// Canvas drawing for The Velvet Ledger: the manor floor, walls and cover,
// vision cones clipped by sight, guards and Wren, the HUD, and every screen.

import {
  TILE, COLS, ROWS, VIEW_W, VIEW_H,
  VISION_RANGE, VISION_HALF_ANGLE,
  COINS_PER_LEVEL, COLORS,
} from './config.js';
import { mulberry32 } from './random.js';
import { tileAt, isWallTile } from './levels.js';
import { lineOfSight, playerInBush, PLAYER_RADIUS, GUARD_RADIUS } from './world.js';

const TAU = Math.PI * 2;

// Deterministic floor speckle per wing, computed once and cached.
const speckleCache = new Map();
function speckleFor(levelIndex) {
  if (speckleCache.has(levelIndex)) return speckleCache.get(levelIndex);
  const rng = mulberry32(levelIndex * 7919 + 101);
  const dots = [];
  for (let i = 0; i < 260; i++) {
    dots.push({
      x: rng() * VIEW_W,
      y: rng() * VIEW_H,
      r: 0.6 + rng() * 1.6,
      a: 0.04 + rng() * 0.08,
    });
  }
  speckleCache.set(levelIndex, dots);
  return dots;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A guard's vision cone as a polygon: rays fanned across the cone, each
// marching until a wall stops it or the range runs out.
export function conePolygon(world, guard) {
  const pts = [{ x: guard.x, y: guard.y }];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = guard.facing - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / steps;
    let r = VISION_RANGE;
    for (let d = 8; d <= VISION_RANGE; d += 6) {
      const x = guard.x + Math.cos(a) * d;
      const y = guard.y + Math.sin(a) * d;
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (isWallTile(world.level, tx, ty)) {
        r = d - 6;
        break;
      }
    }
    pts.push({ x: guard.x + Math.cos(a) * r, y: guard.y + Math.sin(a) * r });
  }
  return pts;
}

function drawFloor(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(world.level, x, y);
      if (t === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
  }
  // Plank seams.
  ctx.strokeStyle = COLORS.floorLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE + 0.5, 0);
    ctx.lineTo(x * TILE + 0.5, VIEW_H);
    ctx.stroke();
  }
  for (const d of speckleFor(world.levelIndex * 31 + (world.seed || 1))) {
    ctx.fillStyle = `rgba(232, 224, 244, ${d.a})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }
  // A soft vignette so the lit middle reads as safe and the edges as dark.
  const grad = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawWalls(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (tileAt(world.level, x, y) !== '#') continue;
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(px, py, TILE, 4);
      ctx.fillStyle = COLORS.wallSide;
      ctx.fillRect(px, py + TILE - 3, TILE, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawCover(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = tileAt(world.level, x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (t === 'C') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.beginPath();
        ctx.moveTo(px + 4, py + 4);
        ctx.lineTo(px + TILE - 4, py + TILE - 4);
        ctx.moveTo(px + TILE - 4, py + 4);
        ctx.lineTo(px + 4, py + TILE - 4);
        ctx.stroke();
      } else if (t === 'B') {
        const cx = px + TILE / 2;
        const cy = py + TILE / 2;
        ctx.fillStyle = COLORS.bushDark;
        ctx.beginPath();
        ctx.arc(cx, cy, 19, 0, TAU);
        ctx.fill();
        ctx.fillStyle = COLORS.bush;
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 4, 10, 0, TAU);
        ctx.arc(cx + 7, cy - 6, 11, 0, TAU);
        ctx.arc(cx + 2, cy + 7, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = COLORS.bushLight;
        ctx.beginPath();
        ctx.arc(cx - 6, cy - 5, 4, 0, TAU);
        ctx.arc(cx + 8, cy - 7, 4.5, 0, TAU);
        ctx.arc(cx + 1, cy + 6, 3.5, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function drawLootAndExit(ctx, world) {
  // Exit: a glowing green door with a breathing light.
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 2.4);
  const glow = ctx.createRadialGradient(
    world.exit.x, world.exit.y, 6,
    world.exit.x, world.exit.y, 70 + pulse * 14,
  );
  glow.addColorStop(0, 'rgba(57, 229, 133, 0.45)');
  glow.addColorStop(1, 'rgba(57, 229, 133, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(world.exit.x - 84, world.exit.y - 84, 168, 168);
  ctx.fillStyle = COLORS.exitDark;
  roundRect(ctx, world.exit.x - 15, world.exit.y - 19, 30, 38, 4);
  ctx.fill();
  ctx.fillStyle = COLORS.exit;
  roundRect(ctx, world.exit.x - 11, world.exit.y - 15, 22, 30, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.exitDark;
  ctx.beginPath();
  ctx.arc(world.exit.x + 6, world.exit.y, 2.5, 0, TAU);
  ctx.fill();

  for (const coin of world.coins) {
    if (coin.taken) continue;
    const tw = 0.6 + 0.4 * Math.sin(world.time * 3 + coin.phase);
    ctx.fillStyle = 'rgba(242, 193, 78, 0.25)';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 14 + tw * 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.coinEdge;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 9, 0, TAU);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(coin.x - 3, coin.y - 3, 2.5, 0, TAU);
    ctx.fill();
  }
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const poly = conePolygon(world, guard);
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fillStyle =
      guard.state === 'chase' ? COLORS.coneChase
      : world.meter > 0.05 ? COLORS.coneAlert
      : COLORS.cone;
    ctx.fill();
    // The cone's rim, so the edge reads even where the fill is faint.
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawGuard(ctx, world, guard) {
  const x = guard.x;
  const y = guard.y;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 11, 13, 5, 0, 0, TAU);
  ctx.fill();
  // Cloaked body.
  ctx.fillStyle = COLORS.guard;
  ctx.beginPath();
  ctx.arc(x, y, GUARD_RADIUS, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.guardDark;
  ctx.beginPath();
  ctx.arc(x, y, GUARD_RADIUS - 5, 0, TAU);
  ctx.fill();
  // Facing tick: the direction the guard looks.
  ctx.strokeStyle = '#ffd7d7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(guard.facing) * 8, y + Math.sin(guard.facing) * 8);
  ctx.lineTo(x + Math.cos(guard.facing) * 17, y + Math.sin(guard.facing) * 17);
  ctx.stroke();
  // Alert marks: ? while investigating, ! while chasing.
  if (guard.state === 'chase' || guard.state === 'investigate') {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(guard.state === 'chase' ? '!' : '?', x, y - 24);
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  const x = p.x;
  const y = p.y;
  // Hidden in a bush: draw her dimmed, half-sunk in the leaves.
  const hidden = playerInBush(world);
  ctx.save();
  if (hidden) ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 11, 13, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, TAU);
  ctx.fill();
  ctx.fillStyle = COLORS.playerDark;
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS - 5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#d9fff8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(p.facing) * 8, y + Math.sin(p.facing) * 8);
  ctx.lineTo(x + Math.cos(p.facing) * 17, y + Math.sin(p.facing) * 17);
  ctx.stroke();
  ctx.restore();
  if (hidden) {
    ctx.fillStyle = 'rgba(232, 224, 244, 0.85)';
    ctx.font = '11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', x, y - 22);
  }
}

function drawThrownCoin(ctx, world) {
  if (world.thrown) {
    const c = world.thrown;
    const t = c.t / 0.35;
    const x = c.fromX + (c.toX - c.fromX) * t;
    const y = c.fromY + (c.toY - c.fromY) * t - Math.sin(t * Math.PI) * 26;
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.toX, c.toY, 10 + t * 8, 0, TAU);
    ctx.stroke();
  }
  if (world.landed) {
    const c = world.landed;
    ctx.strokeStyle = `rgba(242, 193, 78, ${Math.min(0.8, c.ttl / 3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 12, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, TAU);
    ctx.fill();
  }
}

function drawHud(ctx, world, game) {
  const taken = world.coins.filter((c) => c.taken).length;
  ctx.fillStyle = 'rgba(8, 6, 14, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, 34);
  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(world.level.name, 12, 18);
  ctx.textAlign = 'center';
  ctx.fillText(`SCORE ${game.score}`, 330, 18);
  ctx.fillText(`LOOT ${taken}/${world.coins.length}`, 450, 18);
  const mm = Math.floor(world.time / 60);
  const ss = Math.floor(world.time % 60).toString().padStart(2, '0');
  ctx.fillText(`${mm}:${ss}`, 545, 18);
  // Lives as hearts.
  ctx.textAlign = 'right';
  let hearts = '';
  for (let i = 0; i < 3; i++) hearts += i < game.lives ? '♥' : '♡';
  ctx.fillStyle = game.lives === 1 ? '#e5484d' : COLORS.hud;
  ctx.fillText(hearts, 660, 18);
  // Detection meter.
  const mx = 690;
  const mw = 150;
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('DETECTION', mx, 10);
  ctx.fillStyle = '#241d33';
  ctx.fillRect(mx, 16, mw, 10);
  const fill = world.meter;
  ctx.fillStyle = fill > 0.66 ? '#e5484d' : fill > 0.33 ? '#f2c14e' : '#39e585';
  if (fill > 0.01) ctx.fillRect(mx, 16, mw * fill, 10);
  ctx.strokeStyle = 'rgba(232,224,244,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 0.5, 16.5, mw, 10);
  // Coins left to throw.
  const left = COINS_PER_LEVEL - world.coinsThrown;
  ctx.fillStyle = COLORS.coin;
  ctx.textAlign = 'right';
  ctx.font = '13px Georgia, serif';
  ctx.fillText(`● × ${left}`, VIEW_W - 12, 18);
  // A thin hint line at the bottom of the screen.
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD move · Shift sneak · Click throw a coin · P pause · M mute · R restart',
    VIEW_W / 2, VIEW_H - 10,
  );
}

function overlayPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8, 6, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.fillText(title, VIEW_W / 2, 190);
  ctx.fillStyle = COLORS.hud;
  ctx.font = '18px Georgia, serif';
  let y = 250;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 30;
  }
}

export function drawTitle(ctx, world, game) {
  drawWorld(ctx, world, game);
  overlayPanel(ctx, 'THE VELVET LEDGER', [
    'Wren, courier-thief, has one night to lift the Ledger.',
    'Three wings. Three lives. Do not be seen.',
    '',
    'WASD / arrows — move      Shift — sneak',
    'Click — throw a coin      P — pause      M — mute      R — restart',
    '',
    'Press ENTER or click to begin',
  ], COLORS.title);
}

export function drawPause(ctx, world, game) {
  drawWorld(ctx, world, game);
  overlayPanel(ctx, 'PAUSED', ['Press P to keep sneaking.'], COLORS.hud);
}

export function drawCaught(ctx, world, game) {
  drawWorld(ctx, world, game);
  overlayPanel(ctx, 'CAUGHT!', [
    `A guard laid hands on Wren. Lives left: ${game.lives}.`,
    'Press ENTER to try this wing again.',
  ], '#e5484d');
}

export function drawClear(ctx, world, game) {
  drawWorld(ctx, world, game);
  overlayPanel(ctx, 'WING CLEAR', [
    `Loot ${game.wingLoot} coins  ·  Time bonus +${game.wingBonus}`,
    `Score ${game.score} — press ENTER for the next wing.`,
  ], COLORS.exit);
}

export function drawWin(ctx, world, game) {
  drawWorld(ctx, world, game);
  const total = Math.floor(game.totalTime);
  overlayPanel(ctx, 'THE LEDGER IS YOURS', [
    `Wren slips into the night with all three wings behind her.`,
    `Final score ${game.score}  ·  Total time ${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`,
    'Press ENTER to play again.',
  ], COLORS.title);
}

export function drawGameOver(ctx, world, game) {
  drawWorld(ctx, world, game);
  overlayPanel(ctx, 'THE MANOR WINS', [
    `Three lives spent. The Ledger stays in its vault.`,
    `Score ${game.score} — press ENTER to try again.`,
  ], '#e5484d');
}

// The full frame: floor, exit and loot, cones, cover, actors, HUD.
export function drawWorld(ctx, world, game) {
  drawFloor(ctx, world);
  drawLootAndExit(ctx, world);
  drawCones(ctx, world);
  drawCover(ctx, world);
  drawThrownCoin(ctx, world);
  for (const guard of world.guards) drawGuard(ctx, world, guard);
  drawPlayer(ctx, world);
  drawHud(ctx, world, game);
}
