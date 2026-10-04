# 🏃 UNO Snakes, Ladders & Traps — Multiplayer Board Race

A real-time multiplayer board race game where players draw **UNO cards** instead of rolling dice, advancing animated character runner pawns along winding tracks with **Ludo-style knockouts**, **pitfall & freeze traps**, **ladders**, **live table chat**, and **Android TV / Smart TV remote D-Pad support**!

🌐 **Live on Render**: [https://uno-counting-cards-narp.onrender.com](https://uno-counting-cards-narp.onrender.com)

---

## ✨ Features

- **🗺️ 3 Selectable Game Modes / Track Lengths**:
  - **46 Tiles · Quick Match**: Fast loop with snakes and shortcut ladders.
  - **100 Tiles · Classic Championship**: 10x10 serpentine track with balanced traps and ladders.
  - **200 Tiles · Epic Grand Marathon**: 15x14 grand board race for up to 8 players.
- **🏃 Animated Character "Man" Runner Pawns**:
  - Fully animated 3D character pawns with sprinting legs, color-coded player badges, and step-by-step running animation.
- **🎴 UNO Card Draw Movement Engine**:
  - Draw UNO cards (Numbers 0–9, +2, +4 Wild, Skip, Reverse, Swap) to advance your runner across the board.
- **💥 Ludo-Style Knockouts**:
  - Landing on an opponent's tile eliminates their runner and sends them back to START (Tile #1).
- **🕳️ Pitfall & 🪤 Freeze Traps**:
  - **Pitfall Traps 🕳️**: Drops the runner back to START (Tile #1).
  - **Freeze Traps 🪤**: Freezes the runner, causing them to miss their next card draw turn.
- **🪜 Shortcut Ladders**:
  - Climb up ladders to bypass competitors.
- **👥 Up to 8 Players Multiplayer & Solo Practice**:
  - Host private tables with 8-character codes or practice solo.
  - Rock-Paper-Scissors opening draw decides turn order.
- **💬 Real-Time Live Chat & Quick Emojis**:
  - In-game table chat with quick emoji reaction pills.
- **📺 Android TV & Smart TV Support**:
  - **D-Pad Remote Navigation**: Use `▲`, `▼`, `◄`, `►`, and `OK` / `Enter` on any Android TV or Smart TV remote.
  - **10-Foot TV Mode**: High-contrast, scaled-up UI designed for 1080p/4K TV viewing.
  - **Auto-Focus on Turn**: Automatically highlights the card draw button on your turn so you only have to press `OK`.
  - **Auto Camera Tracking**: Automatically centers the track map on the active runner.
  - **Gamepad Controller Support**: Plug-and-play Bluetooth gamepad navigation (Xbox, PlayStation, Android Gamepads).
- **🔊 Web Audio API Synthesizer & Canvas Confetti**:
  - Dynamic audio chords, card flip sounds, footstep effects, trap stings, knockout alerts, and victory confetti.
- **📱 Fully Responsive**:
  - Works seamlessly on Android TVs, mobile phones, tablets, and desktop browsers.

---

## 🚀 Running Locally

Ensure you have **Node.js 20+** installed:

1. Clone and install:
   ```sh
   git clone https://github.com/SAthyEAH2929/UNO-Counting-Cards.git
   cd UNO-Counting-Cards
   ```

2. Start the local server:
   ```sh
   npm start
   ```
   *(or `node server.mjs`)*

3. Open **[http://localhost:3000](http://localhost:3000)** in your browser or Android TV browser.

---

## ☁️ Deployment on Render.com

This repository is configured for automatic zero-downtime deployment on Render.com as a Web Service:

1. Create a **Web Service** on [Render.com](https://render.com).
2. Connect this repository: `https://github.com/SAthyEAH2929/UNO-Counting-Cards.git`.
3. Set the configuration:
   - **Environment**: `Node`
   - **Build Command**: *(leave blank or `npm install`)*
   - **Start Command**: `node server.mjs`
4. Deploy! Every git push to `main` automatically triggers a redeployment.

---

## 📁 Project Structure

```
├── index.html       # Responsive frontend client, 3D animated pawns, TV D-Pad engine, audio & confetti
├── server.mjs       # Authoritative game state engine, 8-player room manager & standalone Node server
├── api/
│   └── index.js     # Serverless router for Vercel/cloud functions
├── vercel.json      # Serverless route rewrites
├── package.json     # Node scripts & dependencies
└── README.md        # Documentation & deployment guide
```

---

## 🎮 Android TV & Remote Key Controls

| Remote / Controller Key | Action |
|---|---|
| **D-Pad `[▲ ▼ ◄ ►]`** | Navigate through buttons, inputs, and controls |
| **`[OK]` / `[Enter]` / `(A)`** | Select button / Draw UNO Card & Run |
| **`[TV Mode]` / `(Y)`** | Toggle 10-Foot Fullscreen TV Mode |
| **`[Back]` / `[Escape]` / `(B)`** | Cancel / Leave Table |
| **`[Select / Start]`** | Toggle Audio Mute |
| **🟩 Green Button** | Draw UNO Card & Run |
| **🟥 Red Button** | Leave Table |
| **🟨 Yellow Button** | Copy Match Invite Link |
| **🟦 Blue Button** | Toggle Sound |

---

## 📜 License
MIT License. Built for real-time multiplayer gaming across Mobile, PC, and Android TVs!
