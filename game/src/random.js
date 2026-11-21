// Seeded random: mulberry32, small and deterministic, so a ?shot= scene
// renders the same floor speckle and coin glints on every run.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A number in [min, max) from a seeded stream.
export function seededRange(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one element of an array from a seeded stream.
export function seededPick(rng, items) {
  return items[Math.floor(rng() * items.length) % items.length];
}
