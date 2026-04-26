// Shadow-wisp enemies: floating dark spheres with eyes. They drift, and when
// the player comes close they chase and attempt to land soft hits.
import * as THREE from 'three';
import { terrainHeight } from './World';

export class Wisp {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  hp = 30;
  maxHp = 30;
  alive = true;
  private core: THREE.Mesh;
  private halo: THREE.Mesh;
  private light: THREE.PointLight;
  private phase: number;
  private attackCooldown = 0;
  private hitFlashT = 0;
  radius = 0.6;
  private damage = 1;

  constructor(scene: THREE.Scene, spawn: THREE.Vector3, health: number = 30, damage: number = 1) {
    this.pos.copy(spawn);
    this.phase = Math.random() * Math.PI * 2;
    this.hp = health;
    this.maxHp = health;
    this.damage = damage;

    // Core sphere (dark)
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0x1a0a28,
        emissive: 0x3a1050,
        emissiveIntensity: 0.8,
        roughness: 0.6,
      })
    );
    this.core.castShadow = true;
    this.group.add(this.core);

    // Outer halo
    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x8a4ad0,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    );
    this.group.add(this.halo);

    // Glowing eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
    eyeL.position.set(-0.15, 0.1, 0.42);
    eyeR.position.set(0.15, 0.1, 0.42);
    this.group.add(eyeL);
    this.group.add(eyeR);

    this.light = new THREE.PointLight(0x9a4ad0, 1.5, 7, 2);
    this.light.position.y = 0;
    this.group.add(this.light);

    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  update(dt: number, time: number, target: THREE.Vector3, onHitPlayer: (damage: number) => void) {
    if (!this.alive) return;
    this.phase += dt;

    const toPlayer = target.clone().sub(this.pos);
    toPlayer.y = 0;
    const dist = toPlayer.length();

    // Float motion
    const hover = Math.sin(this.phase * 1.6) * 0.3;
    const baseY = terrainHeight(this.pos.x, this.pos.z) + 1.4 + hover;

    let speed = 0.6;
    if (dist < 14) {
      speed = 2.4;
      // Pursue
      toPlayer.normalize();
      this.pos.x += toPlayer.x * speed * dt;
      this.pos.z += toPlayer.z * speed * dt;
    } else {
      // Idle drift
      this.pos.x += Math.sin(this.phase * 0.5) * 0.2 * dt;
      this.pos.z += Math.cos(this.phase * 0.3) * 0.2 * dt;
    }

    this.pos.y = baseY;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    // Attack on contact
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (dist < 1.4 && this.attackCooldown <= 0) {
      onHitPlayer(this.damage);
      this.attackCooldown = 1.2;
    }

    // Hit flash
    if (this.hitFlashT > 0) {
      this.hitFlashT = Math.max(0, this.hitFlashT - dt);
      (this.core.material as THREE.MeshStandardMaterial).emissive.setHex(
        this.hitFlashT > 0 ? 0xffffff : 0x3a1050
      );
    }

    // Halo pulse
    const pulse = 1 + Math.sin(time * 3 + this.phase) * 0.15;
    this.halo.scale.setScalar(pulse);
  }

  hit(n: number, from: THREE.Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= n;
    this.hitFlashT = 0.12;
    // Knockback
    const push = this.pos.clone().sub(from);
    push.y = 0;
    push.normalize().multiplyScalar(1.6);
    this.pos.add(push);
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.alive = false;
    // Fade out
    const fadeStart = performance.now();
    const duration = 800;
    const haloMat = this.halo.material as THREE.MeshBasicMaterial;
    const coreMat = this.core.material as THREE.MeshStandardMaterial;
    const initialOpacity = haloMat.opacity;
    coreMat.transparent = true;
    const tick = () => {
      const t = Math.min(1, (performance.now() - fadeStart) / duration);
      haloMat.opacity = initialOpacity * (1 - t);
      coreMat.opacity = 1 - t;
      this.light.intensity = Math.max(0, this.light.intensity - 0.04);
      this.group.scale.setScalar(1 + t * 0.6);
      if (t < 1) requestAnimationFrame(tick);
      else {
        this.group.parent?.remove(this.group);
      }
    };
    requestAnimationFrame(tick);
  }
}
