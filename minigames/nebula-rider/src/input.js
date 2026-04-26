// Keyboard + mouse + touch input manager.
// Desktop: tracks keys, buttons, and normalized mouse position over the canvas.
// Touch: a companion `TouchControls` instance pushes virtual-joystick axes and a
// fire latch into this manager via setTouchAxes / setTouchFire.
// Autofire: if settings.autofire is true, firing() always returns true while
// enabled (convenience for scripted/automated testing).

import { settings } from './settings.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0 };
    this.buttons = new Set();
    this.enabled = false;

    // Touch-input surface (set externally by TouchControls).
    this._touchAxes = { x: 0, y: 0 };
    this._touchFire = false;
    this._touchBoost = false;

    // Cinematic-input surface (set externally by Cinematic). Bypasses the
    // `enabled` flag so the player can't steer the autopilot ship, but still
    // injects axes/fire/boost through the normal ship-update path.
    this._cinematicAxes = null;
    this._cinematicFire = false;
    this._cinematicBoost = false;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      // Avoid page scroll for gameplay keys.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.nx = (this.mouse.x / rect.width) * 2 - 1;
      this.mouse.ny = -((this.mouse.y / rect.height) * 2 - 1);
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.buttons.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      this.buttons.delete(e.button);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.buttons.clear();
    });
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this.keys.clear();
      this.buttons.clear();
      this._touchAxes.x = 0; this._touchAxes.y = 0;
      this._touchFire = false;
      this._touchBoost = false;
    }
  }

  consumeJustPressed(code) {
    if (this.justPressed.has(code)) { this.justPressed.delete(code); return true; }
    return false;
  }

  // --- Touch surface (called by TouchControls) ---
  setTouchAxes(x, y) { this._touchAxes.x = x; this._touchAxes.y = y; }
  setTouchFire(v) { this._touchFire = !!v; }
  setTouchBoost(v) { this._touchBoost = !!v; }

  // --- Cinematic surface (called by Cinematic) ---
  // Pass (null, null) to release the override and fall back to normal input.
  setCinematicAxes(x, y) {
    if (x == null || y == null) { this._cinematicAxes = null; return; }
    this._cinematicAxes = { x, y };
  }
  setCinematicFire(v) { this._cinematicFire = !!v; }
  setCinematicBoost(v) { this._cinematicBoost = !!v; }

  // Normalized steering axes from keyboard + touch (touch dominates when active).
  axes() {
    if (this._cinematicAxes) {
      return { x: this._cinematicAxes.x, y: this._cinematicAxes.y, roll: 0 };
    }
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    const roll = (k.has('KeyE') ? 1 : 0) - (k.has('KeyQ') ? 1 : 0);
    if (this._touchAxes.x !== 0 || this._touchAxes.y !== 0) {
      x = this._touchAxes.x;
      y = this._touchAxes.y;
    }
    if (settings.get('invertY')) y = -y;
    return { x, y, roll };
  }

  firing() {
    if (this._cinematicFire) return true;
    if (!this.enabled) return false;
    if (settings.get('autofire')) return true;
    return this.keys.has('Space') || this.buttons.has(0) || this._touchFire;
  }

  boosting() {
    if (this._cinematicBoost) return true;
    if (!this.enabled) return false;
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this._touchBoost;
  }

  endFrame() { this.justPressed.clear(); }
}
