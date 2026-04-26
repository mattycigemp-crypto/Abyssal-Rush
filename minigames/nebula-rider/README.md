# Nebula Rider

A cinematic 3D WebGL space shooter built with Three.js. Dodge procedurally
generated asteroids, blast enemy interceptors, collect energy crystals, and
survive as the waves escalate — all in a neon-drenched nebula.

![Nebula Rider](https://img.shields.io/badge/WebGL-Three.js-ff4bff?style=for-the-badge)

## Play

Just open `index.html` in a modern browser (served over HTTP — not `file://`,
because ES module import-maps require a server).

```bash
# Any static file server works
python3 -m http.server 5173
# then open http://localhost:5173
```

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / Arrows | Steer |
| Mouse | Fine aim |
| `Space` / Click | Fire lasers |
| `Shift` | Boost |
| `Q` / `E` | Roll |
| `P` | Pause |
| `M` | Mute |

## Features

- **Cinematic post-processing** — Unreal bloom, chromatic aberration,
  vignette, film grain, FXAA, and screen shake.
- **Procedural starfield + nebula** — fully shader-generated sky with
  thousands of twinkling stars and volumetric nebulae.
- **Procedural asteroids** — icosahedron-perturbed geometry with emissive
  crystal veins.
- **Juicy particle VFX** — 2,000 pooled points for explosions, debris,
  sparks, and engine trails.
- **Adaptive synth music + SFX** — entirely synthesized via the WebAudio
  API. No asset files.
- **Wave progression** — enemies & asteroid density scale with your
  survival.

## Architecture

```
src/
├── main.js        State machine, game loop, orchestration
├── renderer.js    Three.js + EffectComposer post-processing
├── world.js       Shader-based skybox, sun, dust
├── ship.js        Player ship model, physics, camera follow, trail
├── entities.js    Asteroids / Enemies / Bullets / Pickups / Particles (pooled)
├── hud.js         DOM HUD & overlays
├── input.js       Keyboard + mouse input manager
├── audio.js       Adaptive music + procedural SFX (WebAudio)
└── utils.js       Math helpers, PRNG, pooled temporaries
```

No build step; Three.js is loaded via an import map from a CDN.
