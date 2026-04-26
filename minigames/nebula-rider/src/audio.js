// Fully-synthesized audio: adaptive music + SFX via WebAudio. No external assets.
import { settings } from './settings.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = settings.get('muted');
    this._started = false;
    this._musicNodes = [];
    this._intensity = 0; // 0..1 ramps with wave/action
    this._tempo = 108;
    this._stepInterval = null;
    this._step = 0;

    // React to settings changes live.
    settings.onChange((key) => {
      if (!this._started) return;
      if (key === 'masterVolume' || key === 'muted') this._applyMaster();
      if (key === 'musicVolume') this._applyMusic();
      if (key === 'sfxVolume') this._applySfx();
    });
  }

  ensureStarted() {
    if (this._started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this._applyMaster();
    this._applyMusic();
    this._applySfx();
    this._started = true;
  }

  _applyMaster() {
    if (!this.master) return;
    // Mirror the canonical value from settings into this.muted so external
    // callers (the M hotkey, UI toggle, etc.) stay in sync with a single source
    // of truth.
    this.muted = !!settings.get('muted');
    const target = this.muted ? 0 : settings.get('masterVolume');
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(target, t + 0.12);
  }
  _applyMusic() {
    if (!this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(settings.get('musicVolume'), this.ctx.currentTime, 0.05);
  }
  _applySfx() {
    if (!this.sfxGain) return;
    this.sfxGain.gain.setTargetAtTime(settings.get('sfxVolume'), this.ctx.currentTime, 0.05);
  }

  setMuted(v) {
    this.muted = v;
    settings.set('muted', !!v);
    this._applyMaster();
  }

  setIntensity(v) { this._intensity = Math.max(0, Math.min(1, v)); }

  // ---------- Music (driven by a step scheduler) ----------
  startMusic() {
    if (!this.ctx || this._stepInterval) return;
    const scaleMinor = [0, 3, 5, 7, 10, 12, 15, 17]; // minor pentatonic-ish
    const root = 36; // C2 midi
    const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

    const bassPattern = [0, null, 0, null, 7, null, 0, 5, 0, null, 0, null, 7, 10, 7, 5];
    let leadNoteIdx = 0;

    const schedule = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const beat = 60 / this._tempo / 2; // 1/8th
      const t = now + 0.02;
      const s = this._step % 16;

      // Kick on 1 & 9, snare on 5 & 13
      if (s === 0 || s === 8) this._kick(t, 0.9);
      if (s === 4 || s === 12) this._snare(t, 0.45);
      if (s % 2 === 0) this._hat(t, 0.1 + Math.random() * 0.08);

      // Bass
      const bn = bassPattern[s];
      if (bn !== null) {
        const f = midiToFreq(root + bn);
        this._bass(t, f, beat * 1.8);
      }

      // Lead arpeggio — becomes denser with intensity.
      if (Math.random() < 0.35 + 0.6 * this._intensity) {
        const scale = scaleMinor;
        const note = scale[(leadNoteIdx + (Math.random() < 0.3 ? 1 : 0)) % scale.length];
        leadNoteIdx = (leadNoteIdx + (Math.random() < 0.7 ? 1 : 2)) % scale.length;
        const f = midiToFreq(root + 24 + note);
        this._lead(t, f, beat * 2, 0.08 + 0.12 * this._intensity);
      }

      // Pad swell every 8 steps
      if (s === 0) this._pad(t, midiToFreq(root + 12), beat * 8);

      this._step++;
    };

    const period = 60 / this._tempo / 2 * 1000;
    // Schedule a little ahead with setInterval — simple and good enough for ambient music.
    this._stepInterval = setInterval(schedule, period);
  }

  stopMusic() {
    if (this._stepInterval) { clearInterval(this._stepInterval); this._stepInterval = null; }
  }

  // ---------- Instrument voices ----------
  _env(gain, t, attack, decay, sustain, release, peak) {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), t + attack + decay);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay + release);
  }

  _kick(t, vel = 1) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.32);
  }

  _snare(t, vel = 1) {
    const noise = this._noiseBuffer(0.25);
    const src = this.ctx.createBufferSource();
    src.buffer = noise;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7 * vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(t); src.stop(t + 0.25);
  }

  _hat(t, vel = 0.15) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.07);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(t); src.stop(t + 0.08);
  }

  _bass(t, freq, dur) {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 540 + 400 * this._intensity;
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = freq; o2.frequency.value = freq * 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }

  _lead(t, freq, dur, vel) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const del = this.ctx.createDelay(); del.delayTime.value = 0.22;
    const fb = this.ctx.createGain(); fb.gain.value = 0.38;
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    g.connect(del); del.connect(fb); fb.connect(del); del.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _pad(t, freq, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 + 0.12 * this._intensity, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [1, 1.005, 1.5, 2].forEach((mul) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq * mul;
      o.connect(g); o.start(t); o.stop(t + dur + 0.1);
    });
    g.connect(this.musicGain);
  }

  _noiseBuffer(seconds) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * seconds, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---------- SFX ----------
  laser() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(250, t + 0.18);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.22);
  }

  explosion(size = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.7);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(1200 * size, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75 * size, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(lp).connect(g).connect(this.sfxGain);
    src.start(t); src.stop(t + 0.72);

    // Low sub-boom
    const o = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120 * size, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.55);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.6 * size, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(og).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.65);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.sfxGain);
    o.start(t); o.stop(t + 0.28);
  }

  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.22);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.8, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    src.connect(bp).connect(g).connect(this.sfxGain);
    src.start(t); src.stop(t + 0.22);
  }

  boost(on) {
    if (!this.ctx) return;
    if (on) {
      if (this._boostNode) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      o.type = 'sawtooth'; o.frequency.value = 90;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
      o.connect(lp).connect(g).connect(this.sfxGain);
      o.start(t);
      this._boostNode = { o, g };
    } else if (this._boostNode) {
      const { o, g } = this._boostNode;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.stop(t + 0.18);
      this._boostNode = null;
    }
  }

  wave() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.35);
      o.connect(g).connect(this.sfxGain);
      o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.4);
    });
  }
}
