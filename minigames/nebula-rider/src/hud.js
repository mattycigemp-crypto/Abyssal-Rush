// HUD updates.
import { fmtInt, clamp } from './utils.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      score: document.getElementById('score'),
      wave: document.getElementById('wave'),
      distance: document.getElementById('distance'),
      hull: document.getElementById('hull-bar'),
      boost: document.getElementById('boost-bar'),
      heat: document.getElementById('heat-bar'),
      damage: document.getElementById('damage-vignette'),
      pickups: document.getElementById('pickups'),
      combo: document.getElementById('combo'),
      comboX: document.getElementById('combo-x'),
      start: document.getElementById('start-screen'),
      pause: document.getElementById('pause-screen'),
      over: document.getElementById('gameover-screen'),
      settings: document.getElementById('settings-screen'),
      loading: document.getElementById('loading'),
      finalScore: document.getElementById('final-score'),
      finalWave: document.getElementById('final-wave'),
      finalDistance: document.getElementById('final-distance'),
      finalRank: document.getElementById('final-rank'),
      bossBar: document.getElementById('boss-bar-wrap'),
      bossFill: document.getElementById('boss-bar'),
      bossLabel: document.getElementById('boss-label'),
      powerups: document.getElementById('powerups'),
    };
    this._comboTimer = 0;
    this._powerupEls = new Map();
  }

  show(name) { this.el[name]?.classList.remove('hidden'); }
  hide(name) { this.el[name]?.classList.add('hidden'); }

  update(state) {
    this.el.score.textContent = fmtInt(state.score);
    this.el.wave.textContent = state.wave;
    this.el.distance.innerHTML = `${fmtInt(state.distance / 100)}<span class="unit"> km</span>`;
    const hullPct = clamp((state.hull / state.maxHull) * 100, 0, 100);
    this.el.hull.style.width = `${hullPct}%`;
    const boostPct = clamp((state.boost / state.maxBoost) * 100, 0, 100);
    this.el.boost.style.width = `${boostPct}%`;
    const heatPct = clamp((state.heat / state.maxHeat) * 100, 0, 100);
    this.el.heat.style.width = `${heatPct}%`;

    // Boss HP bar (only visible while a boss is active).
    if (this.el.bossBar) {
      if (state.bossActive) {
        this.el.bossBar.classList.remove('hidden');
        const pct = clamp(state.bossHpFrac * 100, 0, 100);
        this.el.bossFill.style.width = `${pct}%`;
        this.el.bossLabel.textContent = state.bossExposed ? 'BOSS CORE EXPOSED' : 'BOSS — SHIELD ACTIVE';
        this.el.bossBar.classList.toggle('exposed', !!state.bossExposed);
      } else {
        this.el.bossBar.classList.add('hidden');
      }
    }

    // Powerup indicators
    if (this.el.powerups) {
      this._updatePowerup('shield', state.shieldTime, 'SHIELD');
      this._updatePowerup('rapid', state.rapidFireTime, 'RAPID');
      this._updatePowerup('multi', state.multiShotTime, 'MULTI');
    }
  }

  _updatePowerup(key, time, label) {
    let el = this._powerupEls.get(key);
    if (time > 0) {
      if (!el) {
        el = document.createElement('div');
        el.className = `powerup powerup-${key}`;
        el.innerHTML = `<span class="label">${label}</span><span class="time"></span>`;
        this.el.powerups.appendChild(el);
        this._powerupEls.set(key, el);
      }
      el.querySelector('.time').textContent = `${Math.ceil(time)}s`;
    } else if (el) {
      el.remove();
      this._powerupEls.delete(key);
    }
  }

  flashDamage() {
    this.el.damage.classList.add('hit');
    setTimeout(() => this.el.damage.classList.remove('hit'), 220);
  }

  showCombo(mult) {
    if (mult <= 1) { this.el.combo.classList.add('hidden'); return; }
    this.el.comboX.textContent = `x${mult}`;
    this.el.combo.classList.remove('hidden');
    // Retrigger pop animation using requestAnimationFrame to avoid forced reflow
    this.el.combo.style.animation = 'none';
    requestAnimationFrame(() => {
      this.el.combo.style.animation = '';
    });
  }

  hideCombo() { this.el.combo.classList.add('hidden'); }

  pickupToast(text) {
    const el = document.createElement('div');
    el.className = 'pickup-toast';
    el.textContent = text;
    this.el.pickups.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  showGameOver(state) {
    this.el.finalScore.textContent = fmtInt(state.score);
    this.el.finalWave.textContent = state.wave;
    this.el.finalDistance.textContent = `${fmtInt(state.distance / 100)} km`;
    if (this.el.finalRank) {
      if (state.rank) {
        this.el.finalRank.textContent = `NEW #${state.rank} ON THE BOARD`;
        this.el.finalRank.classList.remove('hidden');
      } else {
        this.el.finalRank.classList.add('hidden');
      }
    }
    this.show('over');
  }
}
