/**
 * Input Handling System
 */

const Input = {
  keys: {}, prev: {},
  left: false, right: false, jump: false, dash: false, emote: false,
  isMobile: false,
  
  // Touch/Mouse tracking (initialize to false)
  touchStartX: 0, touchStartY: 0,
  touchX: 0, touchY: 0,
  isTouching: false,
  swipeThreshold: 30,
  tapTimeout: null,
  touchLeft: false, touchRight: false, 
  touchJump: false, touchDash: false, touchEmote: false,
  
  // Menu click tracking
  menuClick: false,
  menuClickPrev: false,
  menuClickX: 0,
  menuClickY: 0,

  update() {
    this.left = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchLeft;
    this.right = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchRight;
    this.jump = this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['KeyC'] || this.touchJump;
    this.dash = this.keys['KeyX'] || this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.touchDash;
    this.emote = this.keys['KeyE'] || this.keys['Digit1'] || this.touchEmote;
  },

  postUpdate() {
    this.prevJump = this.jump;
    this.prevDash = this.dash;
    this.prevEmote = this.emote;
    // Track individual key states for justPressed detection
    for (let key in this.keys) {
      this.prev[key] = this.keys[key];
    }
    // Track menu clicks
    this.menuClickPrev = this.menuClick;
    this.menuClick = false;
  },
  
  justPressedMenuClick() {
    return this.menuClick && !this.menuClickPrev;
  },

  justPressed(key) {
    if (key === 'Jump') return this.jump && !this.prevJump;
    if (key === 'Dash') return this.dash && !this.prevDash;
    if (key === 'Emote') return this.emote && !this.prevEmote;
    return this.keys[key] && !this.prev[key];
  },

  bind() {
    this.isMobile = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const hint = document.getElementById('hint');
    if (hint) {
      if (this.isMobile) {
        hint.innerHTML = '🎮 TAP: Left/Right/Thirds = Move | Center = Jump | Swipe Up = Dash | 🔥 AUTO-SHOOT in Bullet Hell Mode | Swipe to Scroll Menus | Double Tap = Emote';
      } else {
        hint.innerHTML = '🖱️ CLICK: Left/Right/Thirds = Move | Center = Jump | Double Click = Emote | 🔥 PRESS F to SHOOT in Bullet Hell Mode | Scroll Wheel = Navigate Menus | Keys: WASD/Arrows, Z=Jump, X=Dash, F=Shoot, E=Emote';
      }
    }

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
      
      // Tab key for shop category switching
      if (e.code === 'Tab' && window.GameState && window.GameState.showShop) {
        const categories = ['skins', 'emotes', 'trails', 'nameplates'];
        const currentIdx = categories.indexOf(window.GameState.shopCategory);
        window.GameState.shopCategory = categories[(currentIdx + 1) % categories.length];
      }
      
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (window.GameState) window.GameState.togglePause();
      }
      // B key for back navigation in menus
      if (e.code === 'KeyB' && window.GameState) {
        const gs = window.GameState;
        const STATE = { TITLE: 0, MODE_SELECT: 7, CHAR_SELECT: 6, DIFF_SELECT: 8 };
        if (gs.state === STATE.MODE_SELECT) {
          gs.state = STATE.TITLE;
          gs.menuIdx = 0;
        } else if (gs.state === STATE.CHAR_SELECT) {
          gs.state = STATE.MODE_SELECT;
          gs.menuIdx = 0;
        } else if (gs.state === STATE.DIFF_SELECT) {
          gs.state = STATE.CHAR_SELECT;
          gs.menuIdx = 0;
        }
      }
      
      // 🔐 KONAMI CODE DETECTION (Secret!)
      if (window.GameState) {
        const gs = window.GameState;
        const expected = gs.konamiCode[gs.konamiIdx];
        if (e.code === expected) {
          gs.konamiIdx++;
          if (gs.konamiIdx >= gs.konamiCode.length) {
            // KONAMI CODE COMPLETE!
            gs.konamiIdx = 0;
            if (!gs.secretsFound.includes('KONAMI')) {
              gs.secretsFound.push('KONAMI');
              // Reward: Unlock secret skin!
              if (typeof Shop !== 'undefined') {
                Shop.awardPearls(1000);
                Shop.inventory.skins.push('GOLDEN_DIVER');
                Shop.equipped.skin = 'GOLDEN_DIVER';
                Shop.save();
              }
              alert('🎮 KONAMI CODE ACTIVATED!\nGolden Diver Skin Unlocked!\n+1000 Pearls!');
            }
          }
        } else if (e.code !== 'KeyB') { // B is used elsewhere, don't reset
          gs.konamiIdx = 0;
        }
        
        // Secret code: TYPE "ABYSS" on title screen
        if (gs.state === 0) { // TITLE
          gs.secretCodeBuffer += e.key?.toUpperCase() || '';
          gs.secretCodeBuffer = gs.secretCodeBuffer.slice(-5);
          if (gs.secretCodeBuffer === 'ABYSS' && !gs.secretsFound.includes('ABYSS_CODE')) {
            gs.secretsFound.push('ABYSS_CODE');
            if (typeof Shop !== 'undefined') {
              Shop.awardPearls(500);
              Shop.save();
            }
            alert('🌊 SECRET DISCOVERED!\n"ABYSS" typed!\n+500 Pearls!');
          }
          
          // 🛡️ SECRET: TYPE "ADMIN" to become admin
          gs.adminCommandBuffer += e.key?.toUpperCase() || '';
          gs.adminCommandBuffer = gs.adminCommandBuffer.slice(-5);
          if (gs.adminCommandBuffer === 'ADMIN') {
            if (typeof Auth !== 'undefined' && !Auth.isMod()) {
              Auth.setRole('admin');
              alert('🛡️ ADMIN POWERS ACTIVATED!\nYou now have admin access!');
              gs.adminCommandBuffer = ''; // Clear buffer
            }
          }
        }
      }
      
      AudioSys.init();
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });
    
    // Mouse wheel scrolling for menus
    window.addEventListener('wheel', e => {
      if (!window.GameState) return;
      const gs = window.GameState;
      const delta = Math.sign(e.deltaY);
      
      // TITLE screen - scroll through menu options
      if (gs.state === 0) {
        e.preventDefault();
        const menuOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
        gs.menuIdx = (gs.menuIdx + delta + menuOptions.length) % menuOptions.length;
      }
      // MODE_SELECT - scroll through modes
      else if (gs.state === 7) {
        e.preventDefault();
        const modes = 3; // ADVENTURE, SURVIVAL, BULLET_HELL
        gs.menuIdx = (gs.menuIdx + delta + modes) % modes;
      }
      // CHAR_SELECT - scroll through characters
      else if (gs.state === 6) {
        e.preventDefault();
        const chars = 3; // DIVER, NEO, AEGIS
        gs.menuIdx = (gs.menuIdx + delta + chars) % chars;
      }
      // DIFF_SELECT - scroll through difficulties
      else if (gs.state === 8) {
        e.preventDefault();
        const diffs = 9;
        gs.menuIdx = (gs.menuIdx + delta + diffs) % diffs;
      }
      // TUTORIAL - scroll through pages
      else if (gs.state === 11) {
        e.preventDefault();
        if (delta > 0) {
          gs.tutorialPage = (gs.tutorialPage + 1) % 5;
        } else {
          gs.tutorialPage = (gs.tutorialPage - 1 + 5) % 5;
        }
      }
      // SHOP - scroll through categories/items
      else if (gs.showShop) {
        e.preventDefault();
        // Scroll moves to next/previous item in current category
        const categories = ['skins', 'emotes', 'trails', 'nameplates'];
        const currentCat = gs.shopCategory || 'skins';
        const items = Shop.items[currentCat] || [];
        const currentIdx = Shop.inventory[currentCat]?.indexOf(Shop.equipped[currentCat]) || 0;
        const newIdx = (currentIdx + delta + items.length) % items.length;
        if (items[newIdx] && Shop.inventory[currentCat]?.includes(items[newIdx].id)) {
          Shop.equipItem(currentCat, items[newIdx].id);
        }
      }
    }, { passive: false });

    const bindBtn = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => { e.preventDefault(); this.keys[prop] = true; AudioSys.init(); };
      const end = (e) => { e.preventDefault(); this.keys[prop] = false; };
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', end);
      el.addEventListener('touchstart', start, {passive: false});
      el.addEventListener('touchend', end, {passive: false});
    };

    bindBtn('bleft', 'ArrowLeft');
    bindBtn('bright', 'ArrowRight');
    bindBtn('bjump', 'Space');
    bindBtn('bdash', 'KeyX');
    bindBtn('bemote', 'KeyE');
    
    // Canvas touch/mouse controls for modern gameplay
    const canvas = document.getElementById('c');
    if (canvas) {
      // Touch controls with swipe detection (only during gameplay)
      canvas.addEventListener('touchstart', (e) => {
        // Don't intercept touches during menu screens
        if (!isGameplayState()) return;
        
        e.preventDefault();
        AudioSys.init();
        const touch = e.touches[0];
        this.isTouching = true;
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchX = touch.clientX;
        this.touchY = touch.clientY;
        
        // Determine which side of screen was touched
        const screenWidth = window.innerWidth;
        const touchX = touch.clientX;
        
        // Left third = left movement, Right third = right movement
        if (touchX < screenWidth * 0.33) {
          this.touchLeft = true;
          this.touchRight = false;
        } else if (touchX > screenWidth * 0.67) {
          this.touchRight = true;
          this.touchLeft = false;
        } else {
          // Center = jump on tap, dash on swipe up
          this.touchJump = true;
          clearTimeout(this.tapTimeout);
          this.tapTimeout = setTimeout(() => { this.touchJump = false; }, 100);
        }
      }, {passive: false});
      
      // Track last swipe time to prevent spam
      this.lastMenuSwipe = 0;
      
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!this.isTouching) return;
        
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const dx = x - this.touchStartX;
        const dy = y - this.touchStartY;
        
        // MENU SCROLLING: Vertical swipe in menus to change selection
        if (isMenuState() || (window.GameState?.state === 11)) {
          const now = Date.now();
          if (now - this.lastMenuSwipe < 300) return; // Debounce
          
          if (Math.abs(dy) > this.swipeThreshold * 1.5 && Math.abs(dy) > Math.abs(dx)) {
            this.lastMenuSwipe = now;
            const gs = window.GameState;
            const delta = dy > 0 ? 1 : -1; // Swipe down = next, up = prev
            
            if (gs.state === 0) { // TITLE
              const menuOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
              gs.menuIdx = (gs.menuIdx + delta + menuOptions.length) % menuOptions.length;
            } else if (gs.state === 7) { // MODE_SELECT
              const modes = 3;
              gs.menuIdx = (gs.menuIdx + delta + modes) % modes;
            } else if (gs.state === 6) { // CHAR_SELECT
              const chars = 3;
              gs.menuIdx = (gs.menuIdx + delta + chars) % chars;
            } else if (gs.state === 8) { // DIFF_SELECT
              const diffs = 9;
              gs.menuIdx = (gs.menuIdx + delta + diffs) % diffs;
            } else if (gs.state === 11) { // TUTORIAL
              if (delta > 0) {
                gs.tutorialPage = (gs.tutorialPage + 1) % 5;
              } else {
                gs.tutorialPage = (gs.tutorialPage - 1 + 5) % 5;
              }
            }
            // Reset touch start to allow continuous scrolling
            this.touchStartY = y;
          }
          return;
        }
        
        // GAMEPLAY: Normal touch controls
        if (!isGameplayState()) return;
        
        // Upward swipe = dash (like jump for menus)
        if (dy < -this.swipeThreshold && Math.abs(dy) > Math.abs(dx)) {
          this.touchDash = true;
          this.touchJump = false;
        }
        
        // Horizontal swipe = change direction
        if (dx < -this.swipeThreshold) {
          this.touchLeft = true;
          this.touchRight = false;
        } else if (dx > this.swipeThreshold) {
          this.touchRight = true;
          this.touchLeft = false;
        }
      }, {passive: false});
      
      canvas.addEventListener('touchend', (e) => {
        if (!isGameplayState()) return;
        e.preventDefault();
        this.isTouching = false;
        this.touchLeft = false;
        this.touchRight = false;
        this.touchJump = false;
        this.touchDash = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
      }, {passive: false});
      
      // Mouse controls for desktop clicking
      let mouseDown = false;
      
      // Helper to check if we're in a gameplay state
      const isGameplayState = () => {
        if (!window.GameState) return false;
        const s = window.GameState.state;
        return s === 1; // STATE.PLAY = 1
      };
      
      // Helper to check if we're in a menu state
      const isMenuState = () => {
        if (!window.GameState) return false;
        const s = window.GameState.state;
        // TITLE, PAUSE, CHAR_SELECT, MODE_SELECT, DIFF_SELECT, RANKED, LEADERBOARD, TUTORIAL, MATCHMAKING
        return s === 0 || s === 2 || s === 6 || s === 7 || s === 8 || s === 9 || s === 10 || s === 11 || s === 12;
      };
      
       canvas.addEventListener('mousedown', (e) => {
         e.preventDefault();
         AudioSys.init();
         mouseDown = true;
         const rect = canvas.getBoundingClientRect();
         // Properly scale mouse coordinates to match canvas internal resolution (1280x720)
         const scaleX = canvas.width / rect.width;
         const scaleY = canvas.height / rect.height;
         const x = (e.clientX - rect.left) * scaleX;
         const y = (e.clientY - rect.top) * scaleY;
         const canvasWidth = canvas.width;
         const canvasHeight = canvas.height;
        
        // MENU STATE: Handle menu clicks
        if (isMenuState() || window.GameState?.showShop) {
          Input.menuClick = true;
          Input.menuClickX = x;
          Input.menuClickY = y;
          const gs = window.GameState;
          if (gs.state === 0) { // TITLE
            // 🔍 HIDDEN SECRET: Click the "DEEP DIVE" subtitle text!
            if (y >= canvasHeight / 2 - 40 && y <= canvasHeight / 2 - 20 && 
                x >= canvasWidth * 0.3 && x <= canvasWidth * 0.7) {
              if (!gs.secretsFound.includes('DEEP_SECRET')) {
                gs.secretsFound.push('DEEP_SECRET');
                if (typeof Shop !== 'undefined') {
                  Shop.awardPearls(100);
                  Shop.save();
                }
                alert('🌊 You found a secret!\n"Deep Dive" clicked!\n+100 Pearls!');
              }
              return;
            }
            
            // 🔍 HIDDEN SECRET: Click the corner bubbles!
            if ((x < 50 && y < 50) || (x > canvasWidth - 50 && y > canvasHeight - 50)) {
              if (!gs.secretsFound.includes('BUBBLE_SECRET')) {
                gs.secretsFound.push('BUBBLE_SECRET');
                if (typeof Shop !== 'undefined') {
                  Shop.awardPearls(50);
                  Shop.save();
                }
                alert('🫧 Bubble secret found!\n+50 Pearls!');
              }
              return;
            }
            
            // Check if clicked on menu options (with dynamic LOGIN/LOGOUT)
            // menuY = pillY+48+18 = (iconY+76)+48+18 = (105+76)+48+18 = 247
            // cardH=52, cardGap=10 → spacing=62 per card
            const menuYStart = 247;
            const menuSpacing = 62;
            const baseOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
            const menuOptions = (typeof Auth !== 'undefined' && Auth.isLoggedIn)
              ? [...baseOptions, 'LOGOUT']
              : [...baseOptions, 'LOGIN'];
            const cardW = 340;
            const clickCenterX = canvasWidth / 2;

            for (let i = 0; i < menuOptions.length; i++) {
              const optionY = menuYStart + i * menuSpacing;
              if (y >= optionY && y <= optionY + 52 &&
                  x >= clickCenterX - cardW / 2 && x <= clickCenterX + cardW / 2) {
                gs.menuIdx = i;
                return;
              }
            }
          } else if (gs.state === 2) { // PAUSE
             // Clicks are recorded, let game.js handle them

          } else if (gs.state === 10) { // LEADERBOARD
            // 🔍 SECRET: Click the trophy at the top!
            if (x > canvasWidth/2 - 50 && x < canvasWidth/2 + 50 && 
                y > 30 && y < 90) {
              if (!gs.secretsFound.includes('TROPHY_SECRET')) {
                gs.secretsFound.push('TROPHY_SECRET');
                if (typeof Shop !== 'undefined') {
                  Shop.awardPearls(200);
                  Shop.save();
                }
                alert('🏆 Trophy secret found!\n+200 Pearls!');
              }
              return;
            }
          } else if (gs.state === 9) { // RANKED
            // Clicks handled by game.js

          } else if (gs.state === 11) { // TUTORIAL
            // Click to advance page
            if (y < canvasHeight - 50) {
              gs.tutorialPage = (gs.tutorialPage + 1) % 5;
            } else {
              gs.state = 0; // TITLE - bottom click goes back
            }
          } else if (gs.state === 12) { // MATCHMAKING
            // Click anywhere in bottom half to cancel matchmaking
            if (y >= canvasHeight * 0.6) {
              gs.cancelMatchmaking();
            }
            return; // Block all other clicks during matchmaking
          } else if (gs.state === 7) { // MODE_SELECT
            // startCardY = 200 (matches draw code), cardHeight=100, gap=15
            const modeCardH = 100;
            const modeGap   = 15;
            const modeStart = 200;
            const modeCardW = 360;
            const modeCX    = canvasWidth / 2;

            for (let i = 0; i < 4; i++) {
              const optionY = modeStart + i * (modeCardH + modeGap);
              if (y >= optionY && y <= optionY + modeCardH &&
                  x >= modeCX - modeCardW / 2 && x <= modeCX + modeCardW / 2) {
                if (i === 3) {
                  gs.selectMenuOption('1v1 PVP');
                } else {
                  gs.selectedMode = i;
                  if (gs.player) {
                    gs.player.canShoot = (i === 2);
                    if (i === 2) gs.player.weaponLevel = 1;
                  }
                  gs.state = 6; // CHAR_SELECT
                  gs.menuIdx = 0;
                }
                return;
              }
            }
            // Back button: y=CFG.H-55=665, h=36, w=140 centered
            const bbY1 = canvasHeight - 55, bbW1 = 140;
            if (y >= bbY1 && y <= bbY1 + 36 && x >= canvasWidth/2 - bbW1/2 && x <= canvasWidth/2 + bbW1/2) {
              gs.state = 0;
              gs.menuIdx = 0;
            }
          } else if (gs.state === 6) { // CHAR_SELECT
            // cards: cardW=280, gap=30, centered, cardTopY=160, cardH=200
            const charCardW2 = 280, charCardH2 = 200, gap2 = 30;
            const totalW2 = 3 * charCardW2 + 2 * gap2;
            const startX3 = canvasWidth / 2 - totalW2 / 2;
            const cardTopY2 = 160;
            let charHit = false;
            for (let i = 0; i < 3; i++) {
              const cardLeft2 = startX3 + i * (charCardW2 + gap2);
              if (x >= cardLeft2 && x <= cardLeft2 + charCardW2 && y >= cardTopY2 && y <= cardTopY2 + charCardH2) {
                gs.selectedChar = i;
                gs.state = 8; // DIFF_SELECT
                gs.menuIdx = 0;
                charHit = true;
                return;
              }
            }
            // Back button
            const bbY2 = canvasHeight - 55, bbW2 = 140;
            if (!charHit && y >= bbY2 && y <= bbY2 + 36 && x >= canvasWidth/2 - bbW2/2 && x <= canvasWidth/2 + bbW2/2) {
              gs.state = 7; // MODE_SELECT
              gs.menuIdx = 0;
            }
          } else if (gs.state === 8) { // DIFF_SELECT
            // 3x3 grid: cardW=240, cardH=110, gapX=20, gapY=20, startCardY=150
            const cols2 = 3, dCardW = 240, dCardH = 110, dGapX = 20, dGapY = 20;
            const dStartX = canvasWidth / 2 - (cols2 * dCardW + (cols2-1)*dGapX) / 2;
            const dStartY2 = 150;
            let diffHit = false;
            for (let i = 0; i < 9; i++) {
              const col2 = i % cols2, row2 = Math.floor(i / cols2);
              const cLeft = dStartX + col2 * (dCardW + dGapX);
              const cTop  = dStartY2 + row2 * (dCardH + dGapY);
              if (x >= cLeft && x <= cLeft + dCardW && y >= cTop && y <= cTop + dCardH) {
                gs.selectedDifficulty = i;
                gs.initLevel(0);
                gs.state = 1; // PLAY
                diffHit = true;
                return;
              }
            }
            // Back button
            const bbY3 = canvasHeight - 55, bbW3 = 140;
            if (!diffHit && y >= bbY3 && y <= bbY3 + 36 && x >= canvasWidth/2 - bbW3/2 && x <= canvasWidth/2 + bbW3/2) {
              gs.state = 6; // CHAR_SELECT
              gs.menuIdx = 0;
            }
          }
          // Allow menu click processing - DO NOT RETURN HERE!
        }
        
        // GAMEPLAY STATE: Normal controls
        if (!isGameplayState()) return;
        
        // Same logic as touch
        if (x < canvasWidth * 0.33) {
          this.touchLeft = true;
        } else if (x > canvasWidth * 0.67) {
          this.touchRight = true;
        } else {
          this.touchJump = true;
        }
      });
      
       canvas.addEventListener('mousemove', (e) => {
         const rect = canvas.getBoundingClientRect();
         // Properly scale mouse coordinates to match canvas internal resolution
         const scaleX = canvas.width / rect.width;
         const scaleY = canvas.height / rect.height;
         const x = (e.clientX - rect.left) * scaleX;
         const y = (e.clientY - rect.top) * scaleY;
         const canvasWidth = canvas.width;
        
        // Always track mouse position for UI hover effects
        if (window.GameState) {
          window.GameState.mouseX = x;
          window.GameState.mouseY = y;
          
          // Update menuIdx based on hover for menu screens
          if (isMenuState() && !mouseDown) {
            const gs = window.GameState;
            const cw = canvas.width;   // 1280
            const ch = canvas.height;  // 720
            const cx = cw / 2;

            // ── Shared back button hit-box (all sub-menus) ──
            // Drawn at: y=CFG.H-55, h=36, w=140, centered
            const BBY = ch - 55, BBH = 36, BBW = 140;
            const isOverBack = y >= BBY && y <= BBY + BBH && x >= cx - BBW/2 && x <= cx + BBW/2;

            let overInteractive = false;

            if (gs.state === 0) { // TITLE
              // cards: menuY=247, cardH=52, cardGap=10 → spacing=62, cardW=340
              const menuYStart = 247, spacing = 62, cardW = 340, cardH = 52;
              let hit = false;
              for (let i = 0; i < 6; i++) {
                const topY = menuYStart + i * spacing;
                if (y >= topY && y <= topY + cardH && x >= cx - cardW/2 && x <= cx + cardW/2) {
                  gs.menuIdx = i;
                  hit = true;
                  overInteractive = true;
                  break;
                }
              }

            } else if (gs.state === 2) { // PAUSE
               const pBtnW = 200, pBtnH = 50, pBtnGap = 20;
               const pBtnY = ch / 2 + 30;
               const pRx = cx - pBtnW - pBtnGap / 2;
               const pQx = cx + pBtnGap / 2;
               if (y >= pBtnY && y <= pBtnY + pBtnH) {
                 if (x >= pRx && x <= pRx + pBtnW) overInteractive = true;
                 else if (x >= pQx && x <= pQx + pBtnW) overInteractive = true;
               }
            } else if (gs.state === 7) { // MODE_SELECT
              // cards: startCardY=200, cardH=100, gap=15 → spacing=115, cardW=360
              const modeH = 100, modeGap = 15, modeStart = 200, modeW = 360;
              let hit = false;
              for (let i = 0; i < 3; i++) {
                const topY = modeStart + i * (modeH + modeGap);
                if (y >= topY && y <= topY + modeH && x >= cx - modeW/2 && x <= cx + modeW/2) {
                  gs.menuIdx = i;
                  hit = true;
                  overInteractive = true;
                  break;
                }
              }
              if (!hit && isOverBack) { gs.menuIdx = -1; overInteractive = true; }

            } else if (gs.state === 6) { // CHAR_SELECT
              // cards: horizontal row, cardWidth=280, gap=30, centered, cardY from startY+80=160
              const charCardW = 280, charCardH = 200, gap = 30;
              const totalW = 3 * charCardW + 2 * gap;
              const startX = cx - totalW / 2;
              const cardTopY = 160;
              let hit = false;
              for (let i = 0; i < 3; i++) {
                const cardLeft = startX + i * (charCardW + gap);
                if (x >= cardLeft && x <= cardLeft + charCardW && y >= cardTopY && y <= cardTopY + charCardH) {
                  gs.menuIdx = i;
                  hit = true;
                  overInteractive = true;
                  break;
                }
              }
              if (!hit && isOverBack) { gs.menuIdx = -1; overInteractive = true; }

            } else if (gs.state === 8) { // DIFF_SELECT
              // 3×3 grid: startX centered, cardW=240, cardH=110, gapX=20, gapY=20
              // startCardY = startY+70 = 80+70 = 150
              // x coord is CENTERED on card: startX + col*(cardW+gapX)
              const cols = 3, cardW2 = 240, cardH2 = 110, gapX = 20, gapY = 20;
              const startX2 = cx - (cols * cardW2 + (cols-1)*gapX) / 2;
              const startCardY2 = 150;
              let hit = false;
              for (let i = 0; i < 9; i++) {
                const col = i % cols, row = Math.floor(i / cols);
                const cardLeft = startX2 + col * (cardW2 + gapX);
                const cardTop  = startCardY2 + row * (cardH2 + gapY);
                if (x >= cardLeft && x <= cardLeft + cardW2 && y >= cardTop && y <= cardTop + cardH2) {
                  gs.menuIdx = i;
                  hit = true;
                  overInteractive = true;
                  break;
                }
              }
              if (!hit && isOverBack) { gs.menuIdx = -1; overInteractive = true; }
            }

            // Custom cursor: pointer for interactive elements, default otherwise
            canvas.style.cursor = overInteractive ? 'pointer' : 'default';
          } else if (!isMenuState()) {
            // Reset cursor when leaving menu
            canvas.style.cursor = '';
          }
        }
        
        // Only process gameplay input if mouse is down
        if (!mouseDown || !isGameplayState()) return;
        
        if (x < canvasWidth * 0.33) {
          this.touchLeft = true;
          this.touchRight = false;
        } else if (x > canvasWidth * 0.67) {
          this.touchRight = true;
          this.touchLeft = false;
        }
      });
      
      canvas.addEventListener('mouseup', (e) => {
        e.preventDefault();
        mouseDown = false;
        this.touchLeft = false;
        this.touchRight = false;
        this.touchJump = false;
        this.touchDash = false;
      });
      
      canvas.addEventListener('mouseleave', () => {
        mouseDown = false;
        this.touchLeft = false;
        this.touchRight = false;
        this.touchJump = false;
        this.touchDash = false;
      });
      
      // Double click/tap = emote (only during gameplay)
      let lastClickTime = 0;
      canvas.addEventListener('click', (e) => {
        // Double click/tap = emote (only during gameplay)
        if (isGameplayState()) {
          const now = Date.now();
          if (now - lastClickTime < 300) {
            // Double click detected
            this.touchEmote = true;
            setTimeout(() => { this.touchEmote = false; }, 200);
          }
          lastClickTime = now;
        }
        // Allow clicks to pass through for menu handling
      });
    }
  }
};
