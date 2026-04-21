/**
 * Main Game State & Logic
 */

const GameState = {
  state: STATE.TITLE,
  currentLevel: 0,
  stats: { 
    time: 0, deaths: 0, crystals: 0, score: 0, pearls: 0,
    bestTime: Infinity, levelsCompleted: 0, survivalLevel: 0,
    noDamageRun: false, bossesDefeated: 0, itemsBought: 0
  },
  cam: { x: 0, y: 0 },
  scrShake: 0,
  bossDefeated: false,
  levelCompleteTimer: 0,
  selectedChar: 0,
  selectedMode: 0,
  selectedDifficulty: 1, // Default to DIVER
  menuIdx: 0,
  
  // Shop/Story states
  showShop: false,
  shopCategory: 'skins',
  showStory: false,
  storyPage: 0,
  showDaily: false,
  showAchievements: false,
  
  // Emote system
  emoteTimer: 0,
  currentEmote: null,
  
  // Damage tracking for no-damage achievement
  tookDamageThisLevel: false,
  
  // Difficulty mechanic tracking
  hpDrainTimer: 0,
  levelTimeLimit: 0,
  visionRadius: 0,
  
  // Mouse tracking for UI hover effects
  mouseX: 0,
  mouseY: 0,
  
  // 🔐 SECRETS SYSTEM
  secretsFound: [],
  secretCodeBuffer: '',
  konamiCode: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'],
  konamiIdx: 0,
  adminCode: ['KeyA', 'KeyD', 'KeyM', 'KeyI', 'KeyN'], // Type "ADMIN" to get admin powers
  adminIdx: 0,
  
  // 🛡️ ADMIN PANEL
  showAdminPanel: false,
  adminCommandBuffer: '',
  
  player: new Player(),
  enemies: [],
  crystals: [],
  scatteredCrystals: [],
  powerups: [],
  projectiles: [],
  persistedPowerUps: null, // Store power-ups between levels

  // Background image (user's bg.png)
  bgImage: null,
  bgLoaded: false,

  initLevel(lvl = 0) {
    this.currentLevel = lvl;
    let level;
    if (this.selectedMode === 1) { // SURVIVAL
      this.survivalLevel = this.generateSurvivalLevel(lvl);
      level = this.survivalLevel;
      this.player.hasDoubleJump = true;
      this.player.canShoot = false;
    } else if (this.selectedMode === 2) { // BULLET_HELL
      this.survivalLevel = this.generateBulletHellLevel(lvl);
      level = this.survivalLevel;
      this.player.hasDoubleJump = true;
      this.player.canShoot = true;
      this.player.weaponLevel = 1;
    } else {
      level = LEVELS[Math.min(lvl, LEVELS.length - 1)];
      this.survivalLevel = null;
      // Don't reset power-ups here - we'll restore them after player reset
    }

    this.enemies = level.enemies.map(e => new Enemy(e));
    if (level.boss) this.enemies.push(new Enemy(level.boss));
    this.crystals = level.crystals.map(p => ({ ...p, col: false, vx: 0, vy: 0 }));
    this.scatteredCrystals = [];
    this.powerups = (level.powerups || []).map(p => new PowerUp(p));
    
    // Snap powerups and checkpoints to surfaces
    const snapToSurface = (entity, xPos, isPowerUp) => {
      let nearestY = 99999;
      for (const plat of level.platforms) {
        // Simple bounding box alignment (center x of entity over platform)
        if (xPos >= plat.x && xPos <= plat.x + plat.w && plat.y >= entity.y) {
          if (plat.y < nearestY) {
            nearestY = plat.y;
          }
        }
      }
      if (nearestY !== 99999) {
        if (isPowerUp) entity.y = nearestY - entity.h;
        else entity.y = nearestY; // Checkpoint Y is the base
      }
    };
    
    this.powerups.forEach(p => snapToSurface(p, p.x + p.w / 2, true));
    if (level.checkpoints) level.checkpoints.forEach(cp => snapToSurface(cp, cp.x, false));

    this.projectiles = [];
    // Apply difficulty modifiers
    const diff = DIFFICULTIES[this.selectedDifficulty];
    const char = CHARACTERS[this.selectedChar];
    
    // Override lives based on difficulty
    let startLives = char.lives;
    if (diff.modifiers.lives) startLives = diff.modifiers.lives;
    
    // Reverse gravity for Ascension mode
    if (diff.modifiers.reverseGravity) {
      this.player.reverseGravity = true;
    } else {
      this.player.reverseGravity = false;
    }
    
    // Spawn player above spawn Y to prevent spawning inside platform/hazards
    const spawnY = level.spawn.y - 28; // Player height is 28
    this.player.reset(level.spawn.x, spawnY, char);
    this.player.lives = startLives;
    this.player.maxLives = startLives;
    
    // Clear persisted power-ups at the start of a completely new adventure
    if (lvl === 0) {
      this.persistedPowerUps = null;
    }

    // Restore persisted power-ups (for Adventure mode level transitions)
    if (this.persistedPowerUps && this.selectedMode === 0) {
      this.player.hasDoubleJump = this.persistedPowerUps.hasDoubleJump;
      this.player.shield = this.persistedPowerUps.shield;
      this.player.magnet = this.persistedPowerUps.magnet;
      this.player.speedBoost = this.persistedPowerUps.speedBoost;
      this.player.canShoot = this.persistedPowerUps.canShoot;
      this.player.weaponLevel = this.persistedPowerUps.weaponLevel;
      this.player.spreadShot = this.persistedPowerUps.spreadShot;
      this.player.rapidFire = this.persistedPowerUps.rapidFire;
    }

    // Apply always speed for Speedrun mode
    if (diff.modifiers.alwaysSpeed) {
      this.player.speedBoost = 999999;
    }
    
    // Initialize CRUSH DEPTH HP drain
    if (diff.modifiers.hpDrain) {
      this.hpDrainTimer = 180; // 3 seconds before first drain
      this.player.lives = this.player.maxLives;
    } else {
      this.hpDrainTimer = 0;
    }
    
    // Initialize SPEEDRUN time limit
    if (diff.modifiers.timeLimit) {
      this.levelTimeLimit = 1800; // 30 seconds per level (at 60fps)
    } else {
      this.levelTimeLimit = 0;
    }
    
    // Initialize NO LIGHT vision radius
    if (diff.modifiers.vision) {
      this.visionRadius = CFG.W * diff.modifiers.vision;
    } else {
      this.visionRadius = 0;
    }
    
    this.cam.x = this.player.x - CFG.W / 2;
    this.cam.y = this.player.y - CFG.H / 2;
    this.bossDefeated = false;
    this.levelCompleteTimer = 0;
    this.tookDamageThisLevel = false;
    
    // Sync pearls from Shop system
    this.stats.pearls = Shop.pearls;

    if (!this.bgImage) {
      this.bgImage = new Image();
      this.bgImage.onload = () => { this.bgLoaded = true; };
      this.bgImage.src = 'bg.png';
    }
  },

  generateSurvivalLevel(seed) {
    const w = 4000 + seed * 1000;
    const h = 1000;
    const platforms = [{ x: 0, y: 400, w: 400, h: 40 }];
    const enemies = [];
    const crystals = [];
    const hazards = [{ x: 0, y: 950, w: w, h: 50 }];

    for (let i = 400; i < w - 400; i += 300) {
      const py = 300 + Math.random() * 300;
      platforms.push({ x: i, y: py, w: 150 + Math.random() * 100, h: 30 });
      if (Math.random() > 0.5) enemies.push({ x: i + 50, y: py - 40, type: 'eel' });
      for (let j = 0; j < 5; j++) crystals.push({ x: i + j * 25, y: py - 40 });
    }
    platforms.push({ x: w - 300, y: 400, w: 300, h: 40 });

    return {
      w, h, platforms, hazards, enemies, crystals, powerups: [], checkpoints: [], springs: [],
      spawn: { x: 50, y: 322 }, // y adjusted for player height (350 - 28)
      goal: { x: w - 100, y: 350 }
    };
  },

  // 🔥 Generate BULLET HELL level - Lots of enemies and weapon powerups!
  generateBulletHellLevel(seed) {
    const w = 5000 + seed * 1500;
    const h = 1000;
    const platforms = [{ x: 0, y: 500, w: 500, h: 40 }];
    const enemies = [];
    const crystals = [];
    const powerups = [];
    const hazards = [{ x: 0, y: 950, w: w, h: 50 }];

    // Denser platforms and enemies
    for (let i = 500; i < w - 500; i += 250) {
      const py = 250 + Math.random() * 400;
      platforms.push({ x: i, y: py, w: 120 + Math.random() * 80, h: 25 });
      
      // More enemies in bullet hell!
      if (Math.random() > 0.3) {
        const types = ['eel', 'crab', 'jelly', 'puffer'];
        const type = types[Math.floor(Math.random() * types.length)];
        enemies.push({ x: i + 30, y: py - 40, type });
      }
      if (Math.random() > 0.5) {
        enemies.push({ x: i + 60, y: py - 60, type: 'eel' });
      }
      
      // Crystals scattered
      for (let j = 0; j < 3; j++) crystals.push({ x: i + j * 30, y: py - 50 });
      
      // Weapon powerups every few platforms
      if (i % 1500 === 0) {
        powerups.push({ x: i + 50, y: py - 100, type: 'WEAPON' });
      }
      
      // Regular powerups too
      if (Math.random() > 0.7) {
        const types = ['SHIELD', 'SPEED', 'DOUBLE_JUMP'];
        const type = types[Math.floor(Math.random() * types.length)];
        powerups.push({ x: i + 80, y: py - 80, type });
      }
    }
    platforms.push({ x: w - 400, y: 500, w: 400, h: 40 });
    
    // Boss at the end
    enemies.push({ x: w - 200, y: 450, type: 'boss', isBoss: true });

    return {
      w, h, platforms, hazards, enemies, crystals, powerups, checkpoints: [], springs: [],
      spawn: { x: 50, y: 422 }, // y adjusted for player height (450 - 28)
      goal: { x: w - 100, y: 450 }
    };
  },

  togglePause() {
    if (this.state === STATE.PLAY) this.state = STATE.PAUSE;
    else if (this.state === STATE.PAUSE) this.state = STATE.PLAY;
  },

  resetToCheckpoint() {
    const level = (this.selectedMode === 1 && this.survivalLevel) ? this.survivalLevel : LEVELS[this.currentLevel];
    
    // IRONMAN: No checkpoints - always respawn at level start
    const diff = DIFFICULTIES[this.selectedDifficulty];
    let cp = level.spawn;
    
    if (!diff.modifiers.noCheckpoints) {
      // Normal mode: use activated checkpoints
      for (let c of level.checkpoints) {
        if (this.player.x >= c.x) cp = c;
      }
    }
    
    // Spawn player above checkpoint Y to prevent spawning inside platform/hazards
    // Player height is 28, so spawn 28 pixels above checkpoint Y
    const spawnY = cp.y - 28;
    this.player.reset(cp.x, spawnY, this.player.stats);
    this.player.inv = 120;
    
    // Restore powerups that the player had when reaching this checkpoint/level
    if (this.persistedPowerUps && this.selectedMode === 0) {
      this.player.hasDoubleJump = this.persistedPowerUps.hasDoubleJump;
      this.player.shield = this.persistedPowerUps.shield;
      this.player.magnet = this.persistedPowerUps.magnet;
      this.player.speedBoost = this.persistedPowerUps.speedBoost;
      this.player.canShoot = this.persistedPowerUps.canShoot;
      this.player.weaponLevel = this.persistedPowerUps.weaponLevel;
      this.player.spreadShot = this.persistedPowerUps.spreadShot;
      this.player.rapidFire = this.persistedPowerUps.rapidFire;
    }
  },

  nextLevel() {
    // Award pearls for completing level (with difficulty multiplier)
    const diff = DIFFICULTIES[this.selectedDifficulty];
    const levelPearls = Math.floor((50 + (this.currentLevel * 25)) * diff.modifiers.pearlMult);
    this.stats.pearls += levelPearls;
    Shop.awardPearls(levelPearls);
    
    // Update stats
    this.stats.levelsCompleted = Math.max(this.stats.levelsCompleted, this.currentLevel + 1);
    if (!this.tookDamageThisLevel) {
      this.stats.noDamageRun = true;
    }
    
    // Check for new achievements
    const newAchievements = Shop.checkAchievements({
      pearls: this.stats.pearls,
      deaths: this.stats.deaths,
      crystals: this.stats.crystals,
      bestTime: this.stats.time,
      levelsCompleted: this.stats.levelsCompleted,
      survivalLevel: this.stats.survivalLevel,
      noDamageRun: this.stats.noDamageRun,
      bossesDefeated: this.stats.bossesDefeated,
      itemsBought: this.stats.itemsBought
    });
    
    if (newAchievements.length > 0) {
      console.log('New achievements unlocked:', newAchievements.map(a => a.name));
    }
    
    // Record ranked match and submit to leaderboard
    const levelTime = this.stats.time - (this.lastLevelTime || 0);
    this.lastLevelTime = this.stats.time;
    
    if (typeof Shop !== 'undefined') {
      // Record as ranked win
      const rankedResult = Shop.recordMatch(
        this.selectedDifficulty,
        true,
        levelTime,
        this.stats.crystals,
        this.stats.deaths
      );
      console.log('Ranked match completed:', rankedResult);
      
      // Submit to leaderboard
      Shop.submitRun(this.currentLevel, levelTime, this.stats.crystals, this.stats.deaths, this.selectedDifficulty);
      
      // Save ghost run
      Shop.saveGhostRun(this.currentLevel, levelTime, this.stats.crystals);
    }
    
    this.currentLevel++;
    if (this.currentLevel < LEVELS.length) {
      this.initLevel(this.currentLevel);
    } else {
      this.state = STATE.WIN;
      if (this.stats.time < this.stats.bestTime) this.stats.bestTime = this.stats.time;
    }
  },

  update() {
    Input.update();

    // 🛡️ ADMIN PANEL - toggle with tilde/backtick
    if (Input.justPressed('Backquote') && typeof Auth !== 'undefined' && Auth.isMod()) {
      this.showAdminPanel = !this.showAdminPanel;
    }
    
    if (this.showAdminPanel) {
      // Admin panel blocks other input
      if (Input.justPressed('Jump')) {
        this.showAdminPanel = false;
      }
      return; // Skip other updates when admin panel is open
    }

    if (this.state === STATE.TITLE) {
      // Title menu options - include LOGOUT if logged in, ADMIN for mods
      let baseOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
      
      // Add ADMIN option for mods/admins
      if (typeof Auth !== 'undefined' && Auth.isMod()) {
        baseOptions = [...baseOptions, 'ADMIN'];
      }
      
      const menuOptions = (typeof Auth !== 'undefined' && Auth.isLoggedIn) 
        ? [...baseOptions, 'LOGOUT']
        : [...baseOptions, 'LOGIN'];
      
      // Ensure menuIdx stays within bounds when menu size changes
      if (this.menuIdx >= menuOptions.length) {
        this.menuIdx = menuOptions.length - 1;
      }
      
      // Legacy: Keyboard navigation with Dash/Jump keys (for backward compatibility)
      if (Input.justPressed('Dash')) {
        this.menuIdx = (this.menuIdx + 1) % menuOptions.length;
      }
      
      if (Input.justPressed('Jump')) {
        this.selectMenuOption(menuOptions[this.menuIdx]);
      }
      
      // Mouse/Tap: Click on menu item to select it immediately
      if (Input.justPressedMenuClick()) {
        const clickedIdx = this.getMenuItemAtPosition(Input.menuClickX, Input.menuClickY, menuOptions.length, STATE.TITLE);
        if (clickedIdx !== -1) {
          this.selectMenuOption(menuOptions[clickedIdx]);
        }
      }
    } else if (this.state === STATE.MODE_SELECT) {
      // Legacy: Keyboard navigation
      if (Input.justPressed('Dash')) this.menuIdx = (this.menuIdx + 1) % MODES.length;
      if (Input.justPressed('Jump')) {
        this.selectMenuOption(MODES[this.menuIdx].name);
      }
      // B key for back
      if (Input.justPressed('KeyB')) {
        this.state = STATE.TITLE;
        this.menuIdx = 0;
      }
      // Mouse/Tap: Click to select
      if (Input.justPressedMenuClick()) {
        const clickedIdx = this.getMenuItemAtPosition(Input.menuClickX, Input.menuClickY, MODES.length, STATE.MODE_SELECT);
        if (clickedIdx !== -1) {
          this.selectMenuOption(MODES[clickedIdx].name);
        }
        // Check for back button click
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.state = STATE.TITLE;
          this.menuIdx = 0;
        }
      }
    } else if (this.state === STATE.CHAR_SELECT) {
      // Legacy: Keyboard navigation
      if (Input.justPressed('Dash')) this.menuIdx = (this.menuIdx + 1) % CHARACTERS.length;
      if (Input.justPressed('Jump')) {
        this.selectMenuOption(CHARACTERS[this.menuIdx].name);
      }
      // B key for back
      if (Input.justPressed('KeyB')) {
        this.state = STATE.MODE_SELECT;
        this.menuIdx = 0;
      }
      // Mouse/Tap: Click to select
      if (Input.justPressedMenuClick()) {
        const clickedIdx = this.getMenuItemAtPosition(Input.menuClickX, Input.menuClickY, CHARACTERS.length, STATE.CHAR_SELECT);
        if (clickedIdx !== -1) {
          this.selectMenuOption(CHARACTERS[clickedIdx].name);
        }
        // Check for back button click
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.state = STATE.MODE_SELECT;
          this.menuIdx = 0;
        }
      }
    } else if (this.state === STATE.DIFF_SELECT) {
      // Legacy: Keyboard navigation
      if (Input.justPressed('Dash')) this.menuIdx = (this.menuIdx + 1) % DIFFICULTIES.length;
      if (Input.justPressed('Jump')) {
        this.selectMenuOption(DIFFICULTIES[this.menuIdx].name);
      }
      // B key for back
      if (Input.justPressed('KeyB')) {
        this.state = STATE.CHAR_SELECT;
        this.menuIdx = 0;
      }
      // Mouse/Tap: Click to select
      if (Input.justPressedMenuClick()) {
        const clickedIdx = this.getMenuItemAtPosition(Input.menuClickX, Input.menuClickY, DIFFICULTIES.length, STATE.DIFF_SELECT);
        if (clickedIdx !== -1) {
          this.selectMenuOption(DIFFICULTIES[clickedIdx].name);
        }
        // Check for back button click
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.state = STATE.CHAR_SELECT;
          this.menuIdx = 0;
        }
      }
    } else if (this.state === STATE.MATCHMAKING) {
      // Cancel matchmaking with ESC or B
      if (Input.justPressed('KeyB') || Input.justPressed('Escape')) {
        this.cancelMatchmaking();
      }
      // Back button click
      if (Input.justPressedMenuClick()) {
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.cancelMatchmaking();
        }
      }
    } else if (this.state === STATE.PLAY) {
      this.stats.time++;
      const level = (this.selectedMode === 1 && this.survivalLevel) ? this.survivalLevel : LEVELS[this.currentLevel];

      this.player.update(level.platforms, level.hazards, level.springs);
      
      // 🔥 BULLET HELL: Handle shooting
      if (this.player.canShoot) {
        this.player.updateShooting(this.projectiles);
      }
      
      // Record ghost data for multiplayer replay system
      if (typeof Shop !== 'undefined' && this.player.alive) {
        const playerState = this.player.dashing ? 'dash' : (this.player.vy < 0 ? 'jump' : 'run');
        Shop.recordGhostFrame(this.stats.time, this.player.x, this.player.y, playerState);
      }
      
      // Handle emotes
      if (Input.justPressed('Emote') && this.emoteTimer <= 0) {
        this.currentEmote = Shop.equipped.emote || 'WAVE';
        this.emoteTimer = 120; // 2 seconds at 60fps
      }
      if (this.emoteTimer > 0) this.emoteTimer--;
      
      // Spawn trail particles based on equipped trail
      const trail = Shop.items.trails.find(t => t.id === Shop.equipped.trail);
      if (trail && trail.id !== 'NONE' && this.player.alive && this.stats.time % 5 === 0) {
        let color = trail.color;
        if (color === 'rainbow') {
          const hues = ['#f00', '#fa0', '#ff0', '#0f0', '#0af', '#00f', '#f0f'];
          color = hues[Math.floor(this.stats.time / 10) % 7];
        }
        FX.spawn(this.player.x + 9, this.player.y + 14, color, 3, { speed: 1, life: 0.5 });
      }
      
      // CRUSH DEPTH: HP drain mechanic
      if (this.hpDrainTimer > 0) {
        this.hpDrainTimer--;
        if (this.hpDrainTimer <= 0) {
          // Lose a life every 3 seconds
          this.player.lives--;
          if (this.player.lives <= 0) {
            this.player.alive = false;
          } else {
            this.hpDrainTimer = 180; // Reset for next drain
          }
        }
      }
      
      // SPEEDRUN: Time limit
      if (this.levelTimeLimit > 0) {
        this.levelTimeLimit--;
        if (this.levelTimeLimit <= 0 && this.player.alive) {
          // Time's up - player dies
          this.player.alive = false;
        }
      }
      
      // IRONMAN: No checkpoints - don't save checkpoint
      // (handled in checkpoint detection)

      // Update enemies
      for (let e of this.enemies) e.update(this.player, level.platforms, this.projectiles);

      // Update projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        let p = this.projectiles[i];
        p.update(level.platforms);
        if (!p.alive) {
          this.projectiles.splice(i, 1);
          continue;
        }
        if (p.owner === 'enemy' && this.player.alive && this.player.inv <= 0 && AABB(p, this.player)) {
          p.alive = false;
          if (this.player.shield) {
            this.player.shield = false;
            this.player.inv = 60;
          } else {
            this.player.takeDamage();
          }
        }
        // 🔥 PLAYER PROJECTILES HIT ENEMIES!
        if (p.owner === 'player') {
          for (let e of this.enemies) {
            if (e.alive && AABB(p, e)) {
              p.alive = false;
              e.takeDamage();
              this.stats.score += 50;
              FX.spawn(p.x, p.y, '#0ff', 10, { speed: 5, life: 0.5 });
              break;
            }
          }
        }
      }

      // Collect crystals
      for (let r of this.crystals) {
        if (!r.col && AABB(this.player, { x: r.x - 7, y: r.y - 7, w: 14, h: 14 })) {
          r.col = true;
          this.stats.crystals++;
          this.stats.score += 10;
          // Award pearls for crystals (with difficulty multiplier)
          const diff = DIFFICULTIES[this.selectedDifficulty];
          const pearlReward = Math.floor(1 * diff.modifiers.pearlMult);
          this.stats.pearls += pearlReward;
          Shop.awardPearls(pearlReward);
          
          // CRUSH DEPTH: Crystals heal HP drain
          if (diff.modifiers.hpDrain) {
            this.hpDrainTimer = Math.min(180, this.hpDrainTimer + 60); // +1 second healing
            this.player.lives = Math.min(this.player.maxLives, this.player.lives + 0.2); // Small heal
          }
          
          if (this.stats.crystals % 100 === 0) {
            this.player.lives = Math.min(this.player.maxLives, this.player.lives + 1);
            AudioSys.extraLife();
          } else {
            AudioSys.crystalCollect();
          }
          FX.spawn(r.x, r.y, '#67e8f9', 6, { speed: 2, life: 0.5 });
        }
      }

      // Collect scattered crystals
      for (let i = this.scatteredCrystals.length - 1; i >= 0; i--) {
        let sr = this.scatteredCrystals[i];
        sr.update(level.platforms);
        if (!sr.alive) {
          this.scatteredCrystals.splice(i, 1);
          continue;
        }
        if (sr.timer < 170 && AABB(this.player, sr)) {
          this.stats.crystals++;
          this.stats.score += 10;
          AudioSys.pickup();
          FX.spawn(sr.x + 7, sr.y + 7, '#67e8f9', 4);
          this.scatteredCrystals.splice(i, 1);
        }
      }

      // Power-ups
      for (let p of this.powerups) {
        p.update();
        if (!p.collected && AABB(this.player, { x: p.x, y: p.y, w: 24, h: 24 })) {
          p.collected = true;
          AudioSys.powerUp();
          this.stats.score += 50;
          switch (p.type) {
            case 'SHIELD': this.player.shield = true; break;
            case 'MAGNET': this.player.magnet = true; break;
            case 'SPEED': this.player.speedBoost = 300; break;
            case 'DOUBLE_JUMP': this.player.hasDoubleJump = true; break;
            case 'EXTRA_LIFE': this.player.lives = Math.min(this.player.maxLives, this.player.lives + 1); break;
            case 'WEAPON': 
              if (this.player.canShoot) {
                this.player.powerUpWeapon();
              } else {
                this.player.canShoot = true;
                this.player.weaponLevel = 1;
              }
              break;
          }
        }
      }

      // Magnet effect
      if (this.player.magnet) {
        for (let r of this.crystals) {
          if (!r.col && dist(this.player, { x: r.x, y: r.y }) < 120) {
            const dx = (this.player.x + 9) - r.x;
            const dy = (this.player.y + 14) - r.y;
            const d = Math.hypot(dx, dy);
            if (d > 10) {
              r.x += (dx / d) * 4;
              r.y += (dy / d) * 4;
            }
          }
        }
      }

      // Checkpoints
      if (level.checkpoints) {
        for (let cp of level.checkpoints) {
          if (!cp.activated && AABB(this.player, { x: cp.x - 10, y: cp.y - 60, w: 30, h: 100 })) {
            cp.activated = true;
            AudioSys.checkpoint();
            FX.spawn(cp.x, cp.y - 30, '#0f0', 15);
            
            // Save power-ups at checkpoint
            if (this.selectedMode === 0) {
              this.persistedPowerUps = {
                hasDoubleJump: this.player.hasDoubleJump,
                shield: this.player.shield,
                magnet: this.player.magnet,
                speedBoost: this.player.speedBoost,
                canShoot: this.player.canShoot,
                weaponLevel: this.player.weaponLevel,
                spreadShot: this.player.spreadShot,
                rapidFire: this.player.rapidFire
              };
            }
          }
        }
      }

      // Goal reach (for non-boss levels)
      if (!level.boss && this.player.x > level.w - 180 && !this.bossDefeated) {
        this.bossDefeated = true;
        this.levelCompleteTimer = 120;
      }

      // Level completion
      if (this.bossDefeated && this.levelCompleteTimer > 0) {
        this.levelCompleteTimer--;
        if (this.levelCompleteTimer <= 0) {
          AudioSys.levelComplete();
          
          // Award pearls for completing level
          const diff = DIFFICULTIES[this.selectedDifficulty];
          const pearlsEarned = Math.floor(10 * diff.modifiers.pearlMult);
          Shop.awardPearls(pearlsEarned);
          
          // Save power-ups before advancing (for Adventure mode)
          if (this.selectedMode === 0) {
            this.persistedPowerUps = {
              hasDoubleJump: this.player.hasDoubleJump,
              shield: this.player.shield,
              magnet: this.player.magnet,
              speedBoost: this.player.speedBoost,
              canShoot: this.player.canShoot,
              weaponLevel: this.player.weaponLevel,
              spreadShot: this.player.spreadShot,
              rapidFire: this.player.rapidFire
            };
          }
          
          // Advance to next level or win
          this.currentLevel++;
          if (this.currentLevel >= LEVELS.length) {
            this.state = STATE.WIN;
            this.cam.x = 0;
            this.currentLevel = 0;
            this.persistedPowerUps = null; // Clear on game win
          } else {
            this.initLevel(this.currentLevel);
          }
        }
      }

      // Fall death
      if (this.player.y > level.h + 150) this.player.alive = false;

      // Death handling
      if (!this.player.alive && this.player.lives <= 0) {
        this.stats.deaths++;
        this.state = STATE.DEAD;
        this.deathTimer = 120;
      } else if (!this.player.alive) {
        this.stats.deaths++;
        this.state = STATE.DEAD;
        this.deathTimer = 60;
      }

      FX.update();
      if (this.scrShake > 0) this.scrShake--;
      if (Math.random() < 0.02) FX.spawnBubble(this.player.x + Math.random() * 20, this.player.y);

      // Camera
      let tx = this.player.x - CFG.W / 2 + this.player.vx * 5;
      let ty = this.player.y - CFG.H / 2 + 60 + this.player.vy * 3;
      tx = clamp(tx, 0, level.w - CFG.W);
      ty = clamp(ty, 0, level.h - CFG.H);
      this.cam.x = lerp(this.cam.x, tx, 0.12);
      this.cam.y = lerp(this.cam.y, ty, 0.1);

    } else if (this.state === STATE.DEAD) {
      FX.update();
      if (this.deathTimer > 0) {
        this.deathTimer--;
      } else if (Input.justPressed('Jump')) {
        if (this.player.lives > 0) {
          this.resetToCheckpoint();
          this.state = STATE.PLAY;
        } else {
          this.state = STATE.TITLE;
        }
      }
    } else if (this.state === STATE.PAUSE) {
      if (Input.justPressed('Jump')) this.state = STATE.PLAY;
      if (Input.justPressed('Dash')) this.state = STATE.TITLE;
      if (Input.justPressedMenuClick()) {
        const pBtnW = 200, pBtnH = 50, pBtnGap = 20;
        const pBtnY = CFG.H / 2 + 30;
        const pRx = CFG.W / 2 - pBtnW - pBtnGap / 2;
        const pQx = CFG.W / 2 + pBtnGap / 2;
        const mx = Input.menuClickX;
        const my = Input.menuClickY;
        if (my >= pBtnY && my <= pBtnY + pBtnH) {
          if (mx >= pRx && mx <= pRx + pBtnW) {
             this.state = STATE.PLAY;
          } else if (mx >= pQx && mx <= pQx + pBtnW) {
             this.state = STATE.TITLE;
          }
        }
      }
    } else if (this.state === STATE.WIN) {
      if (Input.justPressed('Jump')) this.state = STATE.TITLE;

    } else if (this.state === STATE.LEADERBOARD) {
      if (Input.justPressed('Dash')) {
        const types = ['global', 'survival', 'weekly'];
        const idx = types.indexOf(this.leaderboardType);
        this.leaderboardType = types[(idx + 1) % types.length];
      }
      if (Input.justPressed('Jump') || Input.justPressed('KeyB')) {
        this.state = STATE.TITLE;
      }
      // Back button click
      if (Input.justPressedMenuClick()) {
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.state = STATE.TITLE;
        }
      }
    } else if (this.state === STATE.RANKED) {
      if (Input.justPressed('Jump') || Input.justPressed('Dash') || Input.justPressed('KeyB')) {
        this.state = STATE.TITLE;
      }
      // Back button click for ranked
      if (Input.justPressedMenuClick()) {
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.state = STATE.TITLE;
        }
      }
    } else if (this.state === STATE.TUTORIAL) {
      if (Input.justPressed('Dash')) {
        this.tutorialPage = (this.tutorialPage + 1) % 5;
      }
      if (Input.justPressed('Jump') || Input.justPressed('KeyB')) {
        this.state = STATE.TITLE;
      }
      // Back button click
      if (Input.justPressedMenuClick()) {
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.state = STATE.TITLE;
        }
      }
    }
    
    // SHOP INTERACTION (works in any state when showShop is true)
    if (this.showShop) {
      // Close shop with Jump or B
      if (Input.justPressed('Jump') || Input.justPressed('KeyB')) {
        this.showShop = false;
      }

      // Switch categories with Dash/Tab
      if (Input.justPressed('Dash')) {
        const categories = ['skins', 'emotes', 'trails', 'nameplates'];
        const currentIdx = categories.indexOf(this.shopCategory);
        this.shopCategory = categories[(currentIdx + 1) % categories.length];
      }

      // Handle shop item clicks
      if (Input.justPressedMenuClick()) {
        this.handleShopClick(Input.menuClickX, Input.menuClickY);
      }

      // Back button click
      if (Input.justPressedMenuClick()) {
        if (this.isBackButtonClicked(Input.menuClickX, Input.menuClickY)) {
          this.showShop = false;
        }
      }
    }
    
    // 🛡️ ADMIN PANEL INTERACTION
    if (this.showAdminPanel) {
      // Close admin panel with Jump
      if (Input.justPressed('Jump')) {
        this.showAdminPanel = false;
      }
      
      // Handle admin command clicks
      if (Input.justPressedMenuClick()) {
        this.handleAdminClick(Input.menuClickX, Input.menuClickY);
      }
    }

    Input.postUpdate();
  },

  draw(ctx) {
    let cx = this.cam.x;
    let cy = this.cam.y;

    if (this.scrShake > 0) {
      cx += (Math.random() - 0.5) * this.scrShake;
      cy += (Math.random() - 0.5) * this.scrShake;
    }

    // Clear canvas with dark background first
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    // Background - Use user's bg.png with parallax + my effects on top
    if (this.bgLoaded && this.bgImage && this.bgImage.complete) {
      // Draw user's background with slow parallax
      const parallaxX = -(cx * 0.1) % this.bgImage.width;
      ctx.save();
      ctx.globalAlpha = 0.7; // Slightly transparent so my effects blend in

      // Draw multiple copies if needed to cover screen
      let drawX = parallaxX;
      while (drawX < CFG.W) {
        ctx.drawImage(this.bgImage, drawX, 0, this.bgImage.width, CFG.H);
        drawX += this.bgImage.width;
      }

      // If parallaxX is negative, we need another copy on the left
      if (parallaxX < 0) {
        ctx.drawImage(this.bgImage, parallaxX + this.bgImage.width, 0, this.bgImage.width, CFG.H);
      }

      ctx.restore();
    }

    // My gradient overlay on top of user's bg
    const gradient = ctx.createLinearGradient(0, 0, 0, CFG.H);
    gradient.addColorStop(0, 'rgba(0, 16, 32, 0.4)');
    gradient.addColorStop(0.5, 'rgba(0, 32, 64, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 16, 32, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    // Animated caustics (underwater light rays) - modern subtle effect
    ctx.save();
    ctx.globalAlpha = 0.03;
    const time = Date.now() / 3000;
    for (let i = 0; i < 6; i++) {
      const y = (i * 120 + Math.sin(time + i * 0.5) * 40) % (CFG.H + 100) - 50;
      const gradient = ctx.createLinearGradient(0, y, 0, y + 80);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
      gradient.addColorStop(0.5, 'rgba(96, 165, 250, 0.3)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, CFG.W, 80);
    }
    ctx.restore();

    // Game world
    ctx.save();
    // Apply camera offset globally
    ctx.translate(-Math.floor(cx), -Math.floor(cy));

    const level = (this.selectedMode === 1 && this.survivalLevel) ? this.survivalLevel : (LEVELS[this.currentLevel] || LEVELS[0]);

    // Platforms
    for (let p of level.platforms) {
      if (p.x > cx + CFG.W || p.x + p.w < cx) continue;
      const grad = ctx.createLinearGradient(p.x, p.y, p.x, (p.y + p.h));
      grad.addColorStop(0, '#1e3a5f');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#93c5fd';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(p.x, p.y, p.w, 4);
      ctx.globalAlpha = 1;
    }

    // Hazards
    for (let h of level.hazards) {
      if (h.x > cx + CFG.W || h.x + h.w < cx) continue;
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#f43f5e';
      const spikeOffset = Math.sin(Date.now() / 100) * 2;
      for (let i = 0; i < h.w; i += 10) {
        ctx.beginPath();
        ctx.moveTo((h.x + i), (h.y + h.h));
        ctx.lineTo((h.x + i + 5), (h.y + spikeOffset));
        ctx.lineTo((h.x + i + 10), (h.y + h.h));
        ctx.fill();
      }
    }

    // Springs
    for (let s of level.springs) {
      if (s.x > cx + CFG.W || s.x + 30 < cx) continue;
      const bounce = Math.sin(Date.now() / 200 + s.x) * 3;
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(s.x, s.y, 30, 8);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(s.x + 2, s.y - 6 + bounce, 26, 6);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(s.x + 5, s.y - 12 + bounce * 1.5, 20, 4);
    }

    // Checkpoints
    for (let cp of level.checkpoints) {
      const activated = this.player.x >= cp.x;
      ctx.fillStyle = activated ? '#4ade80' : '#475569';
      ctx.shadowColor = activated ? '#4ade80' : 'transparent';
      ctx.shadowBlur = activated ? 15 : 0;
      ctx.fillRect(cp.x - 2, cp.y - 70, 4, 70);
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y - 70);
      ctx.lineTo(cp.x + 15, cp.y - 55);
      ctx.lineTo(cp.x, cp.y - 40);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Crystals - drawn as diamond shapes with cyan color
    const rTime = Date.now() / 120;
    for (let r of this.crystals) {
      if (r.col) continue;
      const rx = r.x + (r.vx || 0);
      const ry = r.y + (r.vy || 0) + Math.sin(rTime + r.x) * 4;
      const size = 8 + Math.sin(rTime + r.x) * 2;

      ctx.fillStyle = '#67e8f9';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 15;
      
      // Draw diamond shape
      ctx.beginPath();
      ctx.moveTo(rx, ry - size);
      ctx.lineTo(rx + size, ry);
      ctx.lineTo(rx, ry + size);
      ctx.lineTo(rx - size, ry);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Scattered crystals
    for (let r of this.scatteredCrystals) {
      if (r.blink) continue;
      ctx.fillStyle = '#a5f3fc';
      ctx.shadowColor = '#67e8f9';
      ctx.shadowBlur = 10;
      
      // Draw smaller diamond
      const size = 6;
      ctx.beginPath();
      ctx.moveTo(r.x + 7, r.y + 7 - size);
      ctx.lineTo(r.x + 7 + size, r.y + 7);
      ctx.lineTo(r.x + 7, r.y + 7 + size);
      ctx.lineTo(r.x + 7 - size, r.y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Power-ups
    for (let p of this.powerups) p.draw(ctx);

    // Enemies
    for (let e of this.enemies) e.draw(ctx);

    // Projectiles
    for (let p of this.projectiles) p.draw(ctx);

    // Player
    if (this.state === STATE.PLAY || (this.state === STATE.DEAD && this.deathTimer > 30)) {
      this.player.draw(ctx);
    }

    FX.draw(ctx);
    ctx.restore();
    
    // NO LIGHT: Vision radius effect
    if (this.visionRadius > 0 && this.state === STATE.PLAY) {
      const playerScreenX = this.player.x - cx;
      const playerScreenY = this.player.y - cy;
      
      // Create darkness overlay with hole for vision
      const gradient = ctx.createRadialGradient(
        playerScreenX + 9, playerScreenY + 14, 0,
        playerScreenX + 9, playerScreenY + 14, this.visionRadius
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(0.8, 'rgba(0,0,0,0.7)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.98)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      // Draw vision indicator
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(playerScreenX + 9, playerScreenY + 14, this.visionRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // UI
    this.drawUI(ctx);
  },

  drawUI(ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 18px Inter, system-ui, sans-serif';

    if (this.state === STATE.TITLE) {
      // ═══════════════════════════════════════════════
      //  PREMIUM TITLE SCREEN
      // ═══════════════════════════════════════════════
      const centerX = CFG.W / 2;
      const now = Date.now();
      const pulse = Math.sin(now / 900) * 0.5 + 0.5;   // 0→1 breathing
      const slow  = now / 4000;

      // ── Aurora glow orbs (behind everything) ──
      const auroraColors = [
        [59,  130, 246],  // blue
        [6,   182, 212],  // cyan
        [139,  92, 246],  // purple
      ];
      ctx.save();
      ctx.globalAlpha = 0.12 + pulse * 0.06;
      auroraColors.forEach(([r,g,b], i) => {
        const ox = centerX + Math.sin(slow + i * 2.1) * 200;
        const oy = 200     + Math.cos(slow + i * 1.7) * 80;
        const rad = 280 + Math.sin(slow * 0.7 + i) * 60;
        const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad);
        orb.addColorStop(0,   `rgba(${r},${g},${b},0.8)`);
        orb.addColorStop(0.6, `rgba(${r},${g},${b},0.15)`);
        orb.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = orb;
        ctx.fillRect(0, 0, CFG.W, CFG.H);
      });
      ctx.restore();

      // ── Floating particle bubbles ──
      ctx.save();
      for (let i = 0; i < 20; i++) {
        const seed = i * 137.508;
        const bx = ((seed * 31 + now * 0.02 * (0.3 + (i % 5) * 0.14)) % CFG.W + CFG.W) % CFG.W;
        const by = CFG.H - ((seed * 17 + now * 0.03 * (0.5 + (i % 4) * 0.12)) % CFG.H);
        const br = 2 + (i % 4) * 1.5;
        ctx.globalAlpha = 0.15 + (i % 3) * 0.1;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? '#67e8f9' : '#93c5fd';
        ctx.fill();
      }
      ctx.restore();

      // ── Wave icon ──
      const iconY = 105;
      ctx.font = '52px Arial';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.92;
      ctx.fillText('🌊', centerX, iconY + Math.sin(now / 700) * 4);
      ctx.globalAlpha = 1;

      // ── Main title ──
      ctx.save();
      const titleGrad = ctx.createLinearGradient(centerX - 260, 0, centerX + 260, 0);
      titleGrad.addColorStop(0,   '#93c5fd');
      titleGrad.addColorStop(0.4, '#f8fafc');
      titleGrad.addColorStop(0.7, '#e0f2fe');
      titleGrad.addColorStop(1,   '#c4b5fd');
      ctx.shadowColor = 'rgba(96,165,250,0.6)';
      ctx.shadowBlur  = 24 + pulse * 16;
      ctx.font        = '800 64px "Space Grotesk", sans-serif';
      ctx.fillStyle   = titleGrad;
      ctx.textAlign   = 'center';
      ctx.letterSpacing = '2px';
      ctx.fillText('ABYSSAL RUSH', centerX, iconY + 65);
      ctx.restore();

      // ── Sub-title pill ──
      const pillW = 180, pillH = 32, pillX = centerX - pillW / 2, pillY = iconY + 76;
      const pillGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      pillGrad.addColorStop(0,   'rgba(59,130,246,0.25)');
      pillGrad.addColorStop(0.5, 'rgba(6,182,212,0.30)');
      pillGrad.addColorStop(1,   'rgba(139,92,246,0.25)');
      ctx.fillStyle = pillGrad;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(96,165,250,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 16);
      ctx.stroke();
      const subGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
      subGrad.addColorStop(0,   '#60a5fa');
      subGrad.addColorStop(0.5, '#22d3ee');
      subGrad.addColorStop(1,   '#a78bfa');
      ctx.font = '600 15px "Space Grotesk", sans-serif';
      ctx.fillStyle = subGrad;
      ctx.textAlign = 'center';
      ctx.fillText('✦  DEEP DIVE  ✦', centerX, pillY + 21);

      // ── Thin separator line ──
      ctx.save();
      const sepY = pillY + 48;
      const sepGrad = ctx.createLinearGradient(centerX - 160, 0, centerX + 160, 0);
      sepGrad.addColorStop(0,   'transparent');
      sepGrad.addColorStop(0.5, 'rgba(96,165,250,0.4)');
      sepGrad.addColorStop(1,   'transparent');
      ctx.strokeStyle = sepGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 160, sepY);
      ctx.lineTo(centerX + 160, sepY);
      ctx.stroke();
      ctx.restore();

      // ── Menu cards ──
      const menuY   = sepY + 18;
      const cardW   = 340;
      const cardH   = 52;
      const cardGap = 10;

      const baseOptions  = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
      const menuOptions  = (typeof Auth !== 'undefined' && Auth.isLoggedIn)
        ? [...baseOptions, 'LOGOUT']
        : [...baseOptions, 'LOGIN'];

      const OPT_META = {
        PLAY:        { icon: '▶', accent: [59,130,246],   label: 'PLAY' },
        TUTORIAL:    { icon: '📖', accent: [6,182,212],   label: 'TUTORIAL' },
        RANKED:      { icon: '🏆', accent: [251,191,36],  label: 'RANKED' },
        LEADERBOARD: { icon: '📊', accent: [139,92,246],  label: 'LEADERBOARD' },
        SHOP:        { icon: '🛒', accent: [52,211,153],  label: 'SHOP' },
        ADMIN:       { icon: '🛡️', accent: [251,191,36],  label: 'ADMIN' },
        LOGIN:       { icon: '👤', accent: [34,197,94],   label: 'LOGIN' },
        LOGOUT:      { icon: '🚪', accent: [239,68,68],   label: 'LOGOUT' },
      };

      menuOptions.forEach((opt, i) => {
        const cardY = menuY + i * (cardH + cardGap);
        const cardX = centerX - cardW / 2;
        const sel   = this.menuIdx === i;
        const m     = OPT_META[opt] || { icon: '•', accent: [148,163,184], label: opt };
        const [ar, ag, ab] = m.accent;

        if (sel) {
          // Glow backdrop
          ctx.save();
          ctx.shadowColor = `rgba(${ar},${ag},${ab},0.5)`;
          ctx.shadowBlur  = 20;
          const cg = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
          cg.addColorStop(0,   `rgba(${ar},${ag},${ab},0.22)`);
          cg.addColorStop(0.7, `rgba(${ar},${ag},${ab},0.10)`);
          cg.addColorStop(1,   `rgba(${ar},${ag},${ab},0.04)`);
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 10);
          ctx.fill();
          ctx.restore();

          // Glowing left accent bar
          ctx.save();
          ctx.shadowColor = `rgba(${ar},${ag},${ab},0.9)`;
          ctx.shadowBlur  = 10;
          const barGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
          barGrad.addColorStop(0, `rgba(${ar},${ag},${ab},1)`);
          barGrad.addColorStop(1, `rgba(${ar},${ag},${ab},0.3)`);
          ctx.fillStyle = barGrad;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, 4, cardH, [3, 0, 0, 3]);
          ctx.fill();
          ctx.restore();

          // Border
          ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.45)`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 10);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(15,23,42,0.55)';
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 10);
          ctx.fill();
          ctx.strokeStyle = 'rgba(148,163,184,0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(cardX, cardY, cardW, cardH, 10);
          ctx.stroke();
        }

        // Icon
        ctx.font = '19px Arial';
        ctx.fillStyle = sel ? '#f8fafc' : '#4b6380';
        ctx.textAlign = 'left';
        ctx.fillText(m.icon, cardX + 18, cardY + 33);

        // Label
        ctx.font = sel ? `700 17px "Space Grotesk", sans-serif` : `500 17px "Space Grotesk", sans-serif`;
        ctx.fillStyle = sel ? '#f8fafc' : '#64748b';
        if (opt === 'LOGIN')  ctx.fillStyle = sel ? '#4ade80' : '#22c55e';
        if (opt === 'LOGOUT') ctx.fillStyle = sel ? '#f87171' : '#94a3b8';
        if (opt === 'ADMIN')  ctx.fillStyle = sel ? '#fde68a' : '#f59e0b';
        ctx.textAlign = 'left';
        ctx.fillText(m.label, cardX + 52, cardY + 34);

        // Arrow hint
        if (sel) {
          ctx.font = '600 13px Inter, sans-serif';
          ctx.fillStyle = `rgba(${ar},${ag},${ab},0.7)`;
          ctx.textAlign = 'right';
          ctx.fillText('ENTER ↵', cardX + cardW - 16, cardY + 34);
        }
      });

      // ── Footer ──
      ctx.textAlign = 'center';
      ctx.font = '400 12px Inter, sans-serif';
      ctx.fillStyle = 'rgba(100,116,139,0.7)';
      ctx.fillText('Click or  DASH ↑↓  to navigate  •  JUMP / Click to select', centerX, CFG.H - 46);

      if (typeof Auth !== 'undefined' && Auth.isLoggedIn && typeof Shop !== 'undefined') {
        // Pearls pill
        const ppW = 130, ppH = 26, ppX = centerX - ppW / 2, ppY = CFG.H - 34;
        ctx.fillStyle = 'rgba(251,191,36,0.12)';
        ctx.beginPath();
        ctx.roundRect(ppX, ppY, ppW, ppH, 13);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251,191,36,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(ppX, ppY, ppW, ppH, 13);
        ctx.stroke();
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`🐚  ${Shop.pearls} pearls`, centerX, ppY + 17);
      }
    } else if (this.state === STATE.MODE_SELECT) {
      // Modern Mode Select
      const centerX = CFG.W / 2;
      const startY = 80;
      
      // Title
      ctx.font = '700 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText('Select Mission', centerX, startY);
      
      // Subtitle
      ctx.font = '400 16px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Choose your game mode', centerX, startY + 30);
      
      // Mode cards
      const cardWidth = 360;
      const cardHeight = 100; // Reduced to fit 4 modes
      const gap = 15;
      const startCardY = startY + 60;

      MODES.forEach((m, i) => {
        const y = startCardY + i * (cardHeight + gap);
        const x = centerX - cardWidth / 2;
        const sel = this.menuIdx === i;
        const isBulletHell = m.id === 2;
        
        // Card background
        if (sel) {
          ctx.fillStyle = isBulletHell ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)';
          ctx.fillRect(x, y, cardWidth, cardHeight);
          
          // Left accent
          ctx.fillStyle = isBulletHell ? '#f59e0b' : '#3b82f6';
          ctx.fillRect(x, y, 4, cardHeight);
          
          // Border
          ctx.strokeStyle = isBulletHell ? 'rgba(245, 158, 11, 0.5)' : 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cardWidth, cardHeight);
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.fillRect(x, y, cardWidth, cardHeight);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cardWidth, cardHeight);
        }
        
        // Mode icon
        const icons = ['🌊', '⚔️', '🔥'];
        ctx.font = '32px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(icons[i], x + 20, y + 50);
        
        // Mode name
        ctx.font = sel ? '600 24px "Space Grotesk", sans-serif' : '500 24px "Space Grotesk", sans-serif';
        ctx.fillStyle = sel ? (isBulletHell ? '#fbbf24' : '#f8fafc') : (isBulletHell ? '#f59e0b' : '#94a3b8');
        ctx.fillText(m.name, x + 70, y + 45);
        
        // Description
        ctx.font = '400 14px Inter, sans-serif';
        ctx.fillStyle = sel ? (isBulletHell ? '#fcd34d' : '#93c5fd') : '#64748b';
        ctx.fillText(m.desc, x + 20, y + 80);
        
        // Features tags
        const features = [
          ['6 Levels', 'Boss Fights'],
          ['Endless', 'High Score'],
          ['Shooting', 'Power-ups'],
          ['Online', '1v1 PVP'],
        ];

        (features[i] || []).forEach((feat, fi) => {
          const tagX = x + 20 + fi * 90;
          const tagY = y + 110;
          ctx.fillStyle = isBulletHell ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)';
          ctx.fillRect(tagX, tagY - 14, 80, 24);
          ctx.font = '500 12px Inter, sans-serif';
          ctx.fillStyle = isBulletHell ? '#fbbf24' : '#60a5fa';
          ctx.textAlign = 'center';
          ctx.fillText(feat, tagX + 40, tagY + 2);
        });
      });
      
      // Back button
      const backY = CFG.H - 55;
      const backWidth = 140;
      const backHeight = 36;
      const backX = centerX - backWidth / 2;
      
      // Back button background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backX, backY, backWidth, backHeight);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backX, backY, backWidth, backHeight);
      
      // Back button text
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', centerX, backY + 24);
      
      // Footer hint
      ctx.font = '400 12px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('DASH ↑↓ to navigate • JUMP to select', centerX, CFG.H - 15);
    } else if (this.state === STATE.CHAR_SELECT) {
      // Modern Character Select
      const centerX = CFG.W / 2;
      const startY = 80;
      
      // Title
      ctx.font = '700 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText('Choose Your Diver', centerX, startY);
      
      // Character cards
      const cardWidth = 280;
      const cardHeight = 200;
      const gap = 30;
      const totalWidth = 3 * cardWidth + 2 * gap;
      const startX = centerX - totalWidth / 2 + cardWidth / 2;
      const cardY = startY + 80;
      
      CHARACTERS.forEach((c, i) => {
        const x = startX + i * (cardWidth + gap);
        const sel = this.menuIdx === i;
        
        // Card background
        if (sel) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fillRect(x - cardWidth/2, cardY, cardWidth, cardHeight);
          
          // Top accent
          ctx.fillStyle = c.col;
          ctx.fillRect(x - cardWidth/2, cardY, cardWidth, 4);
          
          // Border
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - cardWidth/2, cardY, cardWidth, cardHeight);
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.fillRect(x - cardWidth/2, cardY, cardWidth, cardHeight);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - cardWidth/2, cardY, cardWidth, cardHeight);
        }
        
        // Character emoji representation
        const emojis = ['🤿', '⚡', '🛡️'];
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = sel ? '#f8fafc' : '#64748b';
        ctx.fillText(emojis[i], x, cardY + 70);
        
        // Name
        ctx.font = sel ? '600 24px "Space Grotesk", sans-serif' : '500 24px "Space Grotesk", sans-serif';
        ctx.fillStyle = sel ? '#f8fafc' : '#94a3b8';
        ctx.fillText(c.name, x, cardY + 110);
        
        // Stats
        if (sel) {
          ctx.font = '500 14px Inter, sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.fillText(`${c.desc}`, x, cardY + 140);
          
          ctx.font = '600 14px Inter, sans-serif';
          ctx.fillStyle = c.col;
          ctx.fillText(`❤️ ${c.lives}  •  ⚡ ${c.spd}`, x, cardY + 170);
        }
      });
      
      // Back button
      const backY2 = CFG.H - 55;
      const backWidth2 = 140;
      const backHeight2 = 36;
      const backX2 = centerX - backWidth2 / 2;
      
      // Back button background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backX2, backY2, backWidth2, backHeight2);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backX2, backY2, backWidth2, backHeight2);
      
      // Back button text
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', centerX, backY2 + 24);
      
      // Footer hint
      ctx.font = '400 12px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('DASH ←→ to navigate • JUMP to select', centerX, CFG.H - 15);
    } else if (this.state === STATE.DIFF_SELECT) {
      // Modern Difficulty Select
      const centerX = CFG.W / 2;
      const startY = 80;
      
      // Title
      ctx.font = '700 40px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText('Select Difficulty', centerX, startY);
      
      // Difficulty cards - 3x3 grid
      const cols = 3;
      const cardWidth = 240;
      const cardHeight = 110;
      const gapX = 20;
      const gapY = 20;
      const startX = centerX - (cols * cardWidth + (cols - 1) * gapX) / 2 + cardWidth / 2;
      const startCardY = startY + 70;
      
      DIFFICULTIES.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardWidth + gapX);
        const y = startCardY + row * (cardHeight + gapY);
        const sel = this.menuIdx === i;
        
        // Card background
        if (sel) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fillRect(x - cardWidth/2, y, cardWidth, cardHeight);
          
          // Top accent in difficulty color
          ctx.fillStyle = d.color;
          ctx.fillRect(x - cardWidth/2, y, cardWidth, 3);
          
          // Border
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - cardWidth/2, y, cardWidth, cardHeight);
        } else {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.fillRect(x - cardWidth/2, y, cardWidth, cardHeight);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x - cardWidth/2, y, cardWidth, cardHeight);
        }
        
        // Difficulty name
        ctx.font = sel ? '600 20px "Space Grotesk", sans-serif' : '500 20px "Space Grotesk", sans-serif';
        ctx.fillStyle = sel ? d.color : '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(d.name, x, y + 35);
        
        // Description (when selected)
        if (sel) {
          ctx.font = '400 13px Inter, sans-serif';
          ctx.fillStyle = '#64748b';
          const maxChars = 30;
          const desc = d.desc.length > maxChars ? d.desc.substring(0, maxChars) + '...' : d.desc;
          ctx.fillText(desc, x, y + 58);
          
          // Pearl multiplier tag
          const tagWidth = 80;
          const tagHeight = 24;
          const tagY = y + 78;
          ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
          ctx.fillRect(x - tagWidth/2, tagY, tagWidth, tagHeight);
          ctx.font = '600 13px Inter, sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.fillText(`${d.modifiers.pearlMult}x pearls`, x, tagY + 16);
        }
      });
      
      // Back button
      const backY3 = CFG.H - 55;
      const backWidth3 = 140;
      const backHeight3 = 36;
      const backX3 = centerX - backWidth3 / 2;
      
      // Back button background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backX3, backY3, backWidth3, backHeight3);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backX3, backY3, backWidth3, backHeight3);
      
      // Back button text
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', centerX, backY3 + 24);
      
      // Footer hint
      ctx.font = '400 12px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('DASH ↑↓←→ to navigate • JUMP to select', centerX, CFG.H - 15);
    } else if (this.state === STATE.PLAY || this.state === STATE.PAUSE || this.state === STATE.DEAD) {
      // ═══════════════════════════════════════════════
      //  PREMIUM IN-GAME HUD
      // ═══════════════════════════════════════════════
      const diff = DIFFICULTIES[this.selectedDifficulty];

      // Helper: draw a frosted-glass HUD pill
      const drawHUDPill = (x, y, w, h, text, iconText, textColor, iconColor, glowColor) => {
        ctx.save();
        // BG
        ctx.fillStyle = 'rgba(7,12,24,0.62)';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.stroke();
        // Icon
        if (iconText) {
          ctx.font = '14px Arial'; ctx.fillStyle = iconColor || '#94a3b8';
          ctx.textAlign = 'left'; ctx.fillText(iconText, x+10, y+h/2+5);
        }
        // Text
        ctx.font = '700 14px Inter, sans-serif';
        ctx.fillStyle = textColor || '#f8fafc';
        ctx.textAlign = 'left';
        ctx.fillText(text, x + (iconText ? 30 : 10), y + h/2 + 5);
        ctx.restore();
      };

      // ── LEFT HUD: Hearts ──
      const heartPillW = 16 + this.player.maxLives * 26;
      ctx.save();
      ctx.fillStyle = 'rgba(7,12,24,0.62)';
      ctx.beginPath(); ctx.roundRect(14, 12, heartPillW, 34, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(244,63,94,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(14, 12, heartPillW, 34, 10); ctx.stroke();
      ctx.font = '600 20px Inter, sans-serif';
      for (let i = 0; i < this.player.maxLives; i++) {
        ctx.fillStyle = i < this.player.lives ? '#f43f5e' : 'rgba(244,63,94,0.22)';
        if (i < this.player.lives) { ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 6; } else { ctx.shadowBlur = 0; }
        ctx.fillText('♥', 22 + i * 26, 33);
      }
      ctx.restore();

      // ── LEFT HUD: Crystal counter ──
      drawHUDPill(14, 52, 160, 30, `${this.stats.crystals.toString().padStart(3, '0')}`, '💎', '#67e8f9', '#67e8f9');

      // ── LEFT HUD: Score ──
      drawHUDPill(14, 88, 200, 30, this.stats.score.toString().padStart(6, '0'), '⭐', '#fbbf24', '#fbbf24');

      // ── Speedrun time limit ──
      if (this.levelTimeLimit > 0) {
        const timeSec = Math.ceil(this.levelTimeLimit / 60);
        const tCol = timeSec < 10 ? '#f43f5e' : (timeSec < 20 ? '#fb923c' : '#fbbf24');
        drawHUDPill(14, 124, 110, 30, `${timeSec}s`, '⏰', tCol, tCol);
      }

      // ── Reverse gravity ──
      if (diff.modifiers.reverseGravity) {
        drawHUDPill(14, this.levelTimeLimit > 0 ? 160 : 124, 150, 30, 'REVERSED', '🔄', '#e879f9', '#e879f9');
      }

      // ── BULLET HELL weapon ──
      if (this.player.canShoot) {
        drawHUDPill(14, 124 + (this.levelTimeLimit > 0 ? 36 : 0) + (diff.modifiers.reverseGravity ? 36 : 0), 130, 30, `WPN LV${this.player.weaponLevel}`, '🔥', '#fb923c', '#fb923c');
      }

      // ── CENTER: Level pill ──
      const lvlStr = `LEVEL ${this.currentLevel + 1} / ${LEVELS.length}`;
      ctx.save();
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      const lvlW = ctx.measureText(lvlStr).width + 30;
      const lvlX = CFG.W / 2 - lvlW / 2;
      ctx.fillStyle = 'rgba(7,12,24,0.62)';
      ctx.beginPath(); ctx.roundRect(lvlX, 12, lvlW, 30, 15); ctx.fill();
      ctx.strokeStyle = 'rgba(96,165,250,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(lvlX, 12, lvlW, 30, 15); ctx.stroke();
      ctx.fillStyle = '#60a5fa'; ctx.textAlign = 'center';
      ctx.fillText(lvlStr, CFG.W / 2, 31);
      ctx.restore();

      // ── RIGHT HUD: Time ──
      let m = Math.floor(this.stats.time / 3600);
      let s = Math.floor(this.stats.time / 60) % 60;
      drawHUDPill(CFG.W - 154, 12, 140, 30, `${m}:${s.toString().padStart(2, '0')}`, '⏱', '#f8fafc', '#94a3b8');

      // ── RIGHT HUD: Pearls ──
      drawHUDPill(CFG.W - 154, 48, 140, 30, `${this.stats.pearls}`, '🐚', '#fbbf24', '#fbbf24');

      // ── RIGHT HUD: Difficulty badge ──
      ctx.save();
      ctx.font = '700 12px "Space Grotesk", sans-serif';
      const dW = ctx.measureText(diff.name).width + 24;
      const dX = CFG.W - 14 - dW;
      ctx.fillStyle = 'rgba(7,12,24,0.62)';
      ctx.beginPath(); ctx.roundRect(dX, 84, dW, 26, 8); ctx.fill();
      ctx.strokeStyle = diff.color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(dX, 84, dW, 26, 8); ctx.stroke();
      ctx.fillStyle = diff.color; ctx.textAlign = 'center';
      ctx.shadowColor = diff.color; ctx.shadowBlur = 6;
      ctx.fillText(diff.name, dX + dW / 2, 101);
      ctx.restore();

      // ── RIGHT HUD: Crush Depth HP bar ──
      if (diff.modifiers.hpDrain) {
        const drainSec = Math.ceil(this.hpDrainTimer / 60);
        const drainColor = drainSec < 3 ? '#f43f5e' : '#a855f7';
        drawHUDPill(CFG.W - 154, 116, 140, 30, `drain ${drainSec}s`, '💉', drainColor, drainColor);
        // HP bar
        const barX = CFG.W - 150, barY = 152;
        ctx.fillStyle = 'rgba(51,65,85,0.7)'; ctx.beginPath(); ctx.roundRect(barX, barY, 136, 8, 4); ctx.fill();
        const pct = this.player.lives / this.player.maxLives;
        const hpColor = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fb923c' : '#f43f5e';
        ctx.fillStyle = hpColor;
        ctx.beginPath(); ctx.roundRect(barX, barY, 136 * pct, 8, 4); ctx.fill();
      }

      // ── Power-up icons ──
      const pups = [];
      if (this.player.shield)       pups.push({ icon: '🛡', col: '#4ade80' });
      if (this.player.magnet)       pups.push({ icon: '🧲', col: '#e879f9' });
      if (this.player.speedBoost > 0) pups.push({ icon: '⚡', col: '#fbbf24' });
      if (pups.length > 0) {
        const startPX = CFG.W - 14 - pups.length * 36;
        ctx.save();
        ctx.fillStyle = 'rgba(7,12,24,0.62)';
        ctx.beginPath(); ctx.roundRect(startPX - 4, 116 + (diff.modifiers.hpDrain ? 52 : 0), pups.length * 36 + 8, 32, 10); ctx.fill();
        pups.forEach((p, pi) => {
          ctx.font = '20px Arial';
          ctx.fillText(p.icon, startPX + pi * 36, 138 + (diff.modifiers.hpDrain ? 52 : 0));
        });
        ctx.restore();
      }

      // ══════════════════════════════════════════════
      //  PAUSE OVERLAY
      // ══════════════════════════════════════════════
      if (this.state === STATE.PAUSE) {
        // Dark blur backdrop
        ctx.fillStyle = 'rgba(7,12,28,0.80)';
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        // Glow orb behind text
        const pg = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 0, CFG.W/2, CFG.H/2, 220);
        pg.addColorStop(0,   'rgba(59,130,246,0.20)');
        pg.addColorStop(0.5, 'rgba(59,130,246,0.06)');
        pg.addColorStop(1,   'transparent');
        ctx.fillStyle = pg;
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(96,165,250,0.8)';
        ctx.shadowBlur  = 30;
        ctx.font = '800 58px "Space Grotesk", sans-serif';
        ctx.fillStyle = '#f0f9ff';
        ctx.fillText('PAUSED', CFG.W / 2, CFG.H / 2 - 20);
        ctx.restore();

        const sepG2 = ctx.createLinearGradient(CFG.W/2 - 120, 0, CFG.W/2 + 120, 0);
        sepG2.addColorStop(0, 'transparent');
        sepG2.addColorStop(0.5, 'rgba(96,165,250,0.5)');
        sepG2.addColorStop(1, 'transparent');
        ctx.strokeStyle = sepG2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(CFG.W/2-120, CFG.H/2+10); ctx.lineTo(CFG.W/2+120, CFG.H/2+10); ctx.stroke();

        const pBtnW = 200, pBtnH = 50, pBtnGap = 20;
        const pBtnY = CFG.H / 2 + 30;
        const pRx = CFG.W / 2 - pBtnW - pBtnGap / 2;
        const pQx = CFG.W / 2 + pBtnGap / 2;
        
        const mx = this.mouseX || 0;
        const my = this.mouseY || 0;
        const hoverResume = my >= pBtnY && my <= pBtnY + pBtnH && mx >= pRx && mx <= pRx + pBtnW;
        const hoverQuit = my >= pBtnY && my <= pBtnY + pBtnH && mx >= pQx && mx <= pQx + pBtnW;

        // Resume Button
        ctx.fillStyle = hoverResume ? 'rgba(59,130,246,0.3)' : 'rgba(7,12,24,0.6)';
        ctx.beginPath(); ctx.roundRect(pRx, pBtnY, pBtnW, pBtnH, 10); ctx.fill();
        ctx.strokeStyle = hoverResume ? '#3b82f6' : 'rgba(96,165,250,0.3)';
        ctx.stroke();
        ctx.fillStyle = hoverResume ? '#fff' : '#93c5fd';
        ctx.font = '600 18px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RESUME (Jump)', pRx + pBtnW/2, pBtnY + 31);

        // Quit Button
        ctx.fillStyle = hoverQuit ? 'rgba(244,63,94,0.3)' : 'rgba(7,12,24,0.6)';
        ctx.beginPath(); ctx.roundRect(pQx, pBtnY, pBtnW, pBtnH, 10); ctx.fill();
        ctx.strokeStyle = hoverQuit ? '#f43f5e' : 'rgba(244,63,94,0.3)';
        ctx.stroke();
        ctx.fillStyle = hoverQuit ? '#fff' : '#fda4af';
        ctx.fillText('QUIT (Dash)', pQx + pBtnW/2, pBtnY + 31);
      }

      // ══════════════════════════════════════════════
      //  DEATH OVERLAY
      // ══════════════════════════════════════════════
      if (this.state === STATE.DEAD) {
        const isGameOver = this.player.lives <= 0;
        const accentR = isGameOver ? 244 : 251;
        const accentG = isGameOver ? 63  : 146;
        const accentB = isGameOver ? 94  : 60;

        ctx.fillStyle = `rgba(${isGameOver ? '20,5,8' : '20,10,4'},0.82)`;
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        const dg = ctx.createRadialGradient(CFG.W/2, CFG.H/2, 0, CFG.W/2, CFG.H/2, 260);
        dg.addColorStop(0,   `rgba(${accentR},${accentG},${accentB},0.18)`);
        dg.addColorStop(0.6, `rgba(${accentR},${accentG},${accentB},0.05)`);
        dg.addColorStop(1,   'transparent');
        ctx.fillStyle = dg;
        ctx.fillRect(0, 0, CFG.W, CFG.H);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.shadowColor = `rgba(${accentR},${accentG},${accentB},0.8)`;
        ctx.shadowBlur  = 35;
        ctx.font = `800 ${isGameOver ? 62 : 68}px "Space Grotesk", sans-serif`;
        ctx.fillStyle = `rgb(${accentR},${accentG},${accentB})`;
        ctx.fillText(isGameOver ? 'GAME OVER' : 'HIT!', CFG.W / 2, CFG.H / 2 - 20);
        ctx.restore();

        const sepG3 = ctx.createLinearGradient(CFG.W/2 - 120, 0, CFG.W/2 + 120, 0);
        sepG3.addColorStop(0, 'transparent');
        sepG3.addColorStop(0.5, `rgba(${accentR},${accentG},${accentB},0.5)`);
        sepG3.addColorStop(1, 'transparent');
        ctx.strokeStyle = sepG3; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(CFG.W/2-120, CFG.H/2+14); ctx.lineTo(CFG.W/2+120, CFG.H/2+14); ctx.stroke();

        ctx.font = '400 18px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        if (isGameOver) {
          ctx.fillText('Press  JUMP  to return to title', CFG.W / 2, CFG.H / 2 + 50);
        } else {
          ctx.font = '600 20px Inter, sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(`${this.player.lives} ${this.player.lives === 1 ? 'life' : 'lives'} remaining`, CFG.W / 2, CFG.H / 2 + 50);
          ctx.font = '400 15px Inter, sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.fillText('Press  JUMP  to continue', CFG.W / 2, CFG.H / 2 + 78);
        }
      }
    } else if (this.state === STATE.WIN) {
      // ══════════════════════════════════════════════
      //  MISSION COMPLETE — PREMIUM WIN SCREEN
      // ══════════════════════════════════════════════
      ctx.fillStyle = 'rgba(3,14,28,0.92)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);

      // Aurora orb
      const wg = ctx.createRadialGradient(CFG.W/2, CFG.H/2-50, 0, CFG.W/2, CFG.H/2-50, 340);
      wg.addColorStop(0,   'rgba(74,222,128,0.16)');
      wg.addColorStop(0.5, 'rgba(6,182,212,0.07)');
      wg.addColorStop(1,   'transparent');
      ctx.fillStyle = wg; ctx.fillRect(0, 0, CFG.W, CFG.H);

      // Title
      ctx.save();
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(74,222,128,0.8)';
      ctx.shadowBlur  = 36;
      ctx.font = '800 62px "Space Grotesk", sans-serif';
      const wTitleGrad = ctx.createLinearGradient(CFG.W/2-300, 0, CFG.W/2+300, 0);
      wTitleGrad.addColorStop(0,   '#4ade80');
      wTitleGrad.addColorStop(0.5, '#86efac');
      wTitleGrad.addColorStop(1,   '#22d3ee');
      ctx.fillStyle = wTitleGrad;
      ctx.fillText('MISSION COMPLETE!', CFG.W / 2, CFG.H / 2 - 130);
      ctx.restore();

      // Separator
      const wSepG = ctx.createLinearGradient(CFG.W/2-200, 0, CFG.W/2+200, 0);
      wSepG.addColorStop(0, 'transparent');
      wSepG.addColorStop(0.5, 'rgba(74,222,128,0.4)');
      wSepG.addColorStop(1, 'transparent');
      ctx.strokeStyle = wSepG; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(CFG.W/2-200, CFG.H/2-100); ctx.lineTo(CFG.W/2+200, CFG.H/2-100); ctx.stroke();

      // Stat cards
      const tStr = Math.floor(this.stats.time/3600) + ':' + (Math.floor(this.stats.time/60)%60).toString().padStart(2,'0');
      const winStats = [
        { label: 'SCORE',    value: this.stats.score.toLocaleString(),     icon: '⭐', col: '#fbbf24' },
        { label: 'CRYSTALS', value: this.stats.crystals,                   icon: '💎', col: '#67e8f9' },
        { label: 'TIME',     value: tStr,                                  icon: '⏱', col: '#f8fafc' },
        { label: 'DEATHS',   value: this.stats.deaths,                     icon: '💀', col: '#f43f5e' },
      ];
      const cardW2 = 220, cardH2 = 80, cardGap2 = 16;
      const totalW2 = winStats.length * cardW2 + (winStats.length - 1) * cardGap2;
      const startX2 = CFG.W / 2 - totalW2 / 2;
      const cardY2 = CFG.H / 2 - 76;

      winStats.forEach((st, i) => {
        const cx2 = startX2 + i * (cardW2 + cardGap2);
        ctx.fillStyle = 'rgba(7,12,24,0.70)';
        ctx.beginPath(); ctx.roundRect(cx2, cardY2, cardW2, cardH2, 12); ctx.fill();
        ctx.strokeStyle = st.col + '33';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(cx2, cardY2, cardW2, cardH2, 12); ctx.stroke();
        // Top accent
        ctx.fillStyle = st.col;
        ctx.beginPath(); ctx.roundRect(cx2, cardY2, cardW2, 3, [12,12,0,0]); ctx.fill();
        // Icon
        ctx.font = '22px Arial'; ctx.textAlign = 'center';
        ctx.fillText(st.icon, cx2 + cardW2/2, cardY2 + 30);
        // Value
        ctx.font = '700 22px "Space Grotesk", sans-serif';
        ctx.fillStyle = st.col; ctx.shadowColor = st.col; ctx.shadowBlur = 8;
        ctx.fillText(String(st.value), cx2 + cardW2/2, cardY2 + 54);
        ctx.shadowBlur = 0;
        // Label
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText(st.label, cx2 + cardW2/2, cardY2 + 70);
      });

      // Blinking CTA
      if (Math.floor(Date.now() / 600) % 2 === 0) {
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS  JUMP  TO PLAY AGAIN', CFG.W / 2, CFG.H / 2 + 36);
      }
    } else if (this.state === STATE.RANKED) {
      // RANKED STATS SCREEN
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      const rankedStats = Shop.getRankedStats();
      const tier = Shop.tiers.find(t => t.name === rankedStats.tier);
      
      ctx.textAlign = 'center';
      ctx.font = '700 44px Inter, system-ui, sans-serif';
      ctx.fillStyle = tier?.color || '#fbbf24';
      ctx.shadowColor = tier?.color || '#fbbf24';
      ctx.shadowBlur = 25;
      ctx.fillText(`${tier?.icon || '👑'} ${rankedStats.tier}`, CFG.W / 2, 85);
      ctx.shadowBlur = 0;
      
      ctx.font = '600 34px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`MMR: ${rankedStats.mmr}`, CFG.W / 2, 135);
      
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`Rank Points: ${rankedStats.rankPoints}`, CFG.W / 2, 170);
      
      // Stats grid
      const stats = [
        ['WINS', rankedStats.wins, '#0f8'],
        ['LOSSES', rankedStats.losses, '#f44'],
        ['WIN RATE', `${rankedStats.winRate}%`, '#ff0'],
        ['MATCHES', rankedStats.matchesPlayed, '#fff'],
        ['WIN STREAK', rankedStats.winStreak, '#f0f'],
        ['BEST STREAK', rankedStats.bestWinStreak, '#a0f']
      ];
      
      stats.forEach((stat, i) => {
        const x = i % 2 === 0 ? CFG.W / 4 : 3 * CFG.W / 4;
        const y = 220 + Math.floor(i / 2) * 80;
        
        ctx.fillStyle = '#64748b';
        ctx.font = '500 14px Inter, sans-serif';
        ctx.fillText(stat[0], x, y);
        
        ctx.fillStyle = stat[2];
        ctx.font = '700 30px Inter, sans-serif';
        ctx.fillText(String(stat[1]), x, y + 38);
      });
      
      // Tier progression
      const nextTier = Shop.tiers.find(t => t.minMMR > rankedStats.mmr);
      if (nextTier) {
        ctx.fillStyle = '#444';
        ctx.fillRect(CFG.W / 2 - 200, 500, 400, 30);
        ctx.fillStyle = tier?.color || '#ffd700';
        const progress = Math.min(1, (rankedStats.mmr - tier.minMMR) / (nextTier.minMMR - tier.minMMR));
        ctx.fillRect(CFG.W / 2 - 200, 500, 400 * progress, 30);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(CFG.W / 2 - 200, 500, 400, 30);
        
        ctx.fillStyle = '#f8fafc';
        ctx.font = '500 14px Inter, sans-serif';
        ctx.fillText(`Next: ${nextTier.name} (${rankedStats.mmr}/${nextTier.minMMR})`, CFG.W / 2, 550);
      }
      
      // Back button
      const backYRanked = CFG.H - 55;
      const backWidthRanked = 160;
      const backHeightRanked = 36;
      const backXRanked = CFG.W / 2 - backWidthRanked / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backXRanked, backYRanked, backWidthRanked, backHeightRanked);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backXRanked, backYRanked, backWidthRanked, backHeightRanked);

      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', CFG.W / 2, backYRanked + 24);
    } else if (this.state === STATE.LEADERBOARD) {
      // LEADERBOARD SCREEN
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      const lbType = this.leaderboardType || 'global';
      const entries = Shop.getLeaderboard(lbType, 10);
      
      ctx.textAlign = 'center';
      ctx.font = '700 40px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`🏆 ${lbType.toUpperCase()} LEADERBOARD`, CFG.W / 2, 65);
      
      // Column headers
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('RANK', 50, 100);
      ctx.fillText('DIVER', 120, 100);
      ctx.fillText('TIER', 280, 100);
      ctx.fillText('MMR', 400, 100);
      ctx.fillText('WINS', 480, 100);
      ctx.fillText('WIN%', 560, 100);
      
      // Separator
      ctx.fillStyle = '#334155';
      ctx.fillRect(40, 110, CFG.W - 80, 2);
      
      // Entries
      entries.forEach((entry, i) => {
        const y = 140 + i * 40;
        const isPlayer = entry.name === 'YOU';
        
        // Highlight player
        if (isPlayer) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
          ctx.fillRect(40, y - 20, CFG.W - 80, 35);
        }
        
        ctx.fillStyle = isPlayer ? '#60a5fa' : '#f8fafc';
        ctx.font = isPlayer ? '700 18px Inter, sans-serif' : '500 16px Inter, sans-serif';
        
        const tier = Shop.tiers.find(t => t.name === entry.tier);
        
        ctx.textAlign = 'left';
        ctx.fillText(`#${entry.rank}`, 50, y);
        ctx.fillText(entry.name, 120, y);
        
        ctx.fillStyle = tier?.color || '#f8fafc';
        ctx.fillText(tier?.icon || '🥉', 280, y);
        
        ctx.fillStyle = isPlayer ? '#60a5fa' : '#94a3b8';
        ctx.fillText(String(entry.mmr), 400, y);
        ctx.fillText(String(entry.wins), 480, y);
        
        const winRate = entry.matches > 0 ? Math.round((entry.wins / entry.matches) * 100) : 0;
        ctx.fillText(`${winRate}%`, 560, y);
      });
      
      // Player rank if not in top 10
      const playerRank = Shop.getPlayerRank();
      if (playerRank > 10) {
        const y = 140 + 11 * 40;
        ctx.fillStyle = '#334155';
        ctx.fillRect(40, y - 25, CFG.W - 80, 2);
        
        const playerStats = Shop.getRankedStats();
        ctx.fillStyle = '#60a5fa';
        ctx.font = '700 16px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`#${playerRank}`, 50, y);
        ctx.fillText('YOU', 120, y);
        
        const tier = Shop.tiers.find(t => t.name === playerStats.tier);
        ctx.fillStyle = tier?.color || '#f8fafc';
        ctx.fillText(tier?.icon || '🥉', 280, y);
        
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(String(playerStats.mmr), 400, y);
        ctx.fillText(String(playerStats.wins), 480, y);
        ctx.fillText(`${playerStats.winRate}%`, 560, y);
      }
      
      // Back button
      const backYLB = CFG.H - 55;
      const backWidthLB = 140;
      const backHeightLB = 36;
      const backXLB = CFG.W / 2 - backWidthLB / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backXLB, backYLB, backWidthLB, backHeightLB);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backXLB, backYLB, backWidthLB, backHeightLB);

      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', CFG.W / 2, backYLB + 24);

      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`DASH: Switch (${lbType})`, CFG.W / 2, CFG.H - 15);
    } else if (this.state === STATE.MATCHMAKING) {
      // 1v1 MATCHMAKING SCREEN
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      const centerX = CFG.W / 2;
      const time = Date.now();
      
      // Animated spinner
      ctx.save();
      ctx.translate(centerX, 200);
      
      // Outer ring
      ctx.rotate(time * 0.001);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 1.5);
      ctx.stroke();
      
      // Middle ring
      ctx.rotate(time * 0.002);
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 1.5);
      ctx.stroke();
      
      // Inner ring
      ctx.rotate(time * 0.003);
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 1.5);
      ctx.stroke();
      
      ctx.restore();
      
      // Icon
      ctx.textAlign = 'center';
      ctx.font = '60px Inter, sans-serif';
      ctx.fillText('🌐', centerX, 200);
      
      // Title
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 32px Space Grotesk, sans-serif';
      ctx.fillText('Finding Opponent...', centerX, 320);
      
      // Matchmaking status
      const statusText = this.matchmakingStep === 0 ? 'Connecting to server...' :
                        this.matchmakingStep === 1 ? 'Searching for opponents...' :
                        this.matchmakingStep === 2 ? 'Found potential match!' :
                        this.matchmakingStep === 3 ? 'Connecting to opponent...' : 'Starting game...';
      
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillText(statusText, centerX, 370);
      
      // Opponent display
      if (this.opponentName) {
        const username = (typeof Auth !== 'undefined' && Auth.user) ? Auth.user.username : 'You';
        
        ctx.font = '500 16px Inter, sans-serif';
        ctx.fillText('vs', centerX, 420);
        
        // Player
        ctx.fillStyle = '#22c55e';
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillText(`👤 ${username}`, centerX - 150, 460);
        
        // VS
        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 20px Space Grotesk, sans-serif';
        ctx.fillText('VS', centerX, 460);
        
        // Opponent
        ctx.fillStyle = '#a78bfa';
        ctx.font = '700 24px Inter, sans-serif';
        ctx.fillText(`${this.opponentName} 🎱`, centerX + 150, 460);
      }
      
      // Back button
      const backYMM = CFG.H - 55;
      const backWidthMM = 160;
      const backHeightMM = 36;
      const backXMM = centerX - backWidthMM / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backXMM, backYMM, backWidthMM, backHeightMM);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backXMM, backYMM, backWidthMM, backHeightMM);

      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← CANCEL (ESC)', centerX, backYMM + 24);

    } else if (this.state === STATE.TUTORIAL) {
      // TUTORIAL SCREEN
      ctx.fillStyle = 'rgba(15, 23, 42, 0.98)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      const pages = [
        {
          title: '🎮 BASIC CONTROLS',
          content: [
            '',
            'MOVEMENT',
            '• WASD or ARROW KEYS to move left/right',
            '• CLICK/TAP left/right thirds of screen to move',
            '',
            'JUMPING',
            '• SPACE, Z, W, or UP ARROW to jump',
            '• TAP center of screen to jump',
            '• Hold jump button for higher jumps!',
            '',
            'DASHING',
            '• X or SHIFT to dash through enemies',
            '• SWIPE UP on screen to dash',
            '• Dash makes you invincible while dashing!',
            '',
            '💡 Hint: Look up for secrets...',
            '🔍 "UP UP DOWN DOWN LEFT RIGHT B A"' // SECRET: Konami Code hint!
          ]
        },
        {
          title: '⚔️ HOW TO KILL ENEMIES',
          content: [
            '',
            '🦀 CRAB ENEMIES (Red)',
            '• JUMP ON TOP of them to defeat',
            '• You must be falling DOWN onto them',
            '• Don\'t touch their sides!',
            '',
            '🐡 PUFFER ENEMIES (Orange)',
            '• DASH THROUGH them to defeat',
            '• Jumping on them will hurt YOU',
            '• Dash is the only way!',
            '',
            '🦈 JELLYFISH ENEMIES (Pink)',
            '• DASH ONLY - they shock on contact',
            '• Never try to jump on these!',
            '• Dash makes you immune to shock'
          ]
        },
        {
          title: '🎯 ADVANCED COMBAT',
          content: [
            '',
            'WALL JUMP',
            '• Slide down walls to wall-jump',
            '• Press jump while touching wall',
            '• Great for reaching high places!',
            '',
            'DOUBLE JUMP',
            '• Collect DOUBLE JUMP powerup first',
            '• Press jump again in mid-air',
            '• Some characters start with this!',
            '',
            'SCATTERED CRYSTALS',
            '• When hit, you lose all crystals',
            '• Quickly recollect them!',
            '• They disappear after a few seconds'
          ]
        },
        {
          title: '💎 POWER-UPS & CRYSTALS',
          content: [
            '',
            'POWER-UPS',
            '• SHIELD (Green) - Blocks one hit',
            '• MAGNET (Pink) - Pulls crystals to you',
            '• SPEED (Yellow) - Move super fast',
            '• DOUBLE JUMP (Blue) - Extra jump',
            '• EXTRA LIFE (Red) - +1 life',
            '',
            'CRYSTALS',
            '• Collect 100 crystals = EXTRA LIFE!',
            '• Crystals give PEARLS (shop currency)',
            '• Higher difficulties = more pearls'
          ]
        },
        {
          title: '🏆 DIFFICULTIES EXPLAINED',
          content: [
            '',
            'CASUAL - Extra lives, slow enemies',
            'DIVER - Standard balanced gameplay',
            'DEEP DIVER - Fast enemies, 2 lives',
            'ABYSSAL - 1 life, relentless enemies',
            '',
            'SPECIAL MODES:',
            'CRUSH DEPTH - HP drains, crystals heal',
            'NO LIGHT - Can\'t see, navigate by sound',
            'SPEEDRUN - 30 sec timer, always fast',
            'IRONMAN - No checkpoints, 1 life only',
            'ASCENSION - UPSIDE DOWN gravity!'
          ]
        }
      ];
      
      const page = pages[this.tutorialPage || 0];
      
      ctx.textAlign = 'center';
      ctx.font = '700 40px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
      ctx.shadowBlur = 20;
      ctx.fillText(page.title, CFG.W / 2, 70);
      ctx.shadowBlur = 0;
      
      ctx.font = '500 17px Inter, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      
      page.content.forEach((line, i) => {
        const y = 110 + i * 30;
        
        if (line.startsWith('•')) {
          ctx.fillStyle = '#22d3ee';
          ctx.font = '500 16px Inter, sans-serif';
        } else if (line.includes('ENEMIES') || line.includes('POWER-UPS') || line.includes('CRYSTALS') || line.includes('MOVEMENT') || line.includes('JUMPING') || line.includes('DASHING') || line.includes('WALL JUMP') || line.includes('DOUBLE JUMP') || line.includes('SCATTERED') || line.includes('DIFFICULTIES') || line.includes('SPECIAL')) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = '700 22px Inter, sans-serif';
        } else if (line.startsWith('🦀') || line.startsWith('🐡') || line.startsWith('🦈')) {
          ctx.fillStyle = '#f472b6';
          ctx.font = '600 18px Inter, sans-serif';
        } else if (line === '' || line === ' ') {
          // Empty line - skip
        } else {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '500 16px Inter, sans-serif';
        }
        
        ctx.fillText(line, CFG.W / 2, y);
      });
      
      // Page indicator
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText(`Page ${(this.tutorialPage || 0) + 1} / 5`, CFG.W / 2, CFG.H - 70);

      // Back button
      const backYTut = CFG.H - 55;
      const backWidthTut = 160;
      const backHeightTut = 36;
      const backXTut = CFG.W / 2 - backWidthTut / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backXTut, backYTut, backWidthTut, backHeightTut);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backXTut, backYTut, backWidthTut, backHeightTut);

      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', CFG.W / 2, backYTut + 24);

      // Footer hint
      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillText('DASH = Next Page', CFG.W / 2, CFG.H - 15);
    }
    
    // SHOP OVERLAY (renders on top of any state when showShop is true)
    if (this.showShop) {
      // Darken background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      // Title
      ctx.textAlign = 'center';
      ctx.font = '700 44px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
      ctx.shadowBlur = 20;
      ctx.fillText('🛒 SHOP', CFG.W / 2, 70);
      ctx.shadowBlur = 0;
      
      // Pearl balance
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`🐚 ${Shop.pearls} PEARLS`, CFG.W / 2, 115);
      
      // Category tabs
      const categories = ['skins', 'emotes', 'trails', 'nameplates'];
      const catLabels = { skins: 'SKINS', emotes: 'EMOTES', trails: 'TRAILS', nameplates: 'NAMEPLATES' };
      const tabWidth = 180;
      const tabHeight = 40;
      const startX = CFG.W / 2 - (categories.length * tabWidth) / 2;
      
      categories.forEach((cat, i) => {
        const x = startX + i * tabWidth;
        const y = 160;
        const isSelected = this.shopCategory === cat;
        
        // Tab background
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(30, 41, 59, 0.5)';
        ctx.fillRect(x, y, tabWidth - 10, tabHeight);
        
        // Tab border
        ctx.strokeStyle = isSelected ? '#60a5fa' : '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, tabWidth - 10, tabHeight);
        
        // Tab text
        ctx.fillStyle = isSelected ? '#60a5fa' : '#94a3b8';
        ctx.font = isSelected ? '700 16px Inter, sans-serif' : '500 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(catLabels[cat], x + (tabWidth - 10) / 2, y + 26);
      });
      
      // Skin Preview Panel (when viewing skins)
      let previewX = 0;
      if (this.shopCategory === 'skins') {
        const previewWidth = 200;
        const previewHeight = 280;
        previewX = CFG.W - previewWidth - 30;
        const previewY = 230;
        
        // Preview panel background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(previewX, previewY, previewWidth, previewHeight);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(previewX, previewY, previewWidth, previewHeight);
        
        // Preview title
        ctx.textAlign = 'center';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('SKIN PREVIEW', previewX + previewWidth / 2, previewY + 30);
        
        // Get equipped skin color
        const equippedSkin = Shop.equipped.skin;
        const skinItem = Shop.items.skins.find(s => s.id === equippedSkin);
        const skinColor = skinItem ? skinItem.color : '#0af';
        
        // Draw preview player character
        const px = previewX + previewWidth / 2;
        const py = previewY + 140;
        
        // Glow effect
        ctx.shadowColor = skinColor;
        ctx.shadowBlur = 20;
        
        // Body
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.roundRect(px - 20, py - 30, 40, 60, 8);
        ctx.fill();
        
        // Head/helmet
        ctx.beginPath();
        ctx.arc(px, py - 40, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // Visor
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px - 12, py - 45, 24, 10);
        
        // Eye glow
        ctx.fillStyle = '#f8fafc';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(px - 4, py - 40, 3, 0, Math.PI * 2);
        ctx.arc(px + 4, py - 40, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Skin name
        ctx.font = '700 18px Inter, sans-serif';
        ctx.fillStyle = skinColor;
        ctx.fillText(skinItem ? skinItem.name : 'Deep Diver', previewX + previewWidth / 2, previewY + 200);
        
        // Skin description
        ctx.font = '400 12px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        const desc = skinItem ? skinItem.desc : 'Standard gear';
        ctx.fillText(desc, previewX + previewWidth / 2, previewY + 220);
        
        // Color indicator
        ctx.fillStyle = skinColor;
        ctx.fillRect(previewX + 30, previewY + 240, previewWidth - 60, 4);
      }
      
      // Shop items
      const items = Shop.items[this.shopCategory] || [];
      const itemHeight = 70;
      const itemsPerRow = this.shopCategory === 'skins' ? 2 : 2;
      const itemWidth = this.shopCategory === 'skins' ? 280 : 350;
      const startItemY = 230;
      const gapX = 20;
      const gapY = 15;
      // Adjust layout when preview panel is shown
      const availableWidth = this.shopCategory === 'skins' ? CFG.W - 280 : CFG.W;
      const itemsStartX = (availableWidth - (itemsPerRow * itemWidth + (itemsPerRow - 1) * gapX)) / 2 + 20;
      
      items.forEach((item, i) => {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        const x = itemsStartX + col * (itemWidth + gapX);
        const y = startItemY + row * (itemHeight + gapY);
        
        const isOwned = Shop.inventory[this.shopCategory].includes(item.id);
        const isEquipped = Shop.equipped[this.shopCategory] === item.id;
        
        // For skins, draw color indicator
        if (this.shopCategory === 'skins' && item.color) {
          // Color swatch
          ctx.fillStyle = item.color;
          ctx.shadowColor = item.color;
          ctx.shadowBlur = isEquipped ? 15 : 5;
          ctx.fillRect(x + 10, y + 15, 40, 40);
          ctx.shadowBlur = 0;
          
          // Border around swatch
          ctx.strokeStyle = isEquipped ? '#22c55e' : isOwned ? '#60a5fa' : '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 10, y + 15, 40, 40);
        }
        
        // Item background
        const bgOffset = this.shopCategory === 'skins' ? 60 : 0;
        if (isEquipped) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
          ctx.fillRect(x + bgOffset, y, itemWidth - bgOffset, itemHeight);
          ctx.strokeStyle = '#22c55e';
        } else if (isOwned) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fillRect(x + bgOffset, y, itemWidth - bgOffset, itemHeight);
          ctx.strokeStyle = '#60a5fa';
        } else {
          ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
          ctx.fillRect(x + bgOffset, y, itemWidth - bgOffset, itemHeight);
          ctx.strokeStyle = '#475569';
        }
        ctx.lineWidth = 2;
        ctx.strokeRect(x + bgOffset, y, itemWidth - bgOffset, itemHeight);
        
        // Item name
        ctx.textAlign = 'left';
        ctx.font = '600 16px Inter, sans-serif';
        ctx.fillStyle = isEquipped ? '#22c55e' : '#f8fafc';
        ctx.fillText(item.name + (isEquipped ? ' ✓' : ''), x + bgOffset + 12, y + 28);
        
        // Item description
        ctx.font = '400 11px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(item.desc, x + bgOffset + 12, y + 48);
        
        // Price or status
        ctx.textAlign = 'right';
        if (isEquipped) {
          ctx.font = '600 13px Inter, sans-serif';
          ctx.fillStyle = '#22c55e';
          ctx.fillText('EQUIPPED', x + itemWidth - 12, y + 28);
        } else if (isOwned) {
          ctx.font = '500 13px Inter, sans-serif';
          ctx.fillStyle = '#60a5fa';
          ctx.fillText('OWNED', x + itemWidth - 12, y + 28);
        } else if (item.cost === 0) {
          ctx.font = '500 13px Inter, sans-serif';
          ctx.fillStyle = '#4ade80';
          ctx.fillText('FREE', x + itemWidth - 12, y + 28);
        } else {
          ctx.font = '600 14px Inter, sans-serif';
          const canAfford = Shop.pearls >= item.cost;
          ctx.fillStyle = canAfford ? '#fde047' : '#ef4444';
          ctx.fillText(`🐚 ${item.cost}`, x + itemWidth - 12, y + 28);
        }
      });
      
      // Back button
      const backYShop = CFG.H - 55;
      const backWidthShop = 140;
      const backHeightShop = 36;
      const backXShop = CFG.W / 2 - backWidthShop / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(backXShop, backYShop, backWidthShop, backHeightShop);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(backXShop, backYShop, backWidthShop, backHeightShop);

      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('← BACK (B)', CFG.W / 2, backYShop + 24);

      // Footer hint
      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillText('CLICK item to buy/equip | TAB to switch category', CFG.W / 2, CFG.H - 15);
    }
    
    // 🛡️ ADMIN PANEL OVERLAY
    if (this.showAdminPanel && typeof Auth !== 'undefined' && Auth.isMod()) {
      // Darken background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.98)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      
      // Title
      ctx.textAlign = 'center';
      ctx.font = '700 36px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('🛡️ ADMIN PANEL', CFG.W / 2, 60);
      
      // Role indicator
      const role = Auth.getRole();
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillStyle = role === 'admin' ? '#ef4444' : '#f59e0b';
      ctx.fillText(`Role: ${role.toUpperCase()}`, CFG.W / 2, 90);
      
      // Admin commands as buttons
      const commands = [
        { id: 'pearls', label: '+1000 Pearls', icon: '🐚', color: '#fde047' },
        { id: 'unlock', label: 'Unlock All Items', icon: '🔓', color: '#22c55e' },
        { id: 'god', label: 'God Mode', icon: '👑', color: '#f472b6' },
        { id: 'level1', label: 'Warp: Level 1', icon: '1️⃣', color: '#60a5fa' },
        { id: 'level3', label: 'Warp: Level 3 (Boss)', icon: '3️⃣', color: '#f87171' },
        { id: 'level6', label: 'Warp: Level 6 (Final)', icon: '6️⃣', color: '#ef4444' },
        { id: 'shield', label: 'Give Shield', icon: '🛡️', color: '#4ade80' },
        { id: 'weapon', label: 'Give Weapon', icon: '🔫', color: '#f97316' },
        { id: 'life', label: '+1 Life', icon: '❤️', color: '#f43f5e' },
        { id: 'close', label: 'Close Panel', icon: '✕', color: '#94a3b8' }
      ];
      
      const btnWidth = 160;
      const btnHeight = 50;
      const gap = 15;
      const cols = 4;
      const startX = CFG.W / 2 - (cols * btnWidth + (cols - 1) * gap) / 2;
      const startY = 130;
      
      commands.forEach((cmd, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (btnWidth + gap);
        const y = startY + row * (btnHeight + gap);
        
        // Button background
        ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
        ctx.fillRect(x, y, btnWidth, btnHeight);
        ctx.strokeStyle = cmd.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, btnWidth, btnHeight);
        
        // Icon
        ctx.font = '20px Arial';
        ctx.fillStyle = cmd.color;
        ctx.textAlign = 'left';
        ctx.fillText(cmd.icon, x + 12, y + 32);
        
        // Label
        ctx.font = '500 13px Inter, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(cmd.label, x + 42, y + 30);
      });
      
      // Instructions
      ctx.textAlign = 'center';
      ctx.font = '400 13px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('CLICK command to execute | JUMP or ` to close', CFG.W / 2, CFG.H - 30);
      
      // Secret promotion info
      ctx.font = '400 11px Inter, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('Secret: Type "ADMIN" on keyboard to become admin', CFG.W / 2, CFG.H - 15);
    }
  },
  
  // Helper: Select a menu option by name
  selectMenuOption(option) {
    if (option === 'PLAY') {
      this.state = STATE.MODE_SELECT;
      this.menuIdx = 0;
    } else if (option === 'TUTORIAL') {
      this.startTutorial();
    } else if (option === 'RANKED') {
      this.state = STATE.RANKED;
    } else if (option === 'LEADERBOARD') {
      this.state = STATE.LEADERBOARD;
      this.leaderboardType = 'global';
    } else if (option === 'SHOP') {
      this.showShop = true;
      this.shopCategory = 'skins';
    } else if (option === 'ADMIN') {
      // Toggle admin panel
      this.showAdminPanel = !this.showAdminPanel;
    } else if (option === 'LOGIN') {
      if (typeof AuthUI !== 'undefined') AuthUI.show();
    } else if (option === 'LOGOUT') {
      if (typeof Auth !== 'undefined') {
        Auth.logout();
        window.dispatchEvent(new Event('auth:logout'));
      }
    } else if (option === 'ADVENTURE' || option === 'SURVIVAL' || option === 'BULLET_HELL') {
      const modeIdx = MODES.findIndex(m => m.name === option);
      if (modeIdx !== -1) {
        this.selectedMode = modeIdx;
        if (this.player) {
          this.player.canShoot = (modeIdx === 2);
          if (modeIdx === 2) this.player.weaponLevel = 1;
        }
        this.state = STATE.CHAR_SELECT;
        this.menuIdx = 0;
      }
    } else if (option === '1v1 PVP') {
      // Start 1v1 matchmaking
      this.startMatchmaking();
    } else if (CHARACTERS.find(c => c.name === option)) {
      const charIdx = CHARACTERS.findIndex(c => c.name === option);
      if (charIdx !== -1) {
        this.selectedChar = charIdx;
        this.state = STATE.DIFF_SELECT;
        this.menuIdx = 1;
      }
    } else if (DIFFICULTIES.find(d => d.name === option)) {
      const diffIdx = DIFFICULTIES.findIndex(d => d.name === option);
      if (diffIdx !== -1) {
        this.selectedDifficulty = diffIdx;
        this.stats = { time: 0, deaths: 0, crystals: 0, score: 0, pearls: Shop.pearls };
        this.initLevel(0);
        this.state = STATE.PLAY;
      }
    }
  },
  
  // Helper: Get menu item index at click position - updated for card-based UI
  getMenuItemAtPosition(x, y, itemCount, state) {
    // x and y are already canvas coordinates (scaled in input.js)
    const canvasX = x;
    const canvasY = y;
    
    const centerX = CFG.W / 2;
    
    // TITLE screen - card-based vertical layout
    if (state === STATE.TITLE) {
      const cardWidth = 320;
      const cardHeight = 50;
      const gap = 12;
      const startY = 120 + 160; // After title area
      const cardX = centerX - cardWidth / 2;
      
      for (let i = 0; i < itemCount; i++) {
        const cardY = startY + i * (cardHeight + gap);
        if (canvasX >= cardX && canvasX <= cardX + cardWidth &&
            canvasY >= cardY && canvasY <= cardY + cardHeight) {
          return i;
        }
      }
      return -1;
    }
    
    // MODE SELECT - card-based vertical layout
    if (state === STATE.MODE_SELECT) {
      const cardWidth = 360;
      const cardHeight = 100; // Reduced to fit 4 modes
      const gap = 15;
      const startY = 80 + 60; // After title
      const cardX = centerX - cardWidth / 2;

      for (let i = 0; i < itemCount; i++) {
        const cardY = startY + i * (cardHeight + gap);
        if (canvasX >= cardX && canvasX <= cardX + cardWidth &&
            canvasY >= cardY && canvasY <= cardY + cardHeight) {
          return i;
        }
      }
      return -1;
    }
    
    // CHAR SELECT - horizontal card layout
    if (state === STATE.CHAR_SELECT) {
      const cardWidth = 280;
      const cardHeight = 200;
      const gap = 30;
      const startY = 80 + 80; // After title
      const totalWidth = itemCount * cardWidth + (itemCount - 1) * gap;
      const startX = centerX - totalWidth / 2;
      
      for (let i = 0; i < itemCount; i++) {
        const cardX = startX + i * (cardWidth + gap);
        if (canvasX >= cardX && canvasX <= cardX + cardWidth &&
            canvasY >= startY && canvasY <= startY + cardHeight) {
          return i;
        }
      }
      return -1;
    }
    
    // DIFF_SELECT - 3x3 grid layout
    if (state === STATE.DIFF_SELECT) {
      const cols = 3;
      const cardWidth = 240;
      const cardHeight = 110;
      const gapX = 20;
      const gapY = 20;
      const startY = 80 + 70; // After title
      const startX = centerX - (cols * cardWidth + (cols - 1) * gapX) / 2;
      
      for (let i = 0; i < itemCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cardX = startX + col * (cardWidth + gapX);
        const cardY = startY + row * (cardHeight + gapY);
        if (canvasX >= cardX && canvasX <= cardX + cardWidth &&
            canvasY >= cardY && canvasY <= cardY + cardHeight) {
          return i;
        }
      }
      return -1;
    }
    
    return -1;
  },
  
  // Helper: Check if back button was clicked
  isBackButtonClicked(x, y) {
    // Back button area at bottom center (matches drawn button)
    const backY = CFG.H - 55;
    const backHeight = 36;
    const backWidth = 140;
    const backX = CFG.W / 2 - backWidth / 2;
    
    return y >= backY && y <= backY + backHeight &&
           x >= backX && x <= backX + backWidth;
  },
  
  // Helper: Start playable tutorial
  startTutorial() {
    this.selectedMode = 0; // Adventure mode
    this.selectedChar = 0; // Default diver
    this.selectedDifficulty = 0; // Casual (easiest for learning)
    this.stats = { time: 0, deaths: 0, crystals: 0, score: 0, pearls: Shop.pearls };
    this.initLevel(0);
    this.state = STATE.PLAY;
    this.tutorialMode = true;
    this.tutorialStep = 0;
  },
  
  // Opponent names for matchmaking
  opponentNames: [
    'Neptune', 'Poseidon', 'Aquaman', 'Nemo', 'Dory', 'Marlin', 'Crush', 'Squirt', 
    'Sebastian', 'Flounder', 'Ariel', 'Ursula', 'KingTriton', 'Manta', 'Kraken',
    'DeepDiver', 'BubbleBuddy', 'CoralReef', 'JellyFish', 'StarFish'
  ],
  
  // Helper: Start 1v1 matchmaking
  startMatchmaking() {
    this.state = STATE.MATCHMAKING;
    this.matchmakingStep = 0;
    this.opponentName = null;
    
    // Simulate matchmaking steps
    const steps = [
      () => { this.matchmakingStep = 0; },
      () => { this.matchmakingStep = 1; },
      () => { this.matchmakingStep = 2; },
      () => { 
        this.matchmakingStep = 3;
        // Pick random opponent
        this.opponentName = this.opponentNames[Math.floor(Math.random() * this.opponentNames.length)];
      },
      () => { 
        this.matchmakingStep = 4;
        // Start 1v1 game
        setTimeout(() => this.start1v1Game(), 500);
      }
    ];
    
    // Run each step with delays
    let stepIndex = 0;
    const runStep = () => {
      if (stepIndex < steps.length && this.state === STATE.MATCHMAKING) {
        steps[stepIndex]();
        stepIndex++;
        setTimeout(runStep, 1500);
      }
    };
    
    runStep();
  },
  
  // Helper: Cancel matchmaking
  cancelMatchmaking() {
    this.state = STATE.MODE_SELECT;
    this.matchmakingStep = 0;
    this.opponentName = null;
  },
  
  // Helper: Start 1v1 game
  start1v1Game() {
    if (this.state !== STATE.MATCHMAKING) return;
    
    this.selectedMode = 3; // 1v1 PVP mode
    this.selectedChar = 0; // Default character
    this.selectedDifficulty = 1; // Standard difficulty
    this.stats = { time: 0, deaths: 0, crystals: 0, score: 0, pearls: Shop.pearls };
    
    // Initialize 1v1 level (use survival style but with race mechanics)
    this.initLevel(0);
    
    // Add opponent ghost
    this.ghostOpponent = {
      name: this.opponentName,
      x: this.player.x,
      y: this.player.y,
      color: '#ff6b6b'
    };
    
    this.state = STATE.PLAY;
    this.matchmakingStep = 0;
  },
  
  // Helper: Handle shop clicks
  handleShopClick(x, y) {
    const canvasX = x;
    const canvasY = y;
    
    // Check category tab clicks
    const categories = ['skins', 'emotes', 'trails', 'nameplates'];
    const tabWidth = 180;
    const tabHeight = 40;
    const startX = CFG.W / 2 - (categories.length * tabWidth) / 2;
    const tabY = 160;
    
    for (let i = 0; i < categories.length; i++) {
      const tabX = startX + i * tabWidth;
      if (canvasX >= tabX && canvasX <= tabX + tabWidth - 10 &&
          canvasY >= tabY && canvasY <= tabY + tabHeight) {
        this.shopCategory = categories[i];
        return;
      }
    }
    
    // Check item clicks - updated for new layout
    const items = Shop.items[this.shopCategory] || [];
    const itemHeight = 70;
    const itemsPerRow = 2;
    const itemWidth = this.shopCategory === 'skins' ? 280 : 350;
    const startItemY = 230;
    const gapX = this.shopCategory === 'skins' ? 20 : 40;
    const gapY = this.shopCategory === 'skins' ? 15 : 20;
    // Adjust layout when preview panel is shown
    const availableWidth = this.shopCategory === 'skins' ? CFG.W - 280 : CFG.W;
    const itemsStartX = (availableWidth - (itemsPerRow * itemWidth + (itemsPerRow - 1) * gapX)) / 2 + 20;
    
    for (let i = 0; i < items.length; i++) {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      const itemX = itemsStartX + col * (itemWidth + gapX);
      const itemY = startItemY + row * (itemHeight + gapY);
      
      // For skins, account for the swatch offset
      const bgOffset = this.shopCategory === 'skins' ? 60 : 0;
      
      if (canvasX >= itemX && canvasX <= itemX + itemWidth &&
          canvasY >= itemY && canvasY <= itemY + itemHeight) {
        const item = items[i];
        const isOwned = Shop.inventory[this.shopCategory].includes(item.id);
        const isEquipped = Shop.equipped[this.shopCategory] === item.id;
        
        if (isEquipped) {
          // Already equipped - do nothing
          return;
        } else if (isOwned) {
          // Equip the item
          Shop.equipItem(this.shopCategory, item.id);
        } else {
          // Try to buy
          if (Shop.buyItem(this.shopCategory, item.id)) {
            // Auto-equip after buying
            Shop.equipItem(this.shopCategory, item.id);
          }
        }
        return;
      }
    }
  },
  
  // 🛡️ Helper: Handle admin panel clicks
  handleAdminClick(x, y) {
    const canvasX = x;
    const canvasY = y;
    
    const commands = [
      { id: 'pearls' },
      { id: 'unlock' },
      { id: 'god' },
      { id: 'level1' },
      { id: 'level3' },
      { id: 'level6' },
      { id: 'shield' },
      { id: 'weapon' },
      { id: 'life' },
      { id: 'close' }
    ];
    
    const btnWidth = 160;
    const btnHeight = 50;
    const gap = 15;
    const cols = 4;
    const startX = CFG.W / 2 - (cols * btnWidth + (cols - 1) * gap) / 2;
    const startY = 130;
    
    for (let i = 0; i < commands.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnWidth + gap);
      const y = startY + row * (btnHeight + gap);
      
      if (canvasX >= x && canvasX <= x + btnWidth &&
          canvasY >= y && canvasY <= y + btnHeight) {
        
        const cmd = commands[i];
        
        if (cmd.id === 'close') {
          this.showAdminPanel = false;
          return;
        }
        
        // Execute admin command
        if (typeof Auth !== 'undefined') {
          switch(cmd.id) {
            case 'pearls': Auth.adminGivePearls(1000); break;
            case 'unlock': Auth.adminUnlockAllItems(); break;
            case 'god': Auth.adminGodMode(); break;
            case 'level1': Auth.adminSetLevel(1); break;
            case 'level3': Auth.adminSetLevel(3); break;
            case 'level6': Auth.adminSetLevel(6); break;
            case 'shield': Auth.adminSpawnPowerUp('SHIELD'); break;
            case 'weapon': Auth.adminSpawnPowerUp('WEAPON'); break;
            case 'life': Auth.adminSpawnPowerUp('LIFE'); break;
          }
        }
        return;
      }
    }
  }
};

// Expose to window for pause toggle
window.GameState = GameState;
