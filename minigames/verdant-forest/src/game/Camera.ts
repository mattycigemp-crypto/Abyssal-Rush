// Third-person orbit camera with smooth follow and terrain-aware collision.
import * as THREE from 'three';
import { terrainHeight } from './World';

export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = -0.18;
  private distance = 5.5;
  private currentPos = new THREE.Vector3();
  private smoothTarget = new THREE.Vector3();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.1, 600);
  }

  setAspect(a: number) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  getYaw() { return this.yaw; }

  addLook(dx: number, dy: number) {
    const sens = 0.0024;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-1.0, Math.min(0.55, this.pitch));
  }

  update(target: THREE.Vector3, dt: number) {
    const desiredTarget = target.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.smoothTarget.lerp(desiredTarget, Math.min(1, dt * 14));

    const cosP = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosP,
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * cosP
    ).multiplyScalar(this.distance);

    const desired = this.smoothTarget.clone().add(offset);

    // Keep camera above terrain.
    const groundY = terrainHeight(desired.x, desired.z) + 0.6;
    if (desired.y < groundY) desired.y = groundY;

    this.currentPos.lerp(desired, Math.min(1, dt * 10));
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.smoothTarget);
  }

  // Directly snap to a position & lookAt target (used by cutscenes).
  setPose(pos: THREE.Vector3, lookAt: THREE.Vector3) {
    this.currentPos.copy(pos);
    this.camera.position.copy(pos);
    this.camera.lookAt(lookAt);
  }
}
