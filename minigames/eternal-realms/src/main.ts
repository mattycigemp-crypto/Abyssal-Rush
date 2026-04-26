// ═══════════════════════════════════════════════════════════
//  ETERNAL REALMS  ·  Infinite Free-Roam RPG Adventure
// ═══════════════════════════════════════════════════════════

import { generateChunk } from './world.js';
import { updateCamera, tryMove, updateEnemies, checkLevelUp, updateKillMissions, completeMission, performAttack, useAbility, interactWithNPCs, collectItems } from './game.js';
import { renderWorld, renderEntities, renderPlayer, renderVignette, setGameTime } from './renderer.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const VW = 1200, VH = 720;
canvas.width = VW; canvas.height = VH;

function resize() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  canvas.style.width = VW * s + 'px';
  canvas.style.height = VH * s + 'px';
}
resize();
addEventListener('resize', resize);

// ─── GAME STATE ───────────────────────────────────────────
enum GameState {
  TITLE, WORLD, UPGRADE, SKIN, PET, MISSION, PAUSE, GAMEOVER
}

let state = GameState.TITLE;
let gameTime = 0;

// ─── CONSTANTS ───────────────────────────────────────────

// ─── PLAYER DATA ─────────────────────────────────────────
const player = {
  wx: 0, wy: 0,
  speed: 3,
  hp: 100, maxHp: 100,
  xp: 0, level: 1,
  gold: 0,
  stamina: 100, maxStamina: 100,
  facing: 'down' as 'up' | 'down' | 'left' | 'right',
  animT: 0, animF: 0,
  invTimer: 0, atkTimer: 0,
  dead: false,
  
  strength: 5,
  agility: 5,
  intelligence: 5,
  vitality: 5,
  luck: 5,
  
  upgradePoints: 0,
  
  currentSkin: 'default',
  unlockedSkins: ['default'],
  
  currentPet: null as string | null,
  unlockedPets: [] as string[],
  
  abilities: [
    { id: 'slash', name: 'Slash', icon: '⚔️', damage: 15, cooldown: 1, manaCost: 0, unlocked: true, description: 'Basic sword attack' },
    { id: 'fireball', name: 'Fireball', icon: '🔥', damage: 35, cooldown: 3, manaCost: 20, unlocked: false, description: 'Launch a fireball' },
    { id: 'frost', name: 'Frost Nova', icon: '❄️', damage: 25, cooldown: 4, manaCost: 25, unlocked: false, description: 'Freeze nearby enemies' },
    { id: 'lightning', name: 'Lightning', icon: '⚡', damage: 50, cooldown: 5, manaCost: 30, unlocked: false, description: 'Strike with lightning' },
    { id: 'shield', name: 'Shield', icon: '🛡️', damage: 0, cooldown: 8, manaCost: 15, unlocked: false, description: 'Temporary damage reduction' }
  ],
  abilityCooldowns: [0, 0, 0, 0, 0]
};

// ─── SKINS ───────────────────────────────────────────────
const skins = [
  { id: 'default', name: 'Adventurer', color: '#2a5abf', cost: 0, description: 'Classic hero look' },
  { id: 'crimson', name: 'Crimson Knight', color: '#cc3333', cost: 500, description: 'Battle-hardened warrior' },
  { id: 'shadow', name: 'Shadow Walker', color: '#333366', cost: 750, description: 'Stealthy assassin' },
  { id: 'golden', name: 'Golden Guardian', color: '#cc9900', cost: 1000, description: 'Divine protector' },
  { id: 'nature', name: 'Nature\'s Child', color: '#336633', cost: 600, description: 'One with the forest' },
  { id: 'arcane', name: 'Arcane Mage', color: '#6633cc', cost: 800, description: 'Master of magic' },
  { id: 'frost', name: 'Frost Walker', color: '#66ccff', cost: 700, description: 'From the frozen north' },
  { id: 'inferno', name: 'Inferno Lord', color: '#ff6600', cost: 1200, description: 'Wielder of flame' }
];

// ─── PETS ────────────────────────────────────────────────
const pets = [
  { id: 'wolf', name: 'Shadow Wolf', icon: '🐺', cost: 1000, bonus: 'damage', bonusValue: 10, description: '+10% damage' },
  { id: 'dragon', name: 'Baby Dragon', icon: '🐉', cost: 2500, bonus: 'health', bonusValue: 20, description: '+20% max health' },
  { id: 'phoenix', name: 'Phoenix', icon: '🔥', cost: 3000, bonus: 'revive', bonusValue: 1, description: 'Auto-revive once per day' },
  { id: 'fairy', name: 'Light Fairy', icon: '✨', cost: 1500, bonus: 'luck', bonusValue: 15, description: '+15% luck' },
  { id: 'golem', name: 'Stone Golem', icon: '🗿', cost: 2000, bonus: 'defense', bonusValue: 15, description: '+15% damage reduction' },
  { id: 'owl', name: 'Wise Owl', icon: '🦉', cost: 1200, bonus: 'xp', bonusValue: 20, description: '+20% XP gain' }
];

// ─── UPGRADES ────────────────────────────────────────────
const upgrades = [
  { id: 'strength', name: 'Strength', description: 'Increase physical damage', cost: 100, maxLevel: 20, currentLevel: 0, effect: (l: number) => `+${l * 5}% damage` },
  { id: 'agility', name: 'Agility', description: 'Increase movement speed', cost: 100, maxLevel: 15, currentLevel: 0, effect: (l: number) => `+${l * 3}% speed` },
  { id: 'intelligence', name: 'Intelligence', description: 'Increase ability damage', cost: 100, maxLevel: 20, currentLevel: 0, effect: (l: number) => `+${l * 4}% ability damage` },
  { id: 'vitality', name: 'Vitality', description: 'Increase maximum health', cost: 100, maxLevel: 20, currentLevel: 0, effect: (l: number) => `+${l * 10} max HP` },
  { id: 'luck', name: 'Luck', description: 'Increase gold and drop rates', cost: 150, maxLevel: 15, currentLevel: 0, effect: (l: number) => `+${l * 5}% luck` },
  { id: 'stamina', name: 'Endurance', description: 'Increase stamina regeneration', cost: 80, maxLevel: 15, currentLevel: 0, effect: (l: number) => `+${l * 4}% stamina regen` },
  { id: 'crit', name: 'Critical Strike', description: 'Increase critical hit chance', cost: 200, maxLevel: 10, currentLevel: 0, effect: (l: number) => `+${l * 2}% crit chance` },
  { id: 'loot', name: 'Treasure Hunter', description: 'Increase gold find', cost: 150, maxLevel: 15, currentLevel: 0, effect: (l: number) => `+${l * 8}% gold` },
  { id: 'mana', name: 'Mana Pool', description: 'Increase mana and reduce costs', cost: 120, maxLevel: 15, currentLevel: 0, effect: (l: number) => `+${l * 5}% mana, -${l * 2}% costs` }
];

// ─── MISSIONS ───────────────────────────────────────────
const missions = [
  { id: 'tutorial_move', title: 'First Steps', description: 'Learn to move around the world', type: 'explore', objective: 'Walk 500 steps', progress: 0, goal: 500, reward: { gold: 50, xp: 100 }, completed: false, active: true, requiredLevel: 1 },
  { id: 'tutorial_kill', title: 'First Blood', description: 'Defeat your first enemy', type: 'kill', objective: 'Defeat 1 enemy', progress: 0, goal: 1, reward: { gold: 75, xp: 150 }, completed: false, active: false, requiredLevel: 1 },
  { id: 'slime_hunter', title: 'Slime Hunter', description: 'The forest is infested with slimes', type: 'kill', objective: 'Defeat 10 slimes', progress: 0, goal: 10, reward: { gold: 200, xp: 300 }, completed: false, active: false, requiredLevel: 2 },
  { id: 'wolf_pack', title: 'Wolf Pack', description: 'A dangerous wolf pack roams the northern woods', type: 'kill', objective: 'Defeat 5 wolves', progress: 0, goal: 5, reward: { gold: 350, xp: 500 }, completed: false, active: false, requiredLevel: 3 },
  { id: 'golem_slayer', title: 'Golem Slayer', description: 'Stone golems have awakened in the mountains', type: 'kill', objective: 'Defeat 3 golems', progress: 0, goal: 3, reward: { gold: 500, xp: 800 }, completed: false, active: false, requiredLevel: 5 },
  { id: 'dragon_hunter', title: 'Dragon Hunter', description: 'A dragon terrorizes the eastern lands', type: 'boss', objective: 'Defeat the dragon', progress: 0, goal: 1, reward: { gold: 2000, xp: 3000, items: ['dragon_scale'] }, completed: false, active: false, requiredLevel: 10, location: 'Dragon\'s Peak' },
  { id: 'herb_gatherer', title: 'Herb Gatherer', description: 'Collect healing herbs for the village', type: 'collect', objective: 'Collect 20 herbs', progress: 0, goal: 20, reward: { gold: 150, xp: 250 }, completed: false, active: false, requiredLevel: 2 },
  { id: 'ore_miner', title: 'Ore Miner', description: 'Mine valuable ores in the caves', type: 'collect', objective: 'Collect 15 iron ore', progress: 0, goal: 15, reward: { gold: 300, xp: 400 }, completed: false, active: false, requiredLevel: 4 },
  { id: 'treasure_seeker', title: 'Treasure Seeker', description: 'Find hidden treasure chests', type: 'collect', objective: 'Open 10 treasure chests', progress: 0, goal: 10, reward: { gold: 1000, xp: 1500 }, completed: false, active: false, requiredLevel: 6 },
  { id: 'world_explorer', title: 'World Explorer', description: 'Discover new lands across the realm', type: 'explore', objective: 'Discover 20 unique locations', progress: 0, goal: 20, reward: { gold: 500, xp: 1000 }, completed: false, active: false, requiredLevel: 3 },
  { id: 'dungeon_delver', title: 'Dungeon Delver', description: 'Explore the depths of ancient dungeons', type: 'explore', objective: 'Complete 5 dungeons', progress: 0, goal: 5, reward: { gold: 800, xp: 1200 }, completed: false, active: false, requiredLevel: 7 },
  { id: 'ruin_explorer', title: 'Ruin Explorer', description: 'Investigate mysterious ancient ruins', type: 'explore', objective: 'Explore 10 ruins', progress: 0, goal: 10, reward: { gold: 600, xp: 900 }, completed: false, active: false, requiredLevel: 5 },
  { id: 'survivalist', title: 'Survivalist', description: 'Survive in the wilderness', type: 'survive', objective: 'Survive 10 minutes without healing', progress: 0, goal: 600, reward: { gold: 400, xp: 600 }, completed: false, active: false, requiredLevel: 4 },
  { id: 'arena_champion', title: 'Arena Champion', description: 'Defeat waves of enemies in the arena', type: 'survive', objective: 'Survive 20 arena waves', progress: 0, goal: 20, reward: { gold: 1500, xp: 2500 }, completed: false, active: false, requiredLevel: 8, location: 'Arena' },
  { id: 'village_defender', title: 'Village Defender', description: 'Protect the village from monster attacks', type: 'defend', objective: 'Defend against 5 waves', progress: 0, goal: 5, reward: { gold: 700, xp: 1000 }, completed: false, active: false, requiredLevel: 6, location: 'Village' },
  { id: 'castle_guard', title: 'Castle Guard', description: 'Defend the castle from siege', type: 'defend', objective: 'Defend against 10 waves', progress: 0, goal: 10, reward: { gold: 1200, xp: 1800 }, completed: false, active: false, requiredLevel: 9, location: 'Castle' },
  { id: 'slime_king', title: 'Slime King', description: 'Defeat the king of all slimes', type: 'boss', objective: 'Defeat the Slime King', progress: 0, goal: 1, reward: { gold: 800, xp: 1200, items: ['slime_crown'] }, completed: false, active: false, requiredLevel: 4, location: 'Slime Cave' },
  { id: 'lich_lord', title: 'Lich Lord', description: 'Destroy the undead Lich Lord', type: 'boss', objective: 'Defeat the Lich Lord', progress: 0, goal: 1, reward: { gold: 1500, xp: 2500, items: ['lich_phylactery'] }, completed: false, active: false, requiredLevel: 12, location: 'Necropolis' },
  { id: 'demon_lord', title: 'Demon Lord', description: 'Banish the Demon Lord back to hell', type: 'boss', objective: 'Defeat the Demon Lord', progress: 0, goal: 1, reward: { gold: 3000, xp: 5000, items: ['demon_horn'] }, completed: false, active: false, requiredLevel: 15, location: 'Inferno' },
  { id: 'speed_demon', title: 'Speed Demon', description: 'Complete missions quickly', type: 'puzzle', objective: 'Complete 5 missions under 2 minutes each', progress: 0, goal: 5, reward: { gold: 1000, xp: 1500 }, completed: false, active: false, requiredLevel: 5 },
  { id: 'perfectionist', title: 'Perfectionist', description: 'Complete missions without taking damage', type: 'puzzle', objective: 'Complete 3 missions flawlessly', progress: 0, goal: 3, reward: { gold: 800, xp: 1200 }, completed: false, active: false, requiredLevel: 7 },
  { id: 'millionaire', title: 'Millionaire', description: 'Amass a fortune', type: 'collect', objective: 'Collect 10,000 gold', progress: 0, goal: 10000, reward: { gold: 5000, xp: 3000 }, completed: false, active: false, requiredLevel: 1 },
  { id: 'max_level', title: 'Legendary Hero', description: 'Reach the maximum level', type: 'puzzle', objective: 'Reach level 50', progress: 0, goal: 50, reward: { gold: 10000, xp: 0, items: ['legendary_crown'] }, completed: false, active: false, requiredLevel: 1 }
];

// ─── INPUT ───────────────────────────────────────────────
const keys: Record<string, boolean> = {};
const keyJustPressed: Record<string, boolean> = {};

addEventListener('keydown', (e) => {
  if (!keys[e.code]) keyJustPressed[e.code] = true;
  keys[e.code] = true;
  e.preventDefault();
});

addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function clearJustPressed() {
  for (const key in keyJustPressed) {
    delete keyJustPressed[key];
  }
}

// ─── SAVE/LOAD SYSTEM ───────────────────────────────────
const SAVE_KEY = 'eternal_realms_save';

function saveGame() {
  const saveData = {
    player: {
      wx: player.wx,
      wy: player.wy,
      speed: player.speed,
      hp: player.hp,
      maxHp: player.maxHp,
      xp: player.xp,
      level: player.level,
      gold: player.gold,
      stamina: player.stamina,
      maxStamina: player.maxStamina,
      strength: player.strength,
      agility: player.agility,
      intelligence: player.intelligence,
      vitality: player.vitality,
      luck: player.luck,
      upgradePoints: player.upgradePoints,
      currentSkin: player.currentSkin,
      unlockedSkins: player.unlockedSkins,
      currentPet: player.currentPet,
      unlockedPets: player.unlockedPets,
      abilities: player.abilities.map(a => ({ id: a.id, unlocked: a.unlocked }))
    },
    upgrades: upgrades.map(u => ({ id: u.id, currentLevel: u.currentLevel })),
    missions: missions.map(m => ({ id: m.id, completed: m.completed, progress: m.progress })),
    gameTime
  };
  
  localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  notify('Game saved!', '#88ffcc');
}

function loadGame() {
  const saveData = localStorage.getItem(SAVE_KEY);
  if (!saveData) {
    notify('No save data found!', '#ff6666');
    return false;
  }
  
  try {
    const data = JSON.parse(saveData);
    
    // Restore player data
    Object.assign(player, data.player);
    player.abilities = data.player.abilities.map((a: any) => ({
      ...player.abilities.find(pa => pa.id === a.id)!,
      unlocked: a.unlocked
    }));
    
    // Restore upgrades
    data.upgrades.forEach((u: any) => {
      const upgrade = upgrades.find(up => up.id === u.id);
      if (upgrade) upgrade.currentLevel = u.currentLevel;
    });
    
    // Restore missions
    data.missions.forEach((m: any) => {
      const mission = missions.find(mis => mis.id === m.id);
      if (mission) {
        mission.completed = m.completed;
        mission.progress = m.progress;
      }
    });
    
    gameTime = data.gameTime;
    
    notify('Game loaded!', '#88ffcc');
    return true;
  } catch (e) {
    notify('Failed to load game!', '#ff6666');
    return false;
  }
}

// ─── NOTIFICATIONS ───────────────────────────────────────
const notifications: Array<{ text: string; color: string; time: number }> = [];

function notify(text: string, color: string = '#ffd980') {
  notifications.push({ text, color, time: 3 });
}

function updateNotifications(dt: number) {
  for (let i = notifications.length - 1; i >= 0; i--) {
    notifications[i].time -= dt;
    if (notifications[i].time <= 0) {
      notifications.splice(i, 1);
    }
  }
  
  const container = document.getElementById('notifications')!;
  container.innerHTML = notifications.map(n => 
    `<div class="notification" style="border-color: ${n.color}; color: ${n.color}">${n.text}</div>`
  ).join('');
}

// ─── UI UPDATE ──────────────────────────────────────────
function updateUI() {
  document.getElementById('hp-bar')!.style.width = `${(player.hp / player.maxHp) * 100}%`;
  document.getElementById('hp-text')!.textContent = `${Math.floor(player.hp)}/${player.maxHp}`;
  
  const xpNeeded = player.level * 100 + player.level * player.level * 10;
  document.getElementById('xp-bar')!.style.width = `${(player.xp / xpNeeded) * 100}%`;
  document.getElementById('xp-text')!.textContent = `${player.xp}/${xpNeeded}`;
  
  document.getElementById('stamina-bar')!.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
  document.getElementById('stamina-text')!.textContent = `${Math.floor(player.stamina)}/${player.maxStamina}`;
  
  document.getElementById('level')!.textContent = player.level.toString();
  document.getElementById('gold')!.textContent = player.gold.toString();
  
  const activeMission = missions.find(m => m.active && !m.completed);
  if (activeMission) {
    document.getElementById('quest-title')!.textContent = activeMission.title;
    document.getElementById('quest-objective')!.textContent = `${activeMission.objective}: ${Math.floor(activeMission.progress)}/${activeMission.goal}`;
  }
  
  // Update ability cooldowns
  for (let i = 0; i < 5; i++) {
    const slot = document.getElementById(`ability-${i + 1}`)!;
    const cooldown = player.abilityCooldowns[i];
    
    if (cooldown > 0) {
      slot.innerHTML = `<div class="ability-cooldown">${cooldown.toFixed(1)}</div><span class="ability-key">${i + 1}</span>`;
      slot.classList.remove('active');
    } else if (player.abilities[i].unlocked) {
      slot.innerHTML = `${player.abilities[i].icon}<span class="ability-key">${i + 1}</span>`;
      slot.classList.add('active');
    } else {
      slot.innerHTML = `🔒<span class="ability-key">${i + 1}</span>`;
      slot.classList.remove('active');
    }
  }
}

// ─── MENU SYSTEMS ────────────────────────────────────────
function toggleMenu(menuState: GameState) {
  if (state === menuState) {
    state = GameState.WORLD;
    updateMenuVisibility();
  } else if (state === GameState.WORLD) {
    state = menuState;
    updateMenuVisibility();
    
    if (menuState === GameState.UPGRADE) populateUpgradeMenu();
    if (menuState === GameState.SKIN) populateSkinMenu();
    if (menuState === GameState.PET) populatePetMenu();
    if (menuState === GameState.MISSION) populateMissionMenu();
  }
}

function updateMenuVisibility() {
  document.getElementById('title-screen')!.classList.toggle('active', state === GameState.TITLE);
  document.getElementById('hud')!.classList.toggle('active', state === GameState.WORLD);
  document.getElementById('upgrade-menu')!.classList.toggle('active', state === GameState.UPGRADE);
  document.getElementById('skin-menu')!.classList.toggle('active', state === GameState.SKIN);
  document.getElementById('pet-menu')!.classList.toggle('active', state === GameState.PET);
  document.getElementById('mission-menu')!.classList.toggle('active', state === GameState.MISSION);
}

// Initialize title screen as active
document.getElementById('title-screen')!.classList.add('active');

function populateUpgradeMenu() {
  const grid = document.getElementById('upgrade-grid')!;
  grid.innerHTML = '';
  
  upgrades.forEach(upgrade => {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <h3>${upgrade.name}</h3>
      <p>${upgrade.description}</p>
      <p>Level: ${upgrade.currentLevel}/${upgrade.maxLevel}</p>
      <p class="upgrade-cost">${upgrade.effect(upgrade.currentLevel)}</p>
      <p class="upgrade-cost">Cost: ${upgrade.cost * (upgrade.currentLevel + 1)} gold</p>
    `;
    
    card.onclick = () => {
      const cost = upgrade.cost * (upgrade.currentLevel + 1);
      if (player.gold >= cost && upgrade.currentLevel < upgrade.maxLevel) {
        player.gold -= cost;
        upgrade.currentLevel++;
        
        switch (upgrade.id) {
          case 'strength': player.strength += 2; break;
          case 'agility': player.speed *= 1.03; break;
          case 'intelligence': break;
          case 'vitality': player.maxHp += 10; player.hp += 10; break;
          case 'luck': player.luck += 2; break;
          case 'stamina': player.maxStamina += 5; break;
        }
        
        notify(`${upgrade.name} upgraded to level ${upgrade.currentLevel}!`, '#88ffcc');
        populateUpgradeMenu();
      } else {
        notify('Not enough gold or max level reached!', '#ff6666');
      }
    };
    
    grid.appendChild(card);
  });
}

function populateSkinMenu() {
  const grid = document.getElementById('skin-grid')!;
  grid.innerHTML = '';
  
  skins.forEach(skin => {
    const card = document.createElement('div');
    card.className = `skin-card ${player.currentSkin === skin.id ? 'selected' : ''}`;
    card.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎭</div>
      <h3>${skin.name}</h3>
      <p>${skin.description}</p>
      <p class="upgrade-cost">${player.unlockedSkins.includes(skin.id) ? 'Owned' : `Cost: ${skin.cost} gold`}</p>
    `;
    
    card.onclick = () => {
      if (player.unlockedSkins.includes(skin.id)) {
        player.currentSkin = skin.id;
        notify(`Equipped ${skin.name}!`, '#88ffcc');
        populateSkinMenu();
      } else if (player.gold >= skin.cost) {
        player.gold -= skin.cost;
        player.unlockedSkins.push(skin.id);
        player.currentSkin = skin.id;
        notify(`Unlocked and equipped ${skin.name}!`, '#88ffcc');
        populateSkinMenu();
      } else {
        notify('Not enough gold!', '#ff6666');
      }
    };
    
    grid.appendChild(card);
  });
}

function populatePetMenu() {
  const grid = document.getElementById('pet-grid')!;
  grid.innerHTML = '';
  
  pets.forEach(pet => {
    const card = document.createElement('div');
    card.className = `pet-card ${player.currentPet === pet.id ? 'active' : ''}`;
    card.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">${pet.icon}</div>
      <h3>${pet.name}</h3>
      <p>${pet.description}</p>
      <p class="upgrade-cost">${pet.bonus}: +${pet.bonusValue}%</p>
      <p class="upgrade-cost">${player.unlockedPets.includes(pet.id) ? 'Owned' : `Cost: ${pet.cost} gold`}</p>
    `;
    
    card.onclick = () => {
      if (player.unlockedPets.includes(pet.id)) {
        player.currentPet = pet.id;
        notify(`${pet.icon} ${pet.name} activated!`, '#88ffcc');
        populatePetMenu();
      } else if (player.gold >= pet.cost) {
        player.gold -= pet.cost;
        player.unlockedPets.push(pet.id);
        player.currentPet = pet.id;
        notify(`${pet.icon} ${pet.name} unlocked!`, '#88ffcc');
        populatePetMenu();
      } else {
        notify('Not enough gold!', '#ff6666');
      }
    };
    
    grid.appendChild(card);
  });
}

function populateMissionMenu() {
  const list = document.getElementById('mission-list')!;
  list.innerHTML = '';
  
  missions.forEach(mission => {
    const item = document.createElement('div');
    item.className = `mission-item ${mission.completed ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="mission-title">${mission.completed ? '✓' : mission.active ? '●' : '○'} ${mission.title}</div>
      <div class="mission-desc">${mission.description}</div>
      <div class="mission-objective">${mission.objective}: ${Math.floor(mission.progress)}/${mission.goal}</div>
      <div class="mission-reward">Reward: ${mission.reward.gold} gold, ${mission.reward.xp} XP</div>
      ${mission.requiredLevel > 1 ? `<div class="mission-reward">Required Level: ${mission.requiredLevel}</div>` : ''}
    `;
    
    list.appendChild(item);
  });
}

// ─── PLAYER UPDATE ───────────────────────────────────────
function updatePlayer(dt: number) {
  if (state !== GameState.WORLD) return;
  
  let dx = 0, dy = 0;
  
  if (keys['ArrowLeft'] || keys['KeyA']) { dx -= player.speed; player.facing = 'left'; }
  if (keys['ArrowRight'] || keys['KeyD']) { dx += player.speed; player.facing = 'right'; }
  if (keys['ArrowUp'] || keys['KeyW']) { dy -= player.speed; player.facing = 'up'; }
  if (keys['ArrowDown'] || keys['KeyS']) { dy += player.speed; player.facing = 'down'; }
  
  if (dx && dy) {
    const len = Math.hypot(dx, dy);
    dx = (dx / len) * player.speed;
    dy = (dy / len) * player.speed;
  }
  
  if (dx || dy) {
    tryMove(player, dx, dy, 12);
    player.animT += dt;
    if (player.animT > 0.15) {
      player.animT = 0;
      player.animF = (player.animF + 1) % 4;
    }
    
    // Update tutorial mission
    const moveMission = missions.find(m => m.id === 'tutorial_move');
    if (moveMission && moveMission.active) {
      moveMission.progress += Math.hypot(dx, dy) * 0.1;
      if (moveMission.progress >= moveMission.goal) {
        completeMission(moveMission, player);
        notify('✓ Mission Complete: First Steps!', '#88ffcc');
      }
    }
  } else {
    player.animF = 0;
  }
  
  // Attack
  if ((keyJustPressed['Space'] || keyJustPressed['KeyE']) && player.atkTimer <= 0) {
    const kills = performAttack(player);
    player.atkTimer = 0.5;
    
    if (kills > 0) {
      updateKillMissions(missions);
      if (checkLevelUp(player)) {
        notify('⬆ Level Up!', '#88ffcc');
        
        // Check for level-based mission unlocks
        missions.forEach(mission => {
          if (!mission.active && !mission.completed && player.level >= mission.requiredLevel) {
            mission.active = true;
            notify(`📜 New Mission: ${mission.title}`, '#88ccff');
          }
        });
      }
    }
  }
  
  // Abilities
  for (let i = 0; i < 5; i++) {
    const key = `Digit${i + 1}`;
    if (keyJustPressed[key] && player.abilities[i].unlocked && player.abilityCooldowns[i] <= 0) {
      useAbility(player, i);
      notify(`${player.abilities[i].icon} ${player.abilities[i].name}!`, '#88ccff');
    }
  }
  
  // Cooldowns
  if (player.atkTimer > 0) player.atkTimer -= dt;
  if (player.invTimer > 0) player.invTimer -= dt;
  for (let i = 0; i < 5; i++) {
    if (player.abilityCooldowns[i] > 0) {
      player.abilityCooldowns[i] -= dt;
    }
  }
  
  // Stamina regeneration
  if (player.stamina < player.maxStamina) {
    player.stamina = Math.min(player.maxStamina, player.stamina + 10 * dt);
  }
  
  // Menu toggles
  if (keyJustPressed['KeyU']) toggleMenu(GameState.UPGRADE);
  if (keyJustPressed['KeyK']) toggleMenu(GameState.SKIN);
  if (keyJustPressed['KeyP']) toggleMenu(GameState.PET);
  if (keyJustPressed['KeyM']) toggleMenu(GameState.MISSION);
  if (keyJustPressed['Escape']) toggleMenu(GameState.PAUSE);
  if (keyJustPressed['KeyS'] && (keys['ControlLeft'] || keys['ControlRight'])) {
    saveGame();
  }
  
  // Interact with NPCs
  if (keyJustPressed['KeyF'] || keyJustPressed['Enter']) {
    const interaction = interactWithNPCs(player);
    if (interaction) {
      notify(`${interaction.npc.name}: "${interaction.dialogue}"`, '#aaddff');
    }
  }
  
  // Collect items
  collectItems(player, missions);
}

// ─── RENDERING ──────────────────────────────────────────
function render() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, VW, VH);
  
  if (state === GameState.TITLE) {
    return; // Title screen is HTML-based
  }
  
  if (state === GameState.GAMEOVER) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#cc3333';
    ctx.font = 'bold 48px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('YOU FELL', VW / 2, VH / 2 - 30);
    ctx.fillStyle = '#888';
    ctx.font = '20px Georgia';
    ctx.fillText('Your journey ends here...', VW / 2, VH / 2 + 20);
    ctx.fillStyle = '#666';
    ctx.font = '16px Georgia';
    ctx.fillText('[Space] Rise Again', VW / 2, VH / 2 + 70);
    return;
  }
  
  // Render world
  renderWorld(ctx);
  
  // Render entities
  renderEntities(ctx);
  
  // Render player
  renderPlayer(ctx, player);
  
  // Render vignette
  renderVignette(ctx);
}

// ─── MAIN LOOP ───────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp: number) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  gameTime += dt;
  
  setGameTime(gameTime);
  
  if (state === GameState.WORLD) {
    updatePlayer(dt);
    const damage = updateEnemies(dt, player);
    if (damage > 0 && player.invTimer <= 0) {
      player.hp -= damage;
      player.invTimer = 1;
      notify(`-${damage} HP`, '#ff6666');
      
      if (player.hp <= 0) {
        player.dead = true;
        state = GameState.GAMEOVER;
      }
    }
    updateCamera(player);
  }
  
  if (state === GameState.GAMEOVER && (keyJustPressed['Space'] || keyJustPressed['Enter'])) {
    player.hp = player.maxHp;
    player.wx = 0;
    player.wy = 0;
    player.dead = false;
    state = GameState.WORLD;
  }
  
  updateNotifications(dt);
  updateUI();
  render();
  
  clearJustPressed();
  requestAnimationFrame(gameLoop);
}

// ─── INITIALIZATION ───────────────────────────────────────
document.getElementById('start-btn')!.addEventListener('click', () => {
  state = GameState.WORLD;
  updateMenuVisibility();
});

document.getElementById('load-btn')!.addEventListener('click', () => {
  if (loadGame()) {
    state = GameState.WORLD;
    updateMenuVisibility();
  }
});

document.getElementById('free-roam-btn')!.addEventListener('click', () => {
  player.level = 5;
  player.gold = 500;
  player.unlockedSkins = ['default', 'crimson', 'shadow'];
  state = GameState.WORLD;
  updateMenuVisibility();
});

// Auto-save every 30 seconds
setInterval(() => {
  if (state === GameState.WORLD) {
    saveGame();
  }
}, 30000);

document.getElementById('close-upgrade-btn')!.addEventListener('click', () => toggleMenu(GameState.UPGRADE));
document.getElementById('close-skin-btn')!.addEventListener('click', () => toggleMenu(GameState.SKIN));
document.getElementById('close-pet-btn')!.addEventListener('click', () => toggleMenu(GameState.PET));
document.getElementById('close-mission-btn')!.addEventListener('click', () => toggleMenu(GameState.MISSION));

// Initialize starting chunk
generateChunk(0, 0);

// Start game loop
requestAnimationFrame(gameLoop);
