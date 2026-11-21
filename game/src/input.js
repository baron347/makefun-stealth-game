// Keyboard and mouse: held keys for movement, edge-triggered presses for
// menus, and a click queue the game spends as coin throws.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const clicks = [];

  const MOVE_KEYS = {
    KeyW: [0, -1],
    ArrowUp: [0, -1],
    KeyS: [0, 1],
    ArrowDown: [0, 1],
    KeyA: [-1, 0],
    ArrowLeft: [-1, 0],
    KeyD: [1, 0],
    ArrowRight: [1, 0],
  };

  window.addEventListener('keydown', (e) => {
    if (e.code in MOVE_KEYS || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    clicks.push({ x, y });
  });

  // The movement vector from whatever is held, normalised.
  function moveVector() {
    let mx = 0;
    let my = 0;
    for (const code of held) {
      const v = MOVE_KEYS[code];
      if (!v) continue;
      mx += v[0];
      my += v[1];
    }
    const len = Math.hypot(mx, my);
    if (len < 0.01) return { mx: 0, my: 0 };
    return { mx: mx / len, my: my / len };
  }

  function sneak() {
    return held.has('ShiftLeft') || held.has('ShiftRight');
  }

  // True once per physical press; the game loop clears the set each frame.
  function wasPressed(code) {
    return pressed.has(code);
  }

  function consumeClick() {
    return clicks.shift() ?? null;
  }

  function endFrame() {
    pressed.clear();
  }

  return { moveVector, sneak, wasPressed, consumeClick, endFrame };
}
