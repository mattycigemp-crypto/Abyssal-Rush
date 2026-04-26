// Renderer + post-processing setup.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings } from './settings.js';

// Custom post pass: vignette + chromatic aberration + subtle film grain.
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0018 },
    uVignette: { value: 1.3 },
    uGrain: { value: 0.06 },
    uShake: { value: new THREE.Vector2() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uGrain;
    uniform vec2  uShake;

    float hash(vec2 p) {
      p = fract(p * vec2(443.8975, 397.2973));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 uv = vUv + uShake;
      vec2 c = uv - 0.5;
      float r = length(c);
      float ab = uAberration * (0.5 + r * 2.5);

      vec2 dir = normalize(c + 1e-5);
      vec3 col;
      
      // Optimized: use single texture lookup when aberration is 0
      if (uAberration < 0.0001) {
        col = texture2D(tDiffuse, uv).rgb;
      } else {
        // Chromatic aberration (3 texture lookups)
        float rC = texture2D(tDiffuse, uv - dir * ab).r;
        float gC = texture2D(tDiffuse, uv).g;
        float bC = texture2D(tDiffuse, uv + dir * ab).b;
        col = vec3(rC, gC, bC);
      }

      // Vignette
      float vig = smoothstep(0.95, 0.2, r * uVignette);
      col *= mix(0.55, 1.0, vig);

      // Subtle scanline brightness modulation
      col *= 0.97 + 0.03 * sin(uv.y * 900.0);

      // Grain (skip if disabled)
      if (uGrain > 0.001) {
        float g = hash(uv * 1024.0 + uTime * 97.0) - 0.5;
        col *= 1.0 + g * uGrain * 0.15;
      }

      // Slight lift for velvety blacks
      col = col + vec3(0.005, 0.003, 0.012);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x06001c, 0.003);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 3, 12);

    // Postprocessing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.65, 0.35);
    this.composer.addPass(this.bloom);

    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);

    this.finish = new ShaderPass(FinishShader);
    this.composer.addPass(this.finish);

    this.composer.addPass(new OutputPass());

    this._shake = new THREE.Vector2();
    this._shakeAmount = 0;

    // Base post-processing values so reduced-motion can re-derive live.
    this._baseAberration = this.finish.uniforms.uAberration.value;
    this._baseGrain = this.finish.uniforms.uGrain.value;
    this._baseBloom = this.bloom.strength;
    this._applyMotionPrefs();
    this._applyQuality();
    settings.onChange((k) => {
      if (k === 'reducedMotion') this._applyMotionPrefs();
      if (k === 'highQuality') this._applyQuality();
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _applyQuality() {
    const hq = settings.get('highQuality');
    // Enable/disable expensive post-processing passes
    this.bloom.enabled = hq;
    this.fxaa.enabled = hq;
    // Disable finish shader effects when low quality (saves GPU cycles)
    this.finish.uniforms.uAberration.value = hq ? this._baseAberration : 0;
    this.finish.uniforms.uGrain.value = hq ? this._baseGrain : 0;
  }

  _applyMotionPrefs() {
    const reduced = settings.get('reducedMotion');
    this.finish.uniforms.uAberration.value = reduced ? 0 : this._baseAberration;
    this.finish.uniforms.uGrain.value = reduced ? 0 : this._baseGrain;
    this.bloom.strength = reduced ? Math.min(0.35, this._baseBloom) : this._baseBloom;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    // EffectComposer needs the actual pixel size for proper rendering
    this.composer.setSize(w * pr, h * pr);
    // Update bloom pass resolution to match
    this.bloom.resolution.set(w * pr, h * pr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fxaa.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
  }

  shake(amount) {
    if (settings.get('reducedMotion')) return;
    this._shakeAmount = Math.min(1.0, this._shakeAmount + amount);
  }

  render(dt, time) {
    // Update shake
    this._shakeAmount = Math.max(0, this._shakeAmount - dt * 1.2);
    const s = settings.get('reducedMotion') ? 0 : this._shakeAmount;
    this._shake.set((Math.random() - 0.5) * 0.018 * s, (Math.random() - 0.5) * 0.018 * s);
    this.finish.uniforms.uTime.value = time;
    this.finish.uniforms.uShake.value.copy(this._shake);

    this.composer.render();
  }
}
