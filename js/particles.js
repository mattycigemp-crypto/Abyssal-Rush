/**
 * Particle & Bubble FX System
 */

const FX = {
  particles: [],
  bubbles: [],

  spawn(x, y, col, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (opts.vx || 0) + (Math.random() - 0.5) * (opts.speed || 4) * 2,
        vy: (opts.vy || 0) + (Math.random() - 0.5) * (opts.speed || 4) * 2,
        life: 1,
        maxLife: opts.life || 1,
        lifeSp: (opts.decay || 0.03) + Math.random() * 0.02,
        col,
        size: opts.size || 3,
        gravity: opts.gravity !== false
      });
    }
  },

  spawnBubble(x, y) {
    this.bubbles.push({
      x, y,
      vy: -0.5 - Math.random(),
      size: 2 + Math.random() * 4,
      life: 1,
      wobble: Math.random() * Math.PI * 2
    });
  },

  update() {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.gravity) p.vy += 0.08;
      p.life -= p.lifeSp;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      let b = this.bubbles[i];
      b.y += b.vy;
      b.x += Math.sin(Date.now() / 500 + b.wobble) * 0.3;
      b.life -= 0.005;
      if (b.life <= 0) this.bubbles.splice(i, 1);
    }
  },

  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';

    // Draw particles
    for (let p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.life * p.size), 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw bubbles
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#88ccff';
    for (let b of this.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * b.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
};
