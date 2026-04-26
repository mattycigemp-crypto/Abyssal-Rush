// ─── RENDERING SYSTEM ─────────────────────────────────────
import { chunks, Tile, Enemy, Item, NPC } from './world.js';
import { camera } from './game.js';

const TS = 48; // tile size
const CHUNK_SIZE = 16; // chunk size for procedural generation
const VW = 1200, VH = 720;
const RENDER_DISTANCE = 2;

let gameTime = 0;

export function setGameTime(time: number) {
  gameTime = time;
}

export function renderWorld(ctx: CanvasRenderingContext2D) {
  const startChunkX = Math.floor(camera.x / TS / CHUNK_SIZE) - RENDER_DISTANCE;
  const endChunkX = Math.floor(camera.x / TS / CHUNK_SIZE) + RENDER_DISTANCE;
  const startChunkY = Math.floor(camera.y / TS / CHUNK_SIZE) - RENDER_DISTANCE;
  const endChunkY = Math.floor(camera.y / TS / CHUNK_SIZE) + RENDER_DISTANCE;
  
  for (let cy = startChunkY; cy <= endChunkY; cy++) {
    for (let cx = startChunkX; cx <= endChunkX; cx++) {
      const key = `${cx},${cy}`;
      let chunk = chunks.get(key);
      
      if (!chunk) {
        // Generate chunk on the fly
        const { generateChunk } = require('./world.js');
        const newChunk = generateChunk(cx, cy);
        chunks.set(key, newChunk);
        chunk = newChunk;
      }
      
      if (!chunk) continue;
      
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const screenX = chunk.x * CHUNK_SIZE * TS + x * TS - camera.x;
          const screenY = chunk.y * CHUNK_SIZE * TS + y * TS - camera.y;
          
          if (screenX > -TS && screenX < VW && screenY > -TS && screenY < VH) {
            renderTile(ctx, chunk.tiles[y][x], screenX, screenY);
          }
        }
      }
    }
  }
}

function renderTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number) {
  switch (tile) {
    case Tile.GRASS:
      ctx.fillStyle = (Math.floor(x / TS) + Math.floor(y / TS)) % 2 === 0 ? '#3a5a35' : '#325530';
      ctx.fillRect(x, y, TS, TS);
      break;
      
    case Tile.WATER:
      ctx.fillStyle = '#2a5a8a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = 'rgba(70, 140, 210, 0.3)';
      ctx.fillRect(x, y + Math.sin(gameTime * 2 + x * 0.1) * 3, TS, TS * 0.2);
      break;
      
    case Tile.TREE:
      ctx.fillStyle = '#3a5a35';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#2a4a2a';
      ctx.beginPath();
      ctx.arc(x + TS / 2, y + TS * 0.4, TS * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a5a3a';
      ctx.beginPath();
      ctx.arc(x + TS / 2 - 3, y + TS * 0.3, TS * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3a2a';
      ctx.fillRect(x + TS * 0.4, y + TS * 0.6, TS * 0.2, TS * 0.4);
      break;
      
    case Tile.ROCK:
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath();
      ctx.ellipse(x + TS / 2, y + TS / 2, TS * 0.35, TS * 0.25, 0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case Tile.FLOWER:
      ctx.fillStyle = '#3a5a35';
      ctx.fillRect(x, y, TS, TS);
      const colors = ['#ff9be0', '#ffdd57', '#ff7c7c', '#b8f0a0', '#c8a0ff'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[(Math.floor(x / TS) + Math.floor(y / TS) + i) % colors.length];
        ctx.beginPath();
        ctx.arc(x + TS * (0.3 + i * 0.2), y + TS * 0.6, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
      
    case Tile.SAND:
      ctx.fillStyle = '#c4a882';
      ctx.fillRect(x, y, TS, TS);
      break;
      
    case Tile.SNOW:
      ctx.fillStyle = '#e8e8f0';
      ctx.fillRect(x, y, TS, TS);
      break;
      
    case Tile.LAVA:
      ctx.fillStyle = '#cc3300';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
      ctx.fillRect(x, y + Math.sin(gameTime * 3 + x * 0.1) * 4, TS, TS * 0.3);
      break;
      
    case Tile.RUINS:
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(x + 5, y + 5, TS - 10, TS - 10);
      break;
      
    case Tile.PORTAL:
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = `hsl(${gameTime * 50 % 360}, 70%, 50%)`;
      ctx.beginPath();
      ctx.arc(x + TS / 2, y + TS / 2, TS * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
      
    case Tile.CHEST:
      ctx.fillStyle = '#3a5a35';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(x + TS * 0.25, y + TS * 0.35, TS * 0.5, TS * 0.3);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(x + TS * 0.3, y + TS * 0.4, TS * 0.4, TS * 0.2);
      break;
      
    case Tile.SPIKE:
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#6a6a6a';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(x + TS * (0.2 + i * 0.3), y + TS * 0.8);
        ctx.lineTo(x + TS * (0.3 + i * 0.3), y + TS * 0.2);
        ctx.lineTo(x + TS * (0.4 + i * 0.3), y + TS * 0.8);
        ctx.fill();
      }
      break;
      
    case Tile.BRIDGE:
      ctx.fillStyle = '#2a5a8a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#6b4520';
      ctx.fillRect(x, y + TS * 0.4, TS, TS * 0.2);
      break;
      
    case Tile.HOUSE:
      ctx.fillStyle = '#3a5a35';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#8b6914';
      ctx.fillRect(x + 5, y + TS * 0.4, TS - 10, TS * 0.6);
      ctx.fillStyle = '#cc3333';
      ctx.beginPath();
      ctx.moveTo(x - 2, y + TS * 0.4);
      ctx.lineTo(x + TS / 2, y - 2);
      ctx.lineTo(x + TS + 2, y + TS * 0.4);
      ctx.fill();
      break;
      
    case Tile.DUNGEON:
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(x, y, TS, TS);
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(x + 8, y + 8, TS - 16, TS - 16);
      break;
      
    default:
      ctx.fillStyle = '#222';
      ctx.fillRect(x, y, TS, TS);
  }
}

export function renderEntities(ctx: CanvasRenderingContext2D) {
  const renderList: Array<{ y: number; render: () => void }> = [];
  
  chunks.forEach(chunk => {
    // Items
    chunk.items.forEach(item => {
      if (!item.collected) {
        renderList.push({
          y: item.wy * TS,
          render: () => renderItem(ctx, item)
        });
      }
    });
    
    // NPCs
    chunk.npcs.forEach(npc => {
      renderList.push({
        y: npc.wy * TS,
        render: () => renderNPC(ctx, npc)
      });
    });
    
    // Enemies
    chunk.enemies.forEach(enemy => {
      if (enemy.alive) {
        renderList.push({
          y: enemy.wy,
          render: () => renderEnemy(ctx, enemy)
        });
      }
    });
  });
  
  // Sort by Y for depth
  renderList.sort((a, b) => a.y - b.y);
  
  renderList.forEach(item => item.render());
}

function renderItem(ctx: CanvasRenderingContext2D, item: Item) {
  const x = item.wx * TS - camera.x;
  const y = item.wy * TS - camera.y;
  
  if (x < -50 || x > VW + 50 || y < -50 || y > VH + 50) return;
  
  const pulse = Math.sin(gameTime * 3) * 3;
  
  if (item.type === 'chest') {
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(x - 12, y - 8 + pulse, 24, 16);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(x - 8, y - 4 + pulse, 16, 8);
  } else {
    ctx.fillStyle = '#44cc44';
    ctx.beginPath();
    ctx.arc(x, y + pulse, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderNPC(ctx: CanvasRenderingContext2D, npc: NPC) {
  const x = npc.wx * TS - camera.x;
  const y = npc.wy * TS - camera.y;
  
  if (x < -60 || x > VW + 60 || y < -60 || y > VH + 60) return;
  
  const bob = Math.sin(gameTime * 1.5) * 2;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 15, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body
  ctx.fillStyle = '#c4a882';
  ctx.fillRect(x - 8, y - 16 + bob, 16, 24);
  
  // Head
  ctx.fillStyle = '#f5c88a';
  ctx.beginPath();
  ctx.arc(x, y - 20 + bob, 10, 0, Math.PI * 2);
  ctx.fill();
  
  // Name tag
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 36, y - 50 + bob, 72, 16);
  ctx.fillStyle = '#ffd980';
  ctx.font = '11px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText(npc.name, x, y - 38 + bob);
}

function renderEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy) {
  const x = enemy.wx - camera.x;
  const y = enemy.wy - camera.y;
  
  if (x < -80 || x > VW + 80 || y < -80 || y > VH + 80) return;
  
  if (enemy.hitFlash > 0) {
    ctx.fillStyle = `rgba(255, 60, 60, ${enemy.hitFlash * 0.7})`;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  
  const bob = Math.sin(gameTime * 3 + enemy.wx * 0.1) * 2;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 15, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Body based on type
  const colors: Record<string, string> = {
    slime: '#3cb54a',
    wolf: '#4a4a6e',
    goblin: '#5a5a3a',
    golem: '#8899aa',
    harpy: '#6a4a8a',
    scorpion: '#8a6a4a',
    mummy: '#8a8a6a',
    witch: '#6a2a8a',
    hydra: '#2a6a4a',
    yeti: '#aaccff',
    ice_golem: '#aaccff',
    demon: '#8a2a2a',
    dragon: '#6a2a2a',
    phoenix: '#ff6600'
  };
  
  ctx.fillStyle = colors[enemy.type] || '#888';
  
  if (enemy.type === 'slime') {
    ctx.beginPath();
    ctx.ellipse(x, y + bob, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.type === 'wolf') {
    ctx.fillRect(x - 15, y - 10 + bob, 30, 20);
    ctx.beginPath();
    ctx.arc(x + 12, y - 5 + bob, 12, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(x - 12, y - 15 + bob, 24, 30);
  }
  
  // HP bar
  const barW = 40;
  const hpPercent = enemy.hp / enemy.maxHp;
  ctx.fillStyle = '#220000';
  ctx.fillRect(x - barW / 2, y - 35, barW, 6);
  ctx.fillStyle = hpPercent > 0.5 ? '#22cc22' : hpPercent > 0.25 ? '#cccc22' : '#cc2222';
  ctx.fillRect(x - barW / 2, y - 35, barW * hpPercent, 6);
}

export function renderPlayer(ctx: CanvasRenderingContext2D, player: any) {
  const x = player.wx - camera.x;
  const y = player.wy - camera.y;
  
  const bob = Math.sin(gameTime * 2) * 2;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 15, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Get skin color
  const skinColors: Record<string, string> = {
    default: '#2a5abf',
    crimson: '#cc3333',
    shadow: '#333366',
    golden: '#cc9900',
    nature: '#336633',
    arcane: '#6633cc',
    frost: '#66ccff',
    inferno: '#ff6600'
  };
  
  const skinColor = skinColors[player.currentSkin] || skinColors.default;
  
  // Body
  ctx.fillStyle = skinColor;
  ctx.fillRect(x - 10, y - 18 + bob, 20, 28);
  
  // Head
  ctx.fillStyle = '#f5c88a';
  ctx.beginPath();
  ctx.arc(x, y - 24 + bob, 11, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes based on facing
  ctx.fillStyle = '#1a1a2e';
  if (player.facing === 'down' || player.facing === 'left' || player.facing === 'right') {
    const ex = player.facing === 'right' ? 3 : player.facing === 'left' ? -3 : 0;
    if (player.facing === 'down') {
      ctx.beginPath();
      ctx.arc(x - 4, y - 24 + bob, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 4, y - 24 + bob, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x + ex, y - 24 + bob, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function renderVignette(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createRadialGradient(VW / 2, VH / 2, VW * 0.28, VW / 2, VH / 2, VW * 0.75);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VW, VH);
}
