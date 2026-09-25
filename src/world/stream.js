import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';
import { Polyline, FEATURE_TYPES, bowl, edgeWeight, irregular } from './terrainFeatures.js';

// Riachuelo: cauce, perfil del agua, rocas, malla de agua y consultas.
//
// Datos del nivel: `stream.points` = [{ x, z, width (radio del agua), depth (cauce bajo las orillas) }].
// El recorrido se suaviza (Catmull-Rom) y se muestrea cada `sampleSpacing` metros.
// El nivel del agua sigue al terreno pero nunca sube aguas abajo; cuando el terreno baja
// más de `maxStep` el agua baja de golpe y se forma un pequeño rápido con espuma.

const tmpVector = new THREE.Vector3();

export class StreamCourse {
  // detailZones: zonas con malla fina junto al cauce ({ x, z, radius }).
  constructor(data, heightField, detailZones = []) {
    const s = CONFIG.stream;
    this.data = data;
    this.detailZones = detailZones;
    this.samples = smoothCourse(data.points, s.sampleSpacing);
    this.line = new Polyline(this.samples, { cellSize: s.indexCell });
    this.computeProfile(heightField);
    this.feature = this.createChannelFeature();
    this.bankFeatures = this.createBankFeatures();
  }

  // Nivel del agua por muestra: mínimo del terreno en el centro y en ambas orillas menos
  // el resguardo, sin subir nunca aguas abajo y bajando por escalones (rápidos).
  computeProfile(heightField) {
    const { freeboard, maxStep, bankSlope } = CONFIG.stream;
    let level = Infinity;
    this.rapids = [];
    for (let i = 0; i < this.samples.length; i++) {
      const p = this.samples[i];
      const reach = p.width + bankSlope;
      const target = Math.min(
        heightField.sample(p.x, p.z),
        heightField.sample(p.x + p.nx * reach, p.z + p.nz * reach),
        heightField.sample(p.x - p.nx * reach, p.z - p.nz * reach),
      ) - freeboard;
      if (level === Infinity) level = target;
      else if (target < level - maxStep) {
        level -= Math.min(level - target, maxStep);
        this.rapids.push(i);
      }
      p.level = level;
    }
    // Espuma alrededor de cada rápido (muestras antes y después del escalón).
    const { rapidFoamBefore, rapidFoamAfter } = CONFIG.stream;
    for (const p of this.samples) p.foam = 0;
    for (const index of this.rapids) {
      for (let i = Math.max(0, index - rapidFoamBefore); i < Math.min(this.samples.length, index + rapidFoamAfter); i++) {
        const distance = i < index ? (index - i) / rapidFoamBefore : (i - index) / rapidFoamAfter;
        this.samples[i].foam = Math.max(this.samples[i].foam, 1 - distance * 0.6);
      }
    }
  }

  // Muestra interpolada del recorrido en el resultado de una consulta a la polilínea.
  sampleAt(query) {
    const a = this.samples[query.segment];
    const b = this.samples[query.segment + 1] ?? a;
    const u = query.u;
    return {
      level: a.level + (b.level - a.level) * u,
      depth: a.depth + (b.depth - a.depth) * u,
      width: a.width + (b.width - a.width) * u,
      along: a.along + (b.along - a.along) * u,
    };
  }

  // Radio del agua con orillas irregulares.
  waterWidth(x, z, width) {
    return width * (1 + (irregular(x, z) - 1) * CONFIG.stream.bankIrregularity / CONFIG.terrain.irregularity);
  }

  // Nivel del agua en (x, z) o null fuera del agua.
  waterLevelAt(x, z) {
    const query = this.line.query(x, z);
    if (query.distance === Infinity) return null;
    const sample = this.sampleAt(query);
    return query.distance < this.waterWidth(x, z, sample.width) ? sample.level : null;
  }

  // Modificador del terreno: recorta el valle (orillas de altura limitada), sube un
  // pequeño dique si el terreno queda por debajo del agua y excava el lecho.
  createChannelFeature() {
    const s = CONFIG.stream;
    const reach = s.valleyWidth + s.bankSlope + 4;
    const xs = this.samples.map((p) => p.x);
    const zs = this.samples.map((p) => p.z);
    return {
      minX: Math.min(...xs) - reach,
      maxX: Math.max(...xs) + reach,
      minZ: Math.min(...zs) - reach,
      maxZ: Math.max(...zs) + reach,
      detail: 'fine',
      apply: (x, z, height) => {
        const query = this.line.query(x, z);
        if (query.distance === Infinity) return height;
        const sample = this.sampleAt(query);
        const width = this.waterWidth(x, z, sample.width);
        const d = query.distance;
        const bankTop = sample.level + s.freeboard;
        const outside = Math.max(0, d - width - s.bankSlope);
        if (outside > s.valleyWidth) return height;

        // Valle: orillas como mucho `maxBankHeight` sobre el agua cerca del cauce.
        const allowed = bankTop + s.maxBankHeight + outside * s.valleySlope;
        let h = height > allowed ? THREE.MathUtils.lerp(allowed, height, THREE.MathUtils.smoothstep(outside, 0, s.valleyWidth)) : height;
        // Dique: el terreno junto al agua no queda por debajo de la orilla.
        if (d < width + s.bankSlope) h = Math.max(h, bankTop - s.freeboard * 0.2);
        // Lecho: del fondo (centro) al nivel del agua (borde) y talud hasta la orilla.
        const waterDepth = Math.max(s.minWaterDepth, sample.depth - s.freeboard);
        let channel;
        if (d < width) channel = sample.level - s.edgeDepth - (waterDepth - s.edgeDepth) * bowl(d / width);
        else channel = sample.level - s.edgeDepth + (bankTop - sample.level + s.edgeDepth) * THREE.MathUtils.smoothstep(d, width, width + s.bankSlope);
        return Math.min(h, channel);
      },
      // Malla fina junto al cauce cerca de las zonas visitadas (`clearZones`: puente, cabaña);
      // media en el resto del recorrido y en el valle.
      detailIn: (minX, minZ, maxX, maxZ) => {
        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        const { distance, width } = this.line.query(cx, cz);
        const halfDiagonal = Math.hypot(maxX - minX, maxZ - minZ) / 2;
        if (distance - halfDiagonal < width + s.bankSlope + s.fineMargin) {
          const nearZone = this.detailZones.some((zone) => Math.hypot(cx - zone.x, cz - zone.z) < zone.radius + s.fineZoneMargin);
          return nearZone ? 'fine' : 'mid';
        }
        if (distance - halfDiagonal < width + s.bankSlope + s.valleyWidth) return 'mid';
        return 'base';
      },
      ground: [
        {
          layer: 'gravel',
          weight: (x, z) => {
            const query = this.line.query(x, z);
            if (query.distance === Infinity) return 0;
            return edgeWeight(query.distance - this.waterWidth(x, z, query.width) * s.gravelFraction);
          },
        },
        {
          layer: 'mud',
          weight: (x, z) => {
            const query = this.line.query(x, z);
            if (query.distance === Infinity) return 0;
            const width = this.waterWidth(x, z, query.width);
            const inner = width * s.gravelFraction;
            const outer = width + s.bankSlope * s.mudSlopeFraction * irregular(z, x) + s.mudBand;
            // Franja irregular de barro desde el agua hasta media altura del talud.
            return Math.min(edgeWeight(query.distance - outer), edgeWeight(inner - query.distance)) * s.mudStrength;
          },
        },
      ],
    };
  }

  // Tierra y barro acumulados sobre las orillas.
  createBankFeatures() {
    const s = CONFIG.stream;
    const random = createRandom(deriveSeed(CONFIG.seed, 'stream-banks'));
    const features = [];
    for (let along = 0; along < this.line.total; along += s.bankPileSpacing * (0.6 + random() * 0.8)) {
      const p = this.sampleAtDistance(along);
      const side = random() < 0.5 ? -1 : 1;
      const offset = p.width + s.bankSlope * (0.5 + random() * 0.6);
      features.push(FEATURE_TYPES.dirtPile({
        x: p.x + p.nx * offset * side,
        z: p.z + p.nz * offset * side,
        radius: 0.9 + random() * 1.1,
        height: 0.12 + random() * 0.18,
        ground: random() < 0.5 ? 'mud' : 'dirt',
      }));
    }
    return features;
  }

  sampleAtDistance(along) {
    const index = THREE.MathUtils.clamp(Math.round(along / CONFIG.stream.sampleSpacing), 0, this.samples.length - 1);
    return this.samples[index];
  }

  // Rocas del cauce (piedra mojada) y cantos rodados en las orillas, como entradas de nivel.
  rockEntries() {
    const s = CONFIG.stream.rocks;
    const random = createRandom(deriveSeed(CONFIG.seed, 'stream-rocks'));
    const entries = [];
    this.rockFoam = [];
    for (let along = s.spacing * 0.5; along < this.line.total; along += s.spacing * (0.5 + random())) {
      const p = this.sampleAtDistance(along);
      const across = (random() * 2 - 1) * p.width * s.spread;
      const radius = s.radius[0] + random() * (s.radius[1] - s.radius[0]);
      const x = p.x + p.nx * across;
      const z = p.z + p.nz * across;
      entries.push({ type: 'boulder', x, z, radius, sink: s.sink, material: 'wetStone', collider: radius >= s.colliderRadius });
      this.rockFoam.push({ x, z, radius: radius * 0.9 });
    }
    for (let along = 0; along < this.line.total; along += s.bankRubbleSpacing * (0.5 + random())) {
      const p = this.sampleAtDistance(along);
      const side = random() < 0.5 ? -1 : 1;
      const offset = p.width * (0.8 + random() * 0.5);
      entries.push({
        type: 'rubble', x: p.x + p.nx * offset * side, z: p.z + p.nz * offset * side,
        radius: 1.2, count: 4 + Math.floor(random() * 4), minSize: 0.12, maxSize: 0.35, material: 'wetStone',
      });
    }
    return entries;
  }

  // Punto del cauce más cercano (sobre el agua) y distancia, para el sonido.
  nearest(x, z) {
    const query = this.line.query(x, z);
    if (query.distance === Infinity) {
      // Fuera del índice: búsqueda completa (solo para el sonido lejano).
      let best = Infinity;
      let point = this.samples[0];
      for (const p of this.samples) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < best) {
          best = d;
          point = p;
        }
      }
      return { x: point.x, y: point.level, z: point.z, distance: best };
    }
    const sample = this.sampleAt(query);
    return { x: query.x, y: sample.level, z: query.z, distance: Math.max(0, query.distance - sample.width) };
  }

  // Posiciones de los rápidos (para las fuentes de sonido más brillantes).
  rapidPoints() {
    this.rapidCache ??= this.rapids.map((index) => {
      const p = this.samples[index];
      return { x: p.x, y: p.level, z: p.z };
    });
    return this.rapidCache;
  }
}

// Recorrido suavizado con muestras equiespaciadas: posición, normal (izquierda del
// sentido de la corriente), ancho, profundidad y distancia recorrida.
function smoothCourse(points, spacing) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
  const length = curve.getLength();
  const count = Math.max(2, Math.ceil(length / spacing));
  const samples = [];
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    const position = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u, tmpVector);
    const t = curve.getUtoTmapping(u) * (points.length - 1);
    const i0 = Math.min(Math.floor(t), points.length - 2);
    const f = t - i0;
    const a = points[i0];
    const b = points[i0 + 1];
    samples.push({
      x: position.x,
      z: position.z,
      nx: -tangent.z,
      nz: tangent.x,
      width: a.width + (b.width - a.width) * f,
      depth: a.depth + (b.depth - a.depth) * f,
      along: u * length,
    });
  }
  return samples;
}

// Malla de agua en cinta a lo largo del cauce con shader pixel art:
// tonos por profundidad, flujo, destellos que viajan con la corriente y espuma.
export class StreamWater {
  constructor(course, noiseTexture) {
    const s = CONFIG.stream;
    const w = CONFIG.water;
    this.course = course;
    const rocks = (course.rockFoam ?? []).slice(0, w.maxRocks);
    const rockUniform = Array.from({ length: w.maxRocks }, (_, i) => {
      const r = rocks[i];
      return r ? new THREE.Vector3(r.x, r.z, r.radius) : new THREE.Vector3(1e5, 1e5, 0);
    });

    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 },
      uNoise: { value: null },
      uDeep: { value: new THREE.Color(w.colors.deep) },
      uMid: { value: new THREE.Color(w.colors.mid) },
      uShallow: { value: new THREE.Color(w.colors.shallow) },
      uLightWater: { value: new THREE.Color(w.colors.light) },
      uFoamColor: { value: new THREE.Color(w.colors.foam) },
      uSparkleColor: { value: new THREE.Color(w.colors.sparkle) },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uSparkleTint: { value: 1 },
      uTexels: { value: CONFIG.textures.texelsPerUnit },
      uSparkleDensity: { value: w.sparkleDensity },
      uRocks: { value: rockUniform },
    }]);
    this.uniforms.uNoise.value = noiseTexture;

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT.replace('MAX_ROCKS_VALUE', String(w.maxRocks)),
      fog: true,
    });
    this.mesh = new THREE.Mesh(createRibbonGeometry(course, s, w), material);
    this.mesh.name = 'stream-water';
    this.mesh.receiveShadow = false;
    this.tint = new THREE.Color();
    this.tmp = new THREE.Color();
  }

  update(dt, day) {
    const w = CONFIG.water;
    this.uniforms.uTime.value += dt;
    // Luz del momento: ambiente + luz directa (sol o luna), para teñir el agua con la hora.
    this.tint.copy(day.ambientSky).multiplyScalar(day.ambientIntensity * w.ambientWeight);
    this.tmp.copy(day.lightColor).multiplyScalar(day.lightIntensity * w.lightWeight);
    this.tint.add(this.tmp);
    this.tint.r = Math.min(this.tint.r, w.maxTint);
    this.tint.g = Math.min(this.tint.g, w.maxTint);
    this.tint.b = Math.min(this.tint.b, w.maxTint);
    this.uniforms.uTint.value.copy(this.tint);
    this.uniforms.uSparkleTint.value = Math.min(1, w.sparkleBase + day.lightIntensity * w.sparkleLight);
  }
}

// Cinta: por muestra, `water.acrossSegments` vértices de orilla a orilla (algo metidos en
// el talud para que el borde lo marque el terreno). Atributos del flujo por vértice.
function createRibbonGeometry(course, s, w) {
  const positions = [];
  const flow = [];
  const extra = [];
  const indices = [];
  const segments = w.acrossSegments;
  const meanWidth = course.samples.reduce((sum, p) => sum + p.width, 0) / course.samples.length;
  for (let i = 0; i < course.samples.length; i++) {
    const p = course.samples[i];
    const halfWidth = p.width * (1 + s.bankIrregularity) + w.bankOverlap;
    const speed = w.flowSpeed * (meanWidth / p.width) * (1 + p.foam * w.rapidSpeedBoost);
    for (let j = 0; j <= segments; j++) {
      const a = (j / segments) * 2 - 1;
      const across = a * halfWidth;
      positions.push(p.x + p.nx * across, p.level, p.z + p.nz * across);
      flow.push(p.along, across, speed);
      extra.push(p.foam, bowl(Math.abs(across) / p.width), Math.abs(across) / p.width);
    }
    if (i === 0) continue;
    const row = (i - 1) * (segments + 1);
    const next = i * (segments + 1);
    for (let j = 0; j < segments; j++) {
      indices.push(row + j, next + j, row + j + 1, next + j, next + j + 1, row + j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3));
  geometry.setAttribute('aExtra', new THREE.Float32BufferAttribute(extra, 3));
  geometry.setIndex(indices);
  // Orientar las caras hacia arriba sea cual sea el sentido de la normal de la muestra.
  geometry.computeVertexNormals();
  if (geometry.attributes.normal.getY(0) < 0) {
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();
  return geometry;
}

const WATER_VERTEX = /* glsl */`
  attribute vec3 aFlow;   // x: distancia a lo largo (m), y: distancia transversal (m), z: velocidad
  attribute vec3 aExtra;  // x: espuma de rápido, y: profundidad relativa (1 = centro), z: |transversal| / radio
  varying vec3 vFlow;
  varying vec3 vExtra;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vFlow = aFlow;
    vExtra = aExtra;
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WATER_FRAGMENT = /* glsl */`
  #define MAX_ROCKS MAX_ROCKS_VALUE
  uniform float uTime;
  uniform sampler2D uNoise;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uShallow;
  uniform vec3 uLightWater;
  uniform vec3 uFoamColor;
  uniform vec3 uSparkleColor;
  uniform vec3 uTint;
  uniform float uSparkleTint;
  uniform float uTexels;
  uniform float uSparkleDensity;
  uniform vec3 uRocks[MAX_ROCKS]; // (x, z, radio)
  varying vec3 vFlow;
  varying vec3 vExtra;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Coordenadas del flujo ajustadas a la rejilla de texels (look pixel).
    vec2 cell = floor(vFlow.xy * uTexels);
    vec2 p = cell / uTexels;
    float shift = uTime * vFlow.z;
    float n1 = texture2D(uNoise, vec2((p.x - shift) * 0.07, p.y * 0.22)).r;
    float n2 = texture2D(uNoise, vec2((p.x - shift * 1.6) * 0.19, p.y * 0.55 + 0.4)).r;
    float n = n1 * 0.6 + n2 * 0.4;

    float shade = vExtra.y * 0.75 + (n - 0.5) * 1.1;
    vec3 color = shade > 0.55 ? uDeep : shade > 0.32 ? uMid : shade > 0.12 ? uShallow : uLightWater;

    // Espuma: rápidos, orillas y alrededor de las rocas.
    float foam = 0.0;
    if (vExtra.x > 0.0 && n2 + vExtra.x * 0.35 > 0.9) foam = 1.0;
    if (vExtra.z > 0.9 && n1 > 0.62) foam = 1.0;
    vec2 world = (floor(vWorld.xz * uTexels) + 0.5) / uTexels;
    for (int i = 0; i < MAX_ROCKS; i++) {
      vec3 rock = uRocks[i];
      float d = length(world - rock.xy) - rock.z;
      if (d < 0.22 && n2 > 0.45 + d * 1.5) foam = 1.0;
    }
    color = mix(color, uFoamColor, foam);

    // Destellos de 1 píxel que viajan con la corriente y titilan.
    vec2 sparkleCell = floor(vec2((vFlow.x - uTime * vFlow.z * 1.2) * uTexels * 0.5, vFlow.y * uTexels * 0.5));
    float twinkle = floor(uTime * 5.0);
    float h = hash(sparkleCell + vec2(twinkle * 0.37, twinkle * 0.11));
    bool sparkle = h > 1.0 - uSparkleDensity * (0.4 + n * 1.2) && foam < 0.5;

    vec3 lit = color * uTint;
    if (sparkle) lit = uSparkleColor * uSparkleTint;
    gl_FragColor = vec4(lit, 1.0);
    #include <fog_fragment>
  }
`;
