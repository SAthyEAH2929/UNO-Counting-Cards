import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Node 20+. In-memory state with Vercel serverless + Standalone Node support.
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const MAX_ROOMS = 500;
const colors = ['red', 'blue', 'green', 'yellow'];
const defaults = { boardSize: 24, zeroCount: 10, skipSteps: 1, swapEnabled: true };

const fail = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  throw err;
};

const code = () => randomBytes(4).toString('hex').toUpperCase();
const token = () => randomBytes(24).toString('hex');

function nameOf(value) {
  return String(value || 'Player').trim().slice(0, 24) || 'Player';
}

function optionsOf(x = {}) {
  return {
    boardSize: [16, 24, 32].includes(Number(x.boardSize)) ? Number(x.boardSize) : 24,
    zeroCount: [1, 10].includes(Number(x.zeroCount)) ? Number(x.zeroCount) : 10,
    skipSteps: [1, 2].includes(Number(x.skipSteps)) ? Number(x.skipSteps) : 1,
    swapEnabled: x.swapEnabled !== false
  };
}

function addPlayer(room, name) {
  const p = {
    id: token(),
    name: nameOf(name),
    score: 0,
    rps: null,
    lastSeen: Date.now()
  };
  room.players.push(p);
  return p;
}

function requirePlayer(room, id) {
  const p = room.players.find(p => p.id === id);
  if (!p) fail('Your seat was not found. Rejoin with the room code.', 401);
  return p;
}

function deck(size) {
  return Array.from({ length: size }, (_, i) => ({
    id: i,
    value: i % 8 === 6 ? 'SKIP' : i % 8 === 7 ? 'SWAP' : String(randomInt(10)),
    color: colors[randomInt(4)],
    active: true
  }));
}

function snapshot(room, viewer) {
  const highestScore = room.players.length ? Math.max(...room.players.map(q => q.score)) : 0;
  return {
    code: room.code,
    phase: room.phase,
    version: room.version,
    options: room.options,
    you: viewer,
    host: 0,
    turn: room.turn,
    count: room.count,
    cursor: room.cursor,
    board: room.board,
    lastMove: room.lastMove,
    log: room.log,
    players: room.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: p.score,
      ready: !!p.rps,
      rps: room.phase === 'finished' ? p.rps : (i === viewer ? p.rps : (p.rps ? 'ready' : null)),
      online: Date.now() - p.lastSeen < 20000
    })),
    winners: room.phase === 'finished'
      ? room.players.map((p, i) => ({ seat: i, score: p.score })).filter(p => p.score === highestScore).map(p => p.seat)
      : []
  };
}

function note(room, text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  room.log.unshift(`[${time}] ${text}`);
  room.log = room.log.slice(0, 24);
}

function starter(players) {
  const gestures = [...new Set(players.map(p => p.rps))];
  let eligible = players.map((_, i) => i);
  if (gestures.length === 2) {
    const beats = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const winner = gestures.find(g => beats[g] === gestures.find(h => h !== g));
    if (winner) {
      eligible = eligible.filter(i => players[i].rps === winner);
    }
  }
  return eligible[randomInt(eligible.length)];
}

function start(room) {
  if (room.players.some(p => !p.rps)) {
    fail('Every player must choose rock, paper, or scissors first.');
  }
  room.board = deck(room.options.boardSize);
  room.players.forEach(p => p.score = 0);
  room.turn = starter(room.players);
  room.cursor = -1;
  room.count = 6;
  room.phase = 'playing';
  room.lastMove = null;
  room.log = [];
  note(room, `${room.players[room.turn].name} won the opening draw and starts! Initial count is 6.`);
}

function play(room, seat) {
  if (room.phase !== 'playing') fail('The game is not in progress.');
  if (room.turn !== seat) fail('Wait for your turn.', 409);

  const remaining = room.board.filter(c => c.active);
  if (!remaining.length) fail('The board is empty.');

  const path = [];
  let cursor = room.cursor;
  for (let n = 0; n < room.count; n++) {
    do {
      cursor = (cursor + 1) % room.board.length;
    } while (!room.board[cursor].active);
    path.push(cursor);
  }

  const card = room.board[cursor];
  card.active = false;
  const p = room.players[seat];
  p.score++;

  let next = (seat + 1) % room.players.length;
  let effect = '';

  if (card.value === 'SKIP') {
    next = (seat + 1 + room.options.skipSteps) % room.players.length;
    effect = `⚡ Skip Card! Advancing ${1 + room.options.skipSteps} seats.`;
  } else if (card.value === 'SWAP') {
    if (room.options.swapEnabled && room.players.length > 1) {
      const target = next;
      const prevScore = p.score;
      p.score = room.players[target].score;
      room.players[target].score = prevScore;
      effect = `🔄 Score Swap! Swapped scores with ${room.players[target].name}.`;
    } else {
      effect = 'Score swap is disabled or solo mode.';
    }
  } else {
    room.count = Number(card.value) || room.options.zeroCount;
    effect = `Next move count set to ${room.count}.`;
  }

  room.cursor = cursor;
  room.turn = next;
  room.lastMove = {
    number: room.version + 1,
    seat,
    path,
    card: card.value,
    cardColor: card.color,
    landingIndex: cursor,
    effect
  };

  note(room, `${p.name} landed on Card #${cursor + 1} (${card.value} ${card.color.toUpperCase()}). +1 pt! ${effect}`);

  if (remaining.length === 1) {
    room.phase = 'finished';
    const maxScore = Math.max(...room.players.map(q => q.score));
    const winners = room.players.filter(q => q.score === maxScore).map(q => q.name);
    note(room, `🏆 Board cleared! Winner: ${winners.join(' & ')} (${maxScore} pts).`);
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      fail('Invalid JSON.');
    }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32768) fail('Request payload too large.', 413);
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    fail('Invalid JSON.');
  }
}

function sendJson(res, status, data) {
  if (res.status && typeof res.json === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(status).json(data);
    return;
  }
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

const rateLimitMap = new Map();

export async function handleRequest(req, res) {
  try {
    // Handle CORS pre-flight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Cache-Control': 'no-store'
      });
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = url.pathname;

    // Serve HTML for root
    if (req.method === 'GET' && pathname === '/') {
      const page = await readFile(new URL('./index.html', import.meta.url));
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(page);
      return;
    }

    // Normalize API route (supports /api/xyz or /xyz)
    const apiRoute = pathname.startsWith('/api/') ? pathname.slice(4) : (pathname.startsWith('/api') ? pathname.slice(4) : pathname);

    if (!pathname.startsWith('/api') && pathname !== '/') {
      // Check if it matches an api route directly
      const validEndpoints = ['/state', '/create', '/join', '/rps', '/start', '/play', '/rematch', '/skip-disconnected'];
      if (!validEndpoints.includes(apiRoute)) {
        fail('Not found.', 404);
      }
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let r = rateLimitMap.get(ip);
    if (!r || now - r.since > 60000) {
      r = { since: now, count: 0 };
      rateLimitMap.set(ip, r);
    }
    if (++r.count > 1200) {
      fail('Too many requests. Please slow down.', 429);
    }

    if (req.method === 'GET' && apiRoute === '/state') {
      const roomCode = String(url.searchParams.get('room') || '').trim().toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) fail('Room not found or expired.', 404);

      const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const p = requirePlayer(room, authHeader);
      p.lastSeen = now;
      room.touched = now;

      sendJson(res, 200, snapshot(room, room.players.indexOf(p)));
      return;
    }

    if (req.method !== 'POST') {
      fail('Method not allowed.', 405);
    }

    const b = await parseBody(req);

    if (apiRoute === '/create') {
      if (rooms.size >= MAX_ROOMS) fail('Server room limit reached.', 503);
      let roomCode;
      do {
        roomCode = code();
      } while (rooms.has(roomCode));

      const room = {
        code: roomCode,
        players: [],
        phase: 'lobby',
        version: 1,
        options: optionsOf(b.options),
        board: [],
        turn: 0,
        count: 6,
        cursor: -1,
        lastMove: null,
        log: [],
        touched: now
      };

      const p = addPlayer(room, b.name);
      rooms.set(roomCode, room);
      note(room, `Room created by ${p.name}. Waiting for players...`);

      sendJson(res, 201, {
        token: p.id,
        state: snapshot(room, 0)
      });
      return;
    }

    const roomTargetCode = String(b.room || '').trim().toUpperCase();
    const room = rooms.get(roomTargetCode);
    if (!room) fail('Room code not found or expired.', 404);

    if (apiRoute === '/join') {
      if (room.phase !== 'lobby') fail('This game has already started. Ask host to start a rematch.');
      if (room.players.length >= 4) fail('This room is full (max 4 players).');

      const p = addPlayer(room, b.name);
      room.version++;
      room.touched = now;
      note(room, `${p.name} joined the table.`);

      sendJson(res, 200, {
        token: p.id,
        state: snapshot(room, room.players.length - 1)
      });
      return;
    }

    const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const p = requirePlayer(room, authHeader);
    const seat = room.players.indexOf(p);

    if (b.version !== undefined && b.version !== room.version) {
      fail('The game table updated. Synchronizing, please try again.', 409);
    }

    switch (apiRoute) {
      case '/rps':
        if (room.phase !== 'lobby') fail('Opening moves are already locked.');
        if (!['rock', 'paper', 'scissors'].includes(b.choice)) fail('Invalid RPS choice.');
        p.rps = b.choice;
        note(room, `${p.name} locked in their opening gesture.`);
        break;

      case '/start':
        if (seat !== 0) fail('Only the host can start the game.', 403);
        if (room.phase !== 'lobby') fail('Game is already in progress.');
        if (room.players.length < 2 && !b.practice) {
          fail('Invite another player or start Solo Practice mode.');
        }
        start(room);
        break;

      case '/play':
        play(room, seat);
        break;

      case '/rematch':
        if (seat !== 0) fail('Only the host can initiate a rematch.', 403);
        if (room.phase !== 'finished') fail('Finish the current round before rematching.');
        room.phase = 'lobby';
        room.board = [];
        room.lastMove = null;
        room.players.forEach(q => {
          q.rps = null;
          q.score = 0;
        });
        note(room, 'Rematch lobby opened! Choose rock, paper, or scissors for the new round.');
        break;

      case '/skip-disconnected':
        if (seat !== 0) fail('Only the host can skip disconnected players.', 403);
        if (room.phase !== 'playing') fail('No active game in progress.');
        const currentActive = room.players[room.turn];
        if (now - currentActive.lastSeen < 30000) {
          fail('Player must be inactive/disconnected for at least 30 seconds.');
        }
        note(room, `Host skipped inactive player ${currentActive.name}.`);
        room.turn = (room.turn + 1) % room.players.length;
        break;

      default:
        fail('Endpoint not found.', 404);
    }

    p.lastSeen = now;
    room.touched = now;
    room.version++;
    sendJson(res, 200, { state: snapshot(room, seat) });

  } catch (e) {
    sendJson(res, e.status || 500, {
      error: e.message || 'Internal server error.'
    });
  }
}

// Cleanup stale rooms & rate limits every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rooms) {
    if (now - r.touched > 7200000) rooms.delete(k); // 2 hours
  }
  for (const [k, r] of rateLimitMap) {
    if (now - r.since > 60000) rateLimitMap.delete(k);
  }
}, 120000).unref();

// Run standalone server if executed directly
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun || process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`UNO Counting Cards server running at http://localhost:${PORT}`);
  });
}

export default handleRequest;
