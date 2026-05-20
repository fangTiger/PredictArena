function xmur3(input: string): () => number {
  let h = 1_779_033_703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3_432_918_353);
    h = (h << 13) | (h >>> 19);
  }

  return () => {
    h = Math.imul(h ^ (h >>> 16), 2_246_822_507);
    h = Math.imul(h ^ (h >>> 13), 3_266_489_909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createSeededRandom(seed: string | number): () => number {
  const normalizedSeed = typeof seed === 'number' ? String(seed) : seed;
  const seedFactory = xmur3(normalizedSeed);
  return mulberry32(seedFactory());
}

export function randomNormal(rng: () => number): number {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = rng();
  }

  while (v === 0) {
    v = rng();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
