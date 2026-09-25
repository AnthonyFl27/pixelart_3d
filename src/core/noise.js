// Generación pseudoaleatoria reproducible: PRNG con semilla y ruido de valor 2D.

// PRNG mulberry32: devuelve una función que genera números en [0, 1).
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deriva una semilla distinta para cada uso a partir de la semilla global.
export function deriveSeed(seed, salt) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

const TABLE_SIZE = 256;

// Ruido de valor 2D en [0, 1]. Con `period` el ruido se repite (texturas sin costuras).
export class ValueNoise2D {
  constructor(seed) {
    const random = createRandom(seed);
    this.values = new Float32Array(TABLE_SIZE);
    this.perm = new Uint8Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) {
      this.values[i] = random();
      this.perm[i] = i;
    }
    for (let i = TABLE_SIZE - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
  }

  // period: número (igual en ambos ejes) o [periodoX, periodoY].
  lattice(ix, iy, period) {
    if (period) {
      const px = Array.isArray(period) ? period[0] : period;
      const py = Array.isArray(period) ? period[1] : period;
      ix = ((ix % px) + px) % px;
      iy = ((iy % py) + py) % py;
    }
    const p = this.perm;
    return this.values[p[(p[ix & 255] + iy) & 255]];
  }

  noise(x, y, period = 0) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const a = this.lattice(ix, iy, period);
    const b = this.lattice(ix + 1, iy, period);
    const c = this.lattice(ix, iy + 1, period);
    const d = this.lattice(ix + 1, iy + 1, period);

    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  }

  // Suma de octavas normalizada a [0, 1]. Cada octava dobla frecuencia y periodo.
  fbm(x, y, { octaves = 4, lacunarity = 2, gain = 0.5, period = 0 } = {}) {
    let sum = 0;
    let amplitude = 1;
    let total = 0;
    let frequency = 1;
    for (let i = 0; i < octaves; i++) {
      const scaled = Array.isArray(period) ? [period[0] * frequency, period[1] * frequency] : period * frequency;
      sum += this.noise(x * frequency, y * frequency, period ? scaled : 0) * amplitude;
      total += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / total;
  }
}
