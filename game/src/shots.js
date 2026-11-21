// Deterministic screenshot scenes: an autopilot plays the wing in fixed
// 1/60 s steps, so a ?shot= frame renders identically on every run.
//   start — five seconds of patrol, then the title over the live level
//   play  — nine seconds of autopilot toward the exit
//   end   — autopilot until the wing clears

import { TILE } from './config.js';
import { updateWorld, findPath, nearestBushTile } from './world.js';
import { tileAt } from './levels.js';

const DT = 1 / 60;
const IDLE = { mx: 0, my: 0, sneak: false, throwAt: null };

// One autopilot brain: a path to the nearest loot, then the exit; sneak near
// guards, duck into a bush when the meter climbs, flee a chasing guard.
function makeAutopilot(world) {
  const brain = {
    path: null,
    pathIndex: 0,
    hiding: false,
    hideTarget: null,
  };

  function replan() {
    const p = world.player;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    // Nearest loot still on the floor, else the exit.
    let goal = null;
    let goalDist = Infinity;
    for (const coin of world.coins) {
      if (coin.taken) continue;
      const cx = Math.floor(coin.x / TILE);
      const cy = Math.floor(coin.y / TILE);
      const d = Math.abs(cx - tx) + Math.abs(cy - ty);
      if (d < goalDist) {
        goalDist = d;
        goal = [cx, cy];
      }
    }
    if (!goal) {
      goal = [Math.floor(world.exit.x / TILE), Math.floor(world.exit.y / TILE)];
    }
    brain.path = findPath(world.level, tx, ty, goal[0], goal[1]);
    brain.pathIndex = 0;
  }

  function nearestGuard() {
    let best = null;
    let bestDist = Infinity;
    for (const guard of world.guards) {
      const d = Math.hypot(guard.x - world.player.x, guard.y - world.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = guard;
      }
    }
    return { guard: best, dist: bestDist };
  }

  function step() {
    const p = world.player;

    // Flee: a chasing guard close by means run the other way.
    const { guard, dist } = nearestGuard();
    if (guard && guard.state === 'chase' && dist < 110) {
      const dx = p.x - guard.x;
      const dy = p.y - guard.y;
      const len = Math.hypot(dx, dy) || 1;
      return { mx: dx / len, my: dy / len, sneak: false, throwAt: null };
    }

    // Hide: meter climbing means the nearest bush until it drains.
    if (brain.hiding) {
      if (world.meter < 0.15) {
        brain.hiding = false;
        brain.path = null;
      } else {
        return { mx: 0, my: 0, sneak: true, throwAt: null };
      }
    } else if (world.meter > 0.45) {
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      const bush = nearestBushTile(world.level, tx, ty);
      if (bush && tileAt(world.level, tx, ty) !== 'B') {
        brain.path = findPath(world.level, tx, ty, bush[0], bush[1]);
        brain.pathIndex = 0;
        brain.hiding = true;
      }
    }

    if (!brain.path || brain.pathIndex >= brain.path.length) replan();
    if (!brain.path || brain.path.length === 0) {
      return { mx: 0, my: 0, sneak: false, throwAt: null };
    }
    const target = brain.path[brain.pathIndex];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    if (Math.hypot(dx, dy) < 6) {
      brain.pathIndex += 1;
      return { mx: 0, my: 0, sneak: false, throwAt: null };
    }
    const len = Math.hypot(dx, dy);
    const sneak = nearestGuard().dist < 130;
    return { mx: dx / len, my: dy / len, sneak, throwAt: null };
  }

  return { step };
}

// Run the world forward with the autopilot for up to `seconds`, stopping
// early when the wing clears or Wren is caught.
export function runAutopilot(world, seconds) {
  const brain = makeAutopilot(world);
  const steps = Math.floor(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (world.status !== 'play') break;
    updateWorld(world, brain.step(), DT);
  }
}

// Run the world forward with Wren standing still (patrols keep moving).
export function runIdle(world, seconds) {
  const steps = Math.floor(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (world.status !== 'play') break;
    updateWorld(world, IDLE, DT);
  }
}

// Stage one named shot and say which screen it should render as.
export function stageShot(world, shot) {
  if (shot === 'start') {
    runIdle(world, 5);
    return 'title';
  }
  if (shot === 'play') {
    runAutopilot(world, 9);
    return 'play';
  }
  if (shot === 'end') {
    runAutopilot(world, 300);
    return world.status === 'clear' ? 'clear' : 'play';
  }
  return 'play';
}
