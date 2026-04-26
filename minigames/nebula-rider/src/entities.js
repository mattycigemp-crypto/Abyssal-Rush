// Asteroids, enemies, bullets, pickups, particles — pooled for performance.
import * as THREE from 'three';
import { clamp, rand, randi, chance, pick, tmp, prng } from './utils.js';
import { settings } from './settings.js';

// Palette: two variants so players with red/green color confusion (or anyone who
// prefers higher separation) can still distinguish asteroid, enemy, pickup, and
// bullet classes. All hazards become orange; all player/positive objects stay
// blue; crystals use a distinct shape per kind (see Pickups below).
function palette(kind) {
  const cb = settings.get('colorblind');
  switch (kind) {
    case 'asteroidTint': return cb ? [0x4a5078, 0x3c4a72, 0x574074] : [0x40345a, 0x2a3a66, 0x5c2a66];
    case 'enemyHull':    return cb ? 0x402210 : 0x400010;
    case 'enemyGlow':    return cb ? 0xff9a2f : 0xff2244;
    case 'enemyLight':   return cb ? 0xffa040 : 0xff3355;
    case 'enemyBullet':  return cb ? 0xffa040 : 0xff4b78;
    case 'playerBullet': return cb ? 0x5dc8ff : 0x5dc8ff; // already blue
    default: return 0xffffff;
  }
}

// ---------- Particle System ----------
export class Particles {
  constructor(scene, max = 800) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.sizes = new Float32Array(max);
    this.velocities = new Float32Array(max * 3);
    this.ages = new Float32Array(max);
    this.lives = new Float32Array(max);
    this.alive = new Uint8Array(max);
    this._head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vCol;
        uniform float uPixelRatio;
        void main() {
          vCol = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          a = pow(a, 1.4);
          gl_FragColor = vec4(vCol, a);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(pos, vel, color, size, life) {
    let i;
    for (let tries = 0; tries < this.max; tries++) {
      i = this._head;
      this._head = (this._head + 1) % this.max;
      if (!this.alive[i]) break;
    }
    const p = i * 3;
    this.positions[p + 0] = pos.x;
    this.positions[p + 1] = pos.y;
    this.positions[p + 2] = pos.z;
    this.velocities[p + 0] = vel.x;
    this.velocities[p + 1] = vel.y;
    this.velocities[p + 2] = vel.z;
    this.colors[p + 0] = color.r;
    this.colors[p + 1] = color.g;
    this.colors[p + 2] = color.b;
    this.sizes[i] = size;
    this.ages[i] = 0;
    this.lives[i] = life;
    this.alive[i] = 1;
  }

  burst(pos, color, opts = {}) {
    const count = opts.count ?? 20;  // Reduced from 40 for performance
    const speed = opts.speed ?? 12;
    const size = opts.size ?? 0.7;
    const life = opts.life ?? 1.1;
    // Use pooled color to avoid allocation
    const c = tmp.c0.setHex(color);
    for (let i = 0; i < count; i++) {
      // Use pooled vector to avoid allocation
      const v = tmp.v0.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      const hue = tmp.c1.copy(c).offsetHSL(rand(-0.08, 0.08), 0, rand(-0.15, 0.15));
      this.spawn(pos, v, hue, size * (0.6 + Math.random() * 0.8), life * (0.7 + Math.random() * 0.6));
    }
  }

  update(dt) {
    const pos = this.positions, vel = this.velocities, col = this.colors, sz = this.sizes;
    for (let i = 0; i < this.max; i++) {
      if (!this.alive[i]) { sz[i] = 0; continue; }
      const a = this.ages[i] += dt;
      if (a >= this.lives[i]) { this.alive[i] = 0; sz[i] = 0; continue; }
      const base = i * 3;
      pos[base + 0] += vel[base + 0] * dt;
      pos[base + 1] += vel[base + 1] * dt;
      pos[base + 2] += vel[base + 2] * dt;
      // Drag
      vel[base + 0] *= 0.95;
      vel[base + 1] *= 0.95;
      vel[base + 2] *= 0.95;
      // Fade
      const k = 1 - a / this.lives[i];
      col[base + 0] *= 0.995;
      col[base + 1] *= 0.995;
      col[base + 2] *= 0.998;
      sz[i] *= 0.985;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.aSize.needsUpdate = true;
  }
}

// ---------- Bullets ----------
export class Bullets {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this._geo = new THREE.CapsuleGeometry(0.12, 1.2, 6, 12);
    this._geo.rotateX(Math.PI / 2);
  }

  _make(friendly) {
    const color = friendly ? palette('playerBullet') : palette('enemyBullet');
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(this._geo, mat);
    mesh.userData = { kind: friendly ? 'playerBullet' : 'enemyBullet', color };
    // Point light disabled for performance - use emissive material instead
    // const light = new THREE.PointLight(color, 1.4, 6, 1.5);
    // mesh.add(light);
    return mesh;
  }

  spawn(pos, dir, speed, friendly, damage) {
    // Limit max bullets for performance
    if (this.active.length >= 40) {
      const old = this.active.shift();
      this.scene.remove(old);
      this.pool.push(old);
    }
    let m = this.pool.pop();
    if (!m || (m.userData.kind === 'playerBullet') !== friendly) m = this._make(friendly);
    m.position.copy(pos);
    m.lookAt(pos.clone().add(dir));
    m.userData.vel = dir.clone().multiplyScalar(speed);
    m.userData.life = 2.5;
    m.userData.age = 0;
    m.userData.damage = damage;
    m.userData.friendly = friendly;
    m.visible = true;
    this.scene.add(m);
    this.active.push(m);
    return m;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.position.addScaledVector(b.userData.vel, dt);
      b.userData.age += dt;
      if (b.userData.age >= b.userData.life) {
        this.scene.remove(b);
        this.pool.push(b);
        this.active.splice(i, 1);
      }
    }
  }

  kill(b) {
    const i = this.active.indexOf(b);
    if (i >= 0) this.active.splice(i, 1);
    this.scene.remove(b);
    this.pool.push(b);
  }
}

// ---------- Asteroids ----------
function makeAsteroidGeometry(radius, seed) {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const rng = prng(seed);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
    const n = 0.35 * (rng() - 0.5) + 0.18 * Math.sin(nx * 3 + ny * 2) + 0.12 * Math.sin(nz * 4);
    pos.setXYZ(i, nx * (1 + n * 0.5), ny * (1 + n * 0.5), nz * (1 + n * 0.5));
  }
  geo.computeVertexNormals();
  return geo;
}

export class Asteroids {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this._seedCounter = 1;

    // Shared materials — derived from the current palette (swapped when
    // colorblind mode toggles).
    this._mats = this._buildMats();
    settings.onChange((k) => { if (k === 'colorblind') this._mats = this._buildMats(); });
  }

  _buildMats() {
    const [c0, c1, c2] = palette('asteroidTint');
    return [
      new THREE.MeshStandardMaterial({ color: c0, metalness: 0.25, roughness: 0.8, emissive: 0x1a0a36, emissiveIntensity: 0.6, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: c1, metalness: 0.2, roughness: 0.85, emissive: 0x081430, emissiveIntensity: 0.6, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: c2, metalness: 0.15, roughness: 0.9, emissive: 0x2a0a3a, emissiveIntensity: 0.7, flatShading: true }),
    ];
  }

  spawn(pos, radius, velocity) {
    // Limit max asteroids for performance
    if (this.items.length >= 20) {
      const old = this.items.shift();
      this.scene.remove(old);
      old.geometry.dispose();
    }
    const geo = makeAsteroidGeometry(radius, this._seedCounter++);
    const mat = pick(this._mats);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData = {
      radius,
      hp: Math.ceil(radius * 2.2),
      maxHp: Math.ceil(radius * 2.2),
      vel: velocity.clone(),
      spin: new THREE.Vector3(rand(-1.2, 1.2), rand(-1.2, 1.2), rand(-1.2, 1.2)),
    };

    // Crystal veins disabled for performance (extra draw calls)
    // if (chance(0.45)) {
    //   const crystalMat = new THREE.MeshBasicMaterial({
    //     color: pick([0x5dc8ff, 0xff4bff, 0x7cffcb, 0xffcf5b]),
    //     transparent: true, opacity: 0.55,
    //     blending: THREE.AdditiveBlending, depthWrite: false,
    //   });
    //   const crystal = new THREE.Mesh(geo.clone().scale(0.6, 0.6, 0.6), crystalMat);
    //   mesh.add(crystal);
    // }

    this.scene.add(mesh);
    this.items.push(mesh);
    return mesh;
  }

  damage(asteroid, amount, particles) {
    asteroid.userData.hp -= amount;
    // Flash
    const mat = asteroid.material;
    mat.emissiveIntensity = 2.5;
    setTimeout(() => { if (mat.emissiveIntensity > 0.7) mat.emissiveIntensity = 0.7; }, 80);
    return asteroid.userData.hp <= 0;
  }

  destroy(asteroid, particles) {
    particles.burst(asteroid.position, 0xff8bff, {
      count: 50, speed: 16, size: 0.9, life: 1.3,
    });
    particles.burst(asteroid.position, 0x5dc8ff, {
      count: 30, speed: 10, size: 0.6, life: 1.0,
    });
    this.scene.remove(asteroid);
    const i = this.items.indexOf(asteroid);
    if (i >= 0) this.items.splice(i, 1);
    // Dispose geometry (it's unique per asteroid from cloning)
    asteroid.geometry.dispose();
  }

  update(dt, player) {
    const playerPos = player.group.position;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const a = this.items[i];
      a.position.addScaledVector(a.userData.vel, dt);
      a.rotation.x += a.userData.spin.x * dt;
      a.rotation.y += a.userData.spin.y * dt;
      a.rotation.z += a.userData.spin.z * dt;
      // Despawn if left behind
      const dz = a.position.z - playerPos.z;
      if (dz > 120 || a.position.distanceToSquared(playerPos) > 90000) {
        this.scene.remove(a);
        a.geometry.dispose();
        this.items.splice(i, 1);
      }
    }
  }

  clear() {
    for (const a of this.items) { this.scene.remove(a); a.geometry.dispose(); }
    this.items.length = 0;
  }
}

// ---------- Pickups ----------
// Each pickup type has a distinct shape + color so they are legible with
// colorblind mode and on a chaotic battlefield. `rollKind()` biases toward
// plain crystals; powerups are rarer rewards.
function basicMat(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
}

const PICKUP_SPECS = {
  crystal: {
    label: 'CRYSTAL',
    color: 0x7cffcb,
    value: 250,
    radius: 0.9,
    geo: () => { const g = new THREE.OctahedronGeometry(0.6, 0); g.scale(0.7, 1.3, 0.7); return g; },
    mat: basicMat,
  },
  shield: {
    label: 'SHIELD',
    color: 0x5dc8ff,
    value: 100,
    radius: 1.0,
    geo: () => new THREE.TorusGeometry(0.65, 0.2, 10, 24),
    mat: basicMat,
  },
  rapidfire: {
    label: 'RAPID FIRE',
    color: 0xffcf5b,
    value: 100,
    radius: 1.0,
    geo: () => new THREE.TetrahedronGeometry(0.85, 0),
    mat: basicMat,
  },
  multishot: {
    label: 'MULTI-SHOT',
    color: 0xff4bff,
    value: 100,
    radius: 1.0,
    geo: () => {
      // Three-prong star via a coarse extruded shape.
      const s = new THREE.Shape();
      for (let i = 0; i < 6; i++) {
        const r = i % 2 === 0 ? 0.9 : 0.35;
        const a = (i / 6) * Math.PI * 2 + Math.PI / 2;
        if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      s.closePath();
      return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
    },
    mat: basicMat,
  },
  bomb: {
    label: 'PULSE BOMB',
    color: 0xff4b78,
    value: 150,
    radius: 1.0,
    geo: () => new THREE.IcosahedronGeometry(0.8, 1),
    mat: (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true }),
  },
};

function rollKind() {
  const r = Math.random();
  if (r < 0.60) return 'crystal';
  if (r < 0.75) return 'shield';
  if (r < 0.88) return 'rapidfire';
  if (r < 0.96) return 'multishot';
  return 'bomb';
}

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  // Spawn a pickup of the given kind. If `kind` is omitted, rolls a random kind
  // weighted toward crystals (common) with rarer powerups.
  spawn(pos, kind) {
    // Limit max pickups for performance
    if (this.items.length >= 10) {
      const old = this.items.shift();
      this.scene.remove(old);
    }
    if (!kind) kind = rollKind();
    const spec = PICKUP_SPECS[kind];
    const mesh = new THREE.Mesh(spec.geo(), spec.mat(spec.color));
    mesh.position.copy(pos);
    mesh.userData = {
      kind,
      value: spec.value,
      radius: spec.radius ?? 0.9,
      spin: rand(2, 4),
      bob: rand(0, Math.PI * 2),
      vel: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-5, 5)),
      color: spec.color,
      label: spec.label,
    };
    // Point light disabled for performance - emissive material provides glow
    // const light = new THREE.PointLight(spec.color, 1.2, 6, 2);
    // mesh.add(light);
    this.scene.add(mesh);
    this.items.push(mesh);
    return mesh;
  }

  update(dt, player) {
    const playerPos = player.group.position;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.position.addScaledVector(p.userData.vel, dt);
      p.rotation.y += p.userData.spin * dt;
      p.rotation.x += p.userData.spin * 0.5 * dt;
      p.userData.bob += dt * 3;
      p.position.y += Math.sin(p.userData.bob) * 0.02;

      // Magnet: attract when close (use squared distance for performance)
      const d = p.position.distanceToSquared(playerPos);
      if (d < 324) {  // 18^2 = 324
        const dir = tmp.v0.copy(playerPos).sub(p.position).normalize();
        const strength = (18 - d) * 6;
        p.userData.vel.addScaledVector(dir, strength * dt);
        p.userData.vel.multiplyScalar(0.92);
      }
      // Despawn far behind (d is squared distance)
      if (p.position.z - playerPos.z > 120 || d > 122500) {  // 350^2 = 122500
        this._dispose(p);
        this.items.splice(i, 1);
      }
    }
  }

  // Each pickup is built with a fresh geometry + material (so per-kind shapes
  // and colors stay independent); we must explicitly release their GPU-side
  // buffers here, otherwise asteroids / enemies / bosses steadily leak vertex
  // buffers and material state over a long session.
  _dispose(p) {
    this.scene.remove(p);
    if (p.geometry) p.geometry.dispose();
    const m = p.material;
    if (Array.isArray(m)) { for (const mm of m) mm?.dispose?.(); }
    else if (m && typeof m.dispose === 'function') m.dispose();
  }

  remove(p) {
    this._dispose(p);
    const i = this.items.indexOf(p);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear() {
    for (const p of this.items) this._dispose(p);
    this.items.length = 0;
  }
}

// ---------- Enemies ----------
export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this._geo = new THREE.ConeGeometry(0.8, 2.0, 5);
    this._geo.rotateX(-Math.PI / 2);
    this._mat = this._buildMat();
    settings.onChange((k) => {
      if (k === 'colorblind') { this._mat = this._buildMat(); for (const e of this.items) e.material = this._mat; }
    });
  }

  _buildMat() {
    return new THREE.MeshStandardMaterial({
      color: palette('enemyHull'), emissive: palette('enemyGlow'), emissiveIntensity: 2.2,
      metalness: 0.3, roughness: 0.4, flatShading: true,
    });
  }

  spawn(pos) {
    // Limit max enemies for performance
    if (this.items.length >= 6) {
      const old = this.items.shift();
      this.scene.remove(old);
    }
    const mesh = new THREE.Mesh(this._geo, this._mat);
    mesh.position.copy(pos);
    mesh.userData = {
      hp: 12, maxHp: 12,
      radius: 1.2,
      vel: new THREE.Vector3(0, 0, 0),
      shootCd: rand(1, 2.2),
      state: 'approach',
      pattern: pick(['weave', 'dive', 'strafe']),
      phase: rand(0, Math.PI * 2),
    };
    // Point light disabled for performance - emissive material provides glow
    // const light = new THREE.PointLight(palette('enemyLight'), 2.5, 10, 1.8);
    // mesh.add(light);
    this.scene.add(mesh);
    this.items.push(mesh);
    return mesh;
  }

  update(dt, player, bullets, audio) {
    const pp = player.group.position;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      const ud = e.userData;
      ud.phase += dt;
      const toPlayer = tmp.v0.copy(pp).sub(e.position);
      const dist = toPlayer.length();

      // AI: approach, then weave around player
      const desiredDir = tmp.v1.copy(toPlayer).normalize();
      let lateral = tmp.v2.set(Math.cos(ud.phase * 1.8), Math.sin(ud.phase * 1.3), 0);
      if (ud.pattern === 'dive') lateral.set(Math.sin(ud.phase * 2) * 0.6, Math.cos(ud.phase * 2) * 0.8, 0);
      if (ud.pattern === 'strafe') lateral.set(Math.sin(ud.phase * 2.2), 0, Math.cos(ud.phase * 1.5) * 0.3);

      const speed = 32 + Math.min(20, Math.max(0, (dist - 30) * 0.6));
      ud.vel.lerp(desiredDir.multiplyScalar(speed).add(lateral.multiplyScalar(14)), 0.05);

      e.position.addScaledVector(ud.vel, dt);
      e.lookAt(pp);

      // Firing
      ud.shootCd -= dt;
      if (ud.shootCd <= 0 && dist < 90 && dist > 14 && player.alive) {
        ud.shootCd = rand(1.1, 2.0);
        const dir = tmp.v1.copy(pp).sub(e.position).normalize();
        // Lead target slightly
        dir.addScaledVector(player.forward, 0.05).normalize();
        bullets.spawn(e.position.clone().addScaledVector(dir, 1.2), dir, 70, false, 14);
        if (audio) audio.laser();
      }

      // Despawn if left far behind
      if (e.position.z - pp.z > 180) {
        this.scene.remove(e);
        this.items.splice(i, 1);
      }
    }
  }

  damage(enemy, amount) {
    enemy.userData.hp -= amount;
    return enemy.userData.hp <= 0;
  }

  damageAt(enemy, amount) { return this.damage(enemy, amount); }

  destroy(enemy, particles) {
    particles.burst(enemy.position, palette('enemyLight'), { count: 60, speed: 20, size: 1.0, life: 1.3 });
    particles.burst(enemy.position, 0xffcf5b, { count: 30, speed: 14, size: 0.7, life: 0.9 });
    this.scene.remove(enemy);
    const i = this.items.indexOf(enemy);
    if (i >= 0) this.items.splice(i, 1);
  }

  clear() {
    for (const e of this.items) this.scene.remove(e);
    this.items.length = 0;
  }
}

// ---------- Boss ----------
// A single slow-moving, heavily-armored enemy that appears on waves 3, 6, 9 …
// Features: three orbiting turrets that each fire, central core with its own
// hp. Destroying all three turrets exposes the core; destroying the core kills
// the boss and drops a guaranteed shield + multishot + pulse bomb.
export class Boss {
  constructor(scene) {
    this.scene = scene;
    this.active = null;    // current boss root group or null
    this.onDefeated = null;
  }

  active_() { return this.active; } // keep public for external checks

  spawn(pos, waveNum = 5) {
    if (this.active) return this.active;
    const root = new THREE.Group();
    root.position.copy(pos);

    // Bosses spawn every 3 waves, so tier up on the same cadence.
    const tier = Math.max(1, Math.floor(waveNum / 3));
    const coreHp = 180 * tier;
    const turretHp = 40 * tier;

    // Core: inner icosahedron with pulsing emissive; outer armored shell
    // (octahedron wireframe).
    const coreGeo = new THREE.IcosahedronGeometry(2.4, 2);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1a0013, emissive: palette('enemyGlow'), emissiveIntensity: 2.8,
      metalness: 0.5, roughness: 0.35, flatShading: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.userData.role = 'core';
    root.add(core);

    const shellGeo = new THREE.OctahedronGeometry(3.6, 0);
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xff9a2f, wireframe: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    root.add(shell);

    // Core light reduced intensity for performance
    const coreLight = new THREE.PointLight(palette('enemyLight'), 2, 20, 1.2);
    root.add(coreLight);

    // Turrets orbiting the core at 120° intervals.
    const turrets = [];
    for (let i = 0; i < 3; i++) {
      const tGroup = new THREE.Group();
      const tBodyGeo = new THREE.ConeGeometry(0.9, 2.4, 6);
      tBodyGeo.rotateX(Math.PI / 2);
      const tMat = new THREE.MeshStandardMaterial({
        color: palette('enemyHull'), emissive: palette('enemyGlow'), emissiveIntensity: 2.0,
        metalness: 0.4, roughness: 0.4, flatShading: true,
      });
      const tMesh = new THREE.Mesh(tBodyGeo, tMat);
      tGroup.add(tMesh);
      // Point light disabled for performance
      // tGroup.add(new THREE.PointLight(palette('enemyLight'), 1.6, 10, 1.8));
      tGroup.userData = {
        role: 'turret',
        index: i,
        angle: (i / 3) * Math.PI * 2,
        hp: turretHp, maxHp: turretHp,
        alive: true,
        shootCd: rand(0.8, 2.0),
      };
      root.add(tGroup);
      turrets.push(tGroup);
    }

    root.userData = {
      kind: 'boss', radius: 4.2,
      hp: coreHp, maxHp: coreHp,
      coreHpMax: coreHp,
      tier,
      vel: new THREE.Vector3(0, 0, -2),
      turrets,
      core, shell,
      phase: 0,
      invuln: true,      // core is invulnerable until all turrets dead
      flashTime: 0,
      dead: false,
    };

    this.scene.add(root);
    this.active = root;
    return root;
  }

  update(dt, player, bullets, audio) {
    const boss = this.active;
    if (!boss) return;
    const ud = boss.userData;
    ud.phase += dt;

    // Movement: slow horizontal weave, drifts slightly away from player.
    const pp = player.group.position;
    const toPlayer = tmp.v0.copy(pp).sub(boss.position);
    const dist = toPlayer.length();

    const idealDistance = 55;
    const radial = toPlayer.clone().normalize().multiplyScalar(-0.25 * (idealDistance - dist));
    const weave = tmp.v1.set(Math.sin(ud.phase * 0.7) * 10, Math.cos(ud.phase * 0.5) * 4, 0);
    ud.vel.lerp(weave.add(radial), 0.04);
    boss.position.addScaledVector(ud.vel, dt * 0.35);

    // Shell spins; core pulses
    ud.shell.rotation.x += dt * 0.6;
    ud.shell.rotation.y += dt * 0.8;
    ud.core.rotation.y -= dt * 0.4;
    const pulse = 1 + 0.08 * Math.sin(ud.phase * 4);
    ud.core.scale.setScalar(pulse);
    ud.shell.material.opacity = ud.invuln ? 0.4 + 0.15 * Math.sin(ud.phase * 3) : 0.1;

    // Turret orbits + firing
    const liveTurrets = ud.turrets.filter((t) => t.userData.alive);
    for (const t of ud.turrets) {
      if (!t.userData.alive) continue;
      const a = t.userData.angle + ud.phase * 0.7;
      const r = 4.2;
      t.position.set(Math.cos(a) * r, Math.sin(a) * r, Math.sin(ud.phase + t.userData.index) * 0.8);
      t.lookAt(pp);

      t.userData.shootCd -= dt;
      if (t.userData.shootCd <= 0 && dist < 140 && player.alive) {
        t.userData.shootCd = rand(1.4, 2.4) / ud.tier;
        const muzzle = t.getWorldPosition(tmp.v2);
        const dir = tmp.v1.copy(pp).sub(muzzle).normalize();
        bullets.spawn(muzzle.clone().addScaledVector(dir, 1.4), dir, 80, false, 18);
        if (audio) audio.laser();
      }
    }

    // Invuln toggles off when all turrets dead
    if (ud.invuln && liveTurrets.length === 0) ud.invuln = false;

    // Flash decays
    ud.flashTime = Math.max(0, ud.flashTime - dt);
    ud.core.material.emissiveIntensity = 2.2 + (ud.flashTime > 0 ? 3.5 : 0) + 0.4 * Math.sin(ud.phase * 6);
  }

  // Test whether a bullet hits the boss; returns { hit, kind, hpFrac, dead }.
  damageAt(position, damage, particles) {
    const boss = this.active;
    if (!boss) return null;
    const ud = boss.userData;
    // Turrets first (while alive).
    for (const t of ud.turrets) {
      if (!t.userData.alive) continue;
      const world = t.getWorldPosition(tmp.v0);
      if (position.distanceToSquared(world) < 1.69) {
        t.userData.hp -= damage;
        if (particles) particles.burst(world, palette('enemyLight'), { count: 10, speed: 6, size: 0.5, life: 0.35 });
        if (t.userData.hp <= 0) {
          t.userData.alive = false;
          t.visible = false;
          if (particles) particles.burst(world, palette('enemyGlow'), { count: 80, speed: 22, size: 1.0, life: 1.2 });
        }
        return { hit: true, kind: 'turret', dead: false, hpFrac: ud.hp / ud.maxHp };
      }
    }
    // Then the core (only if not invulnerable).
    if (!ud.invuln) {
      const c = boss.position;
      if (position.distanceToSquared(c) < 9.0) {
        ud.hp -= damage;
        ud.flashTime = 0.18;
        if (particles) particles.burst(position, 0xffffff, { count: 12, speed: 10, size: 0.55, life: 0.4 });
        if (ud.hp <= 0) {
          ud.dead = true;
          return { hit: true, kind: 'core', dead: true, hpFrac: 0 };
        }
        return { hit: true, kind: 'core', dead: false, hpFrac: ud.hp / ud.maxHp };
      }
    } else {
      // Bouncing shell — graphical only (no damage)
      const c = boss.position;
      if (position.distanceToSquared(c) < 14.44) {
        if (particles) particles.burst(position, 0xffcf5b, { count: 6, speed: 5, size: 0.4, life: 0.25 });
        return { hit: true, kind: 'shell', dead: false, hpFrac: ud.hp / ud.maxHp };
      }
    }
    return null;
  }

  // Returns true if the boss is currently exposed (all turrets destroyed).
  exposed() { return this.active && !this.active.userData.invuln; }

  coreHpFrac() { return this.active ? Math.max(0, this.active.userData.hp / this.active.userData.maxHp) : 0; }

  clear() {
    if (this.active) {
      this.scene.remove(this.active);
      this.active.userData.core.geometry.dispose();
      this.active.userData.shell.geometry.dispose();
      this.active = null;
    }
  }

  destroyAndDrop(pickups, particles) {
    if (!this.active) return;
    const pos = this.active.position.clone();
    if (particles) {
      particles.burst(pos, 0xffffff, { count: 200, speed: 40, size: 1.4, life: 2.2 });
      particles.burst(pos, palette('enemyGlow'), { count: 150, speed: 30, size: 1.2, life: 1.8 });
      particles.burst(pos, 0xff4bff, { count: 120, speed: 26, size: 1.0, life: 1.6 });
    }
    this.clear();
    if (pickups) {
      pickups.spawn(pos.clone().add(new THREE.Vector3(3, 1, 0)), 'shield');
      pickups.spawn(pos.clone().add(new THREE.Vector3(-3, 0, 0)), 'multishot');
      pickups.spawn(pos.clone().add(new THREE.Vector3(0, -2, 1)), 'bomb');
      pickups.spawn(pos.clone().add(new THREE.Vector3(0, 2, -1)), 'rapidfire');
    }
  }
}
