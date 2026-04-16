/**
 * Entity Classes - Player, Enemies, Projectiles, PowerUps, etc.
 */

// Base Entity
class Entity {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
  }

  moveX(platforms) {
    this.x += this.vx;
    for (let p of platforms) {
      if (AABB(this, p)) {
        if (this.vx > 0) {
          this.x = p.x - this.w;
          this.vx = 0;
        } else if (this.vx < 0) {
          this.x = p.x + p.w;
          this.vx = 0;
        }
        return true;
      }
    }
    return false;
  }

  moveY(platforms) {
    this.y += this.vy;
    let ground = false;
    for (let p of platforms) {
      if (AABB(this, p)) {
        if (this.vy > 0) {
          this.y = p.y - this.h;
          ground = true;
        } else if (this.vy < 0) {
          this.y = p.y + p.h;
        }
        this.vy = 0;
      }
    }
    return ground;
  }
}

// Scattered Crystal (when hit)
class ScatteredCrystal extends Entity {
  constructor(x, y) {
    super(x, y, 14, 14);
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 3;
    this.timer = 200;
    this.blink = false;
  }

  update(platforms) {
    this.vy += CFG.GRAV * 0.8;
    this.moveX(platforms);
    if (this.moveY(platforms)) {
      this.vx *= 0.85;
      if (Math.abs(this.vy) > 2) this.vy = -this.vy * 0.4;
    }
    this.timer--;
    this.blink = this.timer < 80 && Math.floor(this.timer / 5) % 2 === 0;
    if (this.timer <= 0) this.alive = false;
  }
}

// PowerUp
class PowerUp extends Entity {
  constructor(cfg) {
    super(cfg.x, cfg.y, 24, 24);
    this.type = cfg.type;
    this.baseY = cfg.y;
    this.collected = false;
    this.pulse = 0;
  }

  update() {
    this.pulse += 0.1;
    this.y = this.baseY + Math.sin(this.pulse) * 3;
  }

  draw(ctx) {
    if (this.collected) return;

    const colors = {
      SHIELD: '#4ade80',
      MAGNET: '#e879f9',
      SPEED: '#fbbf24',
      DOUBLE_JUMP: '#22d3ee',
      EXTRA_LIFE: '#f43f5e',
      WEAPON: '#f97316'  // Orange for weapon upgrades!
    };
    const icons = {
      SHIELD: 'S',
      MAGNET: 'M',
      SPEED: '>>',
      DOUBLE_JUMP: '2J',
      EXTRA_LIFE: '1UP',
      WEAPON: '🔫'  // Gun icon for weapon!
    };

    ctx.shadowColor = colors[this.type];
    ctx.shadowBlur = 15 + Math.sin(this.pulse * 2) * 5;
    ctx.fillStyle = colors[this.type];
    ctx.beginPath();
    ctx.arc(this.x + 12, this.y + 12, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = this.type === 'WEAPON' ? '500 12px Inter, sans-serif' : '700 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icons[this.type], this.x + 12, this.y + 16);
    ctx.shadowBlur = 0;
  }
}

// Projectile
class Projectile extends Entity {
  constructor(x, y, vx, vy, owner) {
    super(x, y, 8, 8);
    this.vx = vx;
    this.vy = vy;
    this.owner = owner; // 'player' or 'enemy'
    this.life = 120;
  }

  update(platforms) {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0) this.alive = false;

    for (let p of platforms) {
      if (AABB(this, p)) {
        this.alive = false;
        FX.spawn(this.x, this.y, '#0af', 3);
      }
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.owner === 'player' ? '#22d3ee' : '#f43f5e';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x + 4, this.y + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class Player extends Entity {
  constructor() {
    super(0, 0, 18, 28);
    this.lives = 3;
    this.maxLives = 5;
    this.stats = CHARACTERS[0];
  }

  reset(x, y, charData = null) {
    if (charData) this.stats = charData;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.alive = true;
    this.inv = CFG.IFRAMES;
    this.lives = this.lives || this.stats.lives;
    this.coyote = 0;
    this.buffer = 0;
    this.jumpHold = 0;
    this.dashTime = 0;
    this.dashCd = 0;
    this.face = 1;
    this.wallSlide = 0;
    this.onGround = false;
    this.doubleJump = false;
    this.hasDoubleJump = false;
    this.shield = false;
    this.magnet = false;
    this.speedBoost = 0;
    // Shooting mechanics for BULLET_HELL mode
    this.canShoot = false;
    this.shootCd = 0;
    this.shootRate = 8;
    this.bulletSpeed = 12;
    this.weaponLevel = 1;
    this.spreadShot = false;
    this.rapidFire = false;
  }

  update(platforms, hazards, springs) {
    if (!this.alive) return;

    const maxSpd = this.speedBoost > 0 ? CFG.MAX_SPD * 1.5 : CFG.MAX_SPD;
    if (this.speedBoost > 0) this.speedBoost--;

    // Dash
    if (Input.justPressed('Dash') && this.dashCd <= 0) {
      this.dashTime = CFG.DASH_TIME;
      this.dashCd = CFG.DASH_CD;
      this.vx = this.face * CFG.DASH_SPD;
      this.vy = 0;
      AudioSys.dash();
      FX.spawn(this.x + 9, this.y + 14, '#0ff', 12, { vx: -this.face * 3, speed: 3, life: 0.5 });
    }

    if (this.dashTime > 0) {
      this.dashTime--;
      this.vy = 0;
      if (this.dashTime % 2 === 0) {
        FX.spawn(this.x + 9, this.y + 14, '#aff', 2, { vx: 0, vy: 0, speed: 2, life: 0.3 });
      }
    } else {
      let dir = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
      if (dir !== 0) this.face = dir;

      let accel = this.onGround ? CFG.ACCEL : CFG.AIR_ACCEL;
      let decel = this.onGround ? CFG.DECEL : CFG.AIR_DECEL;
      if (this.speedBoost > 0) accel *= 1.3;

      if (dir !== 0) {
        this.vx += dir * accel;
        if (Math.abs(this.vx) > maxSpd) this.vx = Math.sign(this.vx) * maxSpd;
      } else {
        this.vx *= decel;
        if (Math.abs(this.vx) < 0.15) this.vx = 0;
      }

      // Apply gravity (normal or reverse for ASCENSION mode)
      const grav = this.reverseGravity ? -CFG.GRAV : CFG.GRAV;
      const maxFall = this.reverseGravity ? -CFG.MAX_FALL : CFG.MAX_FALL;
      this.vy += grav;
      if (this.reverseGravity ? this.vy < maxFall : this.vy > maxFall) this.vy = maxFall;

      // Wall slide (inverted for reverse gravity)
      const wallSlideSpeed = this.reverseGravity ? -CFG.WALL_SLIDE : CFG.WALL_SLIDE;
      if (this.wallSlide !== 0 && 
          (this.reverseGravity ? this.vy < 0 : this.vy > 0) && 
          dir === this.wallSlide) {
        this.vy = wallSlideSpeed;
        if (Math.random() < 0.2) FX.spawnBubble(this.x + (this.face === 1 ? this.w : 0), this.y + this.h);
      }

      // Coyote time (on ground or ceiling for reverse gravity)
      if (this.onGround) {
        this.coyote = CFG.COYOTE_TIME;
        this.doubleJump = false;
      } else if (this.coyote > 0) {
        this.coyote--;
      }

      // Jump buffer (inverted controls for reverse gravity)
      const jumpKey = this.reverseGravity ? Input.justPressed('Dash') : Input.justPressed('Jump');
      if (jumpKey) {
        this.buffer = CFG.JUMP_BUFFER;
      } else if (this.buffer > 0) {
        this.buffer--;
      }

      // Jump execution (reverse gravity for ASCENSION)
      if (this.buffer > 0) {
        if (this.coyote > 0) {
          // In reverse gravity, "jump" pushes down (swim up)
          this.vy = this.reverseGravity ? -this.stats.jump : this.stats.jump;
          this.jumpHold = CFG.JUMP_HOLD;
          this.coyote = 0;
          this.buffer = 0;
          AudioSys.jump();
          const fxY = this.reverseGravity ? this.y - 10 : this.y + 28;
          FX.spawn(this.x + 9, fxY, this.stats.col, 6, { vx: 0, vy: this.reverseGravity ? -2 : 2, speed: 3 });
          for (let i = 0; i < 3; i++) FX.spawnBubble(this.x + Math.random() * this.w, this.y + this.h);
        } else if (this.wallSlide !== 0) {
          this.vy = this.reverseGravity ? -CFG.WALL_JUMP_Y : CFG.WALL_JUMP_Y;
          this.vx = -this.wallSlide * CFG.WALL_JUMP_X;
          this.wallSlide = 0;
          this.buffer = 0;
          this.face = Math.sign(this.vx);
          AudioSys.jump();
          FX.spawn(this.x + 9, this.y + 14, this.stats.col, 6);
        } else if (this.hasDoubleJump && !this.doubleJump) {
          this.vy = this.reverseGravity ? -CFG.DOUBLE_JUMP_FORCE : CFG.DOUBLE_JUMP_FORCE;
          this.doubleJump = true;
          this.buffer = 0;
          this.jumpHold = CFG.JUMP_HOLD;
          AudioSys.doubleJump();
          const fxY = this.reverseGravity ? this.y - 10 : this.y + 28;
          FX.spawn(this.x + 9, fxY, '#ff0', 10, { vx: 0, vy: this.reverseGravity ? -3 : 3, speed: 4 });
          FX.spawnBubble(this.x + 5, this.y + 20);
          FX.spawnBubble(this.x + 13, this.y + 20);
        }
      }

      // Variable jump height (reverse gravity compatible)
      if (Input.jump && this.jumpHold > 0) {
        const jumpForce = this.reverseGravity ? -Math.abs(this.stats.jump) : this.stats.jump;
        const doubleJumpForce = this.reverseGravity ? -Math.abs(CFG.DOUBLE_JUMP_FORCE) : CFG.DOUBLE_JUMP_FORCE;
        this.vy = this.doubleJump ? doubleJumpForce : jumpForce;
        this.jumpHold--;
      } else {
        this.jumpHold = 0;
      }
    }

    if (this.dashCd > 0) this.dashCd--;
    if (this.inv > 0) this.inv--;

    let hitWall = this.moveX(platforms);
    this.wallSlide = hitWall && !this.onGround && this.vy > 0 ? Math.sign(this.vx || this.face) : 0;
    this.onGround = this.moveY(platforms);

    // Hazards
    for (let h of hazards) {
      if (AABB(this, h)) {
        if (this.shield) {
          this.shield = false;
          this.inv = 60;
          FX.spawn(this.x, this.y, '#0f8', 15);
        } else {
          this.takeDamage();
        }
      }
    }

    // Springs
    for (let s of springs) {
      if (this.vy >= 0 && AABB(this, { x: s.x, y: s.y - 10, w: 30, h: 10 })) {
        this.vy = s.force;
        this.buffer = 0;
        this.jumpHold = 0;
        this.onGround = false;
        this.doubleJump = false;
        AudioSys.spring();
        FX.spawn(s.x + 15, s.y, '#fff', 20, { vx: 0, vy: -4, speed: 5 });
        for (let i = 0; i < 5; i++) FX.spawnBubble(s.x + 15, s.y);
      }
    }
  }

  takeDamage() {
    if (this.inv > 0 || !this.alive) return;

    // Track damage for no-damage achievement
    if (window.GameState) window.GameState.tookDamageThisLevel = true;

    if (window.GameState && window.GameState.stats.crystals > 0) {
      let scatterCount = Math.min(25, Math.floor(window.GameState.stats.crystals / 2) + 2);
      for (let i = 0; i < scatterCount; i++) {
        window.GameState.scatteredCrystals.push(new ScatteredCrystal(this.x + 9, this.y + 14));
      }
      window.GameState.stats.crystals = 0;
      window.GameState.scrShake = 12;
      this.inv = CFG.IFRAMES;
      this.vy = -4;
      this.vx = -this.face * CFG.KNOCKBACK;
      AudioSys.scatter();
      FX.spawn(this.x + 9, this.y + 14, '#67e8f9', 25, { speed: 6, life: 1.2 });
    } else {
      this.lives--;
      if (this.lives <= 0) {
        this.alive = false;
        AudioSys.gameOver();
        FX.spawn(this.x + 9, this.y + 14, '#f44', 40, { speed: 8, life: 1.5 });
      } else {
        this.inv = CFG.IFRAMES * 2;
        this.vy = -6;
        this.vx = -this.face * 6;
        AudioSys.hit();
        FX.spawn(this.x + 9, this.y + 14, '#f84', 20, { speed: 5 });
      }
      if (window.GameState) window.GameState.scrShake = 25;
    }
  }

  // 🔥 SHOOTING for BULLET_HELL mode
  shoot(projectiles) {
    if (!this.canShoot || this.shootCd > 0) return;
    
    this.shootCd = this.rapidFire ? Math.floor(this.shootRate / 2) : this.shootRate;
    const bulletX = this.x + 9;
    const bulletY = this.y + 10;
    
    // Basic forward shot
    projectiles.push(new Projectile(bulletX, bulletY, this.face * this.bulletSpeed, 0, 'player'));
    
    // Spread shot powerup
    if (this.spreadShot || this.weaponLevel >= 2) {
      projectiles.push(new Projectile(bulletX, bulletY, this.face * this.bulletSpeed * 0.9, -3, 'player'));
      projectiles.push(new Projectile(bulletX, bulletY, this.face * this.bulletSpeed * 0.9, 3, 'player'));
    }
    
    // Triple shot at higher levels
    if (this.weaponLevel >= 3) {
      projectiles.push(new Projectile(bulletX, bulletY, this.face * this.bulletSpeed * 0.7, -5, 'player'));
      projectiles.push(new Projectile(bulletX, bulletY, this.face * this.bulletSpeed * 0.7, 5, 'player'));
    }
    
    // Back shot at max level
    if (this.weaponLevel >= 4) {
      projectiles.push(new Projectile(bulletX, bulletY, -this.face * this.bulletSpeed * 0.5, 0, 'player'));
    }
    
    AudioSys.shoot();
    FX.spawn(bulletX, bulletY, '#0ff', 8, { speed: 4, life: 0.3 });
  }

  updateShooting(projectiles) {
    if (this.shootCd > 0) this.shootCd--;
    
    // Auto-fire when holding shoot or dash in bullet hell mode
    if (this.canShoot && (Input.keys['KeyZ'] || Input.keys['Space'] || Input.dash)) {
      this.shoot(projectiles);
    }
  }

  powerUpWeapon() {
    this.weaponLevel = Math.min(4, this.weaponLevel + 1);
    this.spreadShot = true;
    // Visual effect
    for (let i = 0; i < 20; i++) {
      FX.spawn(this.x + 9, this.y + 14, '#fa0', 15, { speed: 6, life: 1 });
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    if (this.inv > 0 && Math.floor(Date.now() / 40) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x + 9, this.y + 14);

    let scY = 1, rot = 0;
    if (this.dashTime > 0) {
      scY = 0.5;
      rot = this.face * 0.8;
    } else if (!this.onGround) {
      scY = 1.15;
    }
    
    // Reverse gravity visual rotation
    if (this.reverseGravity) {
      rot += Math.PI; // Flip 180 degrees
    }

    ctx.rotate(rot);
    ctx.scale(this.face, 1);

    // Shield aura
    if (this.shield) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 10 + Math.sin(Date.now() / 100) * 5;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Speed trail
    if (this.speedBoost > 0) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.fillRect(-25, -15, 10, 30);
    }

    // Body - use equipped skin color from Shop
    const skinColor = (typeof Shop !== 'undefined') ? Shop.getEquippedSkinColor() : this.stats.col;
    ctx.fillStyle = skinColor;
    ctx.shadowColor = this.shield ? '#4ade80' : skinColor;
    ctx.shadowBlur = this.shield ? 25 : 15;

    const drawW = 18;
    const drawH = Math.max(1, 28 * scY);

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(-9, -drawH / 2, drawW, drawH, 6);
    } else {
      ctx.rect(-9, -drawH / 2, drawW, drawH);
    }
    ctx.fill();

    // Character specific detail
    if (this.stats.name === 'AEGIS') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.strokeRect(-9, -5, 18, 10);
    } else if (this.stats.name === 'NEO') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-12, -8, 4, 12);
    }

    // Visor
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(2, -10, 10, 10);
    ctx.fillStyle = this.dashTime > 0 ? '#e879f9' : '#0f172a';
    ctx.fillRect(7, -7, 5, 5);

    // Double jump indicator
    if (this.hasDoubleJump && !this.doubleJump) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(-5, -20, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 🔥 Weapon level indicator (for shooting mode)
    if (this.canShoot) {
      const weaponColors = ['#22d3ee', '#4ade80', '#fbbf24', '#e879f9'];
      const weaponY = -drawH / 2 - 8;
      ctx.fillStyle = weaponColors[Math.min(3, this.weaponLevel - 1)];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      for (let i = 0; i < Math.min(4, this.weaponLevel); i++) {
        ctx.beginPath();
        ctx.arc(-12 + i * 8, weaponY, 2 + i * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Shoes
    if (this.dashTime <= 0) {
      ctx.fillStyle = this.speedBoost > 0 ? '#fbbf24' : '#f43f5e';
      ctx.fillRect(-7, 12, 6, 5);
      ctx.fillRect(1, 12, 6, 5);
    }

    // Draw emote if active
    if (window.GameState && window.GameState.currentEmote && window.GameState.emoteTimer > 0) {
      const emoteY = -drawH / 2 - 35;
      const emoteOpacity = Math.min(1, window.GameState.emoteTimer / 30);
      ctx.globalAlpha = emoteOpacity;
      
      // Emote bubble background
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#f8fafc';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, emoteY, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Emote text/symbol
      ctx.fillStyle = '#0f172a';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const emotes = {
        'WAVE': '👋',
        'DANCE': '💃',
        'SALUTE': '🫡',
        'LAUGH': '😂',
        'CRY': '😭',
        'RAGE': '😡',
        'HEART': '❤️',
        'SLEEP': '💤'
      };
      ctx.fillText(emotes[window.GameState.currentEmote] || '👋', 0, emoteY + 1);
      
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Enemy
class Enemy extends Entity {
  constructor(cfg) {
    super(cfg.x, cfg.y, 24, 24);
    this.type = cfg.type;
    this.startX = cfg.x;
    this.startY = cfg.y;
    this.timer = Math.random() * 100;
    this.hp = 1;
    this.flash = 0;

    switch (this.type) {
      case 'eel':
        this.w = 32;
        this.h = 16;
        this.vx = -2.5;
        break;
      case 'jelly':
        this.w = 28;
        this.h = 28;
        break;
      case 'turret':
        this.w = 20;
        this.h = 30;
        this.shootTimer = 0;
        break;
      case 'shark':
        this.w = 48;
        this.h = 24;
        this.vx = -4;
        break;
      case 'leviathan':
        this.w = 120;
        this.h = 80;
        this.hp = 20;
        break;
    }
  }

  update(player, platforms, projectiles) {
    if (!this.alive) return;
    this.timer++;
    if (this.flash > 0) this.flash--;
    
    // Get difficulty multiplier
    const diffMult = (typeof DIFFICULTIES !== 'undefined' && window.GameState) ? 
      DIFFICULTIES[window.GameState.selectedDifficulty].modifiers.enemySpeed : 1;

    switch (this.type) {
      case 'eel':
        this.x += this.vx * diffMult;
        if (Math.abs(this.x - this.startX) > 180) this.vx *= -1;
        break;
      case 'jelly':
        this.y = this.startY + Math.sin(this.timer * 0.05 * diffMult) * 50;
        break;
      case 'shark':
        this.x += this.vx * diffMult;
        if (Math.abs(this.x - this.startX) > 300) this.vx *= -1;
        break;
      case 'turret':
        this.shootTimer++;
        const shootRate = Math.max(30, Math.floor(120 / diffMult));
        if (this.shootTimer > shootRate && Math.abs(player.x - this.x) < 400) {
          const dx = (player.x + 9) - (this.x + 10);
          const dy = (player.y + 14) - (this.y + 15);
          const d = Math.hypot(dx, dy);
          projectiles.push(new Projectile(this.x + 10, this.y + 15, (dx / d) * 5 * diffMult, (dy / d) * 5 * diffMult, 'enemy'));
          this.shootTimer = 0;
        }
        break;
      case 'leviathan':
        this.y = this.startY + Math.sin(this.timer * 0.03 * diffMult) * 60;
        const projRate = Math.max(45, Math.floor(90 / diffMult));
        const bigRate = Math.max(90, Math.floor(180 / diffMult));
        if (this.timer % projRate === 0) {
          projectiles.push(new Projectile(this.x, this.y + 40, -5 * diffMult, 0, 'enemy'));
          projectiles.push(new Projectile(this.x, this.y + 40, -4 * diffMult, 2, 'enemy'));
          projectiles.push(new Projectile(this.x, this.y + 40, -4 * diffMult, -2, 'enemy'));
        }
        if (this.timer % bigRate === 0) {
          projectiles.push(new Projectile(this.x + 60, this.y + 40, -6 * diffMult, 0, 'enemy'));
        }
        break;
    }

    // Player collision
    if (player.alive && player.inv <= 0 && AABB(this, player)) {
      if (player.dashTime > 0 || (player.vy > 0 && player.y + player.h < this.y + this.h * 0.4)) {
        this.takeDamage();
        if (player.dashTime <= 0) player.vy = CFG.JUMP_FORCE * 0.7;
      } else {
        player.takeDamage();
      }
    }
  }

  takeDamage() {
    this.hp--;
    this.flash = 10;
    if (this.type === 'leviathan') {
      AudioSys.bossHit();
      if (window.GameState) window.GameState.scrShake = 8;
    } else {
      AudioSys.enemyHit();
    }
    FX.spawn(this.x + this.w / 2, this.y + this.h / 2, '#fff', 8);

    if (this.hp <= 0) {
      this.alive = false;
      AudioSys.enemyDie();
      FX.spawn(this.x + this.w / 2, this.y + this.h / 2,
        this.type === 'leviathan' ? '#f0f' : '#f44',
        this.type === 'leviathan' ? 50 : 20,
        { speed: 6, life: 1 });
      if (this.type === 'leviathan' && window.GameState) {
        window.GameState.bossDefeated = true;
        window.GameState.levelCompleteTimer = 120;
        window.GameState.stats.bossesDefeated++;
      }
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    if (this.flash > 0) ctx.globalAlpha = 0.5;

    const colors = {
      eel: '#66ff00',
      jelly: '#ff66ff',
      turret: '#ff4444',
      shark: '#8888ff',
      leviathan: '#aa00aa'
    };

    ctx.fillStyle = colors[this.type];
    ctx.shadowColor = colors[this.type];
    ctx.shadowBlur = this.type === 'leviathan' ? 25 : 15;

    ctx.beginPath();
    if (this.type === 'eel' || this.type === 'shark') {
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(this.x, this.y, this.w, this.h, 8);
      } else {
        ctx.rect(this.x, this.y, this.w, this.h);
      }
    } else {
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
    }
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#f8fafc';
    if (this.type === 'leviathan') {
      ctx.fillRect(this.x + 20, this.y + 20, 20, 20);
      ctx.fillRect(this.x + 80, this.y + 20, 20, 20);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(this.x + 30, this.y + 30, 6, 0, Math.PI * 2);
      ctx.arc(this.x + 90, this.y + 30, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2 - 6, this.y + this.h / 2 - 4, 5, 0, Math.PI * 2);
      ctx.arc(this.x + this.w / 2 + 6, this.y + this.h / 2 - 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2 - 6, this.y + this.h / 2 - 4, 2, 0, Math.PI * 2);
      ctx.arc(this.x + this.w / 2 + 6, this.y + this.h / 2 - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Boss HP bar
    if (this.type === 'leviathan') {
      const hpPct = this.hp / 20;
      ctx.fillStyle = '#334155';
      ctx.fillRect(this.x, this.y - 20, this.w, 8);
      ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : hpPct > 0.25 ? '#fbbf24' : '#f43f5e';
      ctx.fillRect(this.x, this.y - 20, this.w * hpPct, 8);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
