/**
 * mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Returns a closure that yields numbers in [0, 1).
 *
 * We use this instead of Math.random() so each player's card is
 * reproducible from the same (seed, playerId) pair — a card can be rebuilt
 * from the game seed rather than stored square by square.
 *
 * Private: `seededRng` is the only way in, so the two halves cannot be
 * combined wrongly at a call site.
 */
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash — converts an arbitrary string seed into a 32-bit integer
 * suitable for mulberry32. Deterministic across platforms.
 */
function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0; // FNV-1a offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Convenience: get a seeded RNG from a string */
export function seededRng(seed: string): () => number {
  return mulberry32(hashSeed(seed));
}
