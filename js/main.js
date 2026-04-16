/**
 * Abyssal Rush: Deep Dive - Entry Point
 * 
 * Controls:
 * - Arrows/WASD: Move
 * - Space/Z: Jump
 * - X/Shift: Dash
 * - P/Escape: Pause
 */

// Setup canvas and context
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// Bind input
Input.bind();

// Main game loop
let lastTime = performance.now();
let accumulator = 0;
const TIME_STEP = 1000 / 60;

function frame(time) {
  let dt = time - lastTime;
  lastTime = time;
  if (dt > 250) dt = 250;

  accumulator += dt;
  while (accumulator >= TIME_STEP) {
    GameState.update();
    accumulator -= TIME_STEP;
  }

  GameState.draw(ctx);
  requestAnimationFrame(frame);
}

// Start the game
requestAnimationFrame(frame);

console.log('🌊 ABYSSAL RUSH: DEEP DIVE - Game started!');
console.log('Controls: Arrows/WASD = Move | Space/Z = Jump | X/Shift = Dash | P = Pause');
