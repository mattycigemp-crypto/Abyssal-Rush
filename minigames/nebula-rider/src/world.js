// Background world: starfield, nebula cloud, distant sun, dust streaks.
import * as THREE from 'three';
import { rand, prng } from './utils.js';

// Shader-based starfield as a giant inverted sphere.
const starVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const starFrag = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform float uTime;

  // 3D hash
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

  // Simple noise
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), u.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), u.x), u.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), u.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), u.x), u.y),
      u.z);
  }

  float fbm(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  vec3 nebulaColor(vec3 dir) {
    float n1 = fbm(dir * 1.5);
    float n2 = fbm(dir * 2.7 + 3.2);
    float n3 = fbm(dir * 0.9 - 1.7);
    vec3 c1 = vec3(0.85, 0.25, 0.95); // magenta
    vec3 c2 = vec3(0.25, 0.55, 1.00); // cyan/blue
    vec3 c3 = vec3(0.35, 1.00, 0.80); // teal
    vec3 col = mix(c1, c2, smoothstep(0.3, 0.8, n1));
    col = mix(col, c3, smoothstep(0.45, 0.9, n2) * 0.6);
    float intensity = pow(n3, 2.5) * 1.2;
    return col * intensity;
  }

  void main() {
    vec3 d = normalize(vDir);

    // Deep space base
    vec3 col = vec3(0.015, 0.01, 0.04);

    // Stars — dense tiny points from a layered hash (2 layers for performance)
    for (int k = 0; k < 2; k++) {
      float s = float(k) * 7.0 + 1.0;
      vec3 q = d * (70.0 + s * 90.0);
      vec3 id = floor(q);
      vec3 f = fract(q) - 0.5;
      float r = hash(id + float(k));
      if (r > 0.985) {
        float brightness = pow(r, 18.0) * 2.4;
        float d2 = dot(f, f);
        float g = exp(-d2 * (110.0 - float(k) * 20.0));
        // subtle twinkle
        g *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 5.0) + r * 40.0);
        // star color temperature
        vec3 starCol = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.85, 0.6), fract(r * 97.0));
        col += starCol * brightness * g;
      }
    }

    // Nebula clouds
    vec3 neb = nebulaColor(d);
    col += neb * 0.55;

    // A soft horizon glow near +Y
    float h = smoothstep(0.0, 0.5, d.y + 0.1);
    col += vec3(0.30, 0.12, 0.45) * pow(1.0 - abs(d.y), 2.0) * 0.18;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;

    // Background sphere
    const skyGeo = new THREE.SphereGeometry(900, 64, 48);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: starVert,
      fragmentShader: starFrag,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // Distant pulsing sun / pulsar
    const sunMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float; varying vec2 vUv; uniform float uTime;
        void main() {
          vec2 c = vUv - 0.5; float r = length(c);
          float core = smoothstep(0.5, 0.0, r);
          float halo = smoothstep(0.5, 0.12, r) * 0.6;
          float rays = abs(sin(atan(c.y, c.x) * 12.0 + uTime * 0.3)) * smoothstep(0.5, 0.3, r) * 0.4;
          vec3 col = mix(vec3(1.0, 0.6, 0.85), vec3(0.5, 0.8, 1.0), smoothstep(0.0, 0.5, r));
          col *= core * 0.8 + halo * 0.55 + rays * 0.6;
          col *= 0.9 + 0.25 * sin(uTime * 0.8);
          gl_FragColor = vec4(col, core + halo * 0.9 + rays * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), sunMat);
    this.sun.position.set(-220, 110, -640);
    this.sun.renderOrder = -9;
    scene.add(this.sun);

    // Ambient dust motes swirling — instanced points that scroll past the camera.
    this._createDust();

    // Lighting
    const hemi = new THREE.HemisphereLight(0xa080ff, 0x000015, 0.4);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xff7cff, 1.2);
    key.position.set(-6, 8, -4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x5dc8ff, 0.6);
    fill.position.set(8, 2, 6);
    scene.add(fill);
  }

  _createDust() {
    const count = 400;  // Reduced from 1400 for performance
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const r = prng(1337);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (r() - 0.5) * 600;
      pos[i * 3 + 1] = (r() - 0.5) * 300;
      pos[i * 3 + 2] = (r() - 0.5) * 600;
      const c = new THREE.Color().setHSL(0.7 + r() * 0.2, 0.9, 0.6 + r() * 0.3);
      col[i * 3 + 0] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 1.4, vertexColors: true, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  update(dt, camera) {
    this.time += dt;
    this.sky.material.uniforms.uTime.value = this.time;
    this.sun.material.uniforms.uTime.value = this.time;
    this.sky.position.copy(camera.position);
    this.sun.lookAt(camera.position);

    // Dust: update every 2nd frame for performance (dt doubled when we do update)
    this._dustSkip = !this._dustSkip;
    if (this._dustSkip) return;
    const dt2 = dt * 2;

    // Dust: gently counter-scroll so it feels like we're moving through space.
    // Wrap dust positions around the camera to keep them around the player.
    const pos = this.dust.geometry.attributes.position;
    const arr = pos.array;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const R = 300;
    const RY = 180;  // R * 0.6
    const t = this.time;
    for (let i = 0; i < arr.length; i += 3) {
      const ii = i;
      // Soft drift (optimized)
      arr[ii] += Math.sin(t * 0.1 + ii) * dt2 * 0.4;
      arr[ii + 1] += Math.cos(t * 0.08 + ii) * dt2 * 0.3;
      // Wrap (optimized conditionals)
      const dx = arr[ii] - cx;
      const dy = arr[ii + 1] - cy;
      const dz = arr[ii + 2] - cz;
      if (dx > R) arr[ii] -= 600;
      else if (dx < -R) arr[ii] += 600;
      if (dy > RY) arr[ii + 1] -= 360;
      else if (dy < -RY) arr[ii + 1] += 360;
      if (dz > R) arr[ii + 2] -= 600;
      else if (dz < -R) arr[ii + 2] += 600;
    }
    pos.needsUpdate = true;
  }
}
