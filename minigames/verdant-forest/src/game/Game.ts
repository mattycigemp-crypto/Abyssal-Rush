// The Game orchestrates setup, the main loop, scene state, missions, and cutscenes.
import * as THREE from 'three';
import { World, terrainHeight } from './World';
import { Player } from './Player';
import { Wisp } from './Enemy';
import { Input } from './Input';
import { ThirdPersonCamera } from './Camera';
import { UI } from './UI';
import { AudioSys } from './Audio';
import { CutscenePlayer, type CutsceneSpec } from './Cutscene';
import { MissionSystem, withinRange } from './Missions';
import { Particles } from './Particles';

type GameState = 'title' | 'intro' | 'playing' | 'paused' | 'cutscene' | 'ending';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private timer = new (THREE as any).Timer();
  private canvas: HTMLCanvasElement;

  private world: World;
  private player: Player;
  private enemies: Wisp[] = [];
  private deepGroveEnemies = new Set<Wisp>();
  private deepGroveSpawned = false;
  private input: Input;
  private camera: ThirdPersonCamera;
  private ui: UI;
  private audio = new AudioSys();
  private cutscene: CutscenePlayer;
  private missions: MissionSystem;
  private particles: Particles;

  private state: GameState = 'title';
  // Day/night cycle: 0..1 over 6 real minutes. Start near dawn.
  private dayT = 0.2;
  private dayDuration = 360; // seconds for a full cycle
  private footstepAccum = 0;
  private enemiesKilled = 0;
  private deepWispsKilled = 0;
  private freeRoam = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.ui = new UI();
    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.player.position.set(0, terrainHeight(0, 6) + 0, 6);
    this.player.facing = Math.PI; // face the well
    this.input = new Input(canvas);
    this.camera = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
    this.cutscene = new CutscenePlayer(this.ui, this.camera);
    this.missions = new MissionSystem(this.ui);
    this.particles = new Particles(this.scene);

    this.particles.spawnFireflies(60);

    window.addEventListener('resize', this.onResize);
    this.bindMenu();

    // Initial camera pose so the title screen backdrop has depth.
    this.camera.setPose(
      new THREE.Vector3(6, 5, 18),
      new THREE.Vector3(0, 1, 0)
    );

    this.applyDayState();
  }

  private bindMenu() {
    const start = document.getElementById('start-btn')!;
    const skip = document.getElementById('skip-intro-btn')!;
    const freeRoam = document.getElementById('free-roam-btn');
    const resume = document.getElementById('resume-btn')!;
    const quit = document.getElementById('quit-btn')!;
    const volume = document.getElementById('volume-slider') as HTMLInputElement;
    const sens = document.getElementById('sensitivity-slider') as HTMLInputElement;

    start.addEventListener('click', () => {
      this.audio.start();
      this.beginIntro();
    });
    skip.addEventListener('click', () => {
      this.audio.start();
      this.beginIntro(true);
    });
    if (freeRoam) {
      freeRoam.addEventListener('click', () => {
        this.audio.start();
        this.beginFreeRoam();
      });
    }
    resume.addEventListener('click', () => this.resume());
    quit.addEventListener('click', () => window.location.reload());
    volume.addEventListener('input', () => this.audio.setVolume(parseFloat(volume.value)));
    sens.addEventListener('input', () => this.input.setSensitivity(parseFloat(sens.value)));

    // Click canvas to regain pointer lock during play.
    this.canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestLock();
    });
  }

  private async beginIntro(skipIntro = false) {
    this.ui.showTitle(false);
    await this.ui.fadeOut(1000);
    // Position player & camera pre-intro.
    this.player.position.set(0, terrainHeight(0, 6), 6);
    this.player.facing = 0;
    this.camera.yaw = 0;
    this.camera.pitch = -0.15;
    // Fade in with letterbox.
    await this.ui.fadeIn(1200);

    if (skipIntro) {
      this.startGameplay();
      return;
    }

    // Build the intro cinematic: sweeping shots of the valley & well.
    const shrine = this.world.shrinePos;
    const well = this.world.villagePos;

    const intro: CutsceneSpec = {
      duration: 22,
      letterbox: true,
      keys: [
        // High sweeping shot over the valley
        {
          t: 0,
          pos: new THREE.Vector3(-60, 30, -40),
          look: new THREE.Vector3(0, 2, 0),
        },
        {
          t: 6,
          pos: new THREE.Vector3(-20, 12, 20),
          look: new THREE.Vector3(0, 1.5, 0),
        },
        // Low shot circling the well
        {
          t: 10,
          pos: new THREE.Vector3(well.x + 5, 1.6, well.z + 5),
          look: new THREE.Vector3(well.x, 1.3, well.z),
        },
        {
          t: 14,
          pos: new THREE.Vector3(well.x - 4, 2.0, well.z + 4),
          look: new THREE.Vector3(well.x, 1.3, well.z),
        },
        // Slow push toward the distant shrine
        {
          t: 17,
          pos: new THREE.Vector3(well.x, 4, well.z - 10),
          look: new THREE.Vector3(shrine.x, shrine.y + 2.5, shrine.z),
        },
        {
          t: 22,
          pos: new THREE.Vector3(well.x, 6, well.z - 25),
          look: new THREE.Vector3(shrine.x, shrine.y + 2.5, shrine.z),
        },
      ],
      dialogue: [
        { t: 1.5, speaker: 'Narrator', text: 'Long ago, the Verdant held its breath.', hold: 4 },
        { t: 7, speaker: 'Narrator', text: 'Its shrine fell silent. Its flame grew cold.', hold: 4.5 },
        { t: 13, speaker: 'Narrator', text: 'One traveler still remembers the old paths…', hold: 4 },
        { t: 18, speaker: 'Narrator', text: '…and you have come to light the embers once more.', hold: 4 },
      ],
      onComplete: () => this.startGameplay(),
    };
    this.state = 'intro';
    this.cutscene.play(intro);
  }

  private startGameplay() {
    this.state = 'playing';
    this.ui.showHUD(true);
    this.input.requestLock();
    // Queue missions.
    const shrine = this.world.shrinePos;
    const stones = this.world.ancientStonesPos;
    const well = this.world.villagePos;

    this.missions.queueMission({
      id: 'find-shrine',
      title: 'Find the Shrine of First Light',
      description: 'Travel northeast to find the old shrine.',
      check: () => withinRange(this.player.position, shrine, 6),
      onComplete: () => this.onReachShrine(),
    });
    this.missions.queueMission({
      id: 'clear-wisps',
      title: 'Cleanse the Grove',
      description: 'Defeat the three shadow-wisps lingering around the shrine.',
      check: () => this.enemiesKilled >= 3,
      onComplete: () => this.onGroveCleared(),
    });
    this.missions.queueMission({
      id: 'light-flame',
      title: 'Rekindle the Flame',
      description: 'Return to the brazier and press E to light it.',
      check: () => this.lightFlameReady,
      onComplete: () => this.onFlameLit(),
    });
    this.missions.queueMission({
      id: 'gather-moonpetals',
      title: 'Gather Moonpetals',
      description: 'Walk through 5 glowing moonpetals scattered across the valley.',
      check: () => this.world.moonpetalsCollected() >= 5,
      onComplete: () => {
        this.audio.playChime(5);
        this.ui.flashToast('The petals hum softly in your pack.');
      },
    });
    this.missions.queueMission({
      id: 'deep-grove-wisps',
      title: 'Shadows of the Deep Grove',
      description: 'Drive the shadow-wisps from the deep grove to the west.',
      check: () => this.deepWispsKilled >= 4,
      onComplete: () => {
        this.audio.playChime(7);
        this.ui.flashToast('The deep grove breathes again.');
      },
    });
    this.missions.queueMission({
      id: 'seek-ancient-stones',
      title: 'The Ancient Stones',
      description: 'Seek the ring of ancient stones to the southwest.',
      check: () => withinRange(this.player.position, stones, 5),
      onComplete: () => {
        this.audio.playChime(9);
        this.ui.flashToast('The stones remember you.');
      },
    });
    this.missions.queueMission({
      id: 'return-home',
      title: 'Return Home',
      description: 'Carry the news back to the well at the village.',
      check: () => withinRange(this.player.position, well, 4),
      onComplete: () => {
        this.audio.playChime(0);
        this.ui.flashToast('The well welcomes you home.');
      },
    });

    this.missions.onAllComplete = () => this.playEndingCutscene();
  }

  private beginFreeRoam() {
    this.freeRoam = true;
    // Skip any queued intro and drop straight into free play.
    this.ui.showTitle(false);
    this.state = 'playing';
    this.ui.showHUD(true);

    // Spawn all wisps across the map so roaming players have optional combat.
    this.world.enemySpawns.forEach((s) => {
      this.enemies.push(new Wisp(this.scene, s.clone()));
    });
    this.world.deepGroveSpawns.forEach((s) => {
      const w = new Wisp(this.scene, s.clone());
      this.enemies.push(w);
      this.deepGroveEnemies.add(w);
    });
    this.deepGroveSpawned = true;

    // Light the shrine flame for ambience — no objectives in this mode.
    this.world.lightShrineFlame();

    this.missions.onAllComplete = undefined;
    this.ui.setObjective('Free Roam — wander the Verdant Valley at your leisure.');
    this.ui.flashToast('Free Roam · explore freely', 3000);
    this.input.requestLock();
  }

  private lightFlameReady = false;

  private onReachShrine() {
    // Spawn enemies around the grove
    this.world.enemySpawns.forEach((s) => {
      this.enemies.push(new Wisp(this.scene, s.clone()));
    });
    // Quick reactive cutscene
    this.state = 'cutscene';
    this.cutscene.onEnd = () => { this.state = 'playing'; this.input.requestLock(); };
    const p = this.player.position;
    const spec: CutsceneSpec = {
      duration: 5.5,
      letterbox: true,
      keys: [
        { t: 0, pos: new THREE.Vector3(p.x + 4, p.y + 2, p.z + 4), look: this.world.shrinePos.clone().setY(p.y + 2) },
        { t: 3, pos: new THREE.Vector3(this.world.shrinePos.x + 6, this.world.shrinePos.y + 4, this.world.shrinePos.z + 6), look: this.world.shrinePos.clone().setY(this.world.shrinePos.y + 1.5) },
        { t: 5.5, pos: new THREE.Vector3(p.x, p.y + 3, p.z - 3), look: p.clone().setY(p.y + 1.5) },
      ],
      dialogue: [
        { t: 0.5, speaker: 'Traveler', text: 'The shrine… shadows cling to it still.', hold: 3.5 },
        { t: 3.8, speaker: 'Traveler', text: 'I must drive them out.', hold: 1.7 },
      ],
    };
    this.cutscene.play(spec);
  }

  private onGroveCleared() {
    this.lightFlameReady = false; // true after player interacts
    // small toast handled by mission system
  }

  private onFlameLit() {
    this.world.lightShrineFlame();
    this.audio.playChime(7);
    this.audio.playChime(12);
  }

  private async playEndingCutscene() {
    this.state = 'ending';
    this.input.releaseLock();
    const shrine = this.world.shrinePos;
    const spec: CutsceneSpec = {
      duration: 14,
      letterbox: true,
      keys: [
        { t: 0, pos: new THREE.Vector3(shrine.x + 5, shrine.y + 2.5, shrine.z + 5), look: shrine.clone().setY(shrine.y + 1.5) },
        { t: 5, pos: new THREE.Vector3(shrine.x, shrine.y + 6, shrine.z + 8), look: shrine.clone().setY(shrine.y + 2) },
        { t: 10, pos: new THREE.Vector3(shrine.x - 30, shrine.y + 25, shrine.z + 30), look: shrine.clone().setY(shrine.y + 2) },
        { t: 14, pos: new THREE.Vector3(shrine.x - 60, shrine.y + 60, shrine.z + 60), look: new THREE.Vector3(0, 0, 0) },
      ],
      dialogue: [
        { t: 0.8, speaker: 'Narrator', text: 'Petals gathered, stones remembered, shadows quieted.', hold: 3.8 },
        { t: 5, speaker: 'Narrator', text: 'The flame grew warm and steady against the dusk.', hold: 4 },
        { t: 10, speaker: 'Narrator', text: 'The Verdant breathed out — and was still.', hold: 4 },
      ],
      onComplete: () => this.showEnding(),
    };
    this.cutscene.play(spec);
  }

  private async showEnding() {
    await this.ui.fadeOut(2000);
    this.ui.showHUD(false);
    this.ui.setLetterbox(false);
    this.ui.showTitle(true);
    const title = document.querySelector('.game-title') as HTMLElement;
    const sub = document.querySelector('.game-subtitle') as HTMLElement;
    if (title) title.textContent = 'Embers, Restored';
    if (sub) sub.textContent = 'Thank you for walking with us.';
    const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    const skipBtn = document.getElementById('skip-btn') as HTMLButtonElement;
    if (startBtn) startBtn.textContent = 'Begin Again';
    if (skipBtn) skipBtn.style.display = 'none';
    await this.ui.fadeIn(1500);
    this.state = 'title';
  }

  private pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    this.ui.showPause(true);
  }

  private resume() {
    if (this.state !== 'paused') return;
    this.ui.showPause(false);
    this.state = 'playing';
    this.input.requestLock();
  }

  private onResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.setAspect(window.innerWidth / window.innerHeight);
  };

  private applyDayState() {
    const s = this.world.getTimeState(this.dayT);
    this.world.applyTimeState(s);
    this.ui.setTimeOfDay(s.label);
  }

  // Convert input + camera yaw to a world-space move vector in the xz plane.
  private readMove(): THREE.Vector3 {
    const i = this.input;
    const forward = new THREE.Vector3(-Math.sin(this.camera.yaw), 0, -Math.cos(this.camera.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const move = new THREE.Vector3();
    if (i.keys.has('KeyW')) move.add(forward);
    if (i.keys.has('KeyS')) move.sub(forward);
    if (i.keys.has('KeyA')) move.sub(right);
    if (i.keys.has('KeyD')) move.add(right);
    if (move.lengthSq() > 0) move.normalize();
    return move;
  }

  start() {
    const loop = (timestamp: number) => {
      requestAnimationFrame(loop);
      this.timer.update(timestamp);
      const dt = Math.min(0.05, this.timer.getDelta());
      this.tick(dt);
      this.renderer.render(this.scene, this.camera.camera);
    };
    requestAnimationFrame(loop);
    // Start without fade (title visible).
    this.ui.fadeIn(600);
  }

  private tick(dt: number) {
    this.input.beginFrame();
    const time = this.timer.getElapsed();

    // Advance day cycle (slower during cutscenes so lighting doesn't jump).
    const dayRate = this.state === 'playing' ? 1 : 0.25;
    this.dayT = (this.dayT + (dt / this.dayDuration) * dayRate) % 1;
    this.applyDayState();

    // ESC toggles pause (edge).
    if (this.input.escPressedEdge) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    // World ambience update
    this.world.update(dt, time);
    this.particles.update(dt, this.dayT);

    if (this.state === 'intro' || this.state === 'cutscene' || this.state === 'ending') {
      this.cutscene.update(dt);
      // Skip cutscene with space
      if (this.input.keys.has('Space') || this.input.leftPressedEdge) {
        // allow skipping after 1.5s min view
        if (this.cutscene.isActive() && time > 1.5) this.cutscene.skip();
      }
      this.input.endFrame();
      return;
    }

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    }

    this.input.endFrame();
  }

  private updatePlaying(dt: number) {
    // Camera look
    this.camera.addLook(this.input.mouseDX, this.input.mouseDY);

    // Player movement
    const move = this.readMove();
    const sprint = this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight');
    const wantsJump = this.input.keys.has('Space');
    this.player.update(move, wantsJump, sprint, dt, this.camera.yaw);

    // Footstep SFX
    if (move.lengthSq() > 0.1 && this.player.isGrounded) {
      this.footstepAccum += dt * (sprint ? 2.6 : 1.8);
      if (this.footstepAccum >= 1) {
        this.footstepAccum = 0;
        this.audio.playFootstep();
      }
    } else this.footstepAccum = 0;

    // Attack input
    if (this.input.leftPressedEdge) {
      this.player.startAttack();
      this.audio.playSwordSwing();
    }

    // Camera follow
    this.camera.update(this.player.position, dt);

    // Enemies update
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this.timer.getElapsed(), this.player.position, () => {
        this.player.damage(6);
        this.audio.playHit();
      });
    }

    // Attack hit resolution: when player is mid-swing & on hit frame.
    if (this.player.isSwinging() && this.player.attackHitFrame) {
      const origin = this.player.getAttackOrigin();
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.pos.x - origin.x;
        const dz = e.pos.z - origin.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 2.2 * 2.2) {
          const dead = e.hit(14, this.player.position);
          this.audio.playHit();
          this.particles.spawnHit(e.pos.clone());
          if (dead) {
            if (this.deepGroveEnemies.has(e)) this.deepWispsKilled++;
            else this.enemiesKilled++;
            this.audio.playChime(0);
          }
        }
      }
      // Consume the hit frame so each swing hits at most once.
      this.player.attackHitFrame = false;
    }

    // Interact: 'E' near brazier after grove cleared
    const curMission = this.missions.currentMission();
    if (curMission && curMission.id === 'light-flame') {
      const d2 =
        (this.player.position.x - this.world.shrinePos.x) ** 2 +
        (this.player.position.z - this.world.shrinePos.z) ** 2;
      if (d2 < 3 * 3) {
        this.ui.setTooltip('[E] Rekindle the brazier');
        if (this.input.interactPressedEdge) {
          this.lightFlameReady = true;
          this.ui.setTooltip(null);
        }
      } else {
        this.ui.setTooltip(null);
      }
    } else {
      this.ui.setTooltip(null);
    }

    // Spawn the deep grove wisps the first time the player ventures west
    // (or when the mission actively requires it).
    if (!this.deepGroveSpawned) {
      const needMission =
        curMission && curMission.id === 'deep-grove-wisps';
      const dg = this.world.deepGrovePos;
      const dgd2 =
        (this.player.position.x - dg.x) ** 2 +
        (this.player.position.z - dg.z) ** 2;
      if (needMission && dgd2 < 22 * 22) {
        this.world.deepGroveSpawns.forEach((s) => {
          const w = new Wisp(this.scene, s.clone());
          this.enemies.push(w);
          this.deepGroveEnemies.add(w);
        });
        this.deepGroveSpawned = true;
        this.ui.flashToast('Shadows stir in the deep grove…');
      }
    }

    // Moonpetal auto-pickup on proximity.
    const picked = this.world.collectMoonpetalAt(this.player.position);
    if (picked) {
      this.audio.playChime(3);
      const got = this.world.moonpetalsCollected();
      const total = this.world.moonpetalTotal();
      const needed = this.freeRoam ? total : 5;
      this.ui.flashToast(
        `Moonpetal collected · ${Math.min(got, needed)}/${needed}`,
        1600
      );
    }

    // HUD
    this.ui.setHealth(this.player.hp / this.player.maxHp);
    this.ui.setStamina(this.player.stamina / this.player.maxStamina);

    // Missions
    this.missions.update();

    // Death/respawn (soft): if hp reaches 0, heal and knock back to village (relaxing!).
    if (this.player.hp <= 0) {
      this.player.hp = this.player.maxHp;
      this.player.position.set(0, terrainHeight(0, 6), 6);
      this.ui.flashToast('You awaken by the well…', 2000);
    }
  }
}
