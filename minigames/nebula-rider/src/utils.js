// Math / helper utilities.
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const sign = (x) => (x < 0 ? -1 : x > 0 ? 1 : 0);

// Damp a value toward a target using frame-rate independent exponential decay.
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

// Mulberry32 seeded PRNG
export function prng(seed = 1) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Format number with thousands separators.
export const fmtInt = (n) => Math.floor(n).toLocaleString('en-US');

// Reusable temporaries to avoid allocations in the hot path.
export const tmp = {
  v0: new THREE.Vector3(),
  v1: new THREE.Vector3(),
  v2: new THREE.Vector3(),
  v3: new THREE.Vector3(),
  v4: new THREE.Vector3(),
  v5: new THREE.Vector3(),
  q0: new THREE.Quaternion(),
  q1: new THREE.Quaternion(),
  q2: new THREE.Quaternion(),
  q3: new THREE.Quaternion(),
  m0: new THREE.Matrix4(),
  e0: new THREE.Euler(),
  c0: new THREE.Color(),
  c1: new THREE.Color(),
  c2: new THREE.Color(),
};
