// Simple cutscene engine: a timeline of keyframes that tween camera pose and
// trigger dialogue lines. Runs independent of the normal game update.
import * as THREE from 'three';
import type { UI } from './UI';
import type { ThirdPersonCamera } from './Camera';

export interface CamKey {
  t: number; // seconds into cutscene
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface DialogueLine {
  t: number;
  speaker: string;
  text: string;
  hold: number; // seconds to stay visible
}

export interface CutsceneSpec {
  duration: number;
  keys: CamKey[];
  dialogue: DialogueLine[];
  onComplete?: () => void;
  letterbox: boolean;
}

export class CutscenePlayer {
  private ui: UI;
  private cam: ThirdPersonCamera;
  private running = false;
  private spec: CutsceneSpec | null = null;
  private startedAt = 0;
  private skipOffset = 0;
  private elapsed = 0;
  private shownLines = new Set<number>();
  private dialogueHideAt = -1;
  onEnd?: () => void;

  constructor(ui: UI, cam: ThirdPersonCamera) {
    this.ui = ui;
    this.cam = cam;
  }

  isActive() { return this.running; }

  play(spec: CutsceneSpec) {
    this.spec = spec;
    this.startedAt = performance.now() / 1000;
    this.skipOffset = 0;
    this.elapsed = 0;
    this.shownLines.clear();
    this.dialogueHideAt = -1;
    this.running = true;
    if (spec.letterbox) this.ui.setLetterbox(true);
  }

  skip() {
    if (!this.running || !this.spec) return;
    this.skipOffset = this.spec.duration + 1;
  }

  update(_dt: number) {
    if (!this.running || !this.spec) return;
    // Use wall-clock time so timing is robust to RAF throttling when the tab
    // is backgrounded or framerate drops.
    this.elapsed = performance.now() / 1000 - this.startedAt + this.skipOffset;

    // Interpolate camera pose along keyframes.
    const keys = this.spec.keys;
    if (keys.length > 0) {
      let a = keys[0];
      let b = keys[keys.length - 1];
      for (let i = 0; i < keys.length - 1; i++) {
        if (this.elapsed >= keys[i].t && this.elapsed <= keys[i + 1].t) {
          a = keys[i];
          b = keys[i + 1];
          break;
        }
      }
      const span = Math.max(0.0001, b.t - a.t);
      const raw = Math.max(0, Math.min(1, (this.elapsed - a.t) / span));
      const f = raw * raw * (3 - 2 * raw); // smoothstep
      const pos = a.pos.clone().lerp(b.pos, f);
      const look = a.look.clone().lerp(b.look, f);
      this.cam.setPose(pos, look);
    }

    // Dialogue lines.
    this.spec.dialogue.forEach((line, i) => {
      if (!this.shownLines.has(i) && this.elapsed >= line.t) {
        this.shownLines.add(i);
        this.ui.showDialogue(line.speaker, line.text);
        this.dialogueHideAt = this.elapsed + line.hold;
      }
    });
    if (this.dialogueHideAt > 0 && this.elapsed >= this.dialogueHideAt) {
      this.ui.hideDialogue();
      this.dialogueHideAt = -1;
    }

    if (this.elapsed >= this.spec.duration) {
      this.running = false;
      this.ui.setLetterbox(false);
      this.ui.hideDialogue();
      const done = this.spec.onComplete;
      this.spec = null;
      if (done) done();
      if (this.onEnd) this.onEnd();
    }
  }
}
