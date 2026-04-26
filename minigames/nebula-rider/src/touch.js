// On-screen touch controls: virtual joystick (left) + fire/boost buttons (right).
// Reports steering axes into a provided Input instance and adds "buttons" (0 for
// fire, plus a boost flag exposed via touch.boosting()).
//
// Activation: shown when pointer is "coarse" (primary = touch) or when URL has
// ?touch=1, or via Settings (not persisted here — caller decides). The caller
// should call .setEnabled(true) to show the UI.

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.enabled = false;
    this.boostActive = false;
    this._joy = null;
    this._firePressed = false;

    this._buildDom();
    this._bind();
    this._onResize = () => this._layout();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this._layout();
  }

  _buildDom() {
    const wrap = document.createElement('div');
    wrap.id = 'touch-controls';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <div class="touch-zone left" data-zone="joy">
        <div class="touch-joy">
          <div class="touch-joy-base"></div>
          <div class="touch-joy-stick"></div>
        </div>
        <div class="touch-hint">STEER</div>
      </div>
      <div class="touch-zone right">
        <button type="button" class="touch-btn fire" aria-label="Fire">FIRE</button>
        <button type="button" class="touch-btn boost" aria-label="Boost">BOOST</button>
      </div>
    `;
    wrap.classList.add('hidden');
    document.body.appendChild(wrap);
    this.root = wrap;
    this.joyZone = wrap.querySelector('.touch-zone.left');
    this.joyBase = wrap.querySelector('.touch-joy-base');
    this.joyStick = wrap.querySelector('.touch-joy-stick');
    this.fireBtn = wrap.querySelector('.touch-btn.fire');
    this.boostBtn = wrap.querySelector('.touch-btn.boost');
  }

  _bind() {
    // --- Joystick ---
    const start = (e) => {
      e.preventDefault();
      const p = pointFrom(e);
      if (!p) return;
      this._joy = { id: p.id, cx: p.x, cy: p.y, dx: 0, dy: 0 };
      this._positionJoy(p.x, p.y, 0, 0);
    };
    const move = (e) => {
      if (!this._joy) return;
      const p = pointFromId(e, this._joy.id);
      if (!p) return;
      e.preventDefault();
      const maxR = Math.min(this.joyBase.offsetWidth, this.joyBase.offsetHeight) * 0.5 - 8;
      let dx = p.x - this._joy.cx;
      let dy = p.y - this._joy.cy;
      const len = Math.hypot(dx, dy);
      if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
      this._joy.dx = dx; this._joy.dy = dy;
      this._positionJoy(this._joy.cx, this._joy.cy, dx, dy);
      // Axes normalized to [-1, 1]
      const nx = dx / maxR; const ny = dy / maxR;
      this.input.setTouchAxes(nx, ny);
    };
    const end = (e) => {
      if (!this._joy) return;
      const p = pointFromId(e, this._joy.id);
      if (p == null && e.type !== 'touchend' && e.type !== 'touchcancel' && e.type !== 'pointerup' && e.type !== 'pointercancel') return;
      this._joy = null;
      this.input.setTouchAxes(0, 0);
      this._positionJoy(0, 0, 0, 0, true);
    };
    ['touchstart', 'pointerdown'].forEach((t) => this.joyZone.addEventListener(t, start, { passive: false }));
    ['touchmove', 'pointermove'].forEach((t) => window.addEventListener(t, move, { passive: false }));
    ['touchend', 'touchcancel', 'pointerup', 'pointercancel'].forEach((t) => window.addEventListener(t, end));

    // --- Fire button (press-and-hold) ---
    const fireDown = (e) => { e.preventDefault(); this._firePressed = true; this.input.setTouchFire(true); this.fireBtn.classList.add('active'); };
    const fireUp = (e) => { this._firePressed = false; this.input.setTouchFire(false); this.fireBtn.classList.remove('active'); };
    ['touchstart', 'pointerdown', 'mousedown'].forEach((t) => this.fireBtn.addEventListener(t, fireDown, { passive: false }));
    ['touchend', 'touchcancel', 'pointerup', 'pointercancel', 'mouseup', 'mouseleave'].forEach((t) => this.fireBtn.addEventListener(t, fireUp));

    // --- Boost button (toggle on press, hold on touch-hold) ---
    const boostDown = (e) => { e.preventDefault(); this.boostActive = true; this.boostBtn.classList.add('active'); };
    const boostUp = () => { this.boostActive = false; this.boostBtn.classList.remove('active'); };
    ['touchstart', 'pointerdown', 'mousedown'].forEach((t) => this.boostBtn.addEventListener(t, boostDown, { passive: false }));
    ['touchend', 'touchcancel', 'pointerup', 'pointercancel', 'mouseup', 'mouseleave'].forEach((t) => this.boostBtn.addEventListener(t, boostUp));
  }

  _positionJoy(cx, cy, dx, dy, recenter = false) {
    if (recenter) {
      // Dock base at default lower-left.
      this.joyBase.style.left = ''; this.joyBase.style.top = '';
      this.joyStick.style.left = ''; this.joyStick.style.top = '';
      this.joyBase.classList.remove('active');
      return;
    }
    const rect = this.joyZone.getBoundingClientRect();
    const lx = cx - rect.left;
    const ly = cy - rect.top;
    this.joyBase.style.left = `${lx}px`;
    this.joyBase.style.top = `${ly}px`;
    this.joyStick.style.left = `${lx + dx}px`;
    this.joyStick.style.top = `${ly + dy}px`;
    this.joyBase.classList.add('active');
  }

  _layout() { /* DOM is CSS-positioned; no JS layout needed */ }

  setEnabled(v) {
    this.enabled = !!v;
    this.root.classList.toggle('hidden', !this.enabled);
    if (!this.enabled) {
      this.input.setTouchAxes(0, 0);
      this.input.setTouchFire(false);
      this.boostActive = false;
    }
  }

  boosting() { return this.enabled && this.boostActive; }
}

// --- Pointer/touch event helpers ---
function pointFrom(e) {
  if (e.changedTouches && e.changedTouches.length) {
    const t = e.changedTouches[0];
    return { id: `t${t.identifier}`, x: t.clientX, y: t.clientY };
  }
  if (e.pointerId != null) return { id: `p${e.pointerId}`, x: e.clientX, y: e.clientY };
  return null;
}

function pointFromId(e, id) {
  if (e.changedTouches && id.startsWith('t')) {
    const key = Number(id.slice(1));
    for (const t of e.changedTouches) if (t.identifier === key) return { x: t.clientX, y: t.clientY };
    // fall through to touches for continuous moves
    if (e.touches) {
      for (const t of e.touches) if (t.identifier === key) return { x: t.clientX, y: t.clientY };
    }
    return null;
  }
  if (e.pointerId != null && id.startsWith('p')) {
    if (`p${e.pointerId}` === id) return { x: e.clientX, y: e.clientY };
  }
  return null;
}

export function isTouchLikely() {
  try {
    if (new URLSearchParams(window.location.search).get('touch') === '1') return true;
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  } catch (_) { return false; }
}
