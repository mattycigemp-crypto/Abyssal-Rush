// Centralized input state: keyboard flags, mouse deltas, button edges.
export class Input {
  readonly keys = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  pointerLocked = false;
  leftDown = false;
  leftPressedEdge = false;
  rightDown = false;
  interactPressedEdge = false;
  escPressedEdge = false;

  private canvas: HTMLCanvasElement;
  private sensitivity = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setSensitivity(v: number) { this.sensitivity = v; }

  requestLock() {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  }

  releaseLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  // No-op retained for compatibility; edge flags are cleared at the END of the
  // frame so they survive input events that fire between frames (keydown and
  // mousedown are dispatched by the browser before the next RAF callback, so
  // clearing them at the start of tick would zero them before updatePlaying
  // has a chance to read them).
  beginFrame() {}

  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.leftPressedEdge = false;
    this.interactPressedEdge = false;
    this.escPressedEdge = false;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.code;
    if (!this.keys.has(k)) {
      if (k === 'KeyE') this.interactPressedEdge = true;
      if (k === 'Escape') this.escPressedEdge = true;
    }
    this.keys.add(k);
    // Prevent page scroll while playing
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(k)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX * this.sensitivity;
    this.mouseDY += e.movementY * this.sensitivity;
  };

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      if (!this.leftDown) this.leftPressedEdge = true;
      this.leftDown = true;
    } else if (e.button === 2) {
      this.rightDown = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.leftDown = false;
    if (e.button === 2) this.rightDown = false;
  };

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };
}
