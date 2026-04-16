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
        hint.innerHTML = '🎮 TAP: Left/Right/Thirds = Move | Center = Jump | Swipe Up = Dash | 🔥 HOLD Dash to SHOOT in Bullet Hell Mode | Swipe to Scroll Menus | Double Tap = Emote';
      } else {
        hint.innerHTML = '🖱️ CLICK: Left/Right/Thirds = Move | Center = Jump | Double Click = Emote | 🔥 HOLD X/DASH to SHOOT in Bullet Hell Mode | Scroll Wheel = Navigate Menus | Keys: WASD/Arrows, Z=Jump, X=Dash, E=Emote';
      }
    }

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
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
        return s === 0 || s === 6 || s === 7 || s === 8; // TITLE, CHAR_SELECT, MODE_SELECT, DIFF_SELECT
      };
      
      canvas.addEventListener('mousedown', (e) => {
        e.preventDefault();
        AudioSys.init();
        mouseDown = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;
        
        // MENU STATE: Handle menu clicks
        if (isMenuState()) {
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
            
            // Check if clicked on menu options
            const menuYStart = canvasHeight / 2 + 10;
            const menuSpacing = 45;
            const menuOptions = ['PLAY', 'TUTORIAL', 'RANKED', 'LEADERBOARD', 'SHOP'];
            
            for (let i = 0; i < menuOptions.length; i++) {
              const optionY = menuYStart + i * menuSpacing;
              // Check if click is within text area (approximate)
              if (y >= optionY - 20 && y <= optionY + 10 && x >= canvasWidth * 0.3 && x <= canvasWidth * 0.7) {
                gs.menuIdx = i;
                // Trigger selection
                const option = menuOptions[i];
                if (option === 'PLAY') {
                  gs.state = 7; // MODE_SELECT
                  gs.menuIdx = 0;
                } else if (option === 'TUTORIAL') {
                  gs.state = 11; // TUTORIAL
                  gs.tutorialPage = 0;
                } else if (option === 'RANKED') {
                  gs.state = 9; // RANKED
                } else if (option === 'LEADERBOARD') {
                  gs.state = 10; // LEADERBOARD
                  gs.leaderboardType = 'global';
                } else if (option === 'SHOP') {
                  gs.showShop = true;
                  gs.shopCategory = 'skins';
                }
                return;
              }
            }
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
            // Click anywhere else to go back
            gs.state = 0; // TITLE
          } else if (gs.state === 9) { // RANKED
            // Click anywhere to go back
            gs.state = 0; // TITLE
          } else if (gs.state === 11) { // TUTORIAL
            // Click to advance page
            if (y < canvasHeight - 50) {
              gs.tutorialPage = (gs.tutorialPage + 1) % 5;
            } else {
              gs.state = 0; // TITLE - bottom click goes back
            }
          } else if (gs.state === 7) { // MODE_SELECT
            const modeYStart = 200;
            const modeSpacing = 100;
            
            for (let i = 0; i < 3; i++) { // Now 3 modes!
              const optionY = modeYStart + i * modeSpacing;
              if (y >= optionY - 40 && y <= optionY + 40 && x >= canvasWidth * 0.2 && x <= canvasWidth * 0.8) {
                gs.selectedMode = i;
                // Enable shooting for BULLET_HELL mode
                if (gs.player) {
                  gs.player.canShoot = (i === 2);
                  if (i === 2) gs.player.weaponLevel = 1;
                }
                gs.state = 6; // CHAR_SELECT
                gs.menuIdx = 0;
                return;
              }
            }
            // Back button
            if (y >= canvasHeight - 80 && y <= canvasHeight - 40) {
              gs.state = 0; // TITLE
              gs.menuIdx = 0;
            }
          } else if (gs.state === 6) { // CHAR_SELECT
            const charYStart = 200;
            const charSpacing = 100;
            
            for (let i = 0; i < 3; i++) {
              const optionY = charYStart + i * charSpacing;
              if (y >= optionY - 40 && y <= optionY + 40 && x >= canvasWidth * 0.2 && x <= canvasWidth * 0.8) {
                gs.selectedChar = i;
                gs.state = 8; // DIFF_SELECT
                gs.menuIdx = 0;
                return;
              }
            }
            // Back button
            if (y >= canvasHeight - 80 && y <= canvasHeight - 40) {
              gs.state = 7; // MODE_SELECT
              gs.menuIdx = 0;
            }
          } else if (gs.state === 8) { // DIFF_SELECT
            const diffYStart = 180;
            const diffSpacing = 55;
            
            for (let i = 0; i < 9; i++) {
              const optionY = diffYStart + Math.floor(i / 3) * diffSpacing;
              const optionX = (i % 3) * (canvasWidth / 3) + canvasWidth / 6;
              
              if (Math.abs(y - optionY) < 25 && Math.abs(x - optionX) < 80) {
                gs.selectedDifficulty = i;
                gs.initLevel(0);
                gs.state = 1; // PLAY
                return;
              }
            }
            // Back button
            if (y >= canvasHeight - 80 && y <= canvasHeight - 40) {
              gs.state = 6; // CHAR_SELECT
              gs.menuIdx = 0;
            }
          }
          return; // Don't process as gameplay input
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
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const canvasWidth = rect.width;
        
        // Always track mouse position for UI hover effects
        if (window.GameState) {
          window.GameState.mouseX = x;
          window.GameState.mouseY = y;
          
          // Update menuIdx based on hover for menu screens
          if (isMenuState() && !mouseDown) {
            const gs = window.GameState;
            if (gs.state === 0) { // TITLE
              const menuYStart = rect.height / 2 + 10;
              const menuSpacing = 45;
              for (let i = 0; i < 5; i++) {
                const optionY = menuYStart + i * menuSpacing;
                if (y >= optionY - 20 && y <= optionY + 10) {
                  gs.menuIdx = i;
                  break;
                }
              }
            } else if (gs.state === 7) { // MODE_SELECT
              const modeYStart = 200;
              const modeSpacing = 100;
              for (let i = 0; i < 3; i++) {
                const optionY = modeYStart + i * modeSpacing;
                if (y >= optionY - 40 && y <= optionY + 40) {
                  gs.menuIdx = i;
                  break;
                }
              }
              // Check back button hover
              const backBtnY = rect.height - 50;
              if (y > backBtnY - 20 && y < backBtnY + 10) {
                gs.menuIdx = -1; // Special value for back button
              }
            } else if (gs.state === 6) { // CHAR_SELECT
              const charSpacing = 260;
              const startX = rect.width/2 - 260;
              for (let i = 0; i < 3; i++) {
                const optionX = startX + i * charSpacing;
                if (x >= optionX - 110 && x <= optionX + 110 && y >= 180 && y <= 340) {
                  gs.menuIdx = i;
                  break;
                }
              }
            } else if (gs.state === 8) { // DIFF_SELECT
              const cols = 3;
              const boxW = 260;
              const boxH = 120;
              const startX = rect.width/2 - (cols * boxW) / 2 + boxW/2;
              const startY = 150;
              
              for (let i = 0; i < 9; i++) {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const optionX = startX + col * boxW;
                const optionY = startY + row * (boxH + 20);
                
                if (x >= optionX - boxW/2 && x <= optionX + boxW/2 &&
                    y >= optionY && y <= optionY + boxH) {
                  gs.menuIdx = i;
                  break;
                }
              }
            }
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
        if (!isGameplayState()) return;
        const now = Date.now();
        if (now - lastClickTime < 300) {
          // Double click detected
          this.touchEmote = true;
          setTimeout(() => { this.touchEmote = false; }, 200);
        }
        lastClickTime = now;
      });
    }
  }
};
