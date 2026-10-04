import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  manifestContent,
  swContent,
  icon192Buffer,
  icon512Buffer,
  iconMaskableBuffer,
  screenshotDesktopBuffer,
  screenshotMobileBuffer
} from './assets.mjs';

// Node 20+. In-memory state with Vercel serverless + Standalone Node support.
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map();
const MAX_ROOMS = 500;
const MAX_PLAYERS = 8; // Supports up to 8 players!

const colors = ['red', 'blue', 'green', 'yellow'];
const playerColors = [
  '#facc15', // 0: Gold/Yellow
  '#38bdf8', // 1: Cyan/Blue
  '#4ade80', // 2: Emerald Green
  '#f87171', // 3: Ruby Red
  '#c084fc', // 4: Royal Purple
  '#fb923c', // 5: Flame Orange
  '#f472b6', // 6: Hot Pink
  '#a3e635'  // 7: Electric Lime
];

function getTrackConfig(length = 46) {
  const len = [46, 100, 200].includes(Number(length)) ? Number(length) : 46;
  if (len === 100) {
    return {
      totalTiles: 100,
      ladders: { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91 },
      snakes: { 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 },
      pitfallTraps: [18, 38, 58, 78, 92], // Back to START (Tile 1) 🕳️
      freezeTraps: [12, 26, 46, 68, 86]    // Miss a Turn (Freeze) 🪤
    };
  }
  if (len === 200) {
    return {
      totalTiles: 200,
      ladders: { 10: 35, 25: 60, 45: 85, 70: 120, 95: 140, 130: 175, 160: 192 },
      snakes: { 38: 15, 65: 30, 90: 50, 125: 75, 155: 105, 185: 140, 198: 165 },
      pitfallTraps: [28, 58, 88, 118, 148, 178, 195], // Back to START 🕳️
      freezeTraps: [18, 42, 72, 102, 132, 162, 188]   // Miss a Turn 🪤
    };
  }
  // Default 46 tiles
  return {
    totalTiles: 46,
    ladders: { 7: 33, 12: 36, 24: 42, 37: 44 },
    snakes: { 27: 8, 43: 29, 45: 30 },
    pitfallTraps: [15, 28, 41], // Back to START 🕳️
    freezeTraps: [9, 23, 35]    // Miss a Turn 🪤
  };
}

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
  const trackLen = [46, 100, 200].includes(Number(x.trackLength)) ? Number(x.trackLength) : 46;
  return {
    trackLength: trackLen,
    zeroCount: 10,
    laddersEnabled: x.laddersEnabled !== false,
    killEnabled: x.killEnabled !== false,
    swapEnabled: x.swapEnabled !== false,
    trapsEnabled: x.trapsEnabled !== false
  };
}

function addPlayer(room, name) {
  const seat = room.players.length;
  const p = {
    id: token(),
    name: nameOf(name),
    score: 0,
    position: 1, // Starts at Tile 1 (START)
    kills: 0,
    missTurns: 0,
    rps: null,
    color: playerColors[seat % playerColors.length],
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

function createUnoDeck() {
  const deck = [];
  let id = 1;
  colors.forEach(col => {
    deck.push({ id: id++, value: '0', color: col, type: 'number', steps: 10 });
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: id++, value: String(i), color: col, type: 'number', steps: i });
      deck.push({ id: id++, value: String(i), color: col, type: 'number', steps: i });
    }
    deck.push({ id: id++, value: 'SKIP', color: col, type: 'skip', steps: 0 });
    deck.push({ id: id++, value: 'REVERSE', color: col, type: 'reverse', steps: 0 });
    deck.push({ id: id++, value: 'SWAP', color: col, type: 'swap', steps: 0 });
    deck.push({ id: id++, value: '+2', color: col, type: 'bonus', steps: 2 });
  });
  for (let w = 0; w < 4; w++) {
    deck.push({ id: id++, value: '+4 WILD', color: 'wild', type: 'wild', steps: 4 });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function snapshot(room, viewer) {
  const cfg = getTrackConfig(room.options.trackLength);
  const maxPos = room.players.length ? Math.max(...room.players.map(q => q.position || 1)) : 1;
  return {
    code: room.code,
    phase: room.phase,
    version: room.version,
    options: {
      ...room.options,
      totalTiles: cfg.totalTiles,
      ladders: cfg.ladders,
      snakes: cfg.snakes,
      pitfallTraps: cfg.pitfallTraps,
      freezeTraps: cfg.freezeTraps
    },
    you: viewer,
    host: 0,
    turn: room.turn,
    direction: room.direction || 1,
    deckCount: room.deck ? room.deck.length : 0,
    drawnCard: room.drawnCard,
    lastMove: room.lastMove,
    log: room.log,
    chat: room.chat || [],
    players: room.players.map((p, i) => ({
      seat: i,
      name: p.name,
      score: p.score,
      position: p.position || 1,
      kills: p.kills || 0,
      missTurns: p.missTurns || 0,
      color: p.color || playerColors[i % playerColors.length],
      ready: !!p.rps,
      rps: room.phase === 'finished' ? p.rps : (i === viewer ? p.rps : (p.rps ? 'ready' : null)),
      online: Date.now() - p.lastSeen < 25000
    })),
    winners: room.phase === 'finished'
      ? room.players.map((p, i) => ({ seat: i, position: p.position || 1, kills: p.kills || 0 }))
          .filter(p => p.position >= cfg.totalTiles || p.position === maxPos)
          .map(p => p.seat)
      : []
  };
}

function note(room, text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  room.log.unshift(`[${time}] ${text}`);
  room.log = room.log.slice(0, 30);
}

function addChatMessage(room, sender, seat, text) {
  if (!room.chat) room.chat = [];
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const cleanText = String(text || '').trim().slice(0, 140);
  if (!cleanText) return;
  room.chat.push({
    id: token().slice(0, 8),
    sender,
    seat,
    color: playerColors[seat % playerColors.length],
    text: cleanText,
    time
  });
  if (room.chat.length > 50) room.chat.shift();
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
  room.deck = createUnoDeck();
  room.direction = 1;
  room.drawnCard = null;
  room.players.forEach(p => {
    p.score = 0;
    p.position = 1; // Start at tile 1
    p.kills = 0;
    p.missTurns = 0;
  });
  room.turn = starter(room.players);
  room.phase = 'playing';
  room.lastMove = null;
  room.log = [];
  note(room, `🏁 ${room.players[room.turn].name} won the opening RPS draw and takes the first turn!`);
}

function play(room, seat) {
  if (room.phase !== 'playing') fail('The game is not in progress.');
  if (room.turn !== seat) fail('Wait for your turn.', 409);

  const cfg = getTrackConfig(room.options.trackLength);
  const p = room.players[seat];
  const dir = room.direction || 1;
  let nextSeat = (seat + dir + room.players.length) % room.players.length;

  // 1. Check if player is frozen by a Freeze Trap
  if (p.missTurns > 0) {
    p.missTurns--;
    room.turn = nextSeat;
    room.lastMove = {
      number: room.version + 1,
      seat,
      card: null,
      prevPos: p.position,
      newPos: p.position,
      steps: 0,
      effect: `❄️ ${p.name} is trapped in a Freeze Trap and missed their turn!`,
      knockouts: []
    };
    note(room, `❄️ ${p.name} was trapped and missed their card draw!`);
    return;
  }

  if (!room.deck || room.deck.length === 0) {
    room.deck = createUnoDeck();
  }

  const card = room.deck.pop();
  room.drawnCard = card;

  const prevPos = p.position || 1;
  let steps = card.steps;
  let effect = '';
  let ladderEffect = '';
  let snakeEffect = '';
  let trapEffect = '';
  let knockouts = [];

  if (card.type === 'skip') {
    nextSeat = (seat + dir * 2 + room.players.length * 2) % room.players.length;
    effect = `⚡ SKIP Card! ${room.players[nextSeat].name}'s turn is skipped.`;
  } else if (card.type === 'reverse') {
    room.direction = -dir;
    nextSeat = (seat - dir + room.players.length) % room.players.length;
    effect = `🔁 REVERSE Card! Turn order reversed.`;
  } else if (card.type === 'swap') {
    if (room.options.swapEnabled && room.players.length > 1) {
      const opponents = room.players.filter((_, idx) => idx !== seat);
      const leader = opponents.reduce((prev, curr) => (curr.position > prev.position ? curr : prev), opponents[0]);
      if (leader) {
        const leadPos = leader.position;
        leader.position = prevPos;
        p.position = leadPos;
        effect = `🔄 SWAP Card! Swapped positions with ${leader.name} (Now on Tile ${leadPos})!`;
      }
    } else {
      effect = 'Score swap is disabled or solo mode.';
    }
  } else {
    let newPos = Math.min(cfg.totalTiles, prevPos + steps);
    p.position = newPos;
    effect = `Drawn ${card.color.toUpperCase()} ${card.value} ➔ Moved +${steps} tiles to Tile #${newPos}.`;

    // 1. Check Ladder climb
    if (room.options.laddersEnabled && cfg.ladders[p.position]) {
      const dest = cfg.ladders[p.position];
      ladderEffect = ` 🪜 LADDER CLIMBED! Jumped from Tile #${p.position} ➔ Tile #${dest}!`;
      p.position = dest;
    }

    // 2. Check Snake slide
    if (cfg.snakes[p.position]) {
      const dest = cfg.snakes[p.position];
      snakeEffect = ` 🐍 SLID DOWN! Slid from Tile #${p.position} ➔ Tile #${dest}.`;
      p.position = dest;
    }

    // 3. Check TRAP TILES
    if (room.options.trapsEnabled) {
      // Pitfall Trap (🕳️ sends pawn back to START)
      if (cfg.pitfallTraps.includes(p.position)) {
        trapEffect += ` 🕳️ PITFALL TRAP! ${p.name} fell into a pit on Tile #${p.position} and was sent back to START!`;
        p.position = 1;
      }
      // Freeze Trap (🪤 miss next turn chance)
      else if (cfg.freezeTraps.includes(p.position)) {
        p.missTurns = 1;
        trapEffect += ` 🪤 FREEZE TRAP! Stepped into a trap on Tile #${p.position}! Will miss next card draw chance!`;
      }
    }

    // 4. LUDO KNOCKOUT (KILL) RULE
    if (room.options.killEnabled && p.position > 1 && p.position < cfg.totalTiles) {
      room.players.forEach((target, targetIdx) => {
        if (targetIdx !== seat && target.position === p.position) {
          target.position = 1;
          p.kills = (p.kills || 0) + 1;
          p.score += 2;
          knockouts.push({
            victimSeat: targetIdx,
            victimName: target.name,
            fromTile: p.position,
            toTile: 1,
            killerSeat: seat,
            killerName: p.name
          });
          note(room, `💥 [KNOCKOUT!] ${p.name} eliminated ${target.name} back to START! (+2 PTS)`);
        }
      });
    }
  }

  p.score += 1;
  room.turn = nextSeat;

  room.lastMove = {
    number: room.version + 1,
    seat,
    card,
    prevPos,
    newPos: p.position,
    steps,
    effect: `${effect}${ladderEffect}${snakeEffect}${trapEffect}`,
    knockouts
  };

  note(room, `${p.name} drew [${card.color.toUpperCase()} ${card.value}] ➔ ${effect}${ladderEffect}${snakeEffect}${trapEffect}`);

  if (p.position >= cfg.totalTiles) {
    p.position = cfg.totalTiles;
    room.phase = 'finished';
    note(room, `🏆 ${p.name} REACHED THE FINISH LINE! WINNER!`);
  }
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { fail('Invalid JSON.'); }
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 32768) fail('Request payload too large.', 413);
  }
  try { return JSON.parse(raw || '{}'); } catch { fail('Invalid JSON.'); }
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

    if (req.method === 'GET') {
      if (pathname === '/' || pathname === '/index.html' || pathname === '') {
        try {
          const page = await readFile(new URL('./index.html', import.meta.url));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
          res.end(page);
          return;
        } catch {}
      } else if (pathname === '/manifest.json') {
        res.writeHead(200, {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        });
        res.end(manifestContent);
        return;
      } else if (pathname === '/sw.js') {
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Service-Worker-Allowed': '/',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(swContent);
        return;
      } else if (pathname === '/icon-192.png') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(icon192Buffer);
        return;
      } else if (pathname === '/icon-512.png') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(icon512Buffer);
        return;
      } else if (pathname === '/icon-maskable-512.png') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(iconMaskableBuffer);
        return;
      } else if (pathname === '/screenshot-desktop.png') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(screenshotDesktopBuffer);
        return;
      } else if (pathname === '/screenshot-mobile.png') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(screenshotMobileBuffer);
        return;
      }
    }

    // Resolve API route across Node, Render, and Vercel serverless / rewrites
    let apiRoute = '';
    const actionQuery = url.searchParams.get('action');
    if (actionQuery) {
      apiRoute = '/' + actionQuery.replace(/^\/+/, '');
    } else if (req.query && req.query.action) {
      apiRoute = '/' + String(req.query.action).replace(/^\/+/, '');
    } else if (req.query && req.query.slug) {
      const slug = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
      apiRoute = '/' + slug.replace(/^\/+/, '');
    } else {
      let cleanPath = pathname;
      if (cleanPath.startsWith('/api/')) cleanPath = cleanPath.slice(4);
      else if (cleanPath.startsWith('/api')) cleanPath = cleanPath.slice(4);

      if (cleanPath === '/index.js' || cleanPath === 'index.js') {
        const matched = req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || '';
        if (matched.startsWith('/api/')) {
          cleanPath = matched.slice(4);
        }
      }
      apiRoute = cleanPath;
    }

    apiRoute = apiRoute.split('?')[0];
    if (!apiRoute.startsWith('/')) apiRoute = '/' + apiRoute;

    const validEndpoints = ['/state', '/create', '/join', '/rps', '/start', '/play', '/rematch', '/skip-disconnected', '/chat'];
    if (!validEndpoints.includes(apiRoute)) fail(`Endpoint not found: ${pathname}`, 404);

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    let r = rateLimitMap.get(ip);
    if (!r || now - r.since > 60000) {
      r = { since: now, count: 0 };
      rateLimitMap.set(ip, r);
    }
    if (++r.count > 1500) fail('Too many requests. Please slow down.', 429);

    if (req.method === 'GET' && apiRoute === '/state') {
      const roomCode = String(url.searchParams.get('room') || req.query?.room || '').trim().toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) fail('Room not found or expired.', 404);

      const authHeader = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const p = requirePlayer(room, authHeader);
      p.lastSeen = now;
      room.touched = now;

      sendJson(res, 200, snapshot(room, room.players.indexOf(p)));
      return;
    }

    if (req.method !== 'POST') fail('Method not allowed.', 405);

    const b = await parseBody(req);

    if (apiRoute === '/create') {
      if (rooms.size >= MAX_ROOMS) fail('Server room limit reached.', 503);
      let roomCode;
      do { roomCode = code(); } while (rooms.has(roomCode));

      const room = {
        code: roomCode,
        players: [],
        phase: 'lobby',
        version: 1,
        options: optionsOf(b.options),
        deck: [],
        turn: 0,
        direction: 1,
        drawnCard: null,
        lastMove: null,
        log: [],
        chat: [],
        touched: now
      };

      const p = addPlayer(room, b.name);
      rooms.set(roomCode, room);
      note(room, `Table created by ${p.name} (${room.options.trackLength} Tiles Mode). Up to 8 players!`);

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
      if (room.players.length >= MAX_PLAYERS) fail(`This room is full (max ${MAX_PLAYERS} players).`);

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

    if (apiRoute === '/chat') {
      addChatMessage(room, p.name, seat, b.message);
      room.touched = now;
      sendJson(res, 200, { chat: room.chat });
      return;
    }

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
        room.deck = [];
        room.drawnCard = null;
        room.lastMove = null;
        room.players.forEach(q => {
          q.rps = null;
          q.score = 0;
          q.position = 1;
          q.kills = 0;
          q.missTurns = 0;
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
        room.turn = (room.turn + (room.direction || 1) + room.players.length) % room.players.length;
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

setInterval(() => {
  const now = Date.now();
  for (const [k, r] of rooms) {
    if (now - r.touched > 7200000) rooms.delete(k);
  }
  for (const [k, r] of rateLimitMap) {
    if (now - r.since > 60000) rateLimitMap.delete(k);
  }
}, 120000).unref();

const isDirectRun = process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1].endsWith('server.mjs'));
if (isDirectRun && !process.env.VERCEL) {
  const server = http.createServer(handleRequest);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`UNO Snakes & Ladders (46/100/200 Tiles) running at http://localhost:${PORT}`);
  });
}

export default handleRequest;

