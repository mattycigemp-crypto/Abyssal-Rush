// Procedural ambient audio + SFX using Web Audio API.
// No external asset downloads — everything is synthesized.
export class AudioSys {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private started = false;

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  // Must be called from a user gesture (button click).
  start() {
    if (this.started) return;
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.0;
    this.ambientGain.connect(this.master);

    this.buildAmbient();
    this.started = true;

    // Fade in
    const now = this.ctx.currentTime;
    this.ambientGain.gain.setValueAtTime(0, now);
    this.ambientGain.gain.linearRampToValueAtTime(0.4, now + 3);
  }

  // Soft pad + filtered noise (wind) + occasional chimes.
  private buildAmbient() {
    if (!this.ctx || !this.ambientGain) return;
    const ctx = this.ctx;

    // Drone pad (stacked detuned sine oscillators)
    const pad = ctx.createGain();
    pad.gain.value = 0.15;
    pad.connect(this.ambientGain);
    const padFreqs = [110, 164.81, 220, 329.63]; // A2, E3, A3, E4
    padFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = 0.5 / padFreqs.length;
      // Slow volume LFO for shimmer
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.013;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.3 / padFreqs.length;
      lfo.connect(lfoGain).connect(g.gain);
      lfo.start();
      osc.connect(g).connect(pad);
      osc.start();
    });

    // Wind: filtered pink-ish noise with slow amplitude modulation
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.0995;
      b1 = 0.985 * b1 + white * 0.2965;
      b2 = 0.95 * b2 + white * 0.2535;
      out[i] = b0 + b1 + b2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 600;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    const ampLfo = ctx.createOscillator();
    ampLfo.frequency.value = 0.09;
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.03;
    ampLfo.connect(ampLfoGain).connect(noiseGain.gain);
    ampLfo.start();
    noise.connect(noiseFilter).connect(noiseGain).connect(this.ambientGain);
    noise.start();

    // Chimes every ~20s
    const scheduleChime = () => {
      if (!this.ctx || !this.ambientGain) return;
      const when = this.ctx.currentTime + 12 + Math.random() * 16;
      const freqs = [523.25, 659.25, 783.99, 987.77]; // C5 E5 G5 B5
      const f = freqs[Math.floor(Math.random() * freqs.length)];
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(0.12, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 3);
      osc.connect(g).connect(this.ambientGain);
      osc.start(when);
      osc.stop(when + 3.1);
      window.setTimeout(scheduleChime, (when - this.ctx.currentTime + 0.1) * 1000);
    };
    scheduleChime();
  }

  // One-shot effect: short band-passed noise burst.
  playSwordSwing() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.2);
    filter.Q.value = 6;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(filter).connect(g).connect(this.master);
    src.start(now);
  }

  playHit() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playFootstep() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 3);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    src.connect(filter).connect(g).connect(this.master);
    src.start(now);
  }

  playChime(semitoneOffset = 0) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseFreq = 659.25 * Math.pow(2, semitoneOffset / 12);
    osc.frequency.value = baseFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 1.55);
  }
}
