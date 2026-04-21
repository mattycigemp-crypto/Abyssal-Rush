// Procedural player character: stylized low-poly body with working limbs that
// animate during movement. Carries a glowing sword and has a small trail FX.
import * as THREE from 'three';
import { terrainHeight } from './World';

interface LimbRef {
  group: THREE.Group;
  baseRot: THREE.Euler;
}

export class Player {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3(0, 0, 6);
  readonly velocity = new THREE.Vector3();
  hp = 100;
  maxHp = 100;
  stamina = 100;
  maxStamina = 100;
  facing = 0; // radians

  private body: THREE.Group;
  private leftArm: LimbRef;
  private rightArm: LimbRef;
  private leftLeg: LimbRef;
  private rightLeg: LimbRef;
  private sword: THREE.Group;
  private bobTime = 0;
  private swingT = -1; // -1 means not swinging; 0..1 while swinging
  attackHitFrame = false;
  isGrounded = true;
  private jumpVel = 0;

  constructor(scene: THREE.Scene) {
    this.group.position.copy(this.position);
    scene.add(this.group);

    const body = new THREE.Group();
    this.body = body;
    this.group.add(body);

    const skin = 0xd9b382;
    const cloth = 0x3a5a7a;
    const leather = 0x5b3a1f;
    const cloak = 0x3a2a2a;

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.9, 0.35),
      new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.8 })
    );
    torso.position.y = 1.3;
    torso.castShadow = true;
    body.add(torso);

    // Belt
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.12, 0.4),
      new THREE.MeshStandardMaterial({ color: leather, roughness: 0.9 })
    );
    belt.position.y = 0.88;
    belt.castShadow = true;
    body.add(belt);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.4),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 })
    );
    head.position.y = 1.96;
    head.castShadow = true;
    body.add(head);

    // Hair
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.15, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })
    );
    hair.position.y = 2.17;
    hair.castShadow = true;
    body.add(hair);

    // Cloak
    const cloakMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.1),
      new THREE.MeshStandardMaterial({ color: cloak, roughness: 0.95, side: THREE.DoubleSide })
    );
    cloakMesh.position.set(0, 1.3, -0.22);
    cloakMesh.castShadow = true;
    body.add(cloakMesh);

    // Arms (pivot at shoulder)
    this.leftArm = this.makeLimb(cloth, skin, 0.3, 1.7, -0.01);
    this.rightArm = this.makeLimb(cloth, skin, -0.3, 1.7, -0.01);
    body.add(this.leftArm.group);
    body.add(this.rightArm.group);

    // Legs
    this.leftLeg = this.makeLimb(leather, skin, 0.15, 0.88, 0);
    this.rightLeg = this.makeLimb(leather, skin, -0.15, 0.88, 0);
    this.leftLeg.group.scale.setScalar(1.05);
    this.rightLeg.group.scale.setScalar(1.05);
    body.add(this.leftLeg.group);
    body.add(this.rightLeg.group);

    // Sword in right hand
    this.sword = new THREE.Group();
    const hilt = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.22, 0.08),
      new THREE.MeshStandardMaterial({ color: leather })
    );
    hilt.position.y = -0.1;
    this.sword.add(hilt);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.06, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xc0a070, metalness: 0.6, roughness: 0.3 })
    );
    guard.position.y = 0.02;
    this.sword.add(guard);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.9, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0xd8dce0,
        metalness: 0.9,
        roughness: 0.18,
        emissive: 0x223344,
        emissiveIntensity: 0.1,
      })
    );
    blade.position.y = 0.5;
    this.sword.add(blade);
    // Attach sword to right arm tip; position along the hand.
    this.sword.position.set(0, -0.52, 0.05);
    this.sword.rotation.set(Math.PI / 2, 0, 0);
    this.rightArm.group.add(this.sword);
  }

  private makeLimb(clothColor: number, skinColor: number, x: number, y: number, z: number): LimbRef {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.5, 0.18),
      new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.9 })
    );
    upper.position.y = -0.25;
    upper.castShadow = true;
    group.add(upper);
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.4, 0.16),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85 })
    );
    lower.position.y = -0.62;
    lower.castShadow = true;
    group.add(lower);
    return { group, baseRot: group.rotation.clone() };
  }

  startAttack() {
    if (this.swingT < 0) {
      this.swingT = 0;
      this.attackHitFrame = false;
    }
  }

  isSwinging() { return this.swingT >= 0; }

  /**
   * Update movement, animation, and attack state.
   * @param moveWorld direction the player intends to move in world space (xz plane, length<=1)
   * @param wantsJump true if jump input pressed this frame
   * @param sprint true if sprinting
   * @param dt seconds
   * @param cameraYaw camera yaw so we can face the player toward move direction
   */
  update(
    moveWorld: THREE.Vector3,
    wantsJump: boolean,
    sprint: boolean,
    dt: number,
    _cameraYaw: number
  ) {
    const speed = (sprint && this.stamina > 0 ? 7.5 : 4.2) * (this.swingT >= 0 ? 0.35 : 1);

    const target = moveWorld.clone().multiplyScalar(speed);
    // Smooth horizontal velocity
    this.velocity.x += (target.x - this.velocity.x) * Math.min(1, dt * 10);
    this.velocity.z += (target.z - this.velocity.z) * Math.min(1, dt * 10);

    // Gravity & jump
    if (this.isGrounded && wantsJump) {
      this.jumpVel = 6.2;
      this.isGrounded = false;
    }
    this.jumpVel -= 18 * dt;
    this.position.y += this.jumpVel * dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    const groundY = terrainHeight(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.jumpVel = 0;
      this.isGrounded = true;
    }

    // Face movement direction
    const moving = moveWorld.lengthSq() > 0.001;
    if (moving) {
      const target = Math.atan2(moveWorld.x, moveWorld.z);
      // shortest arc
      let diff = target - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 12);
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;

    // Stamina
    if (sprint && moving) this.stamina = Math.max(0, this.stamina - 22 * dt);
    else this.stamina = Math.min(this.maxStamina, this.stamina + 14 * dt);

    // Limb animation
    const walkSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.bobTime += dt * (4 + walkSpeed * 1.2);
    const swing = Math.sin(this.bobTime * 2) * Math.min(1, walkSpeed / 4) * 0.9;

    this.leftLeg.group.rotation.x = swing;
    this.rightLeg.group.rotation.x = -swing;
    if (this.swingT < 0) {
      this.leftArm.group.rotation.x = -swing * 0.7;
      this.rightArm.group.rotation.x = swing * 0.4; // hold sword ready
      this.rightArm.group.rotation.z = 0.15;
    }
    // Body bob
    this.body.position.y = Math.abs(Math.sin(this.bobTime)) * 0.06 * Math.min(1, walkSpeed / 4);

    // Attack swing (0.5s total, hit frame around 0.25)
    if (this.swingT >= 0) {
      this.swingT += dt / 0.5;
      const p = this.swingT;
      // Raise arm then slash down
      const ease = (x: number) => 1 - Math.pow(1 - x, 3);
      if (p < 0.5) {
        const q = ease(p / 0.5);
        this.rightArm.group.rotation.x = -Math.PI * 0.55 * q;
        this.rightArm.group.rotation.z = 0.15 + 0.2 * q;
      } else {
        const q = ease((p - 0.5) / 0.5);
        this.rightArm.group.rotation.x = -Math.PI * 0.55 + Math.PI * 1.1 * q;
        this.rightArm.group.rotation.z = 0.35 - 0.2 * q;
      }
      if (!this.attackHitFrame && p >= 0.45 && p <= 0.6) {
        this.attackHitFrame = true;
      }
      if (this.swingT >= 1) this.swingT = -1;
    }
  }

  // Where the tip of the sword is in world space (used for hit detection).
  getAttackOrigin(): THREE.Vector3 {
    // Approximate: 1.5m in front of player at chest height
    const forward = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    return this.position
      .clone()
      .add(new THREE.Vector3(0, 1.2, 0))
      .add(forward.multiplyScalar(1.4));
  }

  damage(n: number) { this.hp = Math.max(0, this.hp - n); }
  heal(n: number) { this.hp = Math.min(this.maxHp, this.hp + n); }
}
