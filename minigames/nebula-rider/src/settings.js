// Persistent user settings. Stored in localStorage and exposed as a singleton.
// Emits "change" events whenever a setting is updated so the rest of the game
// can react without tight coupling (e.g., audio gains, renderer effects, HUD).

const STORAGE_KEY = 'nebula-rider.settings.v1';

const DEFAULTS = Object.freeze({
  masterVolume: 0.9,
  musicVolume: 0.35,
  sfxVolume: 0.8,
  muted: false,
  mouseSensitivity: 1.0,
  rollSensitivity: 1.0,
  invertY: false,
  colorblind: false,       // enables high-contrast palette for asteroids/enemies/pickups
  reducedMotion: false,    // disables screen shake, chromatic aberration, grain, hue cycle
  highQuality: true,        // false = disable bloom/FXAA for performance
  showFPS: false,
  autofire: false,         // dev flag; if true, always reports firing true
});

function readRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) { /* ignore */ }
  return {};
}

function writeRaw(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (_) { /* ignore */ }
}

function detectReducedMotion() {
  try {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) { return false; }
}

class SettingsStore {
  constructor() {
    const stored = readRaw();
    const base = { ...DEFAULTS, ...stored };
    // If reducedMotion was never explicitly set by the user, seed it from the OS.
    if (!('reducedMotion' in stored)) base.reducedMotion = detectReducedMotion();
    this._state = base;
    this._listeners = new Set();
  }

  get(key) { return this._state[key]; }
  all() { return { ...this._state }; }

  set(key, value) {
    if (!(key in DEFAULTS)) return;
    if (this._state[key] === value) return;
    this._state[key] = value;
    writeRaw(this._state);
    this._emit(key, value);
  }

  setMany(obj) {
    let changed = false;
    for (const k of Object.keys(obj)) {
      if (k in DEFAULTS && this._state[k] !== obj[k]) {
        this._state[k] = obj[k];
        changed = true;
        this._emit(k, obj[k]);
      }
    }
    if (changed) writeRaw(this._state);
  }

  reset() {
    this._state = { ...DEFAULTS, reducedMotion: detectReducedMotion() };
    writeRaw(this._state);
    for (const k of Object.keys(this._state)) this._emit(k, this._state[k]);
  }

  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit(key, value) {
    for (const l of this._listeners) {
      try { l(key, value, this._state); } catch (e) { console.error('[settings]', e); }
    }
  }
}

// Apply a URL flag once at load (for `?autofire=1` etc.). These override stored
// settings for the current tab but are NOT persisted unless the user explicitly
// changes them via the settings UI.
function applyUrlOverrides(store) {
  try {
    const p = new URLSearchParams(window.location.search);
    const flags = {};
    if (p.get('autofire') === '1') flags.autofire = true;
    if (p.get('colorblind') === '1') flags.colorblind = true;
    if (p.get('reducedMotion') === '1') flags.reducedMotion = true;
    if (Object.keys(flags).length) {
      // Update in-memory only (do not persist URL flags).
      for (const [k, v] of Object.entries(flags)) {
        store._state[k] = v;
        store._emit(k, v);
      }
    }
  } catch (_) { /* ignore */ }
}

export const settings = new SettingsStore();
applyUrlOverrides(settings);
export { DEFAULTS };
