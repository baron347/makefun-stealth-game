// Tuning for The Velvet Ledger: every number the rules and the renderer share.

// Board geometry: one screen, 24 by 15 tiles of 40 px.
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 600

// Movement speeds, pixels per second.
export const WALK_SPEED = 150;
export const SNEAK_SPEED = 82;
export const PATROL_SPEED = 55;
export const CHASE_SPEED = 168;
export const INVESTIGATE_SPEED = 95;
export const RETURN_SPEED = 70;

// Vision: a guard sees this far, this wide, and only with a clear line.
export const VISION_RANGE = 185;
export const VISION_HALF_ANGLE = (35 * Math.PI) / 180;

// Detection meter: 0 hidden, 1 spotted. Fills while seen, drains while not.
export const DETECT_BASE_RATE = 0.55; // per second at the edge of the cone
export const DETECT_CLOSE_RATE = 2.3; // per second point blank
export const DETECT_DECAY_RATE = 0.45; // per second while unseen
export const SNEAK_DETECT_FACTOR = 0.45; // sneaking multiplies the fill rate
export const CHASE_LOSE_SIGHT_SECONDS = 3; // unseen this long ends a chase
export const BUSH_HIDE_DISTANCE = 55; // a guard closer than this still sees you in a bush
export const CATCH_DISTANCE = 26; // a chasing guard this close catches you

// Coin throws: 3 per wing, and who hears the clink.
export const COINS_PER_LEVEL = 3;
export const COIN_THROW_RANGE = 270; // how far Wren can throw
export const COIN_HEAR_RANGE = 280; // guards inside this walk to the coin
export const COIN_FLIGHT_SECONDS = 0.35;

// Scoring and lives.
export const LOOT_SCORE = 100;
export const LEVEL_PAR_SECONDS = 75;
export const TIME_BONUS_PER_SECOND = 5;
export const START_LIVES = 3;

// Guard patrol: how long a guard scans at the end of each patrol leg.
export const SCAN_SECONDS = 1.4;
export const INVESTIGATE_SCAN_SECONDS = 2.0;

// Palette: a dim manor at night, lit where it is safe.
export const COLORS = {
  floorA: '#221a2e',
  floorB: '#1d1626',
  floorLine: '#2c2340',
  wall: '#3b3350',
  wallTop: '#5a4d78',
  wallSide: '#241d33',
  crate: '#6b4a2b',
  crateEdge: '#8a6238',
  bush: '#1e4d2a',
  bushLight: '#2f7a3e',
  bushDark: '#14361d',
  coin: '#f2c14e',
  coinEdge: '#a97e1e',
  exit: '#39e585',
  exitDark: '#0f7a44',
  player: '#2dd4bf',
  playerDark: '#0f766e',
  guard: '#e5484d',
  guardDark: '#7f1d1d',
  cone: 'rgba(242, 193, 78, 0.20)',
  coneAlert: 'rgba(229, 72, 77, 0.30)',
  coneChase: 'rgba(229, 72, 77, 0.38)',
  hud: '#e8e0f4',
  hudDim: '#9b8fb8',
  title: '#f2c14e',
};
