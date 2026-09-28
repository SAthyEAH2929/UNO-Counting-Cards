# 🎴 UNO Counting Cards — Multiplayer Web Game

A fast-paced, real-time multiplayer counting card game inspired by UNO mechanics with modern glassmorphic aesthetics, 3D interactive cards, Web Audio synthesized sound effects, Rock-Paper-Scissors opening draws, and live table synchronization.

---

## ✨ Features

- **🎮 Real-Time Multiplayer & Solo Practice**: Host a private 2–4 player table with an 8-character code, or practice solo against the board.
- **✌️ RPS Opening Draw**: Players select Rock, Paper, or Scissors to decide who takes the first turn.
- **🎴 3D Animated Cards**: Vibrant color palettes (Red, Blue, Green, Yellow), 3D perspective hover tilts, and sequential neon trail pulse animations during countdown.
- **⚡ Special Action Cards**: 
  - `⚡ SKIP`: Advances player turns by 1–2 seats.
  - `🔄 SWAP`: Exchanges scores with the next player in turn order.
  - `0️⃣ ZERO`: Custom next-count multiplier (10 or 1).
- **🔊 Web Audio API Synthesizer**: Fully integrated sound effects (card countdown ticks, landing chords, action swooshes, victory fanfare) with zero external media files.
- **🎉 Canvas Confetti**: Celebratory explosion when a player wins the round.
- **📱 Fully Responsive**: Fluid grid adapting from 8 columns on desktop to 6/4 columns on mobile and tablet.

---

## 🚀 Running Locally

Ensure you have **Node.js 20+** installed:

1. Open your terminal in this project directory:
   ```sh
   npm start
   ```
   *(or `node server.mjs`)*

2. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
3. For local multiplayer testing, open a second browser window or private tab and join with the generated table code!

---

## 🌐 Deploying to Vercel

This repository is pre-configured for instant Vercel deployment with `vercel.json` and `api/index.js` serverless function handlers.

### Option 1: Deploy with Vercel CLI (Fastest)

1. In your project directory, run:
   ```sh
   npx vercel
   ```
2. Follow the interactive prompts:
   - **Set up and deploy?** `Y`
   - **Which scope?** (Select your Vercel account)
   - **Link to existing project?** `N`
   - **What’s your project’s name?** `uno-counting-cards`
   - **In which directory is your code located?** `./`
3. To deploy to production:
   ```sh
   npx vercel --prod
   ```
4. Vercel will output your live URL (e.g. `https://uno-counting-cards.vercel.app`).

---

### Option 2: Deploy via GitHub & Vercel Dashboard

1. Initialize git and push this repository to GitHub:
   ```sh
   git init
   git add .
   git commit -m "Initial commit of UNO Counting Cards"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/uno-web-game.git
   git push -u origin main
   ```
2. Go to **[vercel.com/new](https://vercel.com/new)**.
3. Import your `uno-web-game` repository.
4. Keep the default settings and click **Deploy**.
5. Your web game will be live with continuous deployment on every `git push`!

---

## 📁 Project Architecture

```
├── index.html       # Single-page client with Outfit typography, 3D cards, audio synth & confetti
├── server.mjs       # Authoritative game logic, room management & standalone Node server
├── api/
│   └── index.js     # Vercel Serverless Function router
├── vercel.json      # Vercel rewrite rules for API & static assets
├── package.json     # Node scripts & project metadata
└── README.md        # Documentation and deployment guide
```

---

## 📜 Game Rules Summary

| Rule | Description |
|---|---|
| **Board Setup** | 16, 24, or 32 cards placed face-up in circular row order. |
| **Counting** | Initial count starts at 6. Active cards are counted left-to-right, wrapping circularly. Removed cards are skipped. |
| **Landing** | Landing on a card claims +1 point and removes it. The card's face value sets the next count. |
| **Special Cards** | `SKIP` passes turns; `SWAP` exchanges points with the next player. |
| **Victory** | Once all cards are cleared, the player with the highest score wins! |
