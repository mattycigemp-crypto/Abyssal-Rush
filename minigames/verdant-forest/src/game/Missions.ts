// Lightweight mission / objective tracker.
import * as THREE from 'three';
import type { UI } from './UI';

export interface Mission {
  id: string;
  title: string;
  description: string;
  check: () => boolean;
  onComplete?: () => void;
}

export class MissionSystem {
  private queue: Mission[] = [];
  private current: Mission | null = null;
  private ui: UI;
  onAllComplete?: () => void;

  constructor(ui: UI) { this.ui = ui; }

  queueMission(m: Mission) { this.queue.push(m); if (!this.current) this.advance(); }

  private advance() {
    const next = this.queue.shift();
    if (!next) {
      this.current = null;
      this.ui.setObjective('The valley rests quietly.');
      if (this.onAllComplete) this.onAllComplete();
      return;
    }
    this.current = next;
    this.ui.setObjective(next.description);
    this.ui.flashToast(`New Quest · ${next.title}`);
  }

  currentMission() { return this.current; }

  update() {
    if (this.current && this.current.check()) {
      const done = this.current;
      this.ui.flashToast(`Quest Complete · ${done.title}`);
      if (done.onComplete) done.onComplete();
      this.advance();
    }
  }
}

// Helper used by missions.
export function withinRange(a: THREE.Vector3, b: THREE.Vector3, r: number): boolean {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz < r * r;
}
