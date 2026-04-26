// ─── GAME LOGIC ───────────────────────────────────────────
import { chunks, getChunkKey, Tile, SOLID_TILES, Enemy, NPC } from './world.js';

const TS = 48; // tile size
const CHUNK_SIZE = 16; // chunk size for procedural generation
const VW = 1200, VH = 720;

// ─── CAMERA ──────────────────────────────────────────────
export const camera = { x: 0, y: 0 };

export function updateCamera(player: { wx: number; wy: number }) {
  const targetX = player.wx - VW / 2;
  const targetY = player.wy - VH / 2;
  camera.x += (targetX - camera.x) * 0.1;
  camera.y += (targetY - camera.y) * 0.1;
}

// ─── COLLISION ───────────────────────────────────────────
export function getTileAt(wx: number, wy: number): Tile {
  const cx = Math.floor(wx / TS / CHUNK_SIZE);
  const cy = Math.floor(wy / TS / CHUNK_SIZE);
  const key = getChunkKey(cx, cy);
  
  let chunk = chunks.get(key);
  if (!chunk) {
    // Import generateChunk dynamically to avoid circular dependency
    const { generateChunk } = require('./world.js');
    const newChunk = generateChunk(cx, cy);
    chunks.set(key, newChunk);
    chunk = newChunk;
  }
  
  const localX = Math.floor((wx / TS) % CHUNK_SIZE);
  const localY = Math.floor((wy / TS) % CHUNK_SIZE);
  
  if (localX < 0 || localX >= CHUNK_SIZE || localY < 0 || localY >= CHUNK_SIZE) {
    return Tile.GRASS;
  }
  
  return chunk?.tiles[localY][localX] ?? Tile.GRASS;
}

export function isSolid(wx: number, wy: number): boolean {
  return SOLID_TILES.has(getTileAt(wx, wy));
}

export function collides(wx: number, wy: number, radius: number): boolean {
  const left = wx - radius;
  const right = wx + radius;
  const top = wy - radius;
  const bottom = wy + radius;
  
  for (let y = Math.floor(top / TS); y <= Math.floor(bottom / TS); y++) {
    for (let x = Math.floor(left / TS); x <= Math.floor(right / TS); x++) {
      if (isSolid(x * TS + TS / 2, y * TS + TS / 2)) {
        return true;
      }
    }
  }
  return false;
}

export function tryMove(entity: { wx: number; wy: number }, dx: number, dy: number, radius: number) {
  const newX = entity.wx + dx;
  const newY = entity.wy + dy;
  
  if (!collides(newX, entity.wy, radius)) {
    entity.wx = newX;
  }
  if (!collides(entity.wx, newY, radius)) {
    entity.wy = newY;
  }
}

// ─── ENEMY AI ───────────────────────────────────────────
export function updateEnemies(dt: number, player: { wx: number; wy: number; hp: number; invTimer: number }) {
  chunks.forEach(chunk => {
    chunk.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      
      const dist = Math.hypot(enemy.wx - player.wx, enemy.wy - player.wy);
      
      enemy.animTimer += dt;
      if (enemy.animTimer > 0.2) {
        enemy.animTimer = 0;
        enemy.animFrame = (enemy.animFrame + 1) % 4;
      }
      
      if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
      
      enemy.aiTimer -= dt;
      
      if (dist < enemy.aggroRange) {
        enemy.ai = 'chase';
      } else if (enemy.aiTimer <= 0) {
        enemy.ai = 'idle';
        enemy.aiTimer = 1 + Math.random() * 2;
      }
      
      if (enemy.ai === 'chase') {
        if (dist > 20) {
          const angle = Math.atan2(player.wy - enemy.wy, player.wx - enemy.wx);
          tryMove(enemy, Math.cos(angle) * enemy.speed, Math.sin(angle) * enemy.speed, 15);
        } else if (enemy.aiTimer <= 0 && player.invTimer <= 0) {
          // Attack player - return damage to be handled by caller
          enemy.aiTimer = 1.5 + Math.random() * 0.5;
          return enemy.damage;
        }
      }
    });
  });
  return 0; // No damage dealt this frame
}

// ─── LEVELING SYSTEM ─────────────────────────────────────
export function checkLevelUp(player: { xp: number; level: number; maxHp: number; hp: number; maxStamina: number; stamina: number; upgradePoints: number }) {
  const xpNeeded = player.level * 100 + player.level * player.level * 10;
  
  if (player.xp >= xpNeeded) {
    player.xp -= xpNeeded;
    player.level++;
    player.upgradePoints += 2;
    player.maxHp += 10;
    player.hp = player.maxHp;
    player.maxStamina += 5;
    player.stamina = player.maxStamina;
    
    return true; // Leveled up
  }
  return false;
}

// ─── MISSION PROGRESS ───────────────────────────────────
export function updateKillMissions(missions: any[]) {
  missions.forEach(mission => {
    if (mission.active && !mission.completed && mission.type === 'kill') {
      mission.progress++;
      if (mission.progress >= mission.goal) {
        mission.completed = true;
        mission.active = false;
      }
    }
  });
}

export function completeMission(mission: any, player: { gold: number; xp: number }) {
  mission.completed = true;
  mission.active = false;
  
  player.gold += mission.reward.gold;
  player.xp += mission.reward.xp;
}

// ─── COMBAT ────────────────────────────────────────────
export function getNearbyEnemies(playerX: number, playerY: number, range: number): Enemy[] {
  const nearby: Enemy[] = [];
  
  chunks.forEach(chunk => {
    chunk.enemies.forEach(enemy => {
      if (enemy.alive) {
        const dist = Math.hypot(enemy.wx - playerX, enemy.wy - playerY);
        if (dist < range) {
          nearby.push(enemy);
        }
      }
    });
  });
  
  return nearby;
}

export function performAttack(player: any, range: number = 60) {
  const damage = player.abilities[0].damage + player.strength * 2;
  const nearby = getNearbyEnemies(player.wx, player.wy, range);
  
  nearby.forEach(enemy => {
    if (!enemy.alive) return;
    
    const crit = Math.random() < (0.05 + player.luck * 0.01);
    const finalDamage = crit ? damage * 2 : damage;
    
    enemy.hp -= finalDamage;
    enemy.hitFlash = 0.3;
    
    if (enemy.hp <= 0) {
      enemy.alive = false;
      player.xp += enemy.xp;
      player.gold += enemy.gold;
    }
  });
  
  return nearby.filter(e => !e.alive).length; // Return kill count
}

export function useAbility(player: any, index: number) {
  const ability = player.abilities[index];
  if (!ability.unlocked) return 0;
  
  player.abilityCooldowns[index] = ability.cooldown;
  
  const damage = ability.damage + player.intelligence * 3;
  const range = index === 1 ? 200 : 100; // Fireball has longer range
  const nearby = getNearbyEnemies(player.wx, player.wy, range);
  
  nearby.forEach(enemy => {
    if (!enemy.alive) return;
    enemy.hp -= damage;
    enemy.hitFlash = 0.3;
    
    if (enemy.hp <= 0) {
      enemy.alive = false;
      player.xp += enemy.xp;
      player.gold += enemy.gold;
    }
  });
  
  return nearby.filter(e => !e.alive).length; // Return kill count
}

// ─── INTERACTIONS ───────────────────────────────────────
export function interactWithNPCs(player: { wx: number; wy: number }): { npc: NPC; dialogue: string } | null {
  const playerChunkX = Math.floor(player.wx / TS / CHUNK_SIZE);
  const playerChunkY = Math.floor(player.wy / TS / CHUNK_SIZE);
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = getChunkKey(playerChunkX + dx, playerChunkY + dy);
      const chunk = chunks.get(key);
      
      if (chunk) {
        for (const npc of chunk.npcs) {
          const dist = Math.hypot(npc.wx * TS - player.wx, npc.wy * TS - player.wy);
          if (dist < 80) {
            npc.met = true;
            return { npc, dialogue: npc.pages[0][0] };
          }
        }
      }
    }
  }
  return null;
}

export function collectItems(player: { wx: number; wy: number; hp: number; maxHp: number; gold: number; xp: number }, missions: any[]) {
  const playerChunkX = Math.floor(player.wx / TS / CHUNK_SIZE);
  const playerChunkY = Math.floor(player.wy / TS / CHUNK_SIZE);
  
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = getChunkKey(playerChunkX + dx, playerChunkY + dy);
      const chunk = chunks.get(key);
      
      if (chunk) {
        chunk.items.forEach(item => {
          if (item.collected) return;
          
          const dist = Math.hypot(item.wx * TS - player.wx, item.wy * TS - player.wy);
          if (dist < 40) {
            item.collected = true;
            
            if (item.type === 'chest') {
              const gold = Math.floor(50 + Math.random() * 100);
              player.gold += gold;
            } else if (item.type === 'herb') {
              player.hp = Math.min(player.maxHp, player.hp + 20);
            }
            
            // Update collection missions
            missions.forEach(mission => {
              if (mission.active && !mission.completed && mission.type === 'collect') {
                mission.progress++;
                if (mission.progress >= mission.goal) {
                  completeMission(mission, player);
                }
              }
            });
          }
        });
      }
    }
  }
}
