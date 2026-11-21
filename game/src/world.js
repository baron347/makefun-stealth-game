// Rules of The Velvet Ledger: movement, sight, detection, guards, coins.
// No DOM here on purpose, so the same code runs the live game, the
// screenshot autopilot, and a headless smoke test in Node.

import {
  TILE, COLS, ROWS,
  WALK_SPEED, SNEAK_SPEED, PATROL_SPEED, CHASE_SPEED,
  INVESTIGATE_SPEED, RETURN_SPEED,
  VISION_RANGE, VISION_HALF_ANGLE,
  DETECT_BASE_RATE, DETECT_CLOSE_RATE, DETECT_DECAY_RATE,
  SNEAK_DETECT_FACTOR, CHASE_LOSE_SIGHT_SECONDS,
  BUSH_HIDE_DISTANCE, CATCH_DISTANCE,
  COINS_PER_LEVEL, COIN_THROW_RANGE, COIN_HEAR_RANGE, COIN_FLIGHT_SECONDS,
  LOOT_SCORE, SCAN_SECONDS, INVESTIGATE_SCAN_SECONDS,
} from './config.js';
import { tileAt, isWallTile, isWalkableTile, findTiles } from './levels.js';

export const PLAYER_RADIUS = 14;
export const GUARD_RADIUS = 14;

const TAU = Math.PI * 2;

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function clampAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// Build a fresh wing: player, guards, loot, exit, meter, timers.
export function createWorld(level, levelIndex) {
  const [px, py] = findTiles(level, 'P')[0];
  const [ex, ey] = findTiles(level, 'E')[0];
  const start = tileCenter(px, py);
  const exit = tileCenter(ex, ey);
  const guards = level.guards.map((g) => {
    const [wx, wy] = g.waypoints[0];
    const first = tileCenter(wx, wy);
    return {
      x: first.x,
      y: first.y,
      waypoints: g.waypoints.map(([tx, ty]) => tileCenter(tx, ty)),
      wpIndex: 1 % g.waypoints.length,
      state: 'patrol', // patrol | scan | investigate | chase | return
      facing: 0,
      scanTimer: 0,
      scanDir: 1,
      loseSightTimer: 0,
      investigateTarget: null,
      stepAcc: 0,
    };
  });
  return {
    level,
    levelIndex,
    player: { x: start.x, y: start.y, facing: 0, sneaking: false, stepAcc: 0 },
    guards,
    coins: findTiles(level, 'o').map(([tx, ty]) => {
      const c = tileCenter(tx, ty);
      return { x: c.x, y: c.y, taken: false, phase: (tx * 7 + ty * 13) % 10 };
    }),
    exit: { x: exit.x, y: exit.y },
    meter: 0,
    time: 0,
    coinsThrown: 0,
    thrown: null, // a coin in flight {fromX, fromY, toX, toY, t}
    landed: null, // a landed coin marker {x, y, ttl}
    status: 'play', // play | clear | caught
    events: [],
  };
}

// A segment is clear when no sample point along it sits inside a wall tile.
export function lineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (isWallTile(level, tx, ty)) return false;
  }
  return true;
}

// Is Wren standing in a bush tile right now?
export function playerInBush(world) {
  const tx = Math.floor(world.player.x / TILE);
  const ty = Math.floor(world.player.y / TILE);
  return tileAt(world.level, tx, ty) === 'B';
}

// Does this guard see Wren? Range, cone, line of sight, and bushes hide
// Wren unless the guard is almost on top of her.
export function guardCanSee(world, guard) {
  const p = world.player;
  const dx = p.x - guard.x;
  const dy = p.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return { sees: false, dist };
  const angle = Math.atan2(dy, dx);
  if (Math.abs(clampAngle(angle - guard.facing)) > VISION_HALF_ANGLE) {
    return { sees: false, dist };
  }
  if (!lineOfSight(world.level, guard.x, guard.y, p.x, p.y)) {
    return { sees: false, dist };
  }
  if (playerInBush(world) && dist > BUSH_HIDE_DISTANCE) {
    return { sees: false, dist };
  }
  return { sees: true, dist };
}

// How fast the meter fills for a guard seeing Wren at this distance.
export function detectionRate(dist, sneaking) {
  const closeness = 1 - dist / VISION_RANGE;
  let rate = DETECT_BASE_RATE + (DETECT_CLOSE_RATE - DETECT_BASE_RATE) * closeness;
  if (sneaking) rate *= SNEAK_DETECT_FACTOR;
  return rate;
}

// Circle-vs-tile collision: slide along one axis at a time.
function tryMove(level, e, radius, dx, dy) {
  const nx = e.x + dx;
  if (!hitsWall(level, nx, e.y, radius)) e.x = nx;
  const ny = e.y + dy;
  if (!hitsWall(level, e.x, ny, radius)) e.y = ny;
}

function hitsWall(level, x, y, radius) {
  const x0 = Math.floor((x - radius) / TILE);
  const x1 = Math.floor((x + radius) / TILE);
  const y0 = Math.floor((y - radius) / TILE);
  const y1 = Math.floor((y + radius) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isWallTile(level, tx, ty)) return true;
    }
  }
  return false;
}

function moveToward(level, e, radius, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  tryMove(level, e, radius, (dx / dist) * step, (dy / dist) * step);
  return Math.hypot(tx - e.x, ty - e.y) < 2;
}

function faceToward(e, tx, ty) {
  e.facing = Math.atan2(ty - e.y, tx - e.x);
}

// One guard's brain: patrol legs with a scan at each corner, investigate a
// coin clink, chase a spotted Wren, give up after losing sight.
function updateGuard(world, guard, dt, anySeen) {
  const p = world.player;
  if (guard.state === 'scan') {
    guard.scanTimer -= dt;
    guard.facing += guard.scanDir * 0.9 * dt;
    if (guard.scanTimer <= 0) {
      guard.state = guard.investigateTarget ? 'investigate' : 'patrol';
    }
    return;
  }
  if (guard.state === 'patrol') {
    const target = guard.waypoints[guard.wpIndex];
    faceToward(guard, target.x, target.y);
    const arrived = moveToward(world.level, guard, GUARD_RADIUS, target.x, target.y, PATROL_SPEED, dt);
    guardStep(world, guard, dt);
    if (arrived) {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      guard.state = 'scan';
      guard.scanTimer = SCAN_SECONDS;
      guard.scanDir = guard.wpIndex % 2 === 0 ? 1 : -1;
    }
    return;
  }
  if (guard.state === 'investigate') {
    const t = guard.investigateTarget;
    if (!t) {
      guard.state = 'return';
      return;
    }
    faceToward(guard, t.x, t.y);
    const arrived = moveToward(world.level, guard, GUARD_RADIUS, t.x, t.y, INVESTIGATE_SPEED, dt);
    guardStep(world, guard, dt);
    if (arrived) {
      guard.investigateTarget = null;
      guard.state = 'scan';
      guard.scanTimer = INVESTIGATE_SCAN_SECONDS;
    }
    return;
  }
  if (guard.state === 'chase') {
    faceToward(guard, p.x, p.y);
    moveToward(world.level, guard, GUARD_RADIUS, p.x, p.y, CHASE_SPEED, dt);
    guardStep(world, guard, dt, true);
    if (!anySeen) {
      guard.loseSightTimer += dt;
      if (guard.loseSightTimer >= CHASE_LOSE_SIGHT_SECONDS) {
        guard.loseSightTimer = 0;
        guard.state = 'return';
      }
    } else {
      guard.loseSightTimer = 0;
    }
    return;
  }
  if (guard.state === 'return') {
    // Walk back to the nearest patrol waypoint, then resume the route.
    let best = 0;
    let bestDist = Infinity;
    guard.waypoints.forEach((w, i) => {
      const d = Math.hypot(w.x - guard.x, w.y - guard.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    guard.wpIndex = best;
    const target = guard.waypoints[guard.wpIndex];
    faceToward(guard, target.x, target.y);
    const arrived = moveToward(world.level, guard, GUARD_RADIUS, target.x, target.y, RETURN_SPEED, dt);
    guardStep(world, guard, dt);
    if (arrived) guard.state = 'patrol';
  }
}

function guardStep(world, guard, dt, running = false) {
  guard.stepAcc += (running ? CHASE_SPEED : PATROL_SPEED) * dt;
  const stride = running ? 34 : 40;
  if (guard.stepAcc >= stride) {
    guard.stepAcc -= stride;
    world.events.push({ type: 'step', who: 'guard', x: guard.x, y: guard.y });
  }
}

// Throw a coin: it arcs for a third of a second, lands, and every guard in
// earshot walks over to look.
function throwCoin(world, tx, ty) {
  if (world.coinsThrown >= COINS_PER_LEVEL || world.thrown) return false;
  const p = world.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist > COIN_THROW_RANGE || dist < 8) return false;
  world.coinsThrown += 1;
  world.thrown = { fromX: p.x, fromY: p.y, toX: tx, toY: ty, t: 0 };
  world.events.push({ type: 'throw', x: tx, y: ty });
  return true;
}

function landCoin(world) {
  const c = world.thrown;
  world.thrown = null;
  world.landed = { x: c.toX, y: c.toY, ttl: 6 };
  world.events.push({ type: 'clink', x: c.toX, y: c.toY });
  for (const guard of world.guards) {
    if (guard.state === 'chase') continue;
    const d = Math.hypot(guard.x - c.toX, guard.y - c.toY);
    if (d <= COIN_HEAR_RANGE) {
      guard.investigateTarget = { x: c.toX, y: c.toY };
      guard.state = 'investigate';
    }
  }
}

// Breadth-first path over walkable tiles, for the autopilot. Returns tile
// centers from the start tile to the goal tile, inclusive.
export function findPath(level, fromTx, fromTy, toTx, toTy) {
  if (!isWalkableTile(level, toTx, toTy)) return null;
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const queue = [[fromTx, fromTy]];
  prev.set(key(fromTx, fromTy), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === toTx && y === toTy) {
      const path = [];
      let cur = [x, y];
      while (cur) {
        path.unshift(tileCenter(cur[0], cur[1]));
        cur = prev.get(key(cur[0], cur[1]));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkableTile(level, nx, ny)) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return null;
}

export function nearestBushTile(level, tx, ty) {
  let best = null;
  let bestDist = Infinity;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tileAt(level, x, y) !== 'B') continue;
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d < bestDist) {
        bestDist = d;
        best = [x, y];
      }
    }
  }
  return best;
}

// One fixed step of the wing. `input` is {mx, my, sneak, throwAt}.
// Returns nothing; read world.status and world.events after.
export function updateWorld(world, input, dt) {
  if (world.status !== 'play') return;
  world.time += dt;
  world.events.length = 0;
  const p = world.player;

  // Move Wren, sneak on Shift.
  const speed = input.sneak ? SNEAK_SPEED : WALK_SPEED;
  p.sneaking = input.sneak;
  const len = Math.hypot(input.mx, input.my);
  if (len > 0.01) {
    const nx = input.mx / len;
    const ny = input.my / len;
    p.facing = Math.atan2(ny, nx);
    tryMove(world.level, p, PLAYER_RADIUS, nx * speed * dt, ny * speed * dt);
    p.stepAcc += speed * dt;
    if (p.stepAcc >= 30) {
      p.stepAcc -= 30;
      world.events.push({ type: 'step', who: 'player', x: p.x, y: p.y });
    }
  }

  // Coin throw, then the coin's flight.
  if (input.throwAt) throwCoin(world, input.throwAt.x, input.throwAt.y);
  if (world.thrown) {
    world.thrown.t += dt;
    if (world.thrown.t >= COIN_FLIGHT_SECONDS) landCoin(world);
  }
  if (world.landed) {
    world.landed.ttl -= dt;
    if (world.landed.ttl <= 0) world.landed = null;
  }

  // Who sees Wren? The closest seeing guard drives the meter.
  let seenBy = null;
  let seenDist = Infinity;
  for (const guard of world.guards) {
    const { sees, dist } = guardCanSee(world, guard);
    if (sees && dist < seenDist) {
      seenDist = dist;
      seenBy = guard;
    }
  }
  if (seenBy) {
    const before = world.meter;
    world.meter = Math.min(1, world.meter + detectionRate(seenDist, p.sneaking) * dt);
    if (before < 1 && world.meter >= 1) {
      world.events.push({ type: 'spotted', x: p.x, y: p.y });
    }
  } else {
    world.meter = Math.max(0, world.meter - DETECT_DECAY_RATE * dt);
  }

  // A full meter sends every guard that sees Wren into a chase.
  if (world.meter >= 1) {
    for (const guard of world.guards) {
      const { sees } = guardCanSee(world, guard);
      if (sees && guard.state !== 'chase') {
        guard.state = 'chase';
        guard.loseSightTimer = 0;
      }
    }
  }

  for (const guard of world.guards) updateGuard(world, guard, dt, seenBy !== null);

  // Caught: a chasing guard touches Wren.
  for (const guard of world.guards) {
    if (guard.state !== 'chase') continue;
    if (Math.hypot(guard.x - p.x, guard.y - p.y) < CATCH_DISTANCE) {
      world.status = 'caught';
      world.events.push({ type: 'caught', x: p.x, y: p.y });
      return;
    }
  }

  // Loot: touch a coin, take it.
  for (const coin of world.coins) {
    if (coin.taken) continue;
    if (Math.hypot(coin.x - p.x, coin.y - p.y) < 24) {
      coin.taken = true;
      world.events.push({ type: 'loot', x: coin.x, y: coin.y, score: LOOT_SCORE });
    }
  }

  // Exit: touch the glowing door, clear the wing.
  if (Math.hypot(world.exit.x - p.x, world.exit.y - p.y) < 30) {
    world.status = 'clear';
    world.events.push({ type: 'clear', x: world.exit.x, y: world.exit.y });
  }
}
