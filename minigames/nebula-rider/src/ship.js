// Player ship: model, physics, camera-follow, particle trails.
import * as THREE from 'three';
import { clamp, damp, lerp, rand, tmp } from './utils.js';
import { settings } from './settings.js';

export class Ship {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    scene.add(this.group);

    this._buildModel();
    this._buildTrail();

    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);

    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.bank = 0;

    this.speed = 30;
    this.baseSpeed = 30;
    this.maxSpeed = 60;
    this.boostSpeed = 120;
    this.accel = 40;

    this.hull = 100; this.maxHull = 100;
    this.boost = 100; this.maxBoost = 100;
    this.heat = 0; this.maxHeat = 100;

    this._invuln = 0;
    this._fireCooldown = 0;
    this._alternator = 0;
    this.alive = true;

    // Powerup timers (seconds). 0 = inactive.
    this.shieldTime = 0;      // full invulnerability + visible bubble
    this.rapidFireTime = 0;   // halves fire cooldown
    this.multiShotTime = 0;   // fires 3 bullets in a spread
    this._shieldMesh = null;

    // For camera follow
    this._cameraOffset = new THREE.Vector3(0, 2.2, 7.5);
    this._cameraLookOffset = new THREE.Vector3(0, 0.5, -8);
    this._shake = 0;
  }

  _buildModel() {
    const colorHull = new THREE.Color(0x1a1438);
    const colorAccent = new THREE.Color(0xff4bff);
    const colorGlow = new THREE.Color(0x5dc8ff);

    // Fuselage — elongated octahedron
    const fuselageGeo = new THREE.ConeGeometry(0.55, 2.4, 12);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: colorHull, metalness: 0.8, roughness: 0.25,
      emissive: new THREE.Color(0x220044), emissiveIntensity: 0.6,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    this.body.add(fuselage);

    // Cockpit canopy
    const canopyGeo = new THREE.SphereGeometry(0.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    canopyGeo.scale(1, 0.7, 1.3);
    const canopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x88aaff, metalness: 0.1, roughness: 0.05,
      transmission: 0.6, thickness: 0.4, ior: 1.3,
      emissive: new THREE.Color(0x002244), emissiveIntensity: 0.6,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.25, 0.1);
    this.body.add(canopy);

    // Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, 0.0);
    wingShape.lineTo(1.8, -0.6);
    wingShape.lineTo(0.1, -0.8);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.15, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2, steps: 1 });
    wingGeo.translate(0, 0, -0.4);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x140a2e, metalness: 0.7, roughness: 0.3,
      emissive: colorAccent, emissiveIntensity: 0.35,
    });
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.set(0.1, -0.05, -0.1);
    this.body.add(wingR);
    const wingL = wingR.clone();
    wingL.scale.x = -1;
    wingL.position.x = -0.1;
    this.body.add(wingL);

    // Wing tip glow strips
    const stripGeo = new THREE.BoxGeometry(1.8, 0.06, 0.06);
    const stripMat = new THREE.MeshBasicMaterial({ color: colorGlow });
    const stripR = new THREE.Mesh(stripGeo, stripMat);
    stripR.position.set(1.1, -0.05, -0.25);
    this.body.add(stripR);
    const stripL = stripR.clone(); stripL.position.x = -1.1;
    this.body.add(stripL);

    // Point lights for bloom emission
    const light = new THREE.PointLight(0xff4bff, 2.0, 12, 1.5);
    light.position.set(0, 0, 1.5);
    this.body.add(light);
    this._engineLight = light;

    // Shield bubble (hidden by default).
    const shieldGeo = new THREE.IcosahedronGeometry(1.8, 2);
    const shieldMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vP;
        void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float; varying vec3 vN; varying vec3 vP; uniform float uTime; uniform float uOpacity;
        void main() {
          float fres = pow(1.0 - abs(vN.z), 2.0);
          float grid = abs(sin(vP.x * 3.0 + uTime * 1.1)) * abs(sin(vP.y * 3.0 - uTime * 0.8)) * abs(sin(vP.z * 3.0 + uTime * 0.5));
          vec3 col = mix(vec3(0.35, 0.8, 1.0), vec3(0.5, 1.0, 0.85), fres);
          float a = (fres * 0.7 + grid * 0.35) * uOpacity;
          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this._shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this._shieldMesh.visible = false;
    this.group.add(this._shieldMesh);

    // Engine glow plate
    const engineGlowGeo = new THREE.CircleGeometry(0.28, 24);
    const engineGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff8bff, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.engineGlow = new THREE.Mesh(engineGlowGeo, engineGlowMat);
    this.engineGlow.position.set(0, 0, 1.28);
    this.engineGlow.rotation.y = Math.PI;
    this.body.add(this.engineGlow);

    // Align nose to -Z (we built fuselage with cone apex at +Z then rotated)
    this.body.rotation.y = Math.PI;
  }

  _buildTrail() {
    // Engine trail — additive particle ribbon composed of points.
    const MAX = 200;  // Reduced from 400 for performance
    this._trailMax = MAX;
    this._trailPositions = new Float32Array(MAX * 3);
    this._trailColors = new Float32Array(MAX * 3);
    this._trailSizes = new Float32Array(MAX);
    this._trailAge = new Float32Array(MAX);
    this._trailHead = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._trailPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this._trailColors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this._trailSizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vCol;
        uniform float uPixelRatio;
        void main() {
          vCol = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (180.0 / -mv.z);
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
          gl_FragColor = vec4(vCol, a);
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    this.trail = new THREE.Points(geo, mat);
    this.scene.add(this.trail);
  }

  _emitTrail(dt, boost) {
    // Cap emissions to prevent lag during frame drops
    const emit = Math.min(6, Math.floor(60 * dt * (boost ? 2.6 : 1)));
    if (emit <= 0) return;
    const worldPosR = tmp.v0.set(0.1, -0.02, 1.25).applyMatrix4(this.body.matrixWorld);
    const worldPosL = tmp.v1.set(-0.1, -0.02, 1.25).applyMatrix4(this.body.matrixWorld);
    for (let i = 0; i < emit; i++) {
      for (const base of [worldPosR, worldPosL]) {
        const idx = this._trailHead;
        this._trailPositions[idx * 3 + 0] = base.x + rand(-0.05, 0.05);
        this._trailPositions[idx * 3 + 1] = base.y + rand(-0.05, 0.05);
        this._trailPositions[idx * 3 + 2] = base.z + rand(-0.05, 0.05);
        const hot = boost ? 1 : 0.6;
        this._trailColors[idx * 3 + 0] = 0.8 + 0.2 * hot;
        this._trailColors[idx * 3 + 1] = 0.3 + 0.4 * hot;
        this._trailColors[idx * 3 + 2] = 1.0;
        this._trailSizes[idx] = boost ? rand(0.35, 0.7) : rand(0.22, 0.4);
        this._trailAge[idx] = 0;
        this._trailHead = (idx + 1) % this._trailMax;
      }
    }
  }

  _updateTrail(dt) {
    const life = 0.65;
    const decay = 1 / life;
    for (let i = 0; i < this._trailMax; i++) {
      const a = this._trailAge[i] += dt;
      if (a > life) { this._trailSizes[i] = 0; continue; }
      const t = 1 - a * decay;
      // Cool from magenta-ish to deep blue as they age
      const base = i * 3;
      this._trailColors[base + 0] *= 0.995;
      this._trailColors[base + 1] *= 0.99;
      this._trailSizes[i] *= 0.97;
      // Drift slightly backward in world space
      this._trailPositions[base + 2] += dt * 4 * t;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
    this.trail.geometry.attributes.aSize.needsUpdate = true;
  }

  applyDamage(amount, audio) {
    if (this._cinematic) return false;
    if (this._invuln > 0 || this.shieldTime > 0 || !this.alive) return false;
    this.hull = clamp(this.hull - amount, 0, this.maxHull);
    this._invuln = 0.8;
    this._shake += 0.5;
    if (audio) audio.hit();
    if (this.hull <= 0) { this.alive = false; return true; }
    return false;
  }

  // Powerup helpers -------------------------------------------------
  grantShield(seconds = 8) { this.shieldTime = Math.max(this.shieldTime, seconds); }
  grantRapidFire(seconds = 10) { this.rapidFireTime = Math.max(this.rapidFireTime, seconds); }
  grantMultiShot(seconds = 10) { this.multiShotTime = Math.max(this.multiShotTime, seconds); }
  repair(amount) { this.hull = clamp(this.hull + amount, 0, this.maxHull); }

  shieldActive() { return this.shieldTime > 0; }
  rapidFireActive() { return this.rapidFireTime > 0; }
  multiShotActive() { return this.multiShotTime > 0; }

  reset() {
    this.group.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.yaw = this.pitch = this.roll = this.bank = 0;
    this.hull = this.maxHull;
    this.boost = this.maxBoost;
    this.heat = 0;
    this._invuln = 0;
    this._fireCooldown = 0;
    this.shieldTime = 0;
    this.rapidFireTime = 0;
    this.multiShotTime = 0;
    this.alive = true;
    this.body.quaternion.identity();
    this.body.rotation.y = Math.PI;
    if (this._shieldMesh) { this._shieldMesh.visible = false; }
  }

  update(dt, input, camera) {
    if (!this.alive) {
      this.velocity.multiplyScalar(0.9);
      this.group.position.addScaledVector(this.velocity, dt);
      this._updateTrail(dt);
      return;
    }

    const ax = input.axes();
    const mouse = input.mouse;
    const ms = settings.get('mouseSensitivity');
    const rs = settings.get('rollSensitivity');
    const invertY = settings.get('invertY') ? -1 : 1;
    const mouseY = invertY * mouse.ny;

    // Blend keyboard + mouse input. Mouse provides fine aim offsets.
    const targetYawRate = -ax.x * 1.4 + -mouse.nx * 1.0 * ms;
    const targetPitchRate = -ax.y * 1.1 + mouseY * 0.6 * ms;
    const targetRoll = -ax.x * 0.6 + -mouse.nx * 0.45 * ms + ax.roll * 0.8 * rs;

    this.yaw += targetYawRate * dt;
    this.pitch = clamp(this.pitch + targetPitchRate * dt, -1.2, 1.2);
    this.bank = damp(this.bank, targetRoll, 6, dt);

    // Build orientation quaternion — yaw (Y) then pitch (X) then bank (Z).
    // Use pooled temporaries to avoid GC stalls
    const q = tmp.q0.set(0, 0, 0, 1);
    const qy = tmp.q1.setFromAxisAngle(tmp.v3.set(0, 1, 0), this.yaw);
    const qx = tmp.q2.setFromAxisAngle(tmp.v4.set(1, 0, 0), this.pitch);
    const qz = tmp.q3.setFromAxisAngle(tmp.v5.set(0, 0, 1), this.bank);
    q.multiply(qy).multiply(qx).multiply(qz);
    this.group.quaternion.slerp(q, 1 - Math.exp(-10 * dt));

    // Forward vector in world space
    this.forward.set(0, 0, -1).applyQuaternion(this.group.quaternion).normalize();
    this.right.set(1, 0, 0).applyQuaternion(this.group.quaternion).normalize();
    this.up.set(0, 1, 0).applyQuaternion(this.group.quaternion).normalize();

    // Boost mechanic
    const boostPressed = input.boosting() && this.boost > 5;
    if (boostPressed) {
      this.boost = clamp(this.boost - 35 * dt, 0, this.maxBoost);
      this.speed = damp(this.speed, this.boostSpeed, 3, dt);
    } else {
      this.boost = clamp(this.boost + 18 * dt, 0, this.maxBoost);
      this.speed = damp(this.speed, this.baseSpeed + 12 * (ax.y < 0 ? 1 : 0), 3, dt);
    }

    // Velocity aligned with forward
    this.velocity.copy(this.forward).multiplyScalar(this.speed);
    this.group.position.addScaledVector(this.velocity, dt);

    // Heat dissipation
    this.heat = clamp(this.heat - 25 * dt, 0, this.maxHeat);

    // Invulnerability timer & hit flash
    this._invuln = Math.max(0, this._invuln - dt);

    // Powerup timers
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    this.rapidFireTime = Math.max(0, this.rapidFireTime - dt);
    this.multiShotTime = Math.max(0, this.multiShotTime - dt);
    if (this._shieldMesh) {
      const on = this.shieldTime > 0;
      this._shieldMesh.visible = on;
      if (on) {
        this._shieldMesh.material.uniforms.uTime.value += dt;
        // Fade out in the final 0.8s
        const fade = this.shieldTime < 0.8 ? this.shieldTime / 0.8 : 1;
        this._shieldMesh.material.uniforms.uOpacity.value = fade;
      }
    }

    // Engine glow pulsing
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.02);
    this._engineLight.intensity = (boostPressed ? 4 : 1.8) * pulse;
    this.engineGlow.material.opacity = boostPressed ? 0.95 : 0.75;
    this.engineGlow.scale.setScalar(boostPressed ? 1.6 + 0.3 * pulse : 1.0 + 0.15 * pulse);

    // Trail
    this._emitTrail(dt, boostPressed);
    this._updateTrail(dt);

    // Camera follow
    const offset = tmp.v0.copy(this._cameraOffset).applyQuaternion(this.group.quaternion);
    const lookOffset = tmp.v1.copy(this._cameraLookOffset).applyQuaternion(this.group.quaternion);
    const motionScale = settings.get('reducedMotion') ? 0 : 1;
    const shakeX = (Math.random() - 0.5) * this._shake * 0.4 * motionScale;
    const shakeY = (Math.random() - 0.5) * this._shake * 0.4 * motionScale;
    camera.position.x = damp(camera.position.x, this.group.position.x + offset.x + shakeX, 10, dt);
    camera.position.y = damp(camera.position.y, this.group.position.y + offset.y + shakeY, 10, dt);
    camera.position.z = damp(camera.position.z, this.group.position.z + offset.z, 10, dt);
    const lookTarget = tmp.v2.set(
      this.group.position.x + lookOffset.x,
      this.group.position.y + lookOffset.y,
      this.group.position.z + lookOffset.z,
    );
    camera.lookAt(lookTarget);
    // Roll the camera slightly with the ship for that cinematic banking feel
    // Use rotateZ to apply roll around the camera's forward axis (more stable than modifying rotation.z)
    camera.rotateZ(this.bank * 0.25);

    this._shake = Math.max(0, this._shake - dt);

    // Flicker when invuln
    this.body.visible = this._invuln <= 0 || Math.floor(this._invuln * 30) % 2 === 0;
  }

  canFire() { return this._fireCooldown <= 0 && this.heat < this.maxHeat - 5; }

  fireState(dt) {
    this._fireCooldown = Math.max(0, this._fireCooldown - dt);
  }

  registerShot() {
    this._fireCooldown = this.rapidFireActive() ? 0.04 : 0.08;
    this.heat = clamp(this.heat + (this.rapidFireActive() ? 3.5 : 6), 0, this.maxHeat);
    this._alternator = (this._alternator + 1) % 2;
  }

  muzzleData() {
    // Alternate between wingtips.
    const local = this._alternator === 0
      ? new THREE.Vector3(1.1, -0.05, -0.2)
      : new THREE.Vector3(-1.1, -0.05, -0.2);
    const pos = local.applyMatrix4(this.body.matrixWorld);
    return { pos, dir: this.forward.clone() };
  }
}
