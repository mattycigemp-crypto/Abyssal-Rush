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
  
  player: new Player(),
  enemies: [],
  crystals: [],
  scatteredCrystals: [],
  powerups: [],
  projectiles: [],

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
      this.player.hasDoubleJump = false;
      this.player.canShoot = false;
    }

    this.enemies = level.enemies.map(e => new Enemy(e));
    if (level.boss) this.enemies.push(new Enemy(level.boss));
    this.crystals = level.crystals.map(p => ({ ...p, col: false, vx: 0, vy: 0 }));
    this.scatteredCrystals = [];
    this.powerups = (level.powerups || []).map(p => new PowerUp(p));
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
    
    this.player.reset(level.spawn.x, level.spawn.y, char);
    this.player.lives = startLives;
    this.player.maxLives = startLives;
    
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
      spawn: { x: 50, y: 350 },
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
      spawn: { x: 50, y: 450 },
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
    
    this.player.reset(cp.x, cp.y, this.player.stats);
    this.player.inv = 120;
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

    if (this.state === STATE.TITLE) {
      // Title menu options - include LOGOUT if logged in
      const baseOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
      const menuOptions = (typeof Auth !== 'undefined' && Auth.isLoggedIn) 
        ? [...baseOptions, 'LOGOUT']
        : [...baseOptions, 'LOGIN'];
      
      // Ensure menuIdx stays within bounds when menu size changes
      if (this.menuIdx >= menuOptions.length) {
        this.menuIdx = menuOptions.length - 1;
      }
      
      if (Input.justPressed('Dash')) {
        this.menuIdx = (this.menuIdx + 1) % menuOptions.length;
      }
      
      if (Input.justPressed('Jump')) {
        const option = menuOptions[this.menuIdx];
        if (option === 'PLAY') {
          this.state = STATE.MODE_SELECT;
          this.menuIdx = 0;
        } else if (option === 'TUTORIAL') {
          this.state = STATE.TUTORIAL;
          this.tutorialPage = 0;
        } else if (option === 'RANKED') {
          this.state = STATE.RANKED;
        } else if (option === 'LEADERBOARD') {
          this.state = STATE.LEADERBOARD;
          this.leaderboardType = 'global';
        } else if (option === 'SHOP') {
          this.showShop = true;
          this.shopCategory = 'skins';
        } else if (option === 'LOGIN') {
          if (typeof AuthUI !== 'undefined') AuthUI.show();
        } else if (option === 'LOGOUT') {
          if (typeof Auth !== 'undefined') {
            Auth.logout();
            window.dispatchEvent(new Event('auth:logout'));
          }
        }
      }
    } else if (this.state === STATE.MODE_SELECT) {
      if (Input.justPressed('Dash')) this.menuIdx = (this.menuIdx + 1) % MODES.length;
      if (Input.justPressed('Jump')) {
        this.selectedMode = this.menuIdx;
        // Enable shooting for BULLET_HELL mode
        if (this.player) {
          this.player.canShoot = (this.menuIdx === 2);
          if (this.menuIdx === 2) this.player.weaponLevel = 1;
        }
        this.state = STATE.CHAR_SELECT;
        this.menuIdx = 0;
      }
    } else if (this.state === STATE.CHAR_SELECT) {
      if (Input.justPressed('Dash')) this.menuIdx = (this.menuIdx + 1) % CHARACTERS.length;
      if (Input.justPressed('Jump')) {
        this.selectedChar = this.menuIdx;
        this.state = STATE.DIFF_SELECT;
        this.menuIdx = 1; // Default to DIVER difficulty
      }
    } else if (this.state === STATE.DIFF_SELECT) {
      if (Input.justPressed('Dash')) this.menuIdx = (this.menuIdx + 1) % DIFFICULTIES.length;
      if (Input.justPressed('Jump')) {
        this.selectedDifficulty = this.menuIdx;
        this.stats = { time: 0, deaths: 0, crystals: 0, score: 0, pearls: Shop.pearls };
        this.initLevel(0);
        this.state = STATE.PLAY;
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
      for (let cp of level.checkpoints) {
        if (AABB(this.player, { x: cp.x - 10, y: cp.y - 60, w: 30, h: 100 })) {
          AudioSys.checkpoint();
          FX.spawn(cp.x, cp.y - 30, '#0f0', 15);
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
          this.nextLevel();
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
    } else if (this.state === STATE.WIN) {
      if (Input.justPressed('Jump')) this.state = STATE.TITLE;
    } else if (this.state === STATE.RANKED) {
      if (Input.justPressed('Jump') || Input.justPressed('Dash')) {
        this.state = STATE.TITLE;
      }
    } else if (this.state === STATE.LEADERBOARD) {
      if (Input.justPressed('Dash')) {
        const types = ['global', 'survival', 'weekly'];
        const idx = types.indexOf(this.leaderboardType);
        this.leaderboardType = types[(idx + 1) % types.length];
      }
      if (Input.justPressed('Jump')) {
        this.state = STATE.TITLE;
      }
    } else if (this.state === STATE.TUTORIAL) {
      if (Input.justPressed('Dash')) {
        this.tutorialPage = (this.tutorialPage + 1) % 5;
      }
      if (Input.justPressed('Jump')) {
        this.state = STATE.TITLE;
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

    // Background - Use user's bg.png with parallax + my effects on top
    if (this.bgLoaded && this.bgImage.complete) {
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
      ctx.textAlign = 'center';
      ctx.font = '800 72px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
      ctx.shadowBlur = 40;
      ctx.fillText('ABYSSAL RUSH', CFG.W / 2, CFG.H / 2 - 80);
      ctx.font = '300 36px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#93c5fd';
      ctx.letterSpacing = '8px';
      ctx.fillText('DEEP DIVE', CFG.W / 2, CFG.H / 2 - 30);
      ctx.shadowBlur = 0;
      
      // Menu options - dynamic based on auth state
      const baseOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
      const menuOptions = (typeof Auth !== 'undefined' && Auth.isLoggedIn) 
        ? [...baseOptions, 'LOGOUT']
        : [...baseOptions, 'LOGIN'];
      menuOptions.forEach((opt, i) => {
        const y = CFG.H / 2 + 30 + i * 50;
        const sel = this.menuIdx === i;
        ctx.font = sel ? '600 26px Inter, system-ui, sans-serif' : '400 22px Inter, system-ui, sans-serif';
        // LOGIN/LOGOUT get special colors
        if (opt === 'LOGIN') {
          ctx.fillStyle = sel ? '#4ade80' : '#22d3ee';
        } else if (opt === 'LOGOUT') {
          ctx.fillStyle = sel ? '#f43f5e' : '#fb923c';
        } else {
          ctx.fillStyle = sel ? '#60a5fa' : '#e2e8f0';
        }
        if (sel) {
          ctx.shadowColor = opt === 'LOGIN' ? 'rgba(74, 222, 128, 0.6)' : opt === 'LOGOUT' ? 'rgba(244, 63, 94, 0.6)' : 'rgba(59, 130, 246, 0.6)';
          ctx.shadowBlur = 20;
          ctx.fillText('> ' + opt + ' <', CFG.W / 2, y);
          ctx.shadowBlur = 0;
        } else {
          ctx.fillText(opt, CFG.W / 2, y);
        }
      });
      
      ctx.font = '500 13px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('CLICK option or use: DASH=Navigate | JUMP=Select | SCROLL to browse', CFG.W / 2, CFG.H - 40);
      ctx.fillStyle = '#475569';
      ctx.fillText('Collect 100 crystals for an extra life!', CFG.W / 2, CFG.H - 20);
      
      // Scroll indicators
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillStyle = this.menuIdx > 0 ? '#60a5fa' : '#334155';
      ctx.fillText('▲', CFG.W / 2, CFG.H / 2 + 15);
      ctx.fillStyle = this.menuIdx < (menuOptions.length - 1) ? '#60a5fa' : '#334155';
      ctx.fillText('▼', CFG.W / 2, CFG.H / 2 + 30 + (menuOptions.length - 1) * 50);
    } else if (this.state === STATE.MODE_SELECT) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.fillStyle = '#60a5fa'; ctx.font = '700 44px Inter, system-ui, sans-serif';
      ctx.fillText('SELECT MISSION', CFG.W/2, 100);
      MODES.forEach((m, i) => {
        const y = 200 + i * 100;
        const sel = this.menuIdx === i;
        const isBulletHell = m.id === 2;
        
        if (sel) {
          // Fire styling for BULLET_HELL mode!
          if (isBulletHell) {
            ctx.fillStyle = 'rgba(255,100,0,0.3)';
            ctx.shadowColor = '#f80';
            ctx.shadowBlur = 20;
          } else {
            ctx.fillStyle = 'rgba(0,170,255,0.2)';
            ctx.shadowBlur = 0;
          }
          ctx.fillRect(CFG.W/2 - 250, y - 40, 500, 70);
          ctx.strokeStyle = isBulletHell ? '#f80' : '#0ff';
          ctx.strokeRect(CFG.W/2 - 250, y - 40, 500, 70);
          ctx.shadowBlur = 0;
        }
        
        ctx.fillStyle = sel ? (isBulletHell ? '#fde047' : '#f8fafc') : (isBulletHell ? '#fbbf24' : '#64748b');
        ctx.font = '700 32px Inter, system-ui, sans-serif';
        ctx.fillText((isBulletHell ? '🔥 ' : '') + m.name, CFG.W/2, y + 10);
        
        if (sel) {
          ctx.font = '500 16px Inter, system-ui, sans-serif';
          ctx.fillStyle = isBulletHell ? '#fbbf24' : '#93c5fd';
          ctx.fillText(m.desc, CFG.W/2, y + 45);
        }
      });
      // Back button with hover
      const backBtnY = CFG.H - 50;
      const mouseY = this.mouseY || 0;
      const backHover = mouseY > backBtnY - 20 && mouseY < backBtnY + 10;
      ctx.fillStyle = backHover ? '#f8fafc' : '#64748b';
      ctx.font = backHover ? '600 16px Inter, sans-serif' : '500 14px Inter, sans-serif';
      if (backHover) {
        ctx.fillText('◀ ◀ ◀ BACK [B] ▶ ▶ ▶', CFG.W/2, backBtnY);
        ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.strokeRect(CFG.W/2 - 120, backBtnY - 20, 240, 30);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillText('◀ BACK [B]', CFG.W/2, backBtnY);
      }
      // Scroll indicators (now 3 modes!)
      ctx.font = '500 22px Inter, sans-serif';
      ctx.fillStyle = this.menuIdx > 0 ? '#60a5fa' : '#334155';
      ctx.fillText('▲', CFG.W/2, 170);
      ctx.fillStyle = this.menuIdx < 2 ? '#60a5fa' : '#334155';
      ctx.fillText('▼', CFG.W/2, 420);
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('DASH: CYCLE | JUMP: SELECT | SCROLL', CFG.W/2, CFG.H - 80);
    } else if (this.state === STATE.CHAR_SELECT) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.fillStyle = '#60a5fa'; ctx.font = '700 44px Inter, system-ui, sans-serif';
      ctx.fillText('CHOOSE YOUR DIVER', CFG.W/2, 100);
      CHARACTERS.forEach((c, i) => {
        const x = CFG.W/2 - 260 + i * 260;
        const sel = this.menuIdx === i;
        ctx.fillStyle = sel ? c.col : '#1e293b';
        ctx.strokeStyle = sel ? c.col : '#334155'; ctx.lineWidth = 3;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x - 110, 180, 220, 160, 16);
          ctx.fill(); ctx.stroke();
        } else {
          ctx.rect(x - 110, 180, 220, 160);
          ctx.fill(); ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = sel ? '#0f172a' : '#94a3b8';
        ctx.font = '700 32px Inter, system-ui, sans-serif';
        ctx.fillText(c.name, x, 250);
        if (sel) {
          ctx.fillStyle = '#e2e8f0'; ctx.font = '500 14px Inter, system-ui, sans-serif';
          ctx.fillText(c.desc, x, 365);
          ctx.fillStyle = c.col;
          ctx.font = '600 14px Inter, system-ui, sans-serif';
          ctx.fillText(`LIVES: ${c.lives} | SPD: ${c.spd}`, x, 390);
        }
      });
      // Back button with hover
      const backBtnY2 = CFG.H - 50;
      const mouseY2 = this.mouseY || 0;
      const backHover2 = mouseY2 > backBtnY2 - 20 && mouseY2 < backBtnY2 + 10;
      ctx.fillStyle = backHover2 ? '#f8fafc' : '#64748b';
      ctx.font = backHover2 ? '600 16px Inter, sans-serif' : '500 14px Inter, sans-serif';
      if (backHover2) {
        ctx.fillText('◀ ◀ ◀ BACK [B] ▶ ▶ ▶', CFG.W/2, backBtnY2);
        ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.strokeRect(CFG.W/2 - 120, backBtnY2 - 20, 240, 30);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillText('◀ BACK [B]', CFG.W/2, backBtnY2);
      }
      // Scroll indicators
      ctx.font = '500 22px Inter, sans-serif';
      ctx.fillStyle = this.menuIdx > 0 ? '#60a5fa' : '#334155';
      ctx.fillText('▲', CFG.W/2, 130);
      ctx.fillStyle = this.menuIdx < 2 ? '#60a5fa' : '#334155';
      ctx.fillText('▼', CFG.W/2, 420);
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('DASH: CYCLE | JUMP: SELECT | SCROLL', CFG.W/2, CFG.H - 80);
    } else if (this.state === STATE.DIFF_SELECT) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(0,0,CFG.W,CFG.H);
      ctx.fillStyle = '#e879f9'; ctx.font = '700 44px Inter, system-ui, sans-serif';
      ctx.fillText('CHOOSE DIFFICULTY', CFG.W/2, 80);
      
      // Show difficulties in a 3x3 grid
      const cols = 3;
      const rows = 3;
      const boxW = 260;
      const boxH = 120;
      const startX = CFG.W/2 - (cols * boxW) / 2 + boxW/2;
      const startY = 150;
      
      DIFFICULTIES.forEach((d, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * boxW;
        const y = startY + row * (boxH + 20);
        const sel = this.menuIdx === i;
        
        // Box background
        ctx.fillStyle = sel ? d.color : '#1e293b';
        ctx.globalAlpha = sel ? 1 : 0.6;
        ctx.shadowBlur = sel ? 20 : 0;
        ctx.shadowColor = d.color;
        ctx.fillRect(x - boxW/2, y, boxW, boxH);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        
        // Border
        ctx.strokeStyle = d.color;
        ctx.lineWidth = sel ? 3 : 1;
        ctx.strokeRect(x - boxW/2, y, boxW, boxH);
        
        // Text
        ctx.fillStyle = sel ? '#0f172a' : '#cbd5e1';
        ctx.font = '700 24px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.name, x, y + 35);
        
        // Description
        if (sel) {
          ctx.fillStyle = '#f1f5f9';
          ctx.font = '500 12px Inter, system-ui, sans-serif';
          const words = d.desc.split(' ');
          let line = '';
          let lineY = y + 60;
          words.forEach(word => {
            if ((line + word).length > 35) {
              ctx.fillText(line, x, lineY);
              line = word + ' ';
              lineY += 16;
            } else {
              line += word + ' ';
            }
          });
          ctx.fillText(line, x, lineY);
          
          // Pearl multiplier
          ctx.fillStyle = '#fde047';
          ctx.font = '700 14px Inter, system-ui, sans-serif';
          ctx.fillText(`${d.modifiers.pearlMult}x PEARLS`, x, y + boxH - 10);
        }
      });
      
      // Back button with hover
      const backBtnY3 = CFG.H - 30;
      const mouseY3 = this.mouseY || 0;
      const backHover3 = mouseY3 > backBtnY3 - 20 && mouseY3 < backBtnY3 + 10;
      ctx.fillStyle = backHover3 ? '#f8fafc' : '#64748b';
      ctx.font = backHover3 ? '600 16px Inter, sans-serif' : '500 14px Inter, sans-serif';
      if (backHover3) {
        ctx.fillText('◀ ◀ ◀ BACK [B] ▶ ▶ ▶', CFG.W/2, backBtnY3);
        ctx.shadowColor = 'rgba(59, 130, 246, 0.6)';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.strokeRect(CFG.W/2 - 120, backBtnY3 - 20, 240, 30);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillText('◀ BACK [B]', CFG.W/2, backBtnY3);
      }
      // Scroll indicators
      ctx.font = '500 18px Inter, sans-serif';
      ctx.fillStyle = this.menuIdx >= 3 ? '#60a5fa' : '#334155';
      ctx.fillText('◀ Prev', CFG.W/2 - 400, CFG.H - 50);
      ctx.fillStyle = this.menuIdx < 6 ? '#60a5fa' : '#334155';
      ctx.fillText('Next ▶', CFG.W/2 + 400, CFG.H - 50);
      ctx.font = '500 13px Inter, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('SCROLL to browse | JUMP: Select', CFG.W/2, CFG.H - 30);
    } else if (this.state === STATE.PLAY || this.state === STATE.PAUSE || this.state === STATE.DEAD) {
      ctx.textAlign = 'left';

      // Lives - modern styling
      ctx.fillStyle = '#f43f5e';
      ctx.font = '600 22px Inter, sans-serif';
      for (let i = 0; i < this.player.lives; i++) {
        ctx.fillText('♥', 24 + i * 28, 35);
      }

      // Crystals
      ctx.fillStyle = this.stats.crystals === 0 ? '#fda4af' : '#fbbf24';
      ctx.font = '700 22px Inter, system-ui, sans-serif';
      ctx.fillText(`CRYSTALS ${this.stats.crystals.toString().padStart(3, '0')}`, 24, 68);

      // Score
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(`SCORE ${this.stats.score.toString().padStart(6, '0')}`, 24, 98);

      // Time
      let m = Math.floor(this.stats.time / 3600);
      let s = Math.floor(this.stats.time / 60) % 60;
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText(`${m}:${s.toString().padStart(2, '0')}`, CFG.W - 140, 35);
      
      // Pearls
      ctx.fillStyle = '#e0f2fe';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText(`🐚 ${this.stats.pearls}`, CFG.W - 140, 65);
      
      // 🔥 BULLET HELL mode indicator
      if (this.player.canShoot) {
        ctx.fillStyle = '#fb923c';
        ctx.font = '700 18px Inter, sans-serif';
        ctx.fillText(`🔥 LVL ${this.player.weaponLevel}`, CFG.W - 140, 95);
        ctx.fillStyle = '#fdba74';
        ctx.font = '500 13px Inter, sans-serif';
        ctx.fillText('HOLD DASH TO SHOOT', 24, 128);
      }
      
      // Difficulty
      const diff = DIFFICULTIES[this.selectedDifficulty];
      ctx.fillStyle = diff.color;
      ctx.font = '700 14px Inter, sans-serif';
      ctx.fillText(diff.name, CFG.W - 80, 120);
      
      // Difficulty mechanic indicators
      if (diff.modifiers.hpDrain) {
        // CRUSH DEPTH: HP drain indicator
        const drainSec = Math.ceil(this.hpDrainTimer / 60);
        ctx.fillStyle = drainSec < 3 ? '#f43f5e' : '#a855f7';
        ctx.font = '700 16px Inter, sans-serif';
        ctx.fillText(`⏱️ ${drainSec}s`, CFG.W - 80, 105);
        
        // HP bar
        ctx.fillStyle = '#334155';
        ctx.fillRect(CFG.W - 100, 110, 80, 8);
        ctx.fillStyle = this.player.lives > 1 ? '#4ade80' : '#f43f5e';
        ctx.fillRect(CFG.W - 100, 110, 80 * (this.player.lives / this.player.maxLives), 8);
      }
      
      if (this.levelTimeLimit > 0) {
        // SPEEDRUN: Time limit indicator
        const timeSec = Math.ceil(this.levelTimeLimit / 60);
        const timeColor = timeSec < 10 ? '#f43f5e' : (timeSec < 20 ? '#fb923c' : '#fbbf24');
        ctx.fillStyle = timeColor;
        ctx.font = '700 20px Inter, sans-serif';
        ctx.fillText(`⏰ ${timeSec}s`, 24, 158);
      }
      
      // ASCENSION: Reverse gravity indicator
      if (diff.modifiers.reverseGravity) {
        ctx.fillStyle = '#e879f9';
        ctx.font = '700 16px Inter, sans-serif';
        ctx.fillText('🔄 REVERSE G!', 24, 185);
      }

      // Power-up indicators
      let px = CFG.W - 150;
      if (this.player.shield) {
        ctx.fillStyle = '#4ade80';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText('SHIELD', px, 145);
      }
      if (this.player.magnet) {
        ctx.fillStyle = '#e879f9';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText('MAGNET', px, this.player.shield ? 165 : 145);
      }
      if (this.player.speedBoost > 0) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText('SPEED', px, 145 + (this.player.shield ? 20 : 0) + (this.player.magnet ? 20 : 0));
      }

      // Level indicator
      ctx.textAlign = 'center';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`LEVEL ${this.currentLevel + 1} / ${LEVELS.length}`, CFG.W / 2, 35);

      // Pause overlay
      if (this.state === STATE.PAUSE) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        ctx.textAlign = 'center';
        ctx.font = '800 52px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#60a5fa';
        ctx.fillText('PAUSED', CFG.W / 2, CFG.H / 2);
        ctx.font = '400 20px Inter, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('Press JUMP to resume', CFG.W / 2, CFG.H / 2 + 55);
      }

      // Death overlay
      if (this.state === STATE.DEAD) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, CFG.W, CFG.H);
        ctx.textAlign = 'center';
        ctx.font = '800 52px Inter, system-ui, sans-serif';
        if (this.player.lives <= 0) {
          ctx.fillStyle = '#f43f5e';
          ctx.fillText('GAME OVER', CFG.W / 2, CFG.H / 2);
          ctx.font = '400 20px Inter, sans-serif';
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText('Press JUMP to return to title', CFG.W / 2, CFG.H / 2 + 65);
        } else {
          ctx.fillStyle = '#fb923c';
          ctx.fillText('HIT!', CFG.W / 2, CFG.H / 2);
          ctx.font = '600 24px Inter, sans-serif';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(`Lives: ${this.player.lives}`, CFG.W / 2, CFG.H / 2 + 55);
        }
      }
    } else if (this.state === STATE.WIN) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      ctx.textAlign = 'center';
      ctx.font = '800 56px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.shadowColor = 'rgba(74, 222, 128, 0.5)';
      ctx.shadowBlur = 30;
      ctx.fillText('MISSION COMPLETE!', CFG.W / 2, CFG.H / 2 - 80);
      ctx.shadowBlur = 0;
      ctx.font = '600 26px Inter, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`FINAL SCORE: ${this.stats.score}`, CFG.W / 2, CFG.H / 2 - 10);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`CRYSTALS: ${this.stats.crystals}`, CFG.W / 2, CFG.H / 2 + 30);
      let tStr = Math.floor(this.stats.time / 3600) + ':' + (Math.floor(this.stats.time / 60) % 60).toString().padStart(2, '0');
      ctx.fillText(`TIME: ${tStr}`, CFG.W / 2, CFG.H / 2 + 65);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`DEATHS: ${this.stats.deaths}`, CFG.W / 2, CFG.H / 2 + 100);
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = '#fff';
        ctx.fillText('PRESS JUMP TO PLAY AGAIN', CFG.W / 2, CFG.H / 2 + 150);
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
      
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText('JUMP / DASH to return', CFG.W / 2, CFG.H - 30);
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
      
      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '500 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`DASH: Switch (${lbType}) | JUMP: Return`, CFG.W / 2, CFG.H - 30);
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
      ctx.fillText(`Page ${(this.tutorialPage || 0) + 1} / 5`, CFG.W / 2, CFG.H - 50);
      
      // Footer
      ctx.fillStyle = '#60a5fa';
      ctx.font = '500 14px Inter, sans-serif';
      ctx.fillText('DASH = Next Page  |  JUMP = Return to Menu', CFG.W / 2, CFG.H - 25);
    }
  }
};

// Expose to window for pause toggle
window.GameState = GameState;
