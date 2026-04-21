// Simple particle system for hit sparks and ambient fireflies.
import * as THREE from 'three';

interface P {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class Particles {
  private scene: THREE.Scene;
  private active: P[] = [];
  private sparkGeom = new THREE.SphereGeometry(0.06, 5, 5);

  constructor(scene: THREE.Scene) { this.scene = scene; }

  spawnHit(pos: THREE.Vector3, color = 0xffd98a) {
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(
        this.sparkGeom,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      m.position.copy(pos);
      m.position.y += 0.6;
      this.scene.add(m);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
      this.active.push({ mesh: m, vel, life: 0, maxLife: 0.6 });
    }
  }

  spawnFireflies(count: number, areaHalfX = 70, areaHalfZ = 70) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd98a,
      transparent: true,
      opacity: 0.9,
    });
    const geom = new THREE.SphereGeometry(0.06, 5, 5);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geom, mat.clone());
      m.position.set(
        (Math.random() - 0.5) * 2 * areaHalfX,
        1 + Math.random() * 3,
        (Math.random() - 0.5) * 2 * areaHalfZ
      );
      this.scene.add(m);
      this.active.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.3
        ),
        life: 0,
        maxLife: Infinity,
      });
    }
  }

  update(dt: number, dayT: number) {
    // Night fade for long-lived particles (fireflies)
    // dayT: 0..1, night when t > 0.6 or < 0.02
    const nightness = Math.max(0, Math.min(1, 1 - Math.abs(0.5 - dayT) * 2.5));
    const nightAlpha = 1 - nightness; // inverse: higher near night

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life += dt;
      if (p.maxLife !== Infinity) {
        p.vel.y -= 7 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        const t = p.life / p.maxLife;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
        if (p.life >= p.maxLife) {
          this.scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          this.active.splice(i, 1);
        }
      } else {
        // Firefly wander
        p.vel.x += (Math.random() - 0.5) * 0.4 * dt;
        p.vel.y += (Math.random() - 0.5) * 0.4 * dt;
        p.vel.z += (Math.random() - 0.5) * 0.4 * dt;
        p.vel.multiplyScalar(0.97);
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < 0.4) p.mesh.position.y = 0.4;
        (p.mesh.material as THREE.MeshBasicMaterial).opacity =
          nightAlpha * (0.5 + Math.sin((p.life + p.mesh.position.x) * 3) * 0.5);
      }
    }
  }
}
