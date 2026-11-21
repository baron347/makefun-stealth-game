// The Velvet Ledger: game loop, screens, scoring, and screenshot staging.
// Play is one wing at a time; Enter (or a click) moves between screens.

import {
  START_LIVES, LEVEL_PAR_SECONDS, TIME_BONUS_PER_SECOND, LOOT_SCORE,
} from './config.js';
import { LEVELS } from './levels.js';
import { createWorld, updateWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import {
  drawWorld, drawTitle, drawPause, drawCaught, drawClear, drawWin, drawGameOver,
} from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 1;

// The whole game: which screen, which wing, the score, the lives.
const game = {
  screen: 'title', // title | play | pause | caught | clear | win | gameover
  wingIndex: 0,
  world: null,
  score: 0,
  lives: START_LIVES,
  totalTime: 0,
  wingLoot: 0,
  wingBonus: 0,
  frozen: false,
};

function loadWing(index) {
  game.wingIndex = index;
  game.world = createWorld(LEVELS[index], index);
  game.world.seed = seed;
  game.wingLoot = 0;
  game.wingBonus = 0;
}

function newGame() {
  game.score = 0;
  game.lives = START_LIVES;
  game.totalTime = 0;
  loadWing(0);
  game.screen = 'title';
}

function wingTimeBonus(world) {
  const spare = LEVEL_PAR_SECONDS - world.time;
  return spare > 0 ? Math.round(spare) * TIME_BONUS_PER_SECOND : 0;
}

// What a world event means for the score and the sound.
function handleEvents() {
  for (const e of game.world.events) {
    if (e.type === 'loot') {
      game.score += LOOT_SCORE;
      audio.pickup();
    } else if (e.type === 'spotted') {
      audio.alert();
    } else if (e.type === 'clink') {
      audio.clink();
    } else if (e.type === 'step') {
      audio.step(e.who, e.x, game.world.player.x);
    }
  }
}

function onWingClear() {
  const world = game.world;
  game.wingLoot = world.coins.filter((c) => c.taken).length;
  game.wingBonus = wingTimeBonus(world);
  game.score += game.wingBonus;
  game.totalTime += world.time;
  audio.clear();
  if (game.wingIndex + 1 >= LEVELS.length) {
    game.screen = 'win';
  } else {
    game.screen = 'clear';
  }
}

function onCaught() {
  game.lives -= 1;
  game.totalTime += game.world.time;
  audio.caught();
  game.screen = game.lives <= 0 ? 'gameover' : 'caught';
}

// Enter, or a click anywhere, advances the current screen.
function advance() {
  audio.unlock();
  if (game.screen === 'title') {
    game.screen = 'play';
  } else if (game.screen === 'clear') {
    loadWing(game.wingIndex + 1);
    game.screen = 'play';
  } else if (game.screen === 'caught') {
    loadWing(game.wingIndex);
    game.screen = 'play';
  } else if (game.screen === 'win' || game.screen === 'gameover') {
    newGame();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - frame.last) / 1000 || 0.016);
  frame.last = now;

  if (input.wasPressed('KeyM')) audio.setMuted(!audio.isMuted());
  // One click per frame, spent once: a menu advance, or a coin throw in play.
  const clicked = input.consumeClick();
  if (input.wasPressed('Enter') && game.screen !== 'play' && game.screen !== 'pause') {
    advance();
  } else if (clicked && game.screen !== 'play' && game.screen !== 'pause') {
    advance();
  }
  if (game.screen === 'play') {
    if (input.wasPressed('KeyP')) {
      game.screen = 'pause';
    } else if (input.wasPressed('KeyR')) {
      loadWing(game.wingIndex);
    } else {
      const move = input.moveVector();
      updateWorld(game.world, {
        mx: move.mx,
        my: move.my,
        sneak: input.sneak(),
        throwAt: clicked,
      }, dt);
      handleEvents();
      if (game.world.status === 'clear') onWingClear();
      if (game.world.status === 'caught') onCaught();
    }
  } else if (game.screen === 'pause') {
    if (input.wasPressed('KeyP') || input.wasPressed('Enter')) game.screen = 'play';
  }

  draw();
  input.endFrame();
  if (!game.frozen) requestAnimationFrame(frame);
}
frame.last = 0;

function draw() {
  if (game.screen === 'title') drawTitle(ctx, game.world, game);
  else if (game.screen === 'pause') drawPause(ctx, game.world, game);
  else if (game.screen === 'caught') drawCaught(ctx, game.world, game);
  else if (game.screen === 'clear') drawClear(ctx, game.world, game);
  else if (game.screen === 'win') drawWin(ctx, game.world, game);
  else if (game.screen === 'gameover') drawGameOver(ctx, game.world, game);
  else drawWorld(ctx, game.world, game);
}

// A ?shot= scene is staged synchronously and drawn exactly once, so the
// frame a screenshot takes is deterministic: no loop, no wall clock.
function runShotMode(shot) {
  game.frozen = true;
  const screen = stageShot(game.world, shot);
  // Shot mode never runs the live event loop, so score the staged wing from
  // what the autopilot actually took.
  const taken = game.world.coins.filter((c) => c.taken).length;
  game.score = taken * LOOT_SCORE;
  if (screen === 'clear') {
    game.wingLoot = taken;
    game.wingBonus = wingTimeBonus(game.world);
    game.score += game.wingBonus;
    game.totalTime += game.world.time;
    game.screen = 'clear';
  } else {
    game.screen = screen;
  }
  draw();
}

newGame();
const shot = params.get('shot');
if (shot) {
  runShotMode(shot);
} else {
  requestAnimationFrame(frame);
}
