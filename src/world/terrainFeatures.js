import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';

// Relieve del terreno por capas: ruido base + lomas + micro-relieve + modificadores.
// Los modificadores ("features") son datos del nivel (`terrainFeatures`), caminos,
// tierra al pie de las estructuras y una capa procedural con semilla. Cada uno expone:
//   { minX, maxX, minZ, maxZ, detail: 'fine' | 'mid' | 'base' (resolución de malla que necesita),
//     height(x, z) -> desplazamiento vertical (u),
//     ground?: { layer: 'dirt' | 'mud' | 'gravel', weight(x, z) -> 0..1 } }
// `weight` vale 0,5 en el borde de la zona (ver groundMap.js).

const featureNoise = new ValueNoise2D(deriveSeed(CONFIG.seed, 'terrain-features'));

// Caída suave: 1 en el centro (t = 0), 0 desde t = 1.
export function bowl(t) {
  return t >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * Math.max(t, 0));
}

// Peso de suelo a partir de la distancia con signo al borde de la zona (< 0 dentro).
export function edgeWeight(distance) {
  return THREE.MathUtils.clamp(0.5 - distance / (2 * CONFIG.groundMap.range), 0, 1);
}

// Polilínea con ancho por punto (caminos, crestas, surcos, cauce).
// `query(x, z)` -> { distance, width, t (0-1 a lo largo), segment, u, x, z (punto más cercano) }.
// Con `cellSize` se construye un índice de segmentos por celdas: las consultas solo miran
// las celdas vecinas y devuelven distance = Infinity a más de `cellSize` de la línea.
export class Polyline {
  constructor(points, { cellSize = 0 } = {}) {
    this.points = points;
    this.lengths = [];
    this.offsets = [];
    this.total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const length = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
      this.lengths.push(length);
      this.offsets.push(this.total);
      this.total += length;
    }
    this.cellSize = cellSize;
    if (cellSize) this.buildIndex();
  }

  buildIndex() {
    this.cells = new Map();
    const key = (ix, iz) => ix * 73856093 ^ iz * 19349663;
    this.key = key;
    for (let i = 0; i < this.lengths.length; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const x0 = Math.floor(Math.min(a.x, b.x) / this.cellSize);
      const x1 = Math.floor(Math.max(a.x, b.x) / this.cellSize);
      const z0 = Math.floor(Math.min(a.z, b.z) / this.cellSize);
      const z1 = Math.floor(Math.max(a.z, b.z) / this.cellSize);
      for (let iz = z0; iz <= z1; iz++) {
        for (let ix = x0; ix <= x1; ix++) {
          const k = key(ix, iz);
          if (!this.cells.has(k)) this.cells.set(k, []);
          this.cells.get(k).push(i);
        }
      }
    }
  }

  candidates(x, z) {
    if (!this.cells) return null;
    const ix = Math.floor(x / this.cellSize);
    const iz = Math.floor(z / this.cellSize);
    const result = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = this.cells.get(this.key(ix + dx, iz + dz));
        if (list) result.push(...list);
      }
    }
    return result;
  }

  query(x, z) {
    const { points, lengths } = this;
    const list = this.candidates(x, z);
    let best = Infinity;
    let bestSegment = -1;
    let bestU = 0;
    const count = list ? list.length : lengths.length;
    for (let k = 0; k < count; k++) {
      const i = list ? list[k] : k;
      const a = points[i];
      const b = points[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const u = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (lengths[i] * lengths[i] || 1), 0, 1);
      const dx = x - (a.x + abx * u);
      const dz = z - (a.z + abz * u);
      const d2 = dx * dx + dz * dz;
      if (d2 < best) {
        best = d2;
        bestSegment = i;
        bestU = u;
      }
    }
    if (bestSegment < 0) return { distance: Infinity, width: 0, t: 0, segment: 0, u: 0, x, z };
    const a = points[bestSegment];
    const b = points[bestSegment + 1] ?? a;
    const aw = a.width ?? 1;
    const bw = b.width ?? aw;
    return {
      distance: Math.sqrt(best),
      width: aw + (bw - aw) * bestU,
      t: (this.offsets[bestSegment] + lengths[bestSegment] * bestU) / (this.total || 1),
      segment: bestSegment,
      u: bestU,
      x: a.x + (b.x - a.x) * bestU,
      z: a.z + (b.z - a.z) * bestU,
    };
  }

  distance(x, z) {
    return this.query(x, z).distance;
  }
}

// Deformación del contorno para que las formas no sean círculos perfectos.
export function irregular(x, z) {
  const { irregularity, irregularityScale } = CONFIG.terrain;
  return 1 + (featureNoise.noise(x * irregularityScale, z * irregularityScale) - 0.5) * 2 * irregularity;
}

function circleBounds(x, z, radius) {
  return { minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius };
}

function polylineBounds(points, margin) {
  let maxWidth = 0;
  for (const p of points) maxWidth = Math.max(maxWidth, p.width ?? 0);
  const pad = maxWidth + margin;
  return {
    minX: Math.min(...points.map((p) => p.x)) - pad,
    maxX: Math.max(...points.map((p) => p.x)) + pad,
    minZ: Math.min(...points.map((p) => p.z)) - pad,
    maxZ: Math.max(...points.map((p) => p.z)) + pad,
  };
}

export const FEATURE_TYPES = {
  // Hundimiento suave con fondo de tierra o barro. { x, z, radius, depth, ground? ('dirt' | 'mud' | null) }
  hollow({ x, z, radius = 5, depth = 0.6, ground = 'dirt' }) {
    const reach = radius * (1 + CONFIG.terrain.irregularity);
    return {
      ...circleBounds(x, z, reach),
      detail: 'mid',
      height: (px, pz) => -depth * bowl(Math.hypot(px - x, pz - z) / (radius * irregular(px, pz))),
      ground: ground && {
        layer: ground,
        weight: (px, pz) => edgeWeight(Math.hypot(px - x, pz - z) - radius * CONFIG.terrain.hollowGround * irregular(pz, px)),
      },
    };
  },

  // Montículo o loma elíptica. { x, z, radius | radiusX + radiusZ, height, rotationY? }
  mound({ x, z, radius = 6, radiusX = radius, radiusZ = radius, height = 1.5, rotationY = 0, ground = null }) {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    const reach = Math.max(radiusX, radiusZ) * (1 + CONFIG.terrain.irregularity);
    const local = (px, pz) => {
      const dx = px - x;
      const dz = pz - z;
      return Math.hypot((dx * cos - dz * sin) / radiusX, (dx * sin + dz * cos) / radiusZ) / irregular(px, pz);
    };
    return {
      ...circleBounds(x, z, reach),
      detail: 'base',
      height: (px, pz) => height * bowl(local(px, pz)),
      ground: ground && { layer: ground, weight: (px, pz) => edgeWeight((local(px, pz) - 0.45) * radiusX) },
    };
  },

  // Cresta alargada a lo largo de una polilínea. { points: [{ x, z }], width, height }
  ridge({ points, width = 4, height = 1.2 }) {
    const line = new Polyline(points);
    return {
      ...polylineBounds(points, width * (1 + CONFIG.terrain.irregularity)),
      detail: 'base',
      height: (px, pz) => height * bowl(line.distance(px, pz) / (width * irregular(px, pz))),
    };
  },

  // Surco seco. { points: [{ x, z }], width, depth, ground? }
  gully({ points, width = 2.5, depth = 0.6, ground = 'gravel' }) {
    const line = new Polyline(points);
    return {
      ...polylineBounds(points, width * (1 + CONFIG.terrain.irregularity)),
      detail: 'mid',
      height: (px, pz) => -depth * bowl(line.distance(px, pz) / (width * irregular(px, pz))),
      ground: ground && {
        layer: ground,
        weight: (px, pz) => edgeWeight(line.distance(px, pz) - width * CONFIG.terrain.gullyGround),
      },
    };
  },

  // Montón de tierra acumulada. { x, z, radius, height, ground? }
  dirtPile({ x, z, radius = 1.5, height = 0.25, ground = 'dirt', amount = 1 }) {
    return {
      ...circleBounds(x, z, radius * (1 + CONFIG.terrain.irregularity)),
      detail: 'mid',
      height: (px, pz) => height * bowl(Math.hypot(px - x, pz - z) / (radius * irregular(px, pz))),
      ground: ground && {
        layer: ground,
        weight: (px, pz) => edgeWeight(Math.hypot(px - x, pz - z) - radius * 0.75 * amount * irregular(pz, px)),
      },
    };
  },

  // Mancha de suelo sin relieve. { x, z, radius, ground }
  dirtPatch({ x, z, radius = 2, ground = 'dirt' }) {
    return {
      ...circleBounds(x, z, radius * (1 + CONFIG.terrain.irregularity) + CONFIG.groundMap.range),
      detail: 'base',
      height: () => 0,
      ground: { layer: ground, weight: (px, pz) => edgeWeight(Math.hypot(px - x, pz - z) - radius * irregular(px, pz)) },
    };
  },
};

// Camino de tierra: ligeramente hundido por el paso y con un reborde de tierra acumulada.
export function createPathFeature(path) {
  const { sink, berm, bermWidth } = CONFIG.paths;
  const points = path.points;
  const line = new Polyline(points);
  return {
    ...polylineBounds(points, bermWidth * 2 + CONFIG.groundMap.range),
    detail: 'mid',
    height(px, pz) {
      const { distance, width } = line.query(px, pz);
      return -sink * bowl(distance / (width + bermWidth)) + berm * bowl(Math.abs(distance - width - bermWidth * 0.5) / bermWidth);
    },
    ground: {
      layer: 'dirt',
      weight(px, pz) {
        const { distance, width } = line.query(px, pz);
        return edgeWeight(distance - width);
      },
    },
  };
}

// Tierra acumulada al pie de las piedras del nivel.
function structureDirtFeatures(level) {
  const sizes = CONFIG.terrain.structureDirt;
  const features = [];
  for (const entry of level.structures) {
    const size = sizes[entry.type];
    if (!size) continue;
    const scale = (entry.scale ?? 1) * (size.scaleByRadius ? (entry.radius ?? 1) : 1);
    features.push(FEATURE_TYPES.dirtPile({
      x: entry.x, z: entry.z, radius: size.radius * scale, height: size.height * scale, amount: size.amount,
    }));
  }
  return features;
}

// Hundimientos, montículos y manchas repartidos con semilla, lejos del centro,
// de los caminos y de las zonas despejadas (`clearZones`) del nivel.
function scatterFeatures(level) {
  const s = CONFIG.terrain.scatter;
  const random = createRandom(deriveSeed(CONFIG.seed, 'terrain-scatter'));
  const range = ([min, max]) => min + random() * (max - min);
  const clearZones = level.clearZones ?? [];
  const pathLines = (level.paths ?? []).map((path) => new Polyline(path.points));
  const streamLine = level.stream && new Polyline(level.stream.points);
  const features = [];

  const isClear = (x, z, radius) => {
    if (Math.hypot(x - level.center.x, z - level.center.z) < s.centerClearance + radius) return false;
    for (const zone of clearZones) {
      if (Math.hypot(x - zone.x, z - zone.z) < zone.radius + radius) return false;
    }
    for (const line of pathLines) {
      if (line.distance(x, z) < s.pathClearance + radius) return false;
    }
    if (streamLine) {
      const { distance, width } = streamLine.query(x, z);
      if (distance < width + s.streamClearance + radius) return false;
    }
    return true;
  };

  const place = (count, radiusRange, build) => {
    for (let placed = 0, attempt = 0; placed < count && attempt < count * 30; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * s.areaRadius;
      const x = level.center.x + Math.cos(angle) * distance;
      const z = level.center.z + Math.sin(angle) * distance;
      const radius = range(radiusRange);
      if (!isClear(x, z, radius)) continue;
      features.push(build(x, z, radius));
      placed++;
    }
  };

  place(s.hollows, s.hollowRadius, (x, z, radius) => FEATURE_TYPES.hollow({
    x, z, radius, depth: range(s.hollowDepth), ground: random() < s.muddyHollowChance ? 'mud' : 'dirt',
  }));
  place(s.mounds, s.moundRadius, (x, z, radius) => FEATURE_TYPES.mound({
    x, z, radiusX: radius, radiusZ: radius * range([0.55, 1]), rotationY: random() * Math.PI, height: range(s.moundHeight),
  }));
  place(s.dirtPatches, s.dirtPatchRadius, (x, z, radius) => FEATURE_TYPES.dirtPatch({
    x, z, radius, ground: random() < s.gravelPatchChance ? 'gravel' : 'dirt',
  }));
  return features;
}

// Crea todos los modificadores del nivel (datos + caminos + estructuras + procedurales).
export function createFeatures(level, extra = []) {
  const pathFeatures = (level.paths ?? []).map(createPathFeature);
  const dataFeatures = (level.terrainFeatures ?? []).map((entry) => {
    const build = FEATURE_TYPES[entry.type];
    if (!build) throw new Error(`Tipo de relieve desconocido: "${entry.type}"`);
    return build(entry);
  });
  return [
    ...pathFeatures,
    ...dataFeatures,
    ...structureDirtFeatures(level),
    ...scatterFeatures(level),
    ...extra,
  ];
}

// Allana una zona despejada ({ x, z, radius, flatten: 0-1 }) hacia la altura de su centro.
// Se calcula sobre el terreno ya generado, así que se añade después de crear el HeightField.
export function createFlattenModifier(zone, heightField) {
  const target = heightField.sample(zone.x, zone.z);
  const inner = zone.radius * CONFIG.terrain.flattenCore;
  return {
    ...circleBounds(zone.x, zone.z, zone.radius),
    detail: 'mid',
    apply(x, z, height) {
      const d = Math.hypot(x - zone.x, z - zone.z);
      const t = 1 - THREE.MathUtils.smoothstep(d, inner, zone.radius);
      return THREE.MathUtils.lerp(height, target, t * zone.flatten);
    },
    detailIn(minX, minZ, maxX, maxZ) {
      const cx = THREE.MathUtils.clamp(zone.x, minX, maxX);
      const cz = THREE.MathUtils.clamp(zone.z, minZ, maxZ);
      return Math.hypot(cx - zone.x, cz - zone.z) < zone.radius ? 'mid' : 'base';
    },
  };
}

// Función de altura analítica del terreno. `sample` es la altura "ideal"; la malla
// la muestrea en su rejilla y `Terrain.getHeight` interpola esa triangulación.
export class HeightField {
  constructor(level, features) {
    this.center = level.center;
    this.features = features;
    this.base = new ValueNoise2D(deriveSeed(CONFIG.seed, 'terrain'));
    this.relief = new ValueNoise2D(deriveSeed(CONFIG.seed, 'terrain-relief'));
    this.micro = new ValueNoise2D(deriveSeed(CONFIG.seed, 'terrain-micro'));

    // Rejilla de cubos para consultar solo los modificadores cercanos.
    const { size, featureGrid } = CONFIG.terrain;
    this.gridSize = featureGrid;
    this.gridCount = Math.ceil(size / featureGrid);
    this.half = size / 2;
    this.buckets = Array.from({ length: this.gridCount * this.gridCount }, () => []);
    this.modifiers = [];
    for (const feature of features) this.addFeature(feature, false);
  }

  // Los modificadores con `apply(x, z, height)` se aplican después de sumar el resto
  // (p. ej. el cauce, que recorta el terreno hasta su perfil).
  addFeature(feature, register = true) {
    if (register) this.features.push(feature);
    if (feature.apply) {
      this.modifiers.push(feature);
      return;
    }
    const [x0, z0] = this.cell(feature.minX, feature.minZ);
    const [x1, z1] = this.cell(feature.maxX, feature.maxZ);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) this.buckets[iz * this.gridCount + ix].push(feature);
    }
  }

  cell(x, z) {
    const clamp = (v) => THREE.MathUtils.clamp(Math.floor((v + this.half) / this.gridSize), 0, this.gridCount - 1);
    return [clamp(x), clamp(z)];
  }

  featuresAt(x, z) {
    const [ix, iz] = this.cell(x, z);
    return this.buckets[iz * this.gridCount + ix];
  }

  // Factor 0 (centro llano) → 1 (campo abierto).
  openness(x, z) {
    const { flatRadius, flatBlend } = CONFIG.terrain;
    const r = Math.hypot(x - this.center.x, z - this.center.z);
    return THREE.MathUtils.smoothstep(r, flatRadius, flatRadius + flatBlend);
  }

  sample(x, z) {
    const t = CONFIG.terrain;
    const open = this.openness(x, z);
    const base = (this.base.fbm(x * t.heightFrequency, z * t.heightFrequency, { octaves: t.octaves }) - 0.5) * 2 * t.heightAmplitude;
    const relief = (this.relief.fbm(x * t.relief.frequency, z * t.relief.frequency, { octaves: 2 }) - 0.5) * 2 * t.relief.amplitude;
    const m = t.micro;
    const micro = ((this.micro.noise(x * m.frequency, z * m.frequency) - 0.5) * 2 * m.amplitude
      + (this.micro.noise(x * m.fineFrequency + 31.7, z * m.fineFrequency - 12.3) - 0.5) * 2 * m.fineAmplitude)
      * THREE.MathUtils.lerp(m.insideFlat, 1, open);

    let height = (base + relief) * open + micro;
    for (const feature of this.featuresAt(x, z)) {
      if (x < feature.minX || x > feature.maxX || z < feature.minZ || z > feature.maxZ) continue;
      height += feature.height(x, z);
    }
    for (const modifier of this.modifiers) {
      if (x < modifier.minX || x > modifier.maxX || z < modifier.minZ || z > modifier.maxZ) continue;
      height = modifier.apply(x, z, height);
    }
    return height;
  }

  // Nivel de detalle necesario en un rectángulo: 'fine', 'mid' o 'base'.
  detailIn(minX, minZ, maxX, maxZ) {
    let detail = 'base';
    const { flatRadius, flatBlend } = CONFIG.terrain;
    const cx = THREE.MathUtils.clamp(this.center.x, minX, maxX);
    const cz = THREE.MathUtils.clamp(this.center.z, minZ, maxZ);
    if (Math.hypot(cx - this.center.x, cz - this.center.z) < flatRadius + flatBlend * 0.5) detail = 'mid';
    for (const modifier of this.modifiers) {
      const own = modifier.detailIn?.(minX, minZ, maxX, maxZ);
      if (own === 'fine') return 'fine';
      if (own === 'mid') detail = 'mid';
    }
    const [x0, z0] = this.cell(minX, minZ);
    const [x1, z1] = this.cell(maxX, maxZ);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        for (const f of this.buckets[iz * this.gridCount + ix]) {
          if (f.detail === 'base' || f.maxX < minX || f.minX > maxX || f.maxZ < minZ || f.minZ > maxZ) continue;
          if (f.detail === 'fine') return 'fine';
          detail = 'mid';
        }
      }
    }
    return detail;
  }
}
