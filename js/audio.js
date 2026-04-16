/**
 * Audio System - Web Audio API
 */

const AudioSys = (() => {
  let ctx = null, masterGain = null;

  const init = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(ctx.destination);
    }
  };

  const playTone = (freqs, type, dur, vol = 0.15, when = 0) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.connect(gain);
    gain.connect(masterGain);

    const t = ctx.currentTime + when;
    osc.frequency.setValueAtTime(freqs[0], t);
    if (freqs.length > 1) osc.frequency.exponentialRampToValueAtTime(freqs[1], t + dur);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.start(t);
    osc.stop(t + dur);
    return osc;
  };

  const playChord = (freqs, dur, vol = 0.12) => {
    if (!ctx) return;
    freqs.forEach((f, i) => setTimeout(() => playTone([f, f * 1.5], 'sine', dur, vol), i * 50));
  };

  return {
    init,
    jump: () => playTone([300, 550], 'sine', 0.22, 0.2),
    doubleJump: () => playTone([400, 700], 'sine', 0.2, 0.18),
    spring: () => playChord([200, 300, 500, 800], 0.35, 0.2),
    dash: () => playTone([600, 150], 'sawtooth', 0.2, 0.15),
    shoot: () => playTone([1200, 800], 'square', 0.08, 0.1),
    hit: () => playTone([200, 40], 'sawtooth', 0.4, 0.35),
    pickup: () => playTone([880, 1200], 'sine', 0.12, 0.12),
    crystalCollect: () => playChord([660, 880], 0.1, 0.1),
    powerUp: () => playChord([440, 554, 659, 880], 0.5, 0.25),
    scatter: () => playTone([1000, 300], 'square', 0.35, 0.18),
    enemyDie: () => playTone([180, 35], 'sawtooth', 0.25, 0.22),
    enemyHit: () => playTone([250, 100], 'square', 0.15, 0.18),
    checkpoint: () => playChord([330, 440, 554, 659], 0.6, 0.22),
    bossHit: () => playTone([150, 80], 'sawtooth', 0.3, 0.3),
    levelComplete: () => playChord([523, 659, 783, 1046], 1.0, 0.3),
    extraLife: () => playChord([440, 554, 659, 880, 1108], 0.8, 0.25),
    gameOver: () => playTone([300, 60], 'sawtooth', 1.5, 0.4)
  };
})();
