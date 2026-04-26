// Nebula Rider — main entry and game state machine.
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { World } from './world.js';
import { Ship } from './ship.js';
import { Asteroids, Enemies, Bullets, Pickups, Particles, Boss } from './entities.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { clamp, rand, randi, chance, tmp } from './utils.js';
import { settings } from './settings.js';
import { leaderboard } from './leaderboard.js';
import { TouchControls, isTouchLikely } from './touch.js';
import { Cinematic } from './cinematic.js';

const STATE = { LOADING: 'loading', TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused', OVER: 'over', CINEMATIC: 'cinematic' };

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.scene = this.renderer.scene;
    this.camera = this.renderer.camera;

    this.world = new World(this.scene);
    this.particles = new Particles(this.scene, 2000);
    this.bullets = new Bullets(this.scene);
    this.asteroids = new Asteroids(this.scene);
    this.pickups = new Pickups(this.scene);
    this.enemies = new Enemies(this.scene);
    this.boss = new Boss(this.scene);
    this.ship = new Ship(this.scene);
    this.hud = new HUD();
    this.input = new Input(this.canvas);
    this.audio = new Audio();
    this.touch = new TouchControls(this.input);
    this.cinematic = new Cinematic(this);

    this.state = STATE.LOADING;
    this.time = 0;
    this.score = 0;
    this.combo = 1;
    this._comboTimer = 0;
    this.wave = 1;
    this._waveTimer = 0;
    this._spawnTimer = 0;
    this._enemySpawnTimer = 4;
    this._pickupTimer = 2;
    this._bossSpawned = new Set(); // tracks waves that have already triggered a boss

    this._applyBodyPalette();
    settings.onChange((k) => {
      if (k === 'colorblind') this._applyBodyPalette();
      if (k === 'reducedMotion') document.body.classList.toggle('reduced-motion', settings.get('reducedMotion'));
    });
    document.body.classList.toggle('reduced-motion', settings.get('reducedMotion'));

    // Enable on-screen touch controls on touch-primary devices.
    if (isTouchLikely()) this.touch.setEnabled(true);

    this._bindUI();
    this._onResize = () => this.renderer.resize();
    window.addEventListener('resize', this._onResize);

    requestAnimationFrame((t) => this._firstFrame(t));
  }

  _firstFrame(t) {
    this._lastT = t;
    // Hide loading after first render (so the sky has textures computed).
    this.renderer.render(0.016, 0);
    setTimeout(() => {
      this.hud.hide('loading');
      this.hud.show('start');
      this.state = STATE.TITLE;
    }, 600);
    requestAnimationFrame((t2) => this._loop(t2));
  }

  _bindUI() {
    document.getElementById('start-btn').addEventListener('click', () => this.start());
    document.getElementById('restart-btn').addEventListener('click', () => this.start());
    document.getElementById('resume-btn').addEventListener('click', () => this._resume());
    document.getElementById('quit-btn').addEventListener('click', () => {
      this._resume();
      this.quitToTitle();
    });
    const cineBtn = document.getElementById('cinematic-btn');
    if (cineBtn) cineBtn.addEventListener('click', () => this.startCinematic());

    window.addEventListener('keydown', (e) => {
      const settingsOpen = !this.hud.el.settings?.classList.contains('hidden');
      if (e.code === 'Escape' && this.state === STATE.CINEMATIC) {
        this.stopCinematic();
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        // Escape/P while settings is open should close settings, not
        // accidentally toggle pause behind it.
        if (settingsOpen) { this._closeSettings(); return; }
        if (this.state === STATE.PLAYING) this._pause();
        else if (this.state === STATE.PAUSED) this._resume();
      }
      if (e.code === 'KeyM') {
        this.audio.ensureStarted();
        this.audio.setMuted(!this.audio.muted);
      }
      if (e.code === 'Enter') {
        if (settingsOpen) return;
        if (this.state === STATE.TITLE || this.state === STATE.OVER) this.start();
      }
    });

    // Settings panel — opened from title / pause / gameover screens.
    this._initSettingsUI();
  }

  _applyBodyPalette() {
    document.body.classList.toggle('colorblind', settings.get('colorblind'));
  }

  _initSettingsUI() {
    const panel = document.getElementById('settings-screen');
    if (!panel) return;
    const bindOpen = (id) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => this._openSettings());
    };
    bindOpen('settings-btn');
    bindOpen('settings-btn-pause');
    bindOpen('settings-btn-over');
    document.getElementById('settings-close').addEventListener('click', () => this._closeSettings());
    document.getElementById('settings-reset').addEventListener('click', () => {
      settings.reset();
      this._syncSettingsUI();
    });
    document.getElementById('leaderboard-clear').addEventListener('click', () => {
      if (confirm('Clear all local high scores?')) {
        leaderboard.clear();
        this._renderLeaderboard();
      }
    });
    const bindRange = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => settings.set(key, Number(el.value)));
    };
    const bindCheckbox = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => settings.set(key, el.checked));
    };
    bindRange('set-master', 'masterVolume');
    bindRange('set-music', 'musicVolume');
    bindRange('set-sfx', 'sfxVolume');
    bindRange('set-mouse', 'mouseSensitivity');
    bindRange('set-roll', 'rollSensitivity');
    bindCheckbox('set-mute', 'muted');
    bindCheckbox('set-inverty', 'invertY');
    bindCheckbox('set-colorblind', 'colorblind');
    bindCheckbox('set-reducedmotion', 'reducedMotion');
    bindCheckbox('set-highquality', 'highQuality');
    bindCheckbox('set-autofire', 'autofire');
    const touchEl = document.getElementById('set-touch');
    if (touchEl) {
      touchEl.checked = this.touch.enabled;
      touchEl.addEventListener('change', () => this.touch.setEnabled(touchEl.checked));
    }
    settings.onChange(() => this._syncSettingsUI());

    this._initAdminPanel();

    this._syncSettingsUI();
    this._renderLeaderboard();
  }

  // --- Hidden admin panel ---
  // Unlocked by either (a) tapping the NEBULA title 5 times within 3s on the
  // start screen, or (b) pressing Ctrl+Shift+D anywhere. URL overrides
  // (?autofire=1, ?touch=1) also auto-unlock to keep scripted testing easy.
  _initAdminPanel() {
    const section = document.getElementById('admin-section');
    if (!section) return;
    this._adminUnlocked = this._readAdminUnlocked();
    this._refreshAdminUI();

    // Secret title taps.
    const title = document.querySelector('#start-screen .title-main');
    if (title) {
      let taps = 0;
      let firstTap = 0;
      title.addEventListener('click', () => {
        const now = performance.now();
        if (now - firstTap > 3000) { taps = 0; firstTap = now; }
        taps++;
        if (taps >= 5) {
          taps = 0;
          this._setAdminUnlocked(true);
          this._openSettings();
          this._flashAdminFeedback('Admin panel unlocked.');
        }
      });
    }
    // Ctrl+Shift+D toggles admin.
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
        e.preventDefault();
        this._setAdminUnlocked(!this._adminUnlocked);
        if (this._adminUnlocked) {
          this._openSettings();
          this._flashAdminFeedback('Admin panel unlocked.');
        }
      }
    });

    const lockBtn = document.getElementById('admin-lock');
    if (lockBtn) lockBtn.addEventListener('click', () => {
      this._setAdminUnlocked(false);
      this._flashAdminFeedback('Admin panel locked.');
    });

    const copyBtn = document.getElementById('admin-copy-link');
    if (copyBtn) copyBtn.addEventListener('click', () => this._copyAdminLink());

    // Auto-unlock if URL carried any admin flags, so the user can find the
    // panel without reading the source.
    const qp = new URLSearchParams(window.location.search);
    if (qp.get('autofire') === '1' || qp.get('touch') === '1' || qp.get('admin') === '1') {
      this._setAdminUnlocked(true);
    }
  }

  _readAdminUnlocked() {
    try { return sessionStorage.getItem('nebula-rider.admin.unlocked') === '1'; } catch (_) { return false; }
  }

  _setAdminUnlocked(v) {
    this._adminUnlocked = !!v;
    try {
      if (this._adminUnlocked) sessionStorage.setItem('nebula-rider.admin.unlocked', '1');
      else sessionStorage.removeItem('nebula-rider.admin.unlocked');
    } catch (_) { /* ignore */ }
    this._refreshAdminUI();
  }

  _refreshAdminUI() {
    const section = document.getElementById('admin-section');
    if (section) section.classList.toggle('hidden', !this._adminUnlocked);
  }

  _flashAdminFeedback(msg) {
    const el = document.getElementById('admin-link-feedback');
    if (!el) return;
    el.textContent = msg;
    clearTimeout(this._adminFeedbackTimer);
    this._adminFeedbackTimer = setTimeout(() => { el.textContent = ''; }, 2400);
  }

  _copyAdminLink() {
    const params = new URLSearchParams();
    if (settings.get('autofire')) params.set('autofire', '1');
    if (settings.get('colorblind')) params.set('colorblind', '1');
    if (settings.get('reducedMotion')) params.set('reducedMotion', '1');
    if (this.touch.enabled) params.set('touch', '1');
    params.set('admin', '1');
    const base = `${window.location.origin}${window.location.pathname}`;
    const link = params.toString() ? `${base}?${params.toString()}` : base;
    const done = (msg) => this._flashAdminFeedback(msg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link)
        .then(() => done(`Copied: ${link}`))
        .catch(() => done(`Copy blocked — link: ${link}`));
    } else {
      done(`Link: ${link}`);
    }
  }

  _syncSettingsUI() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } };
    set('set-master', settings.get('masterVolume'));
    set('set-music', settings.get('musicVolume'));
    set('set-sfx', settings.get('sfxVolume'));
    set('set-mouse', settings.get('mouseSensitivity'));
    set('set-roll', settings.get('rollSensitivity'));
    set('set-mute', settings.get('muted'));
    set('set-inverty', settings.get('invertY'));
    set('set-colorblind', settings.get('colorblind'));
    set('set-reducedmotion', settings.get('reducedMotion'));
    set('set-highquality', settings.get('highQuality'));
    set('set-autofire', settings.get('autofire'));
  }

  _openSettings() {
    this._settingsReturnState = this.state;
    // Pause actively-running games so settings changes can be previewed safely.
    if (this.state === STATE.PLAYING) this._pause(/* silent */ true);
    // Hide source overlays so the settings panel isn't obscured.
    this._settingsSourceOverlay = null;
    for (const name of ['start', 'pause', 'over']) {
      const el = this.hud.el[name];
      if (el && !el.classList.contains('hidden')) {
        this._settingsSourceOverlay = name;
        this.hud.hide(name);
        break;
      }
    }
    this._renderLeaderboard();
    this.hud.show('settings');
    // Focus the first interactive control for keyboard users.
    setTimeout(() => document.getElementById('settings-close')?.focus(), 0);
  }
  _closeSettings() {
    this.hud.hide('settings');
    // Restore the overlay that was visible when settings was opened.
    const src = this._settingsSourceOverlay;
    if (src) this.hud.show(src);
    this._settingsSourceOverlay = null;
    // If settings was opened during active gameplay (e.g. via the Ctrl+Shift+D
    // admin shortcut), _openSettings silently paused us. Resume now so the
    // player isn't left frozen behind an invisible pause state.
    if (this._settingsReturnState === STATE.PLAYING && this.state === STATE.PAUSED) {
      this._resume();
    }
    this._settingsReturnState = null;
  }

  _renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    const entries = leaderboard.list();
    if (entries.length === 0) {
      list.innerHTML = '<li class="empty">No runs recorded yet.</li>';
      return;
    }
    list.innerHTML = entries.map((e, i) => {
      const rank = String(i + 1).padStart(2, '0');
      return `<li><span class="rank">${rank}</span><span class="name">${escapeHtml(e.name)}</span><span class="score">${e.score.toLocaleString()}</span><span class="wave">W${e.wave}</span></li>`;
    }).join('');
  }

  start() {
    this.audio.ensureStarted();
    this.audio.setIntensity(0.1);
    this.audio.startMusic();

    // Close the settings panel if start() was invoked while it was open
    // (e.g. user pressed Enter on an admin-only field).
    this.hud.hide('settings');
    this._settingsSourceOverlay = null;
    this._settingsReturnState = null;

    this.hud.hide('start');
    this.hud.hide('over');
    this.hud.show('hud');
    this.input.setEnabled(true);

    // Reset state
    this.asteroids.clear();
    this.pickups.clear();
    this.enemies.clear();
    this.boss.clear();
    for (let i = this.bullets.active.length - 1; i >= 0; i--) this.bullets.kill(this.bullets.active[i]);
    this.ship.reset();
    this.score = 0;
    this.combo = 1;
    this._comboTimer = 0;
    this.wave = 1;
    this._waveTimer = 0;
    this._spawnTimer = 0;
    this._enemySpawnTimer = 6;
    this._pickupTimer = 3;
    this.distance = 0;
    this._bossSpawned = new Set();
    this._scoreSubmitted = false;

    // Seed the scene with a few asteroids and a crystal so there's immediate action.
    for (let i = 0; i < 3; i++) this._spawnAsteroid();
    this._spawnPickup();

    this.hud.hideCombo();
    this.hud.update(this._hudState());
    this.state = STATE.PLAYING;
  }

  quitToTitle() {
    this.state = STATE.TITLE;
    this.input.setEnabled(false);
    this.hud.hide('hud');
    this.hud.hide('pause');
    this.hud.show('start');
    this.audio.stopMusic();
  }

  startCinematic() {
    // Reset into a clean run first (reuses start()'s scene reset), then
    // immediately flip to CINEMATIC so gameplay systems tick without
    // accepting player input. The cinematic driver pushes virtual input
    // each frame and overrides the camera after ship update.
    this.start();
    this.input.setEnabled(false);
    this.hud.hide('hud');
    this.state = STATE.CINEMATIC;
    // Bump density so the director has more to film — spawn a few extra
    // asteroids and one enemy right away instead of waiting for the
    // pacing timers.
    for (let i = 0; i < 3; i++) this._spawnAsteroid();
    this._spawnEnemy();
    this._spawnPickup();
    this._spawnTimer = 0.4;
    this._enemySpawnTimer = 2;
    this._pickupTimer = 4;
    this.audio.setIntensity(0.6);
    this.cinematic.start();
  }

  stopCinematic() {
    this.cinematic.stop();
    // Wipe the scene we just filmed and return to the title screen.
    this.asteroids.clear();
    this.pickups.clear();
    this.enemies.clear();
    this.boss.clear();
    for (let i = this.bullets.active.length - 1; i >= 0; i--) this.bullets.kill(this.bullets.active[i]);
    this.quitToTitle();
  }

  _pause(silent = false) {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.input.setEnabled(false);
    if (!silent) this.hud.show('pause');
  }

  _resume() {
    if (this.state !== STATE.PAUSED) return;
    this.hud.hide('pause');
    this.input.setEnabled(true);
    this.state = STATE.PLAYING;
  }

  _gameOver() {
    this.state = STATE.OVER;
    this.input.setEnabled(false);
    this.audio.explosion(1.6);
    this.renderer.shake(1.2);
    // Big finale burst
    this.particles.burst(this.ship.group.position, 0xff4bff, { count: 120, speed: 30, size: 1.4, life: 1.8 });
    this.particles.burst(this.ship.group.position, 0x5dc8ff, { count: 80, speed: 24, size: 1.0, life: 1.5 });
    this.particles.burst(this.ship.group.position, 0xffcf5b, { count: 60, speed: 18, size: 0.9, life: 1.2 });

    // Record the run locally.
    const finalState = this._hudState();
    const rank = leaderboard.projectedRank(finalState.score);
    this._lastRunRank = rank;
    // Submit automatically; the UI offers a rename before the panel is closed.
    const submission = leaderboard.submit({
      name: this._riderName() || 'RIDER',
      score: finalState.score,
      wave: finalState.wave,
      distance: finalState.distance,
    });
    this._scoreSubmitted = true;
    this._lastEntry = submission.entry;

    // Delay overlay so the explosion shows.
    setTimeout(() => {
      this.hud.showGameOver({ ...finalState, rank, entry: submission.entry });
      this._renderLeaderboard();
    }, 1500);
  }

  _riderName() {
    try { return localStorage.getItem('nebula-rider.name') || ''; } catch (_) { return ''; }
  }
  _setRiderName(name) {
    try { localStorage.setItem('nebula-rider.name', (name || '').toString().slice(0, 12).toUpperCase()); } catch (_) { /* ignore */ }
  }

  _hudState() {
    return {
      score: this.score,
      wave: this.wave,
      distance: this.distance,
      hull: this.ship.hull, maxHull: this.ship.maxHull,
      boost: this.ship.boost, maxBoost: this.ship.maxBoost,
      heat: this.ship.heat, maxHeat: this.ship.maxHeat,
      shieldTime: this.ship.shieldTime,
      rapidFireTime: this.ship.rapidFireTime,
      multiShotTime: this.ship.multiShotTime,
      bossActive: !!this.boss.active,
      bossHpFrac: this.boss.active ? this.boss.coreHpFrac() : 0,
      bossExposed: this.boss.exposed(),
    };
  }

  _addScore(n) {
    const mult = Math.min(8, this.combo);
    const added = Math.floor(n * mult);
    this.score += added;
    this.combo += 1;
    this._comboTimer = 2.5;
    this.hud.showCombo(Math.min(8, this.combo));
    return added;
  }

  _spawnWaveContent(dt) {
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      // Spawn asteroids in front of player (reduced for performance)
      const count = 1 + randi(0, 2) + Math.min(2, Math.floor(this.wave / 3));
      for (let i = 0; i < count; i++) this._spawnAsteroid();
      this._spawnTimer = rand(0.8, 1.4) - Math.min(0.4, this.wave * 0.03);
    }

    this._enemySpawnTimer -= dt;
    if (this.wave >= 2 && this._enemySpawnTimer <= 0) {
      // randi is exclusive of its upper bound, so randi(0, 2) yields {0, 1}.
      const count = 1 + (this.wave >= 4 ? randi(0, 2) : 0) + (this.wave >= 7 ? randi(0, 2) : 0);
      for (let i = 0; i < count; i++) this._spawnEnemy();
      const base = rand(4, 8) - Math.min(3, this.wave * 0.25);
      this._enemySpawnTimer = Math.max(1.5, base);
    }

    this._pickupTimer -= dt;
    if (this._pickupTimer <= 0) {
      this._spawnPickup();
      this._pickupTimer = rand(2.5, 5);
    }

    // Boss spawns at wave 3, 6, 9, … (only one active at a time).
    if (!this.boss.active && this.wave >= 3 && this.wave % 3 === 0 && !this._bossSpawned.has(this.wave)) {
      this._spawnBoss();
      this._bossSpawned.add(this.wave);
    }

    // Advance wave on distance thresholds
    // BUT: cannot advance if boss is active (must kill boss first)
    this._waveTimer += dt;
    const waveDuration = 30;
    if (this._waveTimer >= waveDuration && !this.boss.active) {
      this._waveTimer = 0;
      this.wave += 1;
      this.audio.setIntensity(Math.min(1, this.wave * 0.12));
      this.audio.wave();
      this.hud.pickupToast(`WAVE ${this.wave}`);
    }
  }

  _spawnBoss() {
    const fwd = this.ship.forward;
    const basePos = this.ship.group.position.clone().addScaledVector(fwd, 110);
    this.boss.spawn(basePos, this.wave);
    this.audio.wave();
    this.audio.setIntensity(1);
    this.hud.pickupToast(`⚠  WAVE ${this.wave} BOSS  ⚠`);
    this.renderer.shake(0.6);
  }

  _spawnAsteroid() {
    const fwd = this.ship.forward;
    const basePos = this.ship.group.position.clone().addScaledVector(fwd, 180 + rand(0, 60));
    // Spread around forward cone
    basePos.x += rand(-60, 60);
    basePos.y += rand(-28, 28);
    const radius = rand(1.2, 4.5) * (1 + Math.min(1, this.wave * 0.05));
    // Velocity: drift slightly toward player but mostly ambient.
    const vel = new THREE.Vector3(rand(-2, 2), rand(-1, 1), rand(-8, -2));
    this.asteroids.spawn(basePos, radius, vel);
  }

  _spawnEnemy() {
    const fwd = this.ship.forward;
    const basePos = this.ship.group.position.clone().addScaledVector(fwd, 150 + rand(0, 40));
    basePos.x += rand(-40, 40);
    basePos.y += rand(-15, 15);
    this.enemies.spawn(basePos);
  }

  _spawnPickup() {
    const fwd = this.ship.forward;
    const basePos = this.ship.group.position.clone().addScaledVector(fwd, 120 + rand(0, 40));
    basePos.x += rand(-40, 40);
    basePos.y += rand(-18, 18);
    this.pickups.spawn(basePos);
  }

  _fire(dt) {
    this.ship.fireState(dt);
    if (this.input.firing() && this.ship.canFire() && this.ship.alive) {
      const { pos, dir } = this.ship.muzzleData();
      const origin = pos.clone().addScaledVector(dir, 1.5);
      if (this.ship.multiShotActive()) {
        // Three bullets in a slight spread.
        const up = new THREE.Vector3(0, 1, 0);
        const side = up.clone().cross(dir).normalize();
        const spread = 0.07;
        const offsets = [-1, 0, 1];
        for (const o of offsets) {
          const d = dir.clone().addScaledVector(side, o * spread).normalize();
          this.bullets.spawn(origin.clone(), d, 220, true, 5);
        }
      } else {
        this.bullets.spawn(origin, dir, 220, true, 5);
      }
      this.ship.registerShot();
      this.audio.laser();
      // Muzzle flash
      this.particles.burst(pos, 0x88eaff, { count: 8, speed: 6, size: 0.5, life: 0.2 });
    }
  }

  _detonateBomb() {
    // Screen-clear pulse: destroys all asteroids/enemies within range; damages
    // the boss by a big chunk and strips one turret if still invulnerable.
    const pp = this.ship.group.position;
    const radius = 120;
    this.particles.burst(pp, 0xffffff, { count: 250, speed: 60, size: 1.6, life: 1.6 });
    this.particles.burst(pp, 0x5dc8ff, { count: 150, speed: 40, size: 1.2, life: 1.3 });
    this.audio.explosion(1.8);
    this.renderer.shake(0.9);

    const radsq = radius * radius;
    for (let i = this.asteroids.items.length - 1; i >= 0; i--) {
      const a = this.asteroids.items[i];
      if (pp.distanceToSquared(a.position) < radsq) {
        const gained = this._addScore(Math.ceil(a.userData.maxHp * 10));
        this.asteroids.destroy(a, this.particles);
        if (gained > 0) { /* no toast spam */ }
      }
    }
    for (let i = this.enemies.items.length - 1; i >= 0; i--) {
      const e = this.enemies.items[i];
      if (pp.distanceToSquared(e.position) < radsq) {
        this._addScore(500);
        this.enemies.destroy(e, this.particles);
      }
    }
    const bossrad = radius * 1.5;
    if (this.boss.active && pp.distanceToSquared(this.boss.active.position) < bossrad * bossrad) {
      // Pulse bomb damage scales lightly; primary effect is clearing turrets.
      const ud = this.boss.active.userData;
      // Kill one turret, if any remain.
      const liveTurret = ud.turrets.find((t) => t.userData.alive);
      if (liveTurret) {
        liveTurret.userData.alive = false;
        liveTurret.visible = false;
        this.particles.burst(liveTurret.getWorldPosition(new THREE.Vector3()), 0xff9a2f, { count: 80, speed: 22, size: 1.0, life: 1.2 });
      }
      // Chunk-damage the core even through the shield (minor).
      if (this.boss.exposed()) {
        ud.hp = Math.max(0, ud.hp - Math.ceil(ud.maxHp * 0.12));
      } else {
        ud.hp = Math.max(0, ud.hp - Math.ceil(ud.maxHp * 0.03));
      }
      // If the bomb was the killing blow, finish the boss here — otherwise it
      // would linger at 0 HP until another bullet connects.
      if (ud.hp <= 0 && !ud.dead) {
        ud.dead = true;
        this._addScore(10000 + 2000 * (ud.tier || 1));
        this.hud.pickupToast('BOSS DOWN');
        this.audio.explosion(2.0);
        this.renderer.shake(1.0);
        this.boss.destroyAndDrop(this.pickups, this.particles);
      }
    }
  }

  _collide() {
    const pp = this.ship.group.position;
    const pr = 1.1; // player radius

    // Player bullets vs asteroids & enemies & boss
    for (let i = this.bullets.active.length - 1; i >= 0; i--) {
      const b = this.bullets.active[i];
      if (!b.userData.friendly) continue;
      const bp = b.position;
      // Asteroids
      let hit = false;
      for (let j = 0; j < this.asteroids.items.length; j++) {
        const a = this.asteroids.items[j];
        const r = a.userData.radius + 0.4;
        if (bp.distanceToSquared(a.position) < r * r) {
          const dead = this.asteroids.damage(a, b.userData.damage, this.particles);
          this.particles.burst(bp, 0xffffff, { count: 10, speed: 8, size: 0.45, life: 0.35 });
          this.bullets.kill(b);
          if (dead) {
            const gained = this._addScore(Math.ceil(a.userData.maxHp * 20));
            this.hud.pickupToast(`+${gained}`);
            this.audio.explosion(clamp(a.userData.radius / 3, 0.5, 1.3));
            this.renderer.shake(0.25);
            // Chance to drop a pickup (biased toward crystals via rollKind).
            if (chance(0.45)) this.pickups.spawn(a.position.clone());
            this.asteroids.destroy(a, this.particles);
          }
          hit = true; break;
        }
      }
      if (hit) continue;
      // Enemies
      let enemyHit = false;
      for (let j = 0; j < this.enemies.items.length; j++) {
        const e = this.enemies.items[j];
        const er = e.userData.radius + 0.4;
        if (bp.distanceToSquared(e.position) < er * er) {
          const dead = this.enemies.damage(e, b.userData.damage);
          this.particles.burst(bp, 0xff88aa, { count: 12, speed: 10, size: 0.55, life: 0.4 });
          this.bullets.kill(b);
          if (dead) {
            const gained = this._addScore(500);
            this.hud.pickupToast(`ENEMY +${gained}`);
            this.audio.explosion(1.0);
            this.renderer.shake(0.45);
            if (chance(0.85)) this.pickups.spawn(e.position.clone());
            this.enemies.destroy(e, this.particles);
          }
          enemyHit = true; break;
        }
      }
      if (enemyHit) continue;
      // Boss
      if (this.boss.active) {
        const result = this.boss.damageAt(bp, b.userData.damage, this.particles);
        if (result && result.hit) {
          this.bullets.kill(b);
          if (result.kind === 'turret') this.renderer.shake(0.15);
          if (result.kind === 'core') this.renderer.shake(0.25);
          if (result.dead) {
            this._addScore(10000 + 2000 * (this.boss.active?.userData.tier || 1));
            this.hud.pickupToast('BOSS DOWN');
            this.audio.explosion(2.0);
            this.renderer.shake(1.0);
            this.boss.destroyAndDrop(this.pickups, this.particles);
          }
        }
      }
    }

    // Enemy bullets vs player
    for (let i = this.bullets.active.length - 1; i >= 0; i--) {
      const b = this.bullets.active[i];
      if (b.userData.friendly) continue;
      const br = pr + 0.4;
      if (b.position.distanceToSquared(pp) < br * br) {
        const dead = this.ship.applyDamage(b.userData.damage, this.audio);
        this.hud.flashDamage();
        this.renderer.shake(0.4);
        this.particles.burst(b.position, 0xff4b78, { count: 16, speed: 12, size: 0.6, life: 0.5 });
        this.bullets.kill(b);
        if (dead) { this._gameOver(); return; }
      }
    }

    // Player vs asteroids
    for (let j = this.asteroids.items.length - 1; j >= 0; j--) {
      const a = this.asteroids.items[j];
      const ar = a.userData.radius + pr;
      if (pp.distanceToSquared(a.position) < ar * ar) {
        const dead = this.ship.applyDamage(clamp(a.userData.radius * 8, 10, 40), this.audio);
        this.hud.flashDamage();
        this.renderer.shake(0.6);
        this.particles.burst(pp, 0xff4bff, { count: 40, speed: 18, size: 0.9, life: 0.8 });
        this.audio.explosion(1.1);
        // Shatter asteroid
        this.asteroids.destroy(a, this.particles);
        this.combo = 1; this.hud.hideCombo();
        if (dead) { this._gameOver(); return; }
      }
    }

    // Player vs enemies (ramming)
    for (let j = this.enemies.items.length - 1; j >= 0; j--) {
      const e = this.enemies.items[j];
      const er = e.userData.radius + pr;
      if (pp.distanceToSquared(e.position) < er * er) {
        const dead = this.ship.applyDamage(30, this.audio);
        this.hud.flashDamage();
        this.renderer.shake(0.8);
        this.particles.burst(pp, 0xff4b78, { count: 50, speed: 22, size: 1.0, life: 1.0 });
        this.audio.explosion(1.2);
        this.enemies.destroy(e, this.particles);
        this.combo = 1; this.hud.hideCombo();
        if (dead) { this._gameOver(); return; }
      }
    }

    // Player vs boss (ramming the boss itself)
    if (this.boss.active) {
      const bpos = this.boss.active.position;
      const br = this.boss.active.userData.radius;
      const brr = br + pr;
      if (pp.distanceToSquared(bpos) < brr * brr) {
        const dead = this.ship.applyDamage(55, this.audio);
        this.hud.flashDamage();
        this.renderer.shake(1.0);
        this.particles.burst(pp, 0xff9a2f, { count: 60, speed: 22, size: 1.0, life: 1.0 });
        this.combo = 1; this.hud.hideCombo();
        if (dead) { this._gameOver(); return; }
      }
    }

    // Player vs pickups
    for (let j = this.pickups.items.length - 1; j >= 0; j--) {
      const p = this.pickups.items[j];
      const prr = p.userData.radius + pr;
      if (pp.distanceToSquared(p.position) < prr * prr) {
        this._applyPickup(p);
        this.pickups.remove(p);
      }
    }
  }

  _applyPickup(p) {
    const kind = p.userData.kind;
    const color = p.userData.color;
    this.audio.pickup();
    this.particles.burst(p.position, color, { count: 28, speed: 12, size: 0.7, life: 0.6 });
    if (kind === 'crystal') {
      const gained = this._addScore(p.userData.value);
      this.ship.repair(6);
      this.hud.pickupToast(`CRYSTAL +${gained}`);
    } else if (kind === 'shield') {
      this.ship.grantShield(8);
      this._addScore(p.userData.value);
      this.hud.pickupToast('SHIELD +8s');
    } else if (kind === 'rapidfire') {
      this.ship.grantRapidFire(10);
      this._addScore(p.userData.value);
      this.hud.pickupToast('RAPID FIRE +10s');
    } else if (kind === 'multishot') {
      this.ship.grantMultiShot(10);
      this._addScore(p.userData.value);
      this.hud.pickupToast('MULTI-SHOT +10s');
    } else if (kind === 'bomb') {
      this._detonateBomb();
      this._addScore(p.userData.value);
      this.hud.pickupToast('PULSE BOMB!');
    }
  }

  _loop(now) {
    // FPS limiter: skip frame if running too fast (target 60fps max)
    const elapsed = now - this._lastT;
    if (elapsed < 16) {  // ~60fps cap
      requestAnimationFrame((t) => this._loop(t));
      return;
    }
    // Clamp delta time to prevent physics explosions during lag spikes
    // 0.033 = 30fps minimum, 0.05 = 20fps (was too lenient)
    const dt = Math.min(0.033, elapsed / 1000);
    this._lastT = now;
    this.time += dt;

    if (this.state === STATE.PLAYING) {
      // Keep touch boost flag in sync each frame.
      this.input.setTouchBoost(this.touch.boosting());
      this.ship.update(dt, this.input, this.camera);
      this._fire(dt);
      this.bullets.update(dt);
      this.asteroids.update(dt, this.ship);
      this.enemies.update(dt, this.ship, this.bullets, this.audio);
      this.boss.update(dt, this.ship, this.bullets, this.audio);
      this.pickups.update(dt, this.ship);
      this.particles.update(dt);
      this._spawnWaveContent(dt);
      this._collide();
      this.distance += this.ship.speed * dt;

      // Combo timer
      if (this.combo > 1) {
        this._comboTimer -= dt;
        if (this._comboTimer <= 0) { this.combo = 1; this.hud.hideCombo(); }
      }

      this.hud.update(this._hudState());
    } else if (this.state === STATE.CINEMATIC) {
      // Autopilot drives the ship; director overrides the camera after.
      this.cinematic.drive(dt);
      this.ship.update(dt, this.input, this.camera);
      this._fire(dt);
      this.bullets.update(dt);
      this.asteroids.update(dt, this.ship);
      this.enemies.update(dt, this.ship, this.bullets, this.audio);
      this.boss.update(dt, this.ship, this.bullets, this.audio);
      this.pickups.update(dt, this.ship);
      this.particles.update(dt);
      this._spawnWaveContent(dt);
      this._collide();
      this.distance += this.ship.speed * dt;
      // Camera direction — after ship.update so we overwrite its follow.
      this.cinematic.update(dt);
    } else if (this.state === STATE.TITLE || this.state === STATE.OVER) {
      // Drift camera slowly on menus for a cinematic feel.
      this.camera.position.x = Math.sin(this.time * 0.2) * 10;
      this.camera.position.y = 2 + Math.sin(this.time * 0.15) * 1.5;
      this.camera.position.z = 20 + Math.cos(this.time * 0.1) * 4;
      this.camera.lookAt(0, 0, 0);
      this.particles.update(dt);
    }

    this.world.update(dt, this.camera);
    this.renderer.render(dt, this.time);
    this.input.endFrame();

    requestAnimationFrame((t) => this._loop(t));
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

window.addEventListener('load', () => {
  try {
    window.__game = new Game();
  } catch (err) {
    console.error('Failed to initialize game:', err);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `<div style="max-width:520px; text-align:center; padding:24px;">
        <h2 style="color:#ff4b78; letter-spacing:0.2em;">INITIALIZATION FAILED</h2>
        <pre style="white-space:pre-wrap; color:#8a94c7; font-size:12px;">${String(err && err.stack || err)}</pre>
      </div>`;
    }
  }
});
