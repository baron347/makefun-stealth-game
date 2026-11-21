// The three wings of the manor. Legend for every map row (24 by 15):
//   '#' wall   '.' floor   'C' crate (blocks feet and sight)
//   'B' bush (hides Wren)   'o' loot coin (+100)   'E' glowing exit   'P' Wren
// Guard patrols are tile waypoints: a guard walks the loop, scans at each
// corner, and only ever walks axis-aligned legs over walkable tiles.

export const LEVELS = [
  {
    name: 'Wing 1 — The West Wing',
    sub: 'Two guards, four coins. Learn the patrols.',
    map: [
      '########################',
      '#P....#......o.........#',
      '#.....#................#',
      '#..B..#....####........#',
      '#.....#....#..#...o....#',
      '#.....#....#..#........#',
      '#..C.......#..#...B....#',
      '#.....####..#.....#....#',
      '#..........#.....#.....#',
      '#..o....#..#..C..#..E..#',
      '#.......#.....#.....#..#',
      '#..B....#.....#..o..#..#',
      '#.......#.....#.....#..#',
      '#....C..#..B..#.....#..#',
      '########################',
    ],
    guards: [
      { waypoints: [[2, 1], [5, 1], [5, 5], [2, 5]] },
      { waypoints: [[17, 3], [21, 3], [21, 6], [17, 6]] },
    ],
  },
  {
    name: 'Wing 2 — The Gallery',
    sub: 'Three guards, five coins. The long hall is watched.',
    map: [
      '########################',
      '#P...#....o.....#......#',
      '#....#.............B...#',
      '#.B..#..####...#.......#',
      '#....#..#..#...#..o....#',
      '#....#..#..#...#.......#',
      '#.C.....#..#...#..##...#',
      '#......##..#...#.......#',
      '#....#.....#...#..B....#',
      '#.o..#..C..#...#.......#',
      '#....#.....#...#..##...#',
      '#..B..#..o..#......E...#',
      '#.....#.....#...#......#',
      '#..C..#..B..#...#..o...#',
      '########################',
    ],
    guards: [
      { waypoints: [[2, 9], [4, 9], [4, 12], [2, 12]] },
      { waypoints: [[14, 2], [14, 10]] },
      { waypoints: [[17, 8], [22, 8], [22, 12], [17, 12]] },
    ],
  },
  {
    name: 'Wing 3 — The Vault',
    sub: 'Four guards, six coins. The Ledger is behind the last door.',
    map: [
      '########################',
      '#P....#...o....#.......#',
      '#..B...........#..C....#',
      '#.....#..####..#.......#',
      '#..C..#..#..#..#..o....#',
      '#.....#..#..#..........#',
      '#.o...#..#..#..#..##...#',
      '#.....####..#..#.......#',
      '#..B..#....#..#..B..o..#',
      '#..........#..#........#',
      '#..o..#..C.#..#..##....#',
      '#.....#....#..#..E.....#',
      '#..B..#....#..#........#',
      '#.....#..o.#..#..C.....#',
      '########################',
    ],
    guards: [
      { waypoints: [[2, 1], [5, 1], [5, 5], [2, 5]] },
      { waypoints: [[8, 1], [8, 6]] },
      { waypoints: [[20, 1], [22, 1], [22, 5], [20, 5]] },
      { waypoints: [[13, 8], [13, 13]] },
    ],
  },
];

// Tile helpers shared by the world and the autopilot.
export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= 24 || ty >= 15) return '#';
  return level.map[ty][tx];
}

export function isWallTile(level, tx, ty) {
  const t = tileAt(level, tx, ty);
  return t === '#' || t === 'C';
}

// Bushes and crates and walls are all walkable or not: only walls and crates
// stop feet. Bushes hide; everything else on the map is open floor.
export function isWalkableTile(level, tx, ty) {
  return !isWallTile(level, tx, ty);
}

// Find every tile holding a character (player start, exit, loot).
export function findTiles(level, ch) {
  const out = [];
  for (let y = 0; y < level.map.length; y++) {
    for (let x = 0; x < level.map[y].length; x++) {
      if (level.map[y][x] === ch) out.push([x, y]);
    }
  }
  return out;
}
