# 🌊 ABYSSAL RUSH: DEEP DIVE

A modern underwater platformer game with authentication, cloud saves, and competitive leaderboards.

## 🎮 Features

- **3 Playable Characters** - Each with unique abilities
- **3 Game Modes** - Campaign, Survival, and Bullet Hell
- **6 Difficulty Levels** - From Casual to Abyssal
- **Crystal Collection** - Collect 100 crystals for extra lives
- **Power-ups** - Shield, Magnet, Speed, Double Jump, Extra Life, Weapon
- **Online Authentication** - Sign up/login to save progress
- **Cloud Sync** - Your progress syncs across devices
- **Ranked Matches** - Climb the competitive ladder
- **Leaderboards** - Compete with players worldwide

## 🚀 Deployment to Vercel

### Prerequisites

1. [Vercel Account](https://vercel.com/signup)
2. [Vercel CLI](https://vercel.com/docs/cli) - `npm i -g vercel`

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Vercel KV (Database):**
   ```bash
   vercel link
   vercel env add KV_URL
   vercel env add KV_REST_API_URL
   vercel env add KV_REST_API_TOKEN
   vercel env add KV_REST_API_READ_ONLY_TOKEN
   ```
   
   Get these values from your [Vercel Dashboard](https://vercel.com/dashboard) → Storage → KV → Connect.

3. **Set JWT Secret:**
   ```bash
   vercel env add JWT_SECRET
   ```
   Enter a random string (32+ characters recommended).

### Deploy

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run deploy
```

Or push to GitHub and connect to Vercel for automatic deployments.

## 🔧 Environment Variables

| Variable | Description |
|----------|-------------|
| `KV_URL` | Vercel KV connection URL |
| `KV_REST_API_URL` | Vercel KV REST API URL |
| `KV_REST_API_TOKEN` | Vercel KV write token |
| `KV_REST_API_READ_ONLY_TOKEN` | Vercel KV read token |
| `JWT_SECRET` | Secret key for JWT signing |

## 🎨 Tech Stack

- **Frontend:** Vanilla JavaScript + HTML5 Canvas
- **Backend:** Vercel Serverless Functions (Node.js)
- **Database:** Vercel KV (Redis)
- **Auth:** JWT-based authentication
- **Styling:** CSS3 with glassmorphism effects

## 📁 Project Structure

```
├── api/                    # Serverless API routes
│   └── auth/
│       ├── signup.js       # User registration
│       ├── login.js        # User authentication
│       ├── me.js           # Get current user
│       └── sync.js         # Save/load game data
├── css/
│   └── style.css          # Modern glassmorphism UI
├── js/
│   ├── auth.js            # Client-side auth system
│   ├── game.js            # Main game logic
│   ├── entities.js        # Player, enemies, powerups
│   ├── levels.js          # Level definitions
│   ├── shop.js            # Shop & progression
│   ├── input.js           # Controls & input handling
│   ├── audio.js           # Sound effects
│   ├── particles.js       # FX system
│   ├── config.js          # Game constants
│   └── main.js            # Entry point
├── index.html             # Main page
├── package.json           # Dependencies
├── vercel.json            # Vercel configuration
└── README.md              # This file
```

## 🎯 Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Move | WASD / Arrows | Tap left/right |
| Jump | Space / Z / W / Up | Tap center |
| Dash | X / Shift | Swipe up |
| Shoot | C (Bullet Hell mode) | Auto-fire |

## 🏆 Ranked System

- **Tiers:** Bronze → Silver → Gold → Platinum → Diamond → Master → Legend
- **MMR:** Win matches to gain MMR, lose to drop
- **Rewards:** Higher tiers earn bonus pearls

## 📝 License

MIT License - feel free to use and modify!

---

Made with 💙 for the abyss.
