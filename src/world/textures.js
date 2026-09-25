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
    planks: createPlankTexture('planks', CONFIG.textures.planks),
    shingles: createShingleTexture('shingles', CONFIG.textures.shingles),
    rustyMetal: createCorrugatedTexture('rustyMetal', CONFIG.textures.rustyMetal),
    lattice: createLatticeTexture('lattice', CONFIG.textures.lattice),
    dirtyGlass: createGlassTexture('dirtyGlass', CONFIG.textures.dirtyGlass),
    wallpaper: createWallpaperTexture('wallpaper', CONFIG.textures.wallpaper),
    fabric: createFabricTexture('fabric', CONFIG.textures.fabric),
    rug: createRugTexture('rug', CONFIG.textures.rug),
    iron: createPaletteTexture('iron', CONFIG.textures.iron),
    enamel: createPaletteTexture('enamel', CONFIG.textures.enamel),
    grain: createPaletteTexture('grain', CONFIG.textures.grain),
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

// Lienzo de `textures.size` texels con escritura por texel (x e y se repiten).
function createPixelCanvas() {
  const size = CONFIG.textures.size;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const wrap = (v) => ((v % size) + size) % size;
  return {
    size,
    canvas,
    put(x, y, [r, g, b], alpha = 255) {
      const offset = (wrap(y) * size + wrap(x)) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = alpha;
    },
    finish(name) {
      ctx.putImageData(image, 0, 0);
      return finishCanvasTexture(canvas, name);
    },
  };
}

// Juntas repartidas de forma cíclica en una fila de `size` texels (anchos en [min, max]).
function cyclicJoints(size, [min, max], random) {
  const joints = [];
  const start = Math.floor(random() * size);
  let x = start;
  do {
    joints.push(x % size);
    x += min + Math.floor(random() * (max - min + 1));
  } while (x - start < size - min);
  return joints.sort((a, b) => a - b);
}

// Tablas gastadas: filas de `rowHeight` texels, cada una con tablas de largo variable.
// La primera fila de texels de cada tabla es la sombra de la tabla de arriba y la
// última, el canto iluminado. Vetas horizontales, nudos y clavos junto a las juntas.
// Cada tabla de la cabaña muestra una sola fila (ver cabin.js).
function createPlankTexture(name, p) {
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const noise = new ValueNoise2D(seed);
  const colors = p.colors.map(hexToRgb);
  const top = colors.length - 1;
  const px = createPixelCanvas();
  const { size } = px;
  for (let y0 = 0; y0 < size; y0 += p.rowHeight) {
    const joints = cyclicJoints(size, p.boardLength, random);
    for (let j = 0; j < joints.length; j++) {
      const from = joints[j];
      const to = j + 1 < joints.length ? joints[j + 1] : joints[0] + size;
      const base = 1 + Math.floor(random() * (top - 1));
      const knot = random() < p.knots ? { x: from + 3 + Math.floor(random() * Math.max(1, to - from - 6)), y: y0 + 1 + Math.floor(random() * (p.rowHeight - 2)) } : null;
      const weathered = random() < p.weathering;
      for (let x = from; x < to; x++) {
        for (let y = y0; y < y0 + p.rowHeight; y++) {
          if (x === from || y === y0) {
            px.put(x, y, colors[0]);
            continue;
          }
          const [gx, gy] = p.grainFrequency;
          const grain = noise.fbm((x / size) * gx, (y / size) * gy, { octaves: 2, period: [gx, gy] }) - 0.5;
          let shade = base + Math.round(grain * 4 * p.grain + (random() - 0.5) * 0.8);
          if (y === y0 + p.rowHeight - 1) shade += 1;
          if (weathered) shade += 1;
          if (knot && Math.abs(x - knot.x) <= 1 && y === knot.y) shade = x === knot.x ? 0 : shade - 1;
          px.put(x, y, colors[THREE.MathUtils.clamp(shade, 1, top)]);
        }
      }
      // Clavos junto a las juntas.
      for (const nx of [from + 1, to - 2]) {
        if (random() < p.nails) px.put(nx, y0 + 1 + Math.floor(random() * (p.rowHeight - 2)), colors[0]);
      }
    }
  }
  return px.finish(name);
}

// Tablillas del tejado: hiladas de `rowHeight` texels con tablillas de ancho variable.
// Bajo el borde de cada hilada queda una línea de sombra; algunas tablillas faltan
// (hueco oscuro) o tienen musgo (`accent`).
function createShingleTexture(name, p) {
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const colors = p.colors.map(hexToRgb);
  const accent = hexToRgb(p.accent);
  const top = colors.length - 1;
  const px = createPixelCanvas();
  const { size } = px;
  for (let y0 = 0; y0 < size; y0 += p.rowHeight) {
    const joints = cyclicJoints(size, p.shingleWidth, random);
    for (let j = 0; j < joints.length; j++) {
      const from = joints[j];
      const to = j + 1 < joints.length ? joints[j + 1] : joints[0] + size;
      const roll = random();
      const missing = roll < p.missing;
      const mossy = !missing && roll < p.missing + p.accentChance;
      const base = 1 + Math.floor(random() * (top - 1));
      for (let x = from; x < to; x++) {
        for (let y = y0; y < y0 + p.rowHeight; y++) {
          const shadow = y === y0;
          const joint = x === from;
          if (missing) px.put(x, y, colors[0]);
          else if (shadow || joint) px.put(x, y, colors[shadow && joint ? 0 : 1]);
          else if (mossy && random() < 0.7) px.put(x, y, accent);
          else {
            // El borde inferior (culote) de la tablilla, más claro.
            const shade = base + (y === y0 + p.rowHeight - 1 ? 1 : 0) + (random() < 0.15 ? -1 : 0);
            px.put(x, y, colors[THREE.MathUtils.clamp(shade, 1, top)]);
          }
        }
      }
    }
  }
  return px.finish(name);
}

// Chapa ondulada oxidada: ondas verticales (columnas de `ribPeriod` texels con luz y
// sombra) y manchas de óxido estiradas hacia abajo (chorretones).
function createCorrugatedTexture(name, p) {
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const noise = new ValueNoise2D(seed);
  const metal = p.metal.map(hexToRgb);
  const rust = p.rust.map(hexToRgb);
  const ribShade = [0, 1, 2, 1];
  const px = createPixelCanvas();
  const { size } = px;
  const [fx, fy] = p.frequency;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rib = ribShade[Math.floor((x % p.ribPeriod) / p.ribPeriod * ribShade.length)];
      const stain = noise.fbm((x / size) * fx, (y / size) * fy, { octaves: 3, period: [fx, fy] }) + (random() - 0.5) * 0.12;
      if (stain > 1 - p.rustAmount) {
        const depth = THREE.MathUtils.clamp(Math.floor((stain - (1 - p.rustAmount)) / p.rustAmount * rust.length * 1.6), 0, rust.length - 1);
        px.put(x, y, rust[THREE.MathUtils.clamp(rust.length - 1 - depth + rib - 1, 0, rust.length - 1)]);
      } else {
        px.put(x, y, metal[THREE.MathUtils.clamp(rib + (random() < 0.08 ? -1 : 0), 0, metal.length - 1)]);
      }
    }
  }
  return px.finish(name);
}

// Celosía: listones diagonales cruzados (periodo `period`, ancho `slat`) sobre un fondo
// oscuro (el hueco bajo la cabaña). Opaca: no necesita transparencia.
function createLatticeTexture(name, p) {
  const random = createRandom(deriveSeed(CONFIG.seed, name));
  const colors = p.colors.map(hexToRgb);
  const gap = hexToRgb(p.gap);
  const px = createPixelCanvas();
  const { size } = px;
  const mod = (v) => ((v % p.period) + p.period) % p.period;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const over = mod(x + y);   // listón que queda por encima
      const under = mod(x - y);
      let shade = -1;
      if (over < p.slat) shade = over === 0 ? 2 : 1;
      else if (under < p.slat) shade = under === 0 && p.slat > 1 ? 1 : 0;
      if (shade < 0) px.put(x, y, gap);
      else px.put(x, y, colors[THREE.MathUtils.clamp(shade - (random() < 0.12 ? 1 : 0), 0, colors.length - 1)]);
    }
  }
  return px.finish(name);
}

// Cristal sucio: tinte translúcido con manchas de mugre casi opacas, chorretones
// verticales y reflejos diagonales de 1 texel.
function createGlassTexture(name, p) {
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const noise = new ValueNoise2D(seed);
  const tint = hexToRgb(p.tint);
  const grime = hexToRgb(p.grime);
  const highlight = hexToRgb(p.highlight);
  const px = createPixelCanvas();
  const { size } = px;
  const drips = Array.from({ length: size }, () => random() < p.drips);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dirt = noise.fbm((x / size) * 4, (y / size) * 4, { octaves: 3, period: 4 }) + (drips[x] ? 0.18 : 0) + (random() - 0.5) * 0.1;
      if (dirt > 1 - p.grimeAmount) px.put(x, y, grime, Math.round(p.grimeAlpha * 255));
      else if ((x + y) % p.highlightPeriod === 0 || (x + y) % p.highlightPeriod === 2) px.put(x, y, highlight, Math.round(p.highlightAlpha * 255));
      else px.put(x, y, tint, Math.round(p.alpha * 255));
    }
  }
  return px.finish(name);
}

// Papel pintado descolorido: rayas verticales suaves con un motivo pequeño repetido,
// manchas de humedad y desvaído hacia abajo.
function createWallpaperTexture(name, p) {
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const noise = new ValueNoise2D(seed);
  const [base, light, motif, stain] = p.colors.map(hexToRgb);
  const px = createPixelCanvas();
  const { size } = px;
  const motifShape = ['.#.', '###', '.#.'];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let color = x % p.stripe < 2 ? light : base;
      const mx = x % p.motifSpacing;
      const my = (y + (Math.floor(x / p.motifSpacing) % 2) * (p.motifSpacing / 2)) % p.motifSpacing;
      if (mx < 3 && my < 3 && motifShape[my][mx] === '#') color = motif;
      const damp = noise.fbm((x / size) * 4, (y / size) * 4, { octaves: 3, period: 4 });
      if (damp > 1 - p.stains || random() < 0.02) color = stain;
      px.put(x, y, color);
    }
  }
  return px.finish(name);
}

// Tela: trama de hilos (texels alternos) con ruido; se tiñe con el color de vértice.
function createFabricTexture(name, p) {
  const seed = deriveSeed(CONFIG.seed, name);
  const random = createRandom(seed);
  const noise = new ValueNoise2D(seed);
  const colors = p.colors.map(hexToRgb);
  const px = createPixelCanvas();
  const { size } = px;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const weave = (x + y) % 2;
      const wear = noise.fbm((x / size) * 4, (y / size) * 4, { octaves: 2, period: 4 });
      const shade = THREE.MathUtils.clamp(1 + weave + Math.round((wear - 0.5) * 2) - (random() < 0.05 ? 1 : 0), 0, colors.length - 1);
      px.put(x, y, colors[shade]);
    }
  }
  return px.finish(name);
}

// Alfombra: rombos concéntricos con periodo `period`, colores gastados.
function createRugTexture(name, p) {
  const random = createRandom(deriveSeed(CONFIG.seed, name));
  const colors = p.colors.map(hexToRgb);
  const px = createPixelCanvas();
  const { size } = px;
  const half = p.period / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs((x % p.period) - half + 0.5);
      const dy = Math.abs((y % p.period) - half + 0.5);
      const ring = Math.floor((dx + dy) / 2);
      let index = ring % colors.length;
      if (random() < p.wear) index = Math.max(0, index - 1);
      px.put(x, y, colors[index]);
    }
  }
  return px.finish(name);
}

// Array de texturas (una capa por nombre) para el material por capas: todas repiten
// y comparten tamaño. Las filas se invierten porque las texturas 3D no admiten flipY.
export function createLayeredTexture(textures, names) {
  const size = CONFIG.textures.size;
  const layerBytes = size * size * 4;
  const data = new Uint8Array(layerBytes * names.length);
  names.forEach((name, layer) => {
    const canvas = textures[name].image;
    const pixels = canvas.getContext('2d').getImageData(0, 0, size, size).data;
    for (let y = 0; y < size; y++) {
      const row = (size - 1 - y) * size * 4;
      data.set(pixels.subarray(row, row + size * 4), layer * layerBytes + y * size * 4);
    }
  });
  const texture = new THREE.DataArrayTexture(data, size, size, names.length);
  texture.name = 'layers';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
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
