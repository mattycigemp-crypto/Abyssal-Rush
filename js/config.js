/**
 * ABYSSAL RUSH: Configuration & Constants
 */

const CFG = {
  W: 1280, H: 720,
  GRAV: 0.28, MAX_FALL: 11,
  ACCEL: 0.28, DECEL: 0.92, AIR_ACCEL: 0.18, AIR_DECEL: 0.97, MAX_SPD: 7.5,
  JUMP_FORCE: -6.5, JUMP_HOLD: 12, DOUBLE_JUMP_FORCE: -5.5,
  COYOTE_TIME: 8, JUMP_BUFFER: 8,
  DASH_SPD: 14, DASH_TIME: 10, DASH_CD: 25,
  WALL_SLIDE: 1.2, WALL_JUMP_X: 5.5, WALL_JUMP_Y: -6.5,
  IFRAMES: 100, KNOCKBACK: 5
};

const STATE = { TITLE: 0, PLAY: 1, PAUSE: 2, DEAD: 3, WIN: 4, LEVEL_TRANSITION: 5, CHAR_SELECT: 6, MODE_SELECT: 7, DIFF_SELECT: 8, RANKED: 9, LEADERBOARD: 10, TUTORIAL: 11 };
const POWERUP_TYPES = ['SHIELD', 'MAGNET', 'SPEED', 'DOUBLE_JUMP', 'EXTRA_LIFE', 'WEAPON'];
const CHARACTERS = [
  { id: 0, name: 'DIVER', col: '#0af', lives: 3, spd: 7.5, jump: -6.5, dash: 14, desc: 'BALANCED: The classic explorer.' },
  { id: 1, name: 'NEO', col: '#0ff', lives: 2, spd: 10.0, jump: -7.5, dash: 18, desc: 'SCOUT: Fast but fragile.' },
  { id: 2, name: 'AEGIS', col: '#0f8', lives: 5, spd: 5.5, jump: -5.5, dash: 11, desc: 'TANK: Can take a beating.' }
];
const MODES = [
  { id: 0, name: 'ADVENTURE', desc: 'STORY: EXPLORE THE REEF' },
  { id: 1, name: 'SURVIVAL', desc: 'ENDLESS: DIVE UNTIL DEATH' },
  { id: 2, name: 'BULLET_HELL', desc: '🔥 SHOOT EM UP: DODGE AND DESTROY', shooting: true }
];

// 9 Special Difficulties - Each with unique modifiers
const DIFFICULTIES = [
  { 
    id: 0, name: 'CASUAL', color: '#0f8', 
    desc: 'Relaxing dive. Extra lives, slower enemies.',
    modifiers: { lives: 5, enemySpeed: 0.5, damage: 0.5, pearlMult: 0.5 }
  },
  { 
    id: 1, name: 'DIVER', color: '#0af', 
    desc: 'Standard exploration. Balanced challenge.',
    modifiers: { lives: 3, enemySpeed: 1, damage: 1, pearlMult: 1 }
  },
  { 
    id: 2, name: 'DEEP DIVER', color: '#f80', 
    desc: 'Dangerous waters. More enemies, faster movement.',
    modifiers: { lives: 2, enemySpeed: 1.3, damage: 1.2, pearlMult: 1.5 }
  },
  { 
    id: 3, name: 'ABYSSAL', color: '#f04', 
    desc: 'The deep hunts you. Enemies relentless.',
    modifiers: { lives: 1, enemySpeed: 1.5, damage: 1.5, pearlMult: 2, enemyCount: 1.5 }
  },
  { 
    id: 4, name: 'CRUSH DEPTH', color: '#a0f', 
    desc: 'Pressure kills. Constant HP drain, find crystals to heal!',
    modifiers: { lives: 3, hpDrain: true, enemySpeed: 1.2, damage: 1.3, pearlMult: 2.5 }
  },
  { 
    id: 5, name: 'NO LIGHT', color: '#444', 
    desc: 'Blind dive. Limited vision radius, navigate by sound!',
    modifiers: { lives: 2, vision: 0.3, enemySpeed: 1.1, damage: 1.2, pearlMult: 3 }
  },
  { 
    id: 6, name: 'IRONMAN', color: '#888', 
    desc: 'One life. One chance. No checkpoints. Permadeath.',
    modifiers: { lives: 1, noCheckpoints: true, enemySpeed: 1.2, damage: 1.5, pearlMult: 4 }
  },
  { 
    id: 7, name: 'SPEEDRUN', color: '#ff0', 
    desc: 'Race the clock! Time limit per level, speed boost always on.',
    modifiers: { lives: 2, timeLimit: true, alwaysSpeed: true, enemySpeed: 1, pearlMult: 3.5 }
  },
  { 
    id: 8, name: 'ASCENSION', color: '#f0f', 
    desc: 'UPSIDE DOWN! Start at bottom, swim UP to surface. Gravity reversed!',
    modifiers: { lives: 2, reverseGravity: true, enemySpeed: 1.3, damage: 1.3, pearlMult: 5 }
  }
];

// Math utilities
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const AABB = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Story/Lore
const STORY = {
  intro: [
    "Year 2187. The surface world has fallen.",
    "Humanity's last hope lies beneath the waves...",
    "You are a Deep Diver, exploring the Abyssal Zones.",
    "Collect Glowing Crystals to power the Life Support.",
    "Beware the mutated creatures of the deep.",
    "The Leviathan awaits in the darkest depths...",
    "Good luck, Diver. The future depends on you."
  ],
  levels: [
    "LEVEL 1: TUTORIAL REEF\nA gentle introduction to the depths. Learn the basics of diving.",
    "LEVEL 2: ABYSSAL TRENCH\nThe pressure increases. Strange creatures lurk in the shadows.",
    "LEVEL 3: LEVIATHAN'S LAIR\nThe first guardian awaits. Face the beast!",
    "LEVEL 4: VOLCANIC VENTS\nSuperheated waters and deadly spikes. Stay alert!",
    "LEVEL 5: CRYSTAL CAVERNS\nBioluminescent crystals light the way. But danger is everywhere.",
    "LEVEL 6: THE ABYSS\nThe final challenge. Defeat the Leviathan Queen!"
  ]
};
