// Cinematic mode — the game plays itself while a director cycles between
// dramatic camera shots. An autopilot drives the ship by injecting virtual
// input through Input's dedicated cinematic channel (bypassing enabled so no
// keyboard input leaks into the shot). The ship is invincible for the
// duration so we can cut freely without the run ending mid-cinematic.
//
// Shots: CHASE (wide following), ORBIT (revolving around ship), FLYBY
// (camera rushes past ship from side), SIDE (locked-off side track), DUTCH
// (close cockpit with tilted horizon), WIDE (distant establishing shot).
// Shots cut cleanly to the next one every 4.5–7.5 seconds and the intro
// fades in a title card over a slow orbiting reveal.

import * as THREE from 'three';
import { clamp, rand, pick } from './utils.js';

const SHOT_POOL = ['chase', 'orbit', 'flyby', 'side', 'dutch', 'wide'];

export class Cinematic {
  constructor(game) {
    this.game = game;
    this.active = false;
    this._shot = null;
    this._lastShot = null;
    this._shotTime = 0;
    this._shotDuration = 0;
    this._shotSeed = 0;
    this._justCut = false;
    this._introTime = 0;
    this._introDuration = 3.6;
    this._origFov = game.camera.fov;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this._introTime = 0;
    this._shotTime = 0;
    this._shotDuration = 0;
    this._shot = null;
    this._lastShot = null;
    this._justCut = true;
    this.game.ship._cinematic = true;
    this.game.camera.up.set(0, 1, 0);
    document.body.classList.add('cinematic');
    const title = document.getElementById('cinematic-title');
    if (title) title.classList.add('show');
    // Lightly boost difficulty so the scene has density to film.
    this.game.wave = Math.max(this.game.wave, 2);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.game.ship._cinematic = false;
    const input = this.game.input;
    input.setCinematicAxes(null, null);
    input.setCinematicFire(false);
    input.setCinematicBoost(false);
    this.game.camera.up.set(0, 1, 0);
    this.game.camera.fov = this._origFov;
    this.game.camera.updateProjectionMatrix();
    document.body.classList.remove('cinematic');
    const title = document.getElementById('cinematic-title');
    if (title) title.classList.remove('show');
  }

  // Called each frame before ship/world update. Computes autopilot commands
  // from the current target and pushes them into the input layer.
  drive(dt) {
    const input = this.game.input;
    // Suppress stale mouse state from before cinematic started.
    input.mouse.nx = 0;
    input.mouse.ny = 0;

    const target = this._acquireTarget();
    const ship = this.game.ship;

    if (target) {
      const to = target.clone().sub(ship.group.position);
      const dist = to.length();
      const fwdComp = to.dot(ship.forward);
      const rightComp = to.dot(ship.right);
      const upComp = to.dot(ship.up);

      let ax = 0;
      let ay = 0;
      if (fwdComp < 0) {
        // Target is behind — commit to a hard yaw to bring it around.
        ax = rightComp >= 0 ? 1 : -1;
      } else {
        ax = clamp(rightComp / 10, -1, 1);
        ay = -clamp(upComp / 10, -1, 1);
      }
      input.setCinematicAxes(ax, ay);

      // Fire when roughly aligned and target is in useful range.
      const angular = Math.hypot(rightComp, upComp) / Math.max(1, dist);
      const aligned = fwdComp > 0 && angular < 0.2;
      input.setCinematicFire(aligned && dist < 220);

      // Boost periodically for visual variety and to chase the camera.
      const t = this.game.time;
      input.setCinematicBoost(Math.sin(t * 0.35) > 0.55 && dist > 45);
    } else {
      // No target: gentle drift, no fire, no boost.
      const t = this.game.time;
      input.setCinematicAxes(Math.sin(t * 0.3) * 0.3, Math.cos(t * 0.22) * 0.15);
      input.setCinematicFire(false);
      input.setCinematicBoost(false);
    }
  }

  _acquireTarget() {
    const ship = this.game.ship;
    const sp = ship.group.position;
    const fwd = ship.forward;
    let best = null;
    let bestScore = -Infinity;
    const consider = (obj) => {
      const d = obj.position.distanceTo(sp);
      if (d > 220) return;
      const dirTo = obj.position.clone().sub(sp).normalize();
      const dot = dirTo.dot(fwd);
      if (dot < 0.1) return; // mostly forward only
      // Prefer closer + more-forward targets.
      const score = dot * 80 - d;
      if (score > bestScore) { bestScore = score; best = obj; }
    };
    for (const a of this.game.asteroids.items) consider(a);
    for (const e of this.game.enemies.items) consider(e);
    if (this.game.boss.active) consider(this.game.boss.active);
    return best ? best.position.clone() : null;
  }

  // Called each frame after ship/world update. Overwrites the ship-follow
  // camera with the director's choice for the current shot.
  update(dt) {
    // Intro: slow orbiting reveal while the title card fades in+out.
    if (this._introTime < this._introDuration) {
      this._applyIntroCamera(dt);
      this._introTime += dt;
      if (this._introTime >= this._introDuration) {
        const title = document.getElementById('cinematic-title');
        if (title) title.classList.remove('show');
        this._nextShot();
      }
      return;
    }

    this._shotTime += dt;
    if (this._shotTime >= this._shotDuration) this._nextShot();
    this._applyShot(this._shot, this._shotTime / Math.max(0.001, this._shotDuration), dt);
  }

  _nextShot() {
    this._shotTime = 0;
    this._shotDuration = rand(4.5, 7.5);
    const pool = SHOT_POOL.filter((s) => s !== this._lastShot);
    this._shot = pick(pool);
    this._lastShot = this._shot;
    this._shotSeed = rand(0, 1000);
    this._justCut = true;
  }

  _applyIntroCamera(dt) {
    const ship = this.game.ship;
    const sp = ship.group.position;
    const p = clamp(this._introTime / this._introDuration, 0, 1);
    // Pull camera out from close beside ship to a wider orbit during intro.
    const radius = 5 + p * 14;
    const height = 1 + p * 3;
    const angle = p * Math.PI * 0.8;
    const pos = new THREE.Vector3(
      sp.x + Math.cos(angle) * radius,
      sp.y + height,
      sp.z + Math.sin(angle) * radius,
    );
    const cam = this.game.camera;
    if (this._justCut) { cam.position.copy(pos); this._justCut = false; }
    else cam.position.lerp(pos, Math.min(1, 4 * dt));
    cam.fov = 60;
    cam.up.set(0, 1, 0);
    cam.lookAt(sp);
    cam.updateProjectionMatrix();
  }

  _applyShot(shot, p, dt) {
    const ship = this.game.ship;
    const sp = ship.group.position;
    const fwd = ship.forward;
    const right = ship.right;
    const up = ship.up;
    const cam = this.game.camera;
    const seed = this._shotSeed;

    const pos = new THREE.Vector3();
    const target = new THREE.Vector3();
    const camUp = new THREE.Vector3(0, 1, 0);
    let fov = 62;

    if (shot === 'chase') {
      // Classic high-and-behind chase shot with a forward look-ahead.
      pos.copy(sp).addScaledVector(fwd, -14).addScaledVector(up, 4.2);
      target.copy(sp).addScaledVector(fwd, 22);
      fov = 72;
    } else if (shot === 'orbit') {
      const a = (seed * 0.1) + p * Math.PI * 1.6;
      const radius = 10 + Math.sin(seed) * 2;
      pos.set(
        sp.x + Math.cos(a) * radius,
        sp.y + 2 + Math.sin(p * 2.1) * 1.4,
        sp.z + Math.sin(a) * radius,
      );
      target.copy(sp);
      fov = 58;
    } else if (shot === 'flyby') {
      // Camera rushes past ship from one side to the other.
      const side = (seed % 2 < 1) ? 1 : -1;
      const startOff = right.clone().multiplyScalar(side * 18).add(fwd.clone().multiplyScalar(-12));
      const endOff = right.clone().multiplyScalar(-side * 8).add(fwd.clone().multiplyScalar(22));
      pos.copy(sp).addScaledVector(startOff.lerp(endOff, p), 1);
      target.copy(sp);
      fov = 56;
    } else if (shot === 'side') {
      // Locked side tracking, ship moves across frame.
      const side = (seed % 2 < 1) ? 1 : -1;
      pos.copy(sp).addScaledVector(right, side * 12).addScaledVector(up, 1.2);
      target.copy(sp).addScaledVector(fwd, 8);
      fov = 66;
    } else if (shot === 'dutch') {
      // Close cockpit shot with a Dutch tilt on the horizon.
      pos.copy(sp).addScaledVector(fwd, -3.2).addScaledVector(up, 0.55).addScaledVector(right, 2.1);
      target.copy(sp).addScaledVector(fwd, 18);
      const tilt = 0.22 + Math.sin(seed) * 0.08;
      camUp.set(Math.sin(tilt), Math.cos(tilt), 0).normalize();
      fov = 52;
    } else if (shot === 'wide') {
      // Distant establishing shot — tiny ship lost in the nebula.
      pos.copy(sp).addScaledVector(fwd, -65).addScaledVector(up, 22);
      target.copy(sp).addScaledVector(fwd, 10);
      fov = 46;
    }

    const lerp = this._justCut ? 1 : Math.min(1, 8 * dt);
    this._justCut = false;
    cam.position.lerp(pos, lerp);
    cam.up.lerp(camUp, Math.min(1, 6 * dt));
    cam.lookAt(target);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = cam.fov + (fov - cam.fov) * Math.min(1, 4 * dt);
      cam.updateProjectionMatrix();
    }
  }
}
