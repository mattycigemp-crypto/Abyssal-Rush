/**
 * ABYSSAL RUSH: Shop, Currency & Progression System
 * 
 * Currency: Pearls (earned from crystals, completing levels, daily login)
 * Shop Items: Skins, Emotes, Trails, Nameplates
 * Daily Rewards: Login bonuses
 * Achievements: Unlockable milestones
 */

const Shop = {
  // Currency
  pearls: 0,
  
  // Inventory (unlocked items)
  inventory: {
    skins: ['DIVER'], // Default skin unlocked
    emotes: ['WAVE'],
    trails: ['NONE'],
    nameplates: ['DEFAULT']
  },
  
  // Equipped items
  equipped: {
    skin: 'DIVER',
    emote: 'WAVE',
    trail: 'NONE',
    nameplate: 'DEFAULT'
  },
  
  // Daily rewards
  lastLogin: null,
  loginStreak: 0,
  dailyClaimed: false,
  
  // Achievements
  achievements: {},
  
  // Shop items
  items: {
    skins: [
      { id: 'DIVER', name: 'Deep Diver', cost: 0, desc: 'Standard exploration gear', color: '#0af', locked: false },
      { id: 'NEO', name: 'Neo Diver', cost: 500, desc: 'Neon enhanced suit', color: '#0ff', locked: true },
      { id: 'AEGIS', name: 'Aegis Armor', cost: 800, desc: 'Heavy duty protection', color: '#0f8', locked: true },
      { id: 'CRIMSON', name: 'Crimson Diver', cost: 1000, desc: 'Blood-red diving suit', color: '#f04', locked: true },
      { id: 'GOLD', name: 'Golden Diver', cost: 2500, desc: 'Luxury gold plating', color: '#fa0', locked: true },
      { id: 'VOID', name: 'Void Walker', cost: 5000, desc: 'Mysterious dark matter suit', color: '#408', locked: true },
      { id: 'CORAL', name: 'Coral Guardian', cost: 1500, desc: 'Reef protector gear', color: '#f48', locked: true },
      { id: 'BIO', name: 'Bio-Luminescent', cost: 2000, desc: 'Naturally glowing suit', color: '#8f4', locked: true },
      // 🔐 SECRET SKIN: Unlock via Konami Code!
      { id: 'GOLDEN_DIVER', name: '✨ Golden Legend', cost: 0, desc: 'SECRET: Unlocked via Konami Code!', color: '#ffd700', locked: true, secret: true }
    ],
    emotes: [
      { id: 'WAVE', name: 'Wave', cost: 0, desc: 'Friendly greeting', anim: 'wave', locked: false },
      { id: 'DANCE', name: 'Dance', cost: 300, desc: 'Victory dance', anim: 'dance', locked: true },
      { id: 'SALUTE', name: 'Salute', cost: 300, desc: 'Military respect', anim: 'salute', locked: true },
      { id: 'LAUGH', name: 'Laugh', cost: 500, desc: 'Hearty chuckle', anim: 'laugh', locked: true },
      { id: 'CRY', name: 'Cry', cost: 500, desc: 'Tears of defeat', anim: 'cry', locked: true },
      { id: 'RAGE', name: 'Rage', cost: 800, desc: 'Angry outburst', anim: 'rage', locked: true },
      { id: 'HEART', name: 'Heart', cost: 600, desc: 'Show love', anim: 'heart', locked: true },
      { id: 'SLEEP', name: 'Sleep', cost: 400, desc: 'Take a nap', anim: 'sleep', locked: true }
    ],
    trails: [
      { id: 'NONE', name: 'No Trail', cost: 0, desc: 'Clean look', color: null, locked: false },
      { id: 'BUBBLES', name: 'Bubbles', cost: 400, desc: 'Classic bubble trail', color: '#aff', locked: true },
      { id: 'FIRE', name: 'Fire Trail', cost: 800, desc: 'Burning path', color: '#f84', locked: true },
      { id: 'STARS', name: 'Star Dust', cost: 1000, desc: 'Sparkling stardust', color: '#ff8', locked: true },
      { id: 'INK', name: 'Dark Ink', cost: 1200, desc: 'Mysterious black ink', color: '#408', locked: true },
      { id: 'RAINBOW', name: 'Rainbow', cost: 2000, desc: 'Colorful spectrum', color: 'rainbow', locked: true }
    ],
    nameplates: [
      { id: 'DEFAULT', name: 'Default', cost: 0, desc: 'Standard nameplate', style: 'default', locked: false },
      { id: 'GOLD', name: 'Gold Frame', cost: 600, desc: 'Golden border', style: 'gold', locked: true },
      { id: 'ROYAL', name: 'Royal Purple', cost: 800, desc: 'Majestic purple', style: 'royal', locked: true },
      { id: 'ELITE', name: 'Elite Red', cost: 1000, desc: 'Elite status', style: 'elite', locked: true },
      { id: 'LEGEND', name: 'Legendary', cost: 2500, desc: 'For legends only', style: 'legend', locked: true }
    ]
  },
  
  // Achievement definitions
  achievementDefs: [
    { id: 'first_blood', name: 'First Blood', desc: 'Die for the first time', reward: 50, check: (s) => s.deaths >= 1 },
    { id: 'collector', name: 'Crystal Collector', desc: 'Collect 100 crystals in one run', reward: 100, check: (s) => s.crystals >= 100 },
    { id: 'speed_demon', name: 'Speed Demon', desc: 'Complete a level in under 60 seconds', reward: 200, check: (s) => s.bestTime < 3600 },
    { id: 'completionist', name: 'Completionist', desc: 'Complete all 6 levels', reward: 500, check: (s) => s.levelsCompleted >= 6 },
    { id: 'rich', name: 'Wealthy Diver', desc: 'Accumulate 5000 pearls', reward: 300, check: (s) => Shop.pearls >= 5000 },
    { id: 'survivor', name: 'Survivor', desc: 'Reach level 10 in survival mode', reward: 400, check: (s) => s.survivalLevel >= 10 },
    { id: 'untouchable', name: 'Untouchable', desc: 'Complete a level without taking damage', reward: 500, check: (s) => s.noDamageRun },
    { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat 5 bosses', reward: 600, check: (s) => s.bossesDefeated >= 5 },
    { id: 'shopper', name: 'Shopaholic', desc: 'Buy 10 items from the shop', reward: 300, check: (s) => s.itemsBought >= 10 },
    { id: 'master', name: 'Abyssal Master', desc: 'Complete all achievements', reward: 1000, check: (s) => s.totalAchievements >= 9 },
    // 🔐 SECRET ACHIEVEMENTS (Hidden until unlocked)
    { id: 'secret_hunter', name: '🔍 Secret Hunter', desc: 'Find 3 hidden secrets', reward: 500, check: (s) => (window.GameState?.secretsFound?.length || 0) >= 3, secret: true },
    { id: 'konami_master', name: '🎮 Konami Master', desc: 'Enter the Konami Code', reward: 1000, check: (s) => window.GameState?.secretsFound?.includes('KONAMI'), secret: true },
    { id: 'code_breaker', name: '🔐 Code Breaker', desc: 'Type "ABYSS" on title screen', reward: 500, check: (s) => window.GameState?.secretsFound?.includes('ABYSS_CODE'), secret: true }
  ],
  
  // Daily reward tiers
  dailyRewards: [100, 150, 200, 250, 300, 400, 500],
  
  // Load from localStorage
  load() {
    const saved = localStorage.getItem('abyssal_rush_progress');
    if (saved) {
      const data = JSON.parse(saved);
      this.pearls = data.pearls || 0;
      this.inventory = data.inventory || this.inventory;
      this.equipped = data.equipped || this.equipped;
      this.lastLogin = data.lastLogin;
      this.loginStreak = data.loginStreak || 0;
      this.achievements = data.achievements || {};
    }
    this.checkDailyReward();
  },
  
  // Save to localStorage
  save() {
    localStorage.setItem('abyssal_rush_progress', JSON.stringify({
      pearls: this.pearls,
      inventory: this.inventory,
      equipped: this.equipped,
      lastLogin: this.lastLogin,
      loginStreak: this.loginStreak,
      achievements: this.achievements
    }));
  },
  
  // Check daily reward availability
  checkDailyReward() {
    const today = new Date().toDateString();
    const last = this.lastLogin ? new Date(this.lastLogin).toDateString() : null;
    
    if (last !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (last === yesterday.toDateString()) {
        this.loginStreak = Math.min(this.loginStreak + 1, 6);
      } else {
        this.loginStreak = 0;
      }
      this.dailyClaimed = false;
      this.lastLogin = new Date().toISOString();
      this.save();
    } else {
      this.dailyClaimed = true;
    }
  },
  
  // Claim daily reward
  claimDailyReward() {
    if (this.dailyClaimed) return 0;
    
    const reward = this.dailyRewards[Math.min(this.loginStreak, 6)];
    this.pearls += reward;
    this.dailyClaimed = true;
    this.save();
    return reward;
  },
  
  // Buy an item
  buyItem(category, itemId) {
    const item = this.items[category].find(i => i.id === itemId);
    if (!item || !item.locked) return false;
    if (this.pearls < item.cost) return false;
    if (this.inventory[category].includes(itemId)) return false;
    
    this.pearls -= item.cost;
    item.locked = false;
    this.inventory[category].push(itemId);
    this.save();
    return true;
  },
  
  // Equip an item
  equipItem(category, itemId) {
    if (!this.inventory[category].includes(itemId)) return false;
    this.equipped[category] = itemId;
    this.save();
    return true;
  },
  
  // Get equipped skin color
  getEquippedSkinColor() {
    const skin = this.items.skins.find(s => s.id === this.equipped.skin);
    return skin ? skin.color : '#0af';
  },
  
  // Award pearls
  awardPearls(amount) {
    this.pearls += amount;
    this.save();
  },
  
  // Check achievements
  checkAchievements(stats) {
    let newUnlocks = [];
    this.achievementDefs.forEach(ach => {
      if (!this.achievements[ach.id] && ach.check(stats)) {
        this.achievements[ach.id] = { unlocked: true, date: new Date().toISOString() };
        this.pearls += ach.reward;
        newUnlocks.push(ach);
      }
    });
    if (newUnlocks.length > 0) this.save();
    return newUnlocks;
  },
  
  // Get player stats for achievements
  getStats() {
    return {
      pearls: this.pearls,
      deaths: GameState.stats.deaths,
      crystals: GameState.stats.crystals,
      bestTime: GameState.stats.bestTime,
      levelsCompleted: GameState.stats.levelsCompleted,
      survivalLevel: GameState.stats.survivalLevel,
      noDamageRun: GameState.stats.noDamageRun,
      bossesDefeated: GameState.stats.bossesDefeated,
      itemsBought: this.inventory.skins.length + this.inventory.emotes.length + 
                   this.inventory.trails.length + this.inventory.nameplates.length - 4,
      totalAchievements: Object.keys(this.achievements).length
    };
  },
  
  // ========== RANKED SYSTEM ==========
  rankedData: {
    mmr: 1000,
    tier: 'BRONZE',
    rankPoints: 0,
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestWinStreak: 0,
    matchesPlayed: 0,
    season: 1
  },
  
  tiers: [
    { name: 'BRONZE', minMMR: 0, color: '#cd7f32', icon: '🥉' },
    { name: 'SILVER', minMMR: 1200, color: '#c0c0c0', icon: '🥈' },
    { name: 'GOLD', minMMR: 1500, color: '#ffd700', icon: '🥇' },
    { name: 'PLATINUM', minMMR: 1800, color: '#3eb489', icon: '💎' },
    { name: 'DIAMOND', minMMR: 2100, color: '#b9f2ff', icon: '💠' },
    { name: 'MASTER', minMMR: 2400, color: '#9370db', icon: '👑' },
    { name: 'GRANDMASTER', minMMR: 2700, color: '#ff4500', icon: '🔥' },
    { name: 'LEGEND', minMMR: 3000, color: '#ffd700', icon: '⚡' }
  ],
  
  loadRanked() {
    const saved = localStorage.getItem('abyssal_rush_ranked');
    if (saved) {
      this.rankedData = { ...this.rankedData, ...JSON.parse(saved) };
    }
    this.updateTier();
  },
  
  saveRanked() {
    localStorage.setItem('abyssal_rush_ranked', JSON.stringify(this.rankedData));
  },
  
  updateTier() {
    for (let i = this.tiers.length - 1; i >= 0; i--) {
      if (this.rankedData.mmr >= this.tiers[i].minMMR) {
        this.rankedData.tier = this.tiers[i].name;
        break;
      }
    }
  },
  
  // Calculate MMR change based on difficulty and performance
  calculateMMRChange(difficulty, didWin, timeSeconds, crystalsCollected, deaths) {
    const diffIndex = typeof difficulty === 'number' ? difficulty : 1;
    const diffMult = DIFFICULTIES[diffIndex]?.modifiers?.pearlMult || 1;
    
    // Base MMR change
    let change = didWin ? 15 + (diffIndex * 5) : -10;
    
    // Performance modifiers (only for wins)
    if (didWin) {
      // Time bonus
      if (timeSeconds < 60) change += 10;
      else if (timeSeconds < 120) change += 5;
      
      // Crystal collection bonus
      if (crystalsCollected > 50) change += 5;
      if (crystalsCollected > 100) change += 10;
      
      // No death bonus
      if (deaths === 0) change += 15;
      
      // Win streak bonus (capped at 10)
      change += Math.min(this.rankedData.winStreak * 2, 10);
    } else {
      // Penalty reduction for good attempts
      if (crystalsCollected > 30) change += 5;
      if (timeSeconds > 180) change -= 5; // Too slow
    }
    
    return Math.floor(change * diffMult);
  },
  
  // Record a ranked match result
  recordMatch(difficulty, didWin, timeSeconds, crystalsCollected, deaths) {
    const mmrChange = this.calculateMMRChange(difficulty, didWin, timeSeconds, crystalsCollected, deaths);
    
    this.rankedData.mmr = Math.max(0, this.rankedData.mmr + mmrChange);
    this.rankedData.matchesPlayed++;
    
    if (didWin) {
      this.rankedData.wins++;
      this.rankedData.winStreak++;
      this.rankedData.bestWinStreak = Math.max(this.rankedData.bestWinStreak, this.rankedData.winStreak);
      this.rankedData.rankPoints += 10;
    } else {
      this.rankedData.losses++;
      this.rankedData.winStreak = 0;
      this.rankedData.rankPoints = Math.max(0, this.rankedData.rankPoints - 5);
    }
    
    this.updateTier();
    this.saveRanked();
    
    return {
      mmrChange,
      newMMR: this.rankedData.mmr,
      tier: this.rankedData.tier,
      rankPoints: this.rankedData.rankPoints
    };
  },
  
  getRankedStats() {
    const tier = this.tiers.find(t => t.name === this.rankedData.tier);
    return {
      ...this.rankedData,
      tierColor: tier?.color || '#cd7f32',
      tierIcon: tier?.icon || '🥉',
      winRate: this.rankedData.matchesPlayed > 0 ? 
        Math.round((this.rankedData.wins / this.rankedData.matchesPlayed) * 100) : 0
    };
  },
  
  // ========== LEADERBOARD SYSTEM ==========
  leaderboard: {
    global: [],
    friends: [],
    weekly: [],
    survival: []
  },
  
  loadLeaderboard() {
    const saved = localStorage.getItem('abyssal_rush_leaderboard');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.leaderboard = { ...this.leaderboard, ...parsed };
        
        // Sanitize survival runs by checking bounds and re-calculating score
        if (Array.isArray(this.leaderboard.survival)) {
          this.leaderboard.survival = this.leaderboard.survival.filter(entry => {
            if (typeof entry.time !== 'number' || entry.time < 0 || 
                typeof entry.crystals !== 'number' || entry.crystals < 0 || 
                typeof entry.deaths !== 'number' || entry.deaths < 0 ||
                typeof entry.difficulty !== 'number') {
              return false;
            }
            const diffMult = DIFFICULTIES[entry.difficulty]?.modifiers?.pearlMult || 1;
            const expectedScore = Math.floor((entry.crystals * 10 + (10000 / Math.max(entry.time, 1))) * diffMult);
            return Math.abs(entry.score - expectedScore) <= 2;
          });
        }
        
        // Sanitize global leaderboard (MMR bounding)
        if (Array.isArray(this.leaderboard.global)) {
          this.leaderboard.global = this.leaderboard.global.filter(p => {
            return typeof p.mmr === 'number' && p.mmr >= 0 && p.mmr <= 10000 &&
                   typeof p.wins === 'number' && p.wins >= 0 &&
                   typeof p.matches === 'number' && p.matches >= p.wins;
          });
        }
      } catch (e) {
        console.error("Failed to parse leaderboard:", e);
      }
    }
    // No AI placeholders - only real players!
  },
  
  saveLeaderboard() {
    localStorage.setItem('abyssal_rush_leaderboard', JSON.stringify(this.leaderboard));
  },
  
  // No AI placeholders - leaderboard only shows real players!
  
  // Submit player's run to leaderboard
  submitRun(level, time, crystals, deaths, difficulty) {
    const diffMult = DIFFICULTIES[difficulty]?.modifiers?.pearlMult || 1;
    const score = Math.floor((crystals * 10 + (10000 / Math.max(time, 1))) * diffMult);
    
    const entry = {
      name: 'YOU',
      level: level,
      time: time,
      crystals: crystals,
      deaths: deaths,
      difficulty: difficulty,
      score: score,
      date: new Date().toISOString()
    };
    
    // Add to survival leaderboard
    this.leaderboard.survival.push(entry);
    this.leaderboard.survival.sort((a, b) => b.score - a.score);
    this.leaderboard.survival = this.leaderboard.survival.slice(0, 50);
    
    // Update global leaderboard with player's ranked stats
    const username = (typeof Auth !== 'undefined' && Auth.user) ? Auth.user.username : 'Guest';
    const playerEntry = this.leaderboard.global.find(p => p.name === username);
    if (playerEntry) {
      playerEntry.mmr = this.rankedData.mmr;
      playerEntry.tier = this.rankedData.tier;
      playerEntry.wins = this.rankedData.wins;
      playerEntry.matches = this.rankedData.matchesPlayed;
    } else {
      this.leaderboard.global.push({
        rank: 0,
        name: username,
        mmr: this.rankedData.mmr,
        tier: this.rankedData.tier,
        wins: this.rankedData.wins,
        matches: this.rankedData.matchesPlayed,
        isPlayer: true
      });
    }
    
    // Re-sort global
    this.leaderboard.global.sort((a, b) => b.mmr - a.mmr);
    this.leaderboard.global.forEach((p, i) => p.rank = i + 1);
    
    this.saveLeaderboard();
    return entry;
  },
  
  getLeaderboard(type = 'global', limit = 10) {
    return this.leaderboard[type]?.slice(0, limit) || [];
  },
  
  getPlayerRank() {
    const player = this.leaderboard.global.find(p => p.name === 'YOU');
    return player?.rank || this.leaderboard.global.length + 1;
  },
  
  // ========== MULTIPLAYER / GHOST SYSTEM ==========
  ghosts: {
    saved: [],
    active: null
  },
  
  // Record player movement for ghost replay
  recordGhostFrame(frame, x, y, state) {
    if (!this.ghosts.active) {
      this.ghosts.active = {
        frames: [],
        startTime: Date.now(),
        level: window.GameState?.currentLevel || 0,
        character: window.GameState?.selectedChar || 0,
        difficulty: window.GameState?.selectedDifficulty || 1
      };
    }
    
    if (frame % 3 === 0) { // Record every 3rd frame to save space
      this.ghosts.active.frames.push({
        f: frame,
        x: Math.round(x),
        y: Math.round(y),
        s: state // 'run', 'jump', 'dash', etc
      });
    }
  },
  
  // Save completed ghost run
  saveGhostRun(level, time, crystals) {
    if (!this.ghosts.active) return;
    
    const ghost = {
      ...this.ghosts.active,
      time: time,
      crystals: crystals,
      date: new Date().toISOString(),
      id: Date.now()
    };
    
    this.ghosts.saved.push(ghost);
    this.ghosts.saved.sort((a, b) => a.time - b.time);
    this.ghosts.saved = this.ghosts.saved.slice(0, 10); // Keep top 10
    this.ghosts.active = null;
    
    localStorage.setItem('abyssal_rush_ghosts', JSON.stringify(this.ghosts.saved));
  },
  
  loadGhosts() {
    const saved = localStorage.getItem('abyssal_rush_ghosts');
    if (saved) {
      this.ghosts.saved = JSON.parse(saved);
    }
  },
  
  // Get best ghost for a level
  getBestGhost(level, difficulty) {
    return this.ghosts.saved
      .filter(g => g.level === level && g.difficulty === difficulty)
      .sort((a, b) => a.time - b.time)[0] || null;
  },
  
  // Get ghosts near player's skill level
  getMatchmakingGhosts(level, difficulty, count = 3) {
    const matching = this.ghosts.saved.filter(g => 
      g.level === level && 
      g.difficulty === difficulty
    );
    
    if (matching.length >= count) {
      return matching.slice(0, count);
    }
    
    // Generate AI ghosts if not enough
    const needed = count - matching.length;
    const aiGhosts = this.generateAIGhosts(level, difficulty, needed);
    return [...matching, ...aiGhosts];
  },
  
  generateAIGhosts(level, difficulty, count) {
    const ghosts = [];
    const aiNames = ['SpeedRunner', 'CrystalMaster', 'NoDeathPro', 'PerfectDiver', 'ShadowSwimmer'];
    const baseTime = 60 + (level * 30);
    
    for (let i = 0; i < count; i++) {
      ghosts.push({
        name: aiNames[i % aiNames.length],
        level: level,
        difficulty: difficulty,
        time: baseTime + Math.random() * 60,
        crystals: 30 + Math.floor(Math.random() * 50),
        isAI: true,
        frames: this.generateAIFrames(level)
      });
    }
    
    return ghosts;
  },
  
  generateAIFrames(level) {
    // Simplified AI path - would need actual level data for proper paths
    const frames = [];
    let x = 100, y = 300;
    
    for (let f = 0; f < 3600; f += 3) {
      x += 2;
      y += Math.sin(f * 0.01) * 2;
      if (Math.random() < 0.02) y -= 50; // Jump
      frames.push({ f, x: Math.round(x), y: Math.round(y), s: 'run' });
    }
    
    return frames;
  }
};

// Initialize shop on load
Shop.load();
Shop.loadRanked();
Shop.loadLeaderboard();
Shop.loadGhosts();
