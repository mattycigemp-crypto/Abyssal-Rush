// The game world: terrain, trees, grass blades, rocks, flowers, water, sky,
// day/night cycle, fog, and the shrine landmark. Procedural & deterministic.
import * as THREE from 'three';
import { Rand } from './Random';

export interface TimeState {
  t: number; // 0..1, where 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight
  label: string;
  sunDir: THREE.Vector3;
  skyColor: THREE.Color;
  horizonColor: THREE.Color;
  fogColor: THREE.Color;
  ambient: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
}

// Smooth terrain height field using layered sine waves (deterministic).
export function terrainHeight(x: number, z: number): number {
  const h1 = Math.sin(x * 0.04) * Math.cos(z * 0.035) * 2.2;
  const h2 = Math.sin((x + 15) * 0.09) * Math.cos((z - 7) * 0.08) * 0.8;
  const h3 = Math.sin(x * 0.17 + z * 0.13) * 0.25;
  // Gentle basin in the center so the player can see the horizon.
  const dist = Math.sqrt(x * x + z * z);
  const basin = -Math.exp(-dist * dist / 1200) * 1.2;
  return h1 + h2 + h3 + basin;
}

export interface MoonpetalNode {
  pos: THREE.Vector3;
  group: THREE.Group;
  collected: boolean;
  phase: number;
}

export class World {
  readonly group = new THREE.Group();
  readonly sun = new THREE.DirectionalLight(0xffffff, 1);
  readonly ambient = new THREE.AmbientLight(0xffffff, 0.35);
  readonly hemi = new THREE.HemisphereLight(0xbfd7ff, 0x3a2a1a, 0.4);
  readonly fog: THREE.Fog;
  readonly shrinePos = new THREE.Vector3(40, 0, -30);
  readonly villagePos = new THREE.Vector3(0, 0, 0);
  readonly ancientStonesPos = new THREE.Vector3(-48, 0, 34);
  readonly deepGrovePos = new THREE.Vector3(-55, 0, -48);
  readonly enemySpawns: THREE.Vector3[] = [];
  readonly deepGroveSpawns: THREE.Vector3[] = [];
  readonly moonpetals: MoonpetalNode[] = [];
  readonly waterLevel = -1.2;

  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private water: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial;
  private grassTime = 0;

  constructor(scene: THREE.Scene) {
    this.fog = new THREE.Fog(0xa8c4d8, 60, 240);
    scene.fog = this.fog;
    scene.add(this.group);

    // Skybox (gradient shader).
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x87b4d8) },
        horizonColor: { value: new THREE.Color(0xffc9a0) },
        bottomColor: { value: new THREE.Color(0x2a3340) },
        offset: { value: 33 },
        exponent: { value: 0.6 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          vec3 col;
          if (h > 0.0) {
            col = mix(horizonColor, topColor, pow(h, exponent));
          } else {
            col = mix(horizonColor, bottomColor, pow(-h, 0.5));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.sky.renderOrder = -1;
    scene.add(this.sky);

    // Lights
    this.sun.position.set(50, 80, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.ambient);
    scene.add(this.hemi);

    // Terrain
    this.buildTerrain();

    // Water
    this.waterMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        colorA: { value: new THREE.Color(0x3a6980) },
        colorB: { value: new THREE.Color(0x7fb0c4) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform vec3 colorA;
        uniform vec3 colorB;
        varying vec2 vUv;
        void main() {
          float ripple =
            sin((vUv.x + time * 0.03) * 40.0) * 0.5 +
            sin((vUv.y + time * 0.02) * 60.0) * 0.5;
          ripple = 0.5 + 0.5 * ripple * 0.5;
          vec3 col = mix(colorA, colorB, ripple);
          gl_FragColor = vec4(col, 0.82);
        }
      `,
    });
    const waterGeom = new THREE.PlaneGeometry(400, 400);
    this.water = new THREE.Mesh(waterGeom, this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = this.waterLevel;
    this.group.add(this.water);

    // Scatter trees, rocks, flowers, grass.
    const rand = new Rand(42);
    this.scatterTrees(rand);
    this.scatterRocks(rand);
    this.scatterFlowers(rand);
    this.scatterGrass(rand);

    // Village well + shrine
    this.buildVillage();
    this.buildShrine();
    this.buildAncientStones();

    // Enemy spawn points near the shrine (the grove).
    const s = this.shrinePos;
    this.enemySpawns.push(
      new THREE.Vector3(s.x + 6, terrainHeight(s.x + 6, s.z + 2) + 1, s.z + 2),
      new THREE.Vector3(s.x - 5, terrainHeight(s.x - 5, s.z + 4) + 1, s.z + 4),
      new THREE.Vector3(s.x + 2, terrainHeight(s.x + 2, s.z - 6) + 1, s.z - 6),
    );

    // Enemy spawn points in the deep grove (far northwest corner).
    const g = this.deepGrovePos;
    this.deepGroveSpawns.push(
      new THREE.Vector3(g.x + 4, terrainHeight(g.x + 4, g.z + 2) + 1, g.z + 2),
      new THREE.Vector3(g.x - 3, terrainHeight(g.x - 3, g.z + 5) + 1, g.z + 5),
      new THREE.Vector3(g.x - 5, terrainHeight(g.x - 5, g.z - 3) + 1, g.z - 3),
      new THREE.Vector3(g.x + 2, terrainHeight(g.x + 2, g.z - 5) + 1, g.z - 5),
    );

    // Moonpetals scattered across the valley.
    this.seedMoonpetals();
  }

  private buildTerrain() {
    const size = 300;
    const seg = 160;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x4c7a3a);
    const lush = new THREE.Color(0x6aa04c);
    const sand = new THREE.Color(0xc0a778);
    const stone = new THREE.Color(0x7a7a74);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      pos.setY(i, y);
      const c = new THREE.Color();
      if (y < this.waterLevel + 0.1) c.copy(sand);
      else if (y < 0.2) c.lerpColors(sand, grass, (y - this.waterLevel) / 1.4);
      else if (y < 2) c.lerpColors(grass, lush, y / 2);
      else c.lerpColors(lush, stone, Math.min(1, (y - 2) / 3));
      // Noise variation
      const noise = (Math.sin(x * 1.3) * Math.cos(z * 1.7)) * 0.04;
      c.offsetHSL(0, 0, noise);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
      flatShading: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private scatterTrees(rand: Rand) {
    const trunkGeom = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6);
    const leafGeom = new THREE.ConeGeometry(1.8, 3.8, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 0.95 });
    const pineMats = [
      new THREE.MeshStandardMaterial({ color: 0x2d5a3a, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x407a4b, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ color: 0x1f4a33, roughness: 0.9 }),
    ];

    const count = 220;
    for (let i = 0; i < count; i++) {
      const x = rand.range(-140, 140);
      const z = rand.range(-140, 140);
      const d = Math.hypot(x, z);
      if (d < 8) continue; // clearing near spawn
      if (Math.hypot(x - this.shrinePos.x, z - this.shrinePos.z) < 6) continue;
      const y = terrainHeight(x, z);
      if (y < this.waterLevel + 0.3) continue;

      const scale = rand.range(0.8, 1.7);
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 1.6 * scale;
      trunk.scale.set(scale, scale, scale);
      trunk.castShadow = true;
      tree.add(trunk);

      const layers = 3;
      const leafMat = pineMats[rand.int(0, pineMats.length - 1)];
      for (let l = 0; l < layers; l++) {
        const cone = new THREE.Mesh(leafGeom, leafMat);
        cone.position.y = (2.2 + l * 1.3) * scale;
        const s = (1 - l * 0.22) * scale;
        cone.scale.set(s, 0.9 * s, s);
        cone.castShadow = true;
        tree.add(cone);
      }
      tree.position.set(x, y, z);
      tree.rotation.y = rand.range(0, Math.PI * 2);
      this.group.add(tree);
    }
  }

  private scatterRocks(rand: Rand) {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f6d6a, roughness: 0.9 });
    const rockMat2 = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 0.9 });
    for (let i = 0; i < 120; i++) {
      const x = rand.range(-140, 140);
      const z = rand.range(-140, 140);
      const y = terrainHeight(x, z);
      if (y < this.waterLevel + 0.1) continue;
      const geom = new THREE.DodecahedronGeometry(rand.range(0.3, 1.2), 0);
      const rock = new THREE.Mesh(geom, rand.next() > 0.5 ? rockMat : rockMat2);
      rock.position.set(x, y + 0.1, z);
      rock.rotation.set(rand.range(0, Math.PI), rand.range(0, Math.PI), rand.range(0, Math.PI));
      rock.scale.set(rand.range(0.8, 1.3), rand.range(0.6, 1.0), rand.range(0.8, 1.3));
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
    }
  }

  private scatterFlowers(rand: Rand) {
    const colors = [0xffc857, 0xe07a7a, 0xffffff, 0xa67aff, 0xffd98a];
    const petalGeom = new THREE.ConeGeometry(0.12, 0.3, 5);
    const stemGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a });
    for (let i = 0; i < 280; i++) {
      const x = rand.range(-100, 100);
      const z = rand.range(-100, 100);
      const y = terrainHeight(x, z);
      if (y < this.waterLevel + 0.2 || y > 2.5) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: colors[rand.int(0, colors.length - 1)],
        emissive: 0x331a00,
        emissiveIntensity: 0.05,
      });
      const flower = new THREE.Group();
      const stem = new THREE.Mesh(stemGeom, stemMat);
      stem.position.y = 0.15;
      flower.add(stem);
      const petal = new THREE.Mesh(petalGeom, mat);
      petal.position.y = 0.32;
      flower.add(petal);
      flower.position.set(x, y, z);
      flower.rotation.y = rand.range(0, Math.PI * 2);
      this.group.add(flower);
    }
  }

  private scatterGrass(rand: Rand) {
    // Use instanced mesh for performance. A simple tapered plane of grass blades.
    const bladeGeom = new THREE.PlaneGeometry(0.18, 0.5, 1, 2);
    bladeGeom.translate(0, 0.25, 0);
    const count = 1500;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5a8a44,
      side: THREE.DoubleSide,
      roughness: 1,
      // Small alpha test to soften edges
      transparent: false,
    });
    const mesh = new THREE.InstancedMesh(bladeGeom, mat, count);
    const dummy = new THREE.Object3D();
    let placed = 0;
    while (placed < count) {
      const x = rand.range(-100, 100);
      const z = rand.range(-100, 100);
      const y = terrainHeight(x, z);
      if (y < this.waterLevel + 0.3 || y > 3) continue;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, rand.range(0, Math.PI * 2), 0);
      const s = rand.range(0.6, 1.4);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private buildVillage() {
    // A little well at origin as a "home" landmark.
    const well = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8682, roughness: 0.9 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.8, 16), stoneMat);
    ring.position.y = 0.4;
    ring.castShadow = true;
    ring.receiveShadow = true;
    well.add(ring);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a4a5a, roughness: 0.2 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.65;
    well.add(water);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x5b3a1f, roughness: 0.9 });
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.15), postMat);
      post.position.set(s * 1.0, 1.2, 0);
      post.castShadow = true;
      well.add(post);
    });
    const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.15, 0.15), postMat);
    crossbar.position.y = 2.1;
    crossbar.castShadow = true;
    well.add(crossbar);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.9 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.4;
    roof.castShadow = true;
    well.add(roof);

    well.position.set(0, terrainHeight(0, 0), 0);
    this.group.add(well);
  }

  private buildShrine() {
    const shrine = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.7 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x7a7a74, roughness: 0.8 });

    // Circular stone base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.4, 24), stoneDark);
    base.position.y = 0.2;
    base.receiveShadow = true;
    shrine.add(base);

    // Inner platform
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.15, 24), stone);
    platform.position.y = 0.48;
    platform.receiveShadow = true;
    shrine.add(platform);

    // Pillars
    const pillarGeom = new THREE.CylinderGeometry(0.25, 0.3, 3.2, 8);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(pillarGeom, stone);
      pillar.position.set(Math.cos(a) * 2.0, 2.0, Math.sin(a) * 2.0);
      pillar.castShadow = true;
      shrine.add(pillar);

      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.7), stone);
      capital.position.set(Math.cos(a) * 2.0, 3.75, Math.sin(a) * 2.0);
      capital.castShadow = true;
      shrine.add(capital);
    }

    // Brazier (lit at night)
    const brazier = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.6, 12),
      stoneDark
    );
    brazier.position.y = 0.95;
    brazier.castShadow = true;
    shrine.add(brazier);

    const flame = new THREE.PointLight(0xffb864, 0, 18, 2);
    flame.position.set(0, 1.6, 0);
    shrine.add(flame);
    shrine.userData.flame = flame;

    // Visual flame: glowing sphere
    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0 })
    );
    flameMesh.position.set(0, 1.55, 0);
    shrine.add(flameMesh);
    shrine.userData.flameMesh = flameMesh;

    shrine.position.copy(this.shrinePos);
    shrine.position.y = terrainHeight(this.shrinePos.x, this.shrinePos.z);
    this.shrinePos.y = shrine.position.y;
    this.group.add(shrine);
    this.shrine = shrine;
  }

  shrine: THREE.Group = new THREE.Group();
  ancientStones: THREE.Group = new THREE.Group();

  update(dt: number, time: number) {
    this.grassTime += dt;
    // Subtle grass sway via material rotation not trivial — skip cheaply.
    if (this.waterMat.uniforms.time) this.waterMat.uniforms.time.value = time;

    // Animate shrine flame if lit
    const flame = this.shrine.userData.flame as THREE.PointLight | undefined;
    const flameMesh = this.shrine.userData.flameMesh as THREE.Mesh | undefined;
    if (flame && flameMesh) {
      const flicker = 1 + Math.sin(time * 12) * 0.08 + Math.sin(time * 7.1) * 0.05;
      if (flame.intensity > 0) flame.intensity = flame.userData.base * flicker;
      const fm = flameMesh.material as THREE.MeshBasicMaterial;
      if (fm.opacity > 0) fm.opacity = flameMesh.userData.baseOpacity * flicker;
    }

    // Animate moonpetals: gentle bob + slow spin.
    for (const m of this.moonpetals) {
      if (m.collected) continue;
      m.phase += dt;
      const bob = Math.sin(m.phase * 1.8) * 0.1;
      m.group.position.y = m.pos.y + 0.7 + bob;
      m.group.rotation.y = m.phase * 0.8;
    }
  }

  private buildAncientStones() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.95 });
    const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.95 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 1 });

    // A broken circle of 6 standing stones around a low altar.
    const count = 6;
    const radius = 3.2;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tall = 2.4 + Math.sin(i * 1.7) * 0.6;
      const stone = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, tall, 0.55),
        i % 2 === 0 ? stoneMat : darkStoneMat
      );
      stone.position.set(Math.cos(a) * radius, tall / 2, Math.sin(a) * radius);
      stone.rotation.y = a + 0.15 * Math.sin(i);
      stone.rotation.z = 0.08 * Math.sin(i * 2.1);
      stone.castShadow = true;
      stone.receiveShadow = true;
      group.add(stone);

      // Moss cap on every other stone
      if (i % 2 === 1) {
        const moss = new THREE.Mesh(
          new THREE.BoxGeometry(0.74, 0.14, 0.58),
          mossMat
        );
        moss.position.set(stone.position.x, tall + 0.07, stone.position.z);
        moss.rotation.copy(stone.rotation);
        group.add(moss);
      }
    }

    // Central altar stone.
    const altar = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.5, 1.2),
      stoneMat
    );
    altar.position.y = 0.25;
    altar.castShadow = true;
    altar.receiveShadow = true;
    group.add(altar);

    // Faint rune glow atop the altar (becomes notable at night).
    const rune = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x9acff5, transparent: true, opacity: 0.35 })
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.51;
    group.add(rune);

    const runeLight = new THREE.PointLight(0x9acff5, 0.9, 12, 2);
    runeLight.position.set(0, 1.0, 0);
    group.add(runeLight);

    group.position.copy(this.ancientStonesPos);
    group.position.y = terrainHeight(this.ancientStonesPos.x, this.ancientStonesPos.z);
    this.ancientStonesPos.y = group.position.y;
    this.group.add(group);
    this.ancientStones = group;
  }

  private seedMoonpetals() {
    // Hand-picked spread so the gathering quest naturally guides the player
    // through several regions of the map.
    const targets: THREE.Vector3[] = [
      new THREE.Vector3(14, 0, -6),
      new THREE.Vector3(-18, 0, 10),
      new THREE.Vector3(22, 0, 24),
      new THREE.Vector3(-30, 0, -10),
      new THREE.Vector3(6, 0, 34),
      new THREE.Vector3(32, 0, -6),
      new THREE.Vector3(-10, 0, -38),
      new THREE.Vector3(-38, 0, 18),
    ];

    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.9 });
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xbfe4ff,
      emissive: 0x4f86b8,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const t of targets) {
      const y = terrainHeight(t.x, t.z);
      if (y < this.waterLevel + 0.3) continue;
      const node = new THREE.Group();

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5),
        stemMat
      );
      stem.position.y = -0.35;
      node.add(stem);

      // Four blue petals.
      const petalGeom = new THREE.ConeGeometry(0.16, 0.3, 6);
      for (let i = 0; i < 4; i++) {
        const petal = new THREE.Mesh(petalGeom, petalMat);
        const a = (i / 4) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12);
        petal.rotation.z = Math.cos(a) * 0.5;
        petal.rotation.x = Math.sin(a) * 0.5;
        petal.castShadow = false;
        node.add(petal);
      }

      // Bright center so the flower is visible from far away.
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), coreMat);
      node.add(core);

      const light = new THREE.PointLight(0x9acff5, 0.6, 4, 2);
      node.add(light);

      node.position.set(t.x, y + 0.7, t.z);
      this.group.add(node);

      this.moonpetals.push({
        pos: new THREE.Vector3(t.x, y, t.z),
        group: node,
        collected: false,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  collectMoonpetalAt(playerPos: THREE.Vector3, radius = 1.2): MoonpetalNode | null {
    const r2 = radius * radius;
    for (const m of this.moonpetals) {
      if (m.collected) continue;
      const dx = m.pos.x - playerPos.x;
      const dz = m.pos.z - playerPos.z;
      if (dx * dx + dz * dz < r2) {
        m.collected = true;
        // Fade and remove the visual.
        const start = performance.now();
        const duration = 600;
        const tick = () => {
          const t = Math.min(1, (performance.now() - start) / duration);
          m.group.scale.setScalar(1 + t * 0.8);
          m.group.position.y += 0.02;
          m.group.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const mat = (obj as THREE.Mesh).material as THREE.Material & { opacity?: number; transparent?: boolean };
              mat.transparent = true;
              if (typeof mat.opacity === 'number') mat.opacity = 1 - t;
            }
          });
          if (t < 1) requestAnimationFrame(tick);
          else m.group.parent?.remove(m.group);
        };
        requestAnimationFrame(tick);
        return m;
      }
    }
    return null;
  }

  moonpetalsRemaining(): number {
    return this.moonpetals.filter((m) => !m.collected).length;
  }

  moonpetalsCollected(): number {
    return this.moonpetals.filter((m) => m.collected).length;
  }

  moonpetalTotal(): number {
    return this.moonpetals.length;
  }

  lightShrineFlame() {
    const flame = this.shrine.userData.flame as THREE.PointLight;
    const flameMesh = this.shrine.userData.flameMesh as THREE.Mesh;
    flame.userData.base = 4.0;
    flame.intensity = 4.0;
    (flameMesh.material as THREE.MeshBasicMaterial).opacity = 1;
    flameMesh.userData.baseOpacity = 1;
  }

  // Compute current time-of-day derived colors/light positions.
  getTimeState(t: number): TimeState {
    t = ((t % 1) + 1) % 1;
    // Define key colors for dawn/noon/dusk/night
    const dawn = {
      sky: new THREE.Color(0xffa776),
      horizon: new THREE.Color(0xffcfa0),
      fog: new THREE.Color(0xe2b58a),
      ambient: new THREE.Color(0x6a5a4a),
      sun: new THREE.Color(0xffd0a0),
      intensity: 0.9,
      label: 'Dawn',
    };
    const noon = {
      sky: new THREE.Color(0x6aa4d8),
      horizon: new THREE.Color(0xc6dff0),
      fog: new THREE.Color(0xbcd2e4),
      ambient: new THREE.Color(0x8094a8),
      sun: new THREE.Color(0xffffff),
      intensity: 1.2,
      label: 'Noon',
    };
    const dusk = {
      sky: new THREE.Color(0x9b5f8a),
      horizon: new THREE.Color(0xe08a54),
      fog: new THREE.Color(0x9a6a7a),
      ambient: new THREE.Color(0x5a4a6a),
      sun: new THREE.Color(0xffa060),
      intensity: 0.7,
      label: 'Dusk',
    };
    const night = {
      sky: new THREE.Color(0x0a1020),
      horizon: new THREE.Color(0x1a2a40),
      fog: new THREE.Color(0x101828),
      ambient: new THREE.Color(0x1a2840),
      sun: new THREE.Color(0x6a80a8), // moon
      intensity: 0.25,
      label: 'Night',
    };

    const keys = [dawn, noon, dusk, night];
    const seg = t * 4;
    const i = Math.floor(seg) % 4;
    const f = seg - Math.floor(seg);
    const a = keys[i];
    const b = keys[(i + 1) % 4];
    const smooth = f * f * (3 - 2 * f);
    const state: TimeState = {
      t,
      label: smooth < 0.5 ? a.label : b.label,
      sunDir: new THREE.Vector3(),
      skyColor: a.sky.clone().lerp(b.sky, smooth),
      horizonColor: a.horizon.clone().lerp(b.horizon, smooth),
      fogColor: a.fog.clone().lerp(b.fog, smooth),
      ambient: a.ambient.clone().lerp(b.ambient, smooth),
      sunColor: a.sun.clone().lerp(b.sun, smooth),
      sunIntensity: a.intensity + (b.intensity - a.intensity) * smooth,
    };
    // Sun follows a circular arc: angle 0 = rising east
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);
    state.sunDir.set(sunX, sunY, 0.3).normalize();
    return state;
  }

  applyTimeState(s: TimeState) {
    this.skyMat.uniforms.topColor.value.copy(s.skyColor);
    this.skyMat.uniforms.horizonColor.value.copy(s.horizonColor);
    this.skyMat.uniforms.bottomColor.value
      .copy(s.horizonColor)
      .lerp(new THREE.Color(0x000000), 0.6);
    this.fog.color.copy(s.fogColor);
    this.ambient.color.copy(s.ambient);
    this.ambient.intensity = 0.25 + s.sunIntensity * 0.15;
    this.hemi.color.copy(s.skyColor);
    this.hemi.groundColor.set(0x3a2a1a);
    this.hemi.intensity = 0.25 + s.sunIntensity * 0.25;
    this.sun.color.copy(s.sunColor);
    this.sun.intensity = s.sunIntensity;
    const origin = new THREE.Vector3(0, 0, 0);
    this.sun.position.copy(origin).add(s.sunDir.clone().multiplyScalar(120));
    this.sun.target.position.copy(origin);
    this.sun.target.updateMatrixWorld();
  }
}
