// Procedural ambient audio + SFX using Web Audio API.
// No external asset downloads — everything is synthesized.
export class AudioSys {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private started = false;
  private currentMusic: 'ambient' | 'exploration' | 'combat' | 'cinematic' | 'chapter1' | 'chapter2' | 'chapter3' = 'ambient';
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

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

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);

    this.buildAmbient();
    this.started = true;

    // Fade in
    const now = this.ctx.currentTime;
    this.ambientGain.gain.setValueAtTime(0, now);
    this.ambientGain.gain.linearRampToValueAtTime(0.4, now + 3);
  }

  setMusic(type: 'ambient' | 'exploration' | 'combat' | 'cinematic' | 'chapter1' | 'chapter2' | 'chapter3') {
    if (this.currentMusic === type) return;
    this.currentMusic = type;
    this.stopMusic();
    
    if (!this.ctx || !this.musicGain) return;
    
    switch (type) {
      case 'ambient':
        this.buildAmbientMusic();
        break;
      case 'exploration':
        this.buildExplorationMusic();
        break;
      case 'combat':
        this.buildCombatMusic();
        break;
      case 'cinematic':
        this.buildCinematicMusic();
        break;
      case 'chapter1':
        this.buildChapterMusic(1);
        break;
      case 'chapter2':
        this.buildChapterMusic(2);
        break;
      case 'chapter3':
        this.buildChapterMusic(3);
        break;
    }
    
    // Fade in music
    const now = this.ctx.currentTime;
    this.musicGain.gain.setValueAtTime(0, now);
    this.musicGain.gain.linearRampToValueAtTime(0.3, now + 2);
  }

  private stopMusic() {
    this.musicNodes.forEach(node => {
      try {
        node.osc.stop();
        node.gain.disconnect();
      } catch (e) {
        // Node already stopped
      }
    });
    this.musicNodes = [];
  }

  private buildAmbientMusic() {
    if (!this.ctx || !this.musicGain) return;
    // Subtle ambient pad
    const freqs = [130.81, 164.81, 196.00]; // C3, E3, G3
    freqs.forEach((f) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.1;
      osc.connect(gain).connect(this.musicGain!);
      osc.start();
      this.musicNodes.push({ osc, gain });
    });
  }

  private buildExplorationMusic() {
    if (!this.ctx || !this.musicGain) return;
    // Uplifting exploration theme
    const baseFreqs = [261.63, 329.63, 392.00]; // C4, E4, G4
    baseFreqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.08;
      
      // Add gentle LFO
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.5 + i * 0.1;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      
      osc.connect(gain).connect(this.musicGain!);
      osc.start();
      this.musicNodes.push({ osc, gain });
    });
  }

  private buildCombatMusic() {
    if (!this.ctx || !this.musicGain) return;
    // Tense combat music
    const freqs = [220.00, 233.08, 246.94]; // A3, Bb3, B3 - dissonant
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.05;
      
      // Fast LFO for tension
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 4 + i * 2;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      
      osc.connect(gain).connect(this.musicGain!);
      osc.start();
      this.musicNodes.push({ osc, gain });
    });
  }

  private buildCinematicMusic() {
    if (!this.ctx || !this.musicGain) return;
    // Epic cinematic orchestral feel
    const freqs = [65.41, 98.00, 130.81, 196.00]; // C2, G2, C3, G3
    freqs.forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.12 - i * 0.02;
      
      // Slow sweeping LFO
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.2 + i * 0.05;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      
      osc.connect(gain).connect(this.musicGain!);
      osc.start();
      this.musicNodes.push({ osc, gain });
    });
  }

  private buildChapterMusic(chapter: number) {
    if (!this.ctx || !this.musicGain) return;
    
    const baseFreq = chapter === 1 ? 261.63 : chapter === 2 ? 293.66 : 329.63; // C4, D4, E4
    const intervals = chapter === 1 ? [1, 1.25, 1.5] : chapter === 2 ? [1, 1.2, 1.4] : [1, 1.33, 1.67];
    
    intervals.forEach((interval, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = baseFreq * interval;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0.1 - i * 0.02;
      
      // Chapter-specific LFO
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.3 + chapter * 0.1 + i * 0.05;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
      
      osc.connect(gain).connect(this.musicGain!);
      osc.start();
      this.musicNodes.push({ osc, gain });
    });
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
