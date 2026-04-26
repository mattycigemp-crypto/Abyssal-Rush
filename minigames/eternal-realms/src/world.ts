// ─── PROCEDURAL WORLD GENERATION ───────────────────────────
export interface Chunk {
  x: number;
  y: number;
  tiles: Tile[][];
  enemies: Enemy[];
  items: Item[];
  npcs: NPC[];
  visited: boolean;
}

export enum Tile {
  GRASS, WATER, TREE, ROCK, FLOWER, SAND, SNOW, LAVA,
  RUINS, PORTAL, CHEST, SPIKE, BRIDGE, HOUSE, DUNGEON
}

export const SOLID_TILES = new Set([Tile.TREE, Tile.ROCK, Tile.WATER, Tile.LAVA, Tile.RUINS, Tile.SPIKE, Tile.HOUSE, Tile.DUNGEON]);

export interface Enemy {
  type: string;
  wx: number;
  wy: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  xp: number;
  gold: number;
  alive: boolean;
  ai: 'idle' | 'chase' | 'flee';
  aiTimer: number;
  animTimer: number;
  animFrame: number;
  hitFlash: number;
  aggroRange: number;
}

export interface Item {
  type: string;
  wx: number;
  wy: number;
  collected: boolean;
}

export interface NPC {
  type: string;
  name: string;
  wx: number;
  wy: number;
  pages: string[][];
  page: number;
  met: boolean;
}

const TS = 48; // tile size
const CHUNK_SIZE = 16; // chunk size for procedural generation

export const chunks = new Map<string, Chunk>();

export function getChunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function generateChunk(cx: number, cy: number): Chunk {
  const chunk: Chunk = {
    x: cx, y: cy,
    tiles: [],
    enemies: [],
    items: [],
    npcs: [],
    visited: false
  };
  
  // Use seeded random for consistent generation
  const seed = cx * 374761393 + cy * 668265263;
  const random = seededRandom(seed);
  
  // Generate terrain based on chunk position
  const biome = getBiome(cx, cy, random);
  
  for (let y = 0; y < CHUNK_SIZE; y++) {
    chunk.tiles[y] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      chunk.tiles[y][x] = generateTile(x, y, biome, random);
    }
  }
  
  // Spawn enemies based on biome and difficulty
  const difficulty = Math.abs(cx) + Math.abs(cy);
  spawnEnemies(chunk, biome, difficulty, random);
  
  // Spawn items
  spawnItems(chunk, random);
  
  // Spawn NPCs in safe zones
  if (biome === 'village' && random() > 0.7) {
    spawnNPCs(chunk, random);
  }
  
  return chunk;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function getBiome(cx: number, cy: number, random: () => number): string {
  const dist = Math.sqrt(cx * cx + cy * cy);
  // Use random to add slight variation to biome boundaries
  const variation = random() * 2;
  
  if (dist < 3 + variation) return 'village';
  if (dist < 8 + variation) return 'forest';
  if (dist < 15 + variation) return 'mountains';
  if (dist < 25 + variation) return 'desert';
  if (dist < 35 + variation) return 'swamp';
  if (dist < 50 + variation) return 'tundra';
  return 'chaos';
}

function generateTile(_x: number, _y: number, biome: string, random: () => number): Tile {
  const noise = random();
  
  switch (biome) {
    case 'village':
      if (noise > 0.9) return Tile.HOUSE;
      if (noise > 0.85) return Tile.FLOWER;
      return Tile.GRASS;
      
    case 'forest':
      if (noise > 0.7) return Tile.TREE;
      if (noise > 0.65) return Tile.FLOWER;
      if (noise > 0.6) return Tile.ROCK;
      return Tile.GRASS;
      
    case 'mountains':
      if (noise > 0.8) return Tile.ROCK;
      if (noise > 0.7) return Tile.TREE;
      if (noise > 0.6) return Tile.RUINS;
      return Tile.GRASS;
      
    case 'desert':
      if (noise > 0.85) return Tile.ROCK;
      if (noise > 0.7) return Tile.RUINS;
      return Tile.SAND;
      
    case 'swamp':
      if (noise > 0.6) return Tile.WATER;
      if (noise > 0.5) return Tile.TREE;
      return Tile.GRASS;
      
    case 'tundra':
      if (noise > 0.7) return Tile.ROCK;
      if (noise > 0.6) return Tile.TREE;
      return Tile.SNOW;
      
    case 'chaos':
      if (noise > 0.5) return Tile.LAVA;
      if (noise > 0.4) return Tile.SPIKE;
      if (noise > 0.3) return Tile.PORTAL;
      return Tile.RUINS;
      
    default:
      return Tile.GRASS;
  }
}

function spawnEnemies(chunk: Chunk, biome: string, difficulty: number, random: () => number) {
  const enemyCount = Math.floor(2 + difficulty * 0.5 + random() * 3);
  
  for (let i = 0; i < enemyCount; i++) {
    const x = Math.floor(random() * CHUNK_SIZE);
    const y = Math.floor(random() * CHUNK_SIZE);
    
    // Add bounds checking to prevent array indexing errors
    if (y < 0 || y >= CHUNK_SIZE || x < 0 || x >= CHUNK_SIZE) continue;
    if (!chunk.tiles[y]) continue;
    
    const tile = chunk.tiles[y][x];
    
    if (!SOLID_TILES.has(tile)) {
      const enemyType = getRandomEnemyType(biome, difficulty, random);
      chunk.enemies.push(createEnemy(enemyType, chunk.x * CHUNK_SIZE + x, chunk.y * CHUNK_SIZE + y, difficulty));
    }
  }
}

function getRandomEnemyType(biome: string, _difficulty: number, random: () => number): string {
  const types: Record<string, string[]> = {
    village: ['slime'],
    forest: ['slime', 'wolf', 'goblin'],
    mountains: ['wolf', 'golem', 'harpy'],
    desert: ['scorpion', 'mummy', 'golem'],
    swamp: ['slime', 'witch', 'hydra'],
    tundra: ['wolf', 'yeti', 'ice_golem'],
    chaos: ['demon', 'dragon', 'phoenix']
  };
  
  const biomeTypes = types[biome] || ['slime'];
  return biomeTypes[Math.floor(random() * biomeTypes.length)];
}

function createEnemy(type: string, wx: number, wy: number, difficulty: number): Enemy {
  const baseStats: Record<string, { hp: number; damage: number; speed: number; xp: number; gold: number }> = {
    slime: { hp: 30, damage: 8, speed: 1.1, xp: 20, gold: 10 },
    wolf: { hp: 50, damage: 13, speed: 2.0, xp: 35, gold: 20 },
    goblin: { hp: 40, damage: 15, speed: 1.8, xp: 45, gold: 25 },
    golem: { hp: 90, damage: 22, speed: 0.7, xp: 60, gold: 40 },
    harpy: { hp: 35, damage: 18, speed: 2.5, xp: 50, gold: 30 },
    scorpion: { hp: 45, damage: 20, speed: 1.5, xp: 55, gold: 35 },
    mummy: { hp: 70, damage: 25, speed: 1.2, xp: 70, gold: 50 },
    witch: { hp: 55, damage: 30, speed: 1.0, xp: 80, gold: 45 },
    hydra: { hp: 120, damage: 35, speed: 0.8, xp: 100, gold: 60 },
    yeti: { hp: 100, damage: 28, speed: 1.3, xp: 90, gold: 55 },
    ice_golem: { hp: 110, damage: 32, speed: 0.6, xp: 95, gold: 58 },
    demon: { hp: 150, damage: 45, speed: 1.5, xp: 150, gold: 100 },
    dragon: { hp: 300, damage: 60, speed: 1.0, xp: 300, gold: 200 },
    phoenix: { hp: 200, damage: 50, speed: 2.0, xp: 250, gold: 150 }
  };
  
  const stats = baseStats[type] || baseStats.slime;
  const scaling = 1 + difficulty * 0.1;
  
  return {
    type,
    wx: wx * TS + TS / 2,
    wy: wy * TS + TS / 2,
    hp: Math.floor(stats.hp * scaling),
    maxHp: Math.floor(stats.hp * scaling),
    damage: Math.floor(stats.damage * scaling),
    speed: stats.speed,
    xp: Math.floor(stats.xp * scaling),
    gold: Math.floor(stats.gold * scaling),
    alive: true,
    ai: 'idle',
    aiTimer: Math.random() * 2,
    animTimer: 0,
    animFrame: 0,
    hitFlash: 0,
    aggroRange: 150 + difficulty * 10
  };
}

function spawnItems(chunk: Chunk, random: () => number) {
  const itemCount = Math.floor(random() * 3);
  
  for (let i = 0; i < itemCount; i++) {
    const x = Math.floor(random() * CHUNK_SIZE);
    const y = Math.floor(random() * CHUNK_SIZE);
    
    // Add bounds checking to prevent array indexing errors
    if (y < 0 || y >= CHUNK_SIZE || x < 0 || x >= CHUNK_SIZE) continue;
    if (!chunk.tiles[y]) continue;
    
    const tile = chunk.tiles[y][x];
    
    if (!SOLID_TILES.has(tile)) {
      const itemType = random() > 0.7 ? 'chest' : 'herb';
      chunk.items.push({
        type: itemType,
        wx: chunk.x * CHUNK_SIZE + x,
        wy: chunk.y * CHUNK_SIZE + y,
        collected: false
      });
    }
  }
}

function spawnNPCs(chunk: Chunk, random: () => number) {
  const npcCount = Math.floor(random() * 2) + 1;
  const npcTypes = ['merchant', 'blacksmith', 'healer', 'quest_giver'];
  
  for (let i = 0; i < npcCount; i++) {
    const x = Math.floor(random() * CHUNK_SIZE);
    const y = Math.floor(random() * CHUNK_SIZE);
    
    // Add bounds checking to prevent array indexing errors
    if (y < 0 || y >= CHUNK_SIZE || x < 0 || x >= CHUNK_SIZE) continue;
    if (!chunk.tiles[y]) continue;
    
    const tile = chunk.tiles[y][x];
    
    if (!SOLID_TILES.has(tile)) {
      chunk.npcs.push({
        type: npcTypes[Math.floor(random() * npcTypes.length)],
        name: generateNPCName(random),
        wx: chunk.x * CHUNK_SIZE + x,
        wy: chunk.y * CHUNK_SIZE + y,
        pages: [generateNPCDialogue(random)],
        page: 0,
        met: false
      });
    }
  }
}

function generateNPCName(random: () => number): string {
  const firstNames = ['Aldric', 'Brynna', 'Cedric', 'Dara', 'Elric', 'Fiona', 'Gareth', 'Hilda', 'Ivar', 'Juna'];
  const lastNames = ['Stone', 'Wood', 'Iron', 'Silver', 'Gold', 'Bright', 'Swift', 'Strong', 'Wise', 'Bold'];
  return firstNames[Math.floor(random() * firstNames.length)] + ' ' + lastNames[Math.floor(random() * lastNames.length)];
}

function generateNPCDialogue(random: () => number): string[] {
  const dialogues = [
    ['Greetings, traveler!', 'What brings you to these lands?'],
    ['Be careful out there.', 'Danger lurks in the wild.'],
    ['Looking for adventure?', 'The world is full of mysteries.'],
    ['Trade with me?', 'I have rare goods for sale.'],
    ['Rest here if you must.', 'The road is long.']
  ];
  return dialogues[Math.floor(random() * dialogues.length)];
}
