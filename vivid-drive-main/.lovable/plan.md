

# Cinematic Open-World Driving + Stunts

A browser-based 3D driving game built with **Three.js + React Three Fiber + Rapier physics**, focused on pushing visual fidelity as far as WebGL realistically allows. Drive across multiple connected biomes, switch cameras, hit ramps, and cause chaos — all with realistic vehicle simulation.

## Visual Direction (the "insane graphics" part)

- **PBR materials** on everything (metal flake car paint with clearcoat, rough asphalt, wet sand, bark, leaves)
- **Dynamic time-of-day lighting** with a physically-based sky shader (Hosek-Wilkie style), animated sun, soft cascaded shadows
- **Post-processing stack**: bloom, screen-space ambient occlusion (SSAO), depth of field on cinematic cam, motion blur on speed, chromatic aberration, film grain, tone-mapped HDR (ACES)
- **Reflections** on car body via cubemap + screen-space reflections on wet surfaces
- **Volumetric effects**: god rays through forest canopy, fog in valleys, desert heat haze shader, dust trails behind tires
- **High-density vegetation** using instanced meshes (thousands of grass blades, trees) with wind shader
- **Detailed car model** with working headlights, brake lights, suspension travel, steering wheels turning, wheel spin
- **Particle systems**: tire smoke, sparks, debris on impact, exhaust, splashes

## The World

One seamless drivable map stitching together four zones connected by roads:

1. **Coastal cliffside road** — sunset hour, ocean shader with foam, lighthouses
2. **City district** — blocks of buildings, traffic lights, parked cars, neon signs at night
3. **Forest off-road trails** — terrain with hills, dirt physics, fog, light shafts
4. **Desert highway** — long straights, dunes, distant mesas, heat shimmer

Time of day cycles slowly (or player can scrub it via a slider) so all biomes can be seen in different lighting.

## Vehicle & Driving

- **Realistic simulation** using Rapier's raycast vehicle controller: weight transfer, suspension, individual wheel friction, traction loss on dirt vs asphalt, handbrake drift
- Engine RPM model with audio that pitches with revs, gear shifts, turbo whistle
- Damage/dirt buildup on car body over time
- Three vehicle choices: sports coupe, off-road truck, muscle car (different handling profiles)

## Stunt / Combat Layer

- **Ramps and jumps** scattered through each biome with airtime detection and slow-mo replay
- **Destructible props**: barrels, crates, road signs, fences that shatter on impact
- **Explosive barrels** with shockwave + screen shake
- **Score system** for big air, near-misses, drift chains, destruction combos

## Camera System

Toggleable with a key/button:
- Chase cam (smoothed spring follow, FOV widens with speed)
- Hood cam
- Cockpit cam (interior visible)
- Cinematic free cam (auto-frames the action with DoF)

## UI / HUD

- Minimal HUD: speedometer + tachometer (analog gauges, bottom corner), gear indicator, mini-map
- Pause menu with vehicle select, biome teleport, time-of-day slider, graphics quality presets (Low/Med/High/Ultra) so weaker devices stay playable
- Photo mode: freeze time, free camera, hide HUD, adjustable DoF & exposure, save screenshot

## Controls

- **Keyboard**: WASD/arrows drive, Space handbrake, Shift boost, C cycle camera, R reset car, P photo mode
- **Gamepad** support (analog steering & throttle for proper sim feel)
- Touch controls on mobile (on-screen wheel + pedals)

## Performance Strategy

- Frustum culling, LOD on vegetation and distant buildings
- Instanced meshes everywhere repeatable
- Quality presets default to Medium; auto-detect mobile and drop settings
- Shadow cascade count and post-FX toggleable

## Build Order

1. Three.js + R3F + Rapier scaffold, basic terrain, sky, sun, tone mapping
2. Car model + raycast vehicle physics + chase camera
3. First biome (coastal road) fully dressed with PBR materials and post-FX
4. Camera system + HUD + controls (keyboard/gamepad/touch)
5. Remaining biomes stitched in, time-of-day cycle
6. Stunts: ramps, destructibles, scoring, slow-mo
7. Photo mode, quality presets, polish pass

