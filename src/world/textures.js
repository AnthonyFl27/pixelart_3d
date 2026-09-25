import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';

// Texturas pixel art generadas en un <canvas> con paleta limitada.
// Todas son repetibles (sin costuras) y usan filtrado nearest sin mipmaps.

export function createTextures() {
  return {
    stone: createPaletteTexture('stone', CONFIG.textures.stone),
    wetStone: createPaletteTexture('wetStone', CONFIG.textures.wetStone),
    grass: createPaletteTexture('grass', CONFIG.textures.grass),
    dirt: createPaletteTexture('dirt', CONFIG.textures.dirt),
    bark: createPaletteTexture('bark', CONFIG.textures.bark),
    leaves: createPaletteTexture('leaves', CONFIG.textures.leaves),
    mud: createPaletteTexture('mud', CONFIG.textures.mud),
    gravel: createPaletteTexture('gravel', CONFIG.textures.gravel),
    moss: createPaletteTexture('moss', CONFIG.textures.moss),
    leavesAutumn: createPaletteTexture('leavesAutumn', CONFIG.textures.leavesAutumn),
    wood: createPaletteTexture('wood', CONFIG.textures.wood),
    masonry: createMasonryTexture('masonry', CONFIG.textures.masonry),
    noise: createNoiseTexture('noise', CONFIG.textures.noise),
  };
}

// Ruido fbm repetible en escala de grises, con filtrado lineal (nubes, bordes).
function createNoiseTexture(name, { size, frequency, octaves }) {
  const noise = new ValueNoise2D(deriveSeed(CONFIG.seed, name));
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = noise.fbm((x / size) * frequency, (y / size) * frequency, { octaves, period: frequency });
      data[y * size + x] = Math.round(v * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.name = name;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

// Cada texel = color de la paleta elegido por ruido fbm (manchas) + ruido blanco (grano),
// más motas claras/oscuras ocasionales. `frequency` puede ser [fx, fy] (vetas de madera).
function createPaletteTexture(name, params) {
  const size = CONFIG.textures.size;
  const seed = deriveSeed(CONFIG.seed, name);
  const noise = new ValueNoise2D(seed);
  const random = createRandom(seed);
  const colors = params.colors.map(hexToRgb);
  const { frequency, octaves, blotchWeight, speckleLight, speckleDark } = params;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [fx, fy] = Array.isArray(frequency) ? frequency : [frequency, frequency];
      const blotch = noise.fbm((x / size) * fx, (y / size) * fy, { octaves, period: [fx, fy] });
      let v = blotch * blotchWeight + random() * (1 - blotchWeight);

      const r = random();
      if (r < speckleLight) v = 1;
      else if (r < speckleLight + speckleDark) v = 0;

      const index = Math.min(colors.length - 1, Math.max(0, Math.floor(v * colors.length)));
      const [cr, cg, cb] = colors[index];
      const offset = (y * size + x) * 4;
      image.data[offset] = cr;
      image.data[offset + 1] = cg;
      image.data[offset + 2] = cb;
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return finishCanvasTexture(canvas, name);
}

// Mampostería: hiladas de bloques de anchura variable separados por mortero oscuro.
// Las juntas se reparten de forma cíclica en cada hilada para que la textura se repita.
function createMasonryTexture(name, params) {
  const size = CONFIG.textures.size;
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const noise = new ValueNoise2D(seed);
  const colors = params.colors.map(hexToRgb);
  const mortar = hexToRgb(params.mortar);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const put = (x, y, [r, g, b]) => {
    const offset = (y * size + x) * 4;
    image.data[offset] = r;
    image.data[offset + 1] = g;
    image.data[offset + 2] = b;
    image.data[offset + 3] = 255;
  };

  // Alturas de hilada que suman exactamente `size`.
  const rows = [];
  let total = 0;
  while (total < size) {
    const [min, max] = params.rowHeight;
    let height = min + Math.floor(random() * (max - min + 1));
    if (size - total - height < min) height = size - total;
    rows.push(height);
    total += height;
  }
  let y0 = 0;
  for (const rowHeight of rows) {
    const joints = [];
    let x = Math.floor(random() * size);
    const start = x;
    do {
      joints.push(x % size);
      const [min, max] = params.blockWidth;
      x += min + Math.floor(random() * (max - min + 1));
    } while (x - start < size - params.blockWidth[0]);
    joints.sort((a, b) => a - b);
    for (let j = 0; j < joints.length; j++) {
      const from = joints[j];
      const to = j + 1 < joints.length ? joints[j + 1] : joints[0] + size;
      const base = Math.floor(random() * colors.length);
      for (let bx = from; bx < to; bx++) {
        for (let by = y0; by < y0 + rowHeight; by++) {
          const px = bx % size;
          if (bx === from || by === y0) {
            put(px, by, mortar);
            continue;
          }
          const n = noise.noise(px * 0.5, by * 0.5, size / 2) - 0.5 + (random() - 0.5) * params.grain;
          const shade = THREE.MathUtils.clamp(base + Math.round(n * 2), 0, colors.length - 1);
          // Borde inferior-derecho del bloque algo más oscuro (relieve).
          const edge = bx === to - 1 || by === y0 + rowHeight - 1;
          put(px, by, colors[Math.max(0, shade - (edge ? 1 : 0))]);
        }
      }
    }
    y0 += rowHeight;
  }
  ctx.putImageData(image, 0, 0);
  return finishCanvasTexture(canvas, name);
}

function finishCanvasTexture(canvas, name) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function hexToRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
