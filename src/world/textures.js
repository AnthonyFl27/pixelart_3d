import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';

// Texturas pixel art generadas en un <canvas> con paleta limitada.
// Todas son repetibles (sin costuras) y usan filtrado nearest sin mipmaps.

export function createTextures() {
  return {
    stone: createPaletteTexture('stone', CONFIG.textures.stone),
    grass: createPaletteTexture('grass', CONFIG.textures.grass),
    dirt: createPaletteTexture('dirt', CONFIG.textures.dirt),
  };
}

// Cada texel = color de la paleta elegido por ruido fbm (manchas) + ruido blanco (grano),
// más motas claras/oscuras ocasionales.
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
      const blotch = noise.fbm((x / size) * frequency, (y / size) * frequency, { octaves, period: frequency });
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
