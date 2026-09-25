import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';

// Pasto alto y flores con InstancedMesh (1 draw call cada uno). Se agrupan en
// manchas por ruido, evitan el camino y las piedras y se mecen con el viento.
export class Vegetation {
  constructor(level, terrain, colliders, gradientMap) {
    const v = CONFIG.vegetation;
    this.uniforms = {
      uTime: { value: 0 },
      uWindStrength: { value: v.windStrength },
      uWindSpeed: { value: v.windSpeed },
    };
    this.random = createRandom(deriveSeed(CONFIG.seed, 'vegetation'));
    this.dryRandom = createRandom(deriveSeed(CONFIG.seed, 'vegetation-dry'));
    this.clusters = new ValueNoise2D(deriveSeed(CONFIG.seed, 'vegetation-clusters'));
    this.level = level;
    this.terrain = terrain;
    this.colliders = colliders;

    const grassGeometry = createTuftGeometry(v.grassBlades, v.grassBaseColor, v.grassTipColor, 0.05, this.random);
    this.grass = this.createMesh(grassGeometry, gradientMap, v.grassCount, v.grassHeight, true, false, true);
    this.grass.name = 'tall-grass';

    const flowerGeometry = createFlowerGeometry(v.grassBaseColor);
    this.flowers = this.createMesh(flowerGeometry, gradientMap, v.flowerCount, [0.3, 0.5], false, true);
    this.flowers.name = 'flowers';
    const color = new THREE.Color();
    for (let i = 0; i < this.flowers.count; i++) {
      color.setHex(v.flowerColors[Math.floor(this.random() * v.flowerColors.length)]);
      this.flowers.setColorAt(i, color);
    }
    if (this.flowers.instanceColor) this.flowers.instanceColor.needsUpdate = true;
  }

  get meshes() {
    return [this.grass, this.flowers];
  }

  update(dt) {
    this.uniforms.uTime.value += dt;
  }

  // tinted: el color de instancia solo se aplica a los vértices con aTint = 1.
  // dry: cada instancia lleva `aDry` (0-1) según las zonas `dryGrass` del nivel.
  createMesh(geometry, gradientMap, count, heightRange, clustered, tinted, dry = false) {
    const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      this.addWind(shader);
      if (tinted) addTint(shader);
      if (dry) addDryness(shader);
    };
    material.customProgramCacheKey = () => `vegetation${tinted ? '-tinted' : ''}${dry ? '-dry' : ''}`;
    const dryness = dry ? new Float32Array(count) : null;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let placed = 0;
    for (let attempt = 0; attempt < count * 20 && placed < count; attempt++) {
      const point = this.samplePoint(clustered);
      if (!point) continue;
      const height = heightRange[0] + this.random() * (heightRange[1] - heightRange[0]);
      const width = 0.8 + this.random() * 0.5;
      position.set(point.x, this.terrain.getHeight(point.x, point.z) - 0.02, point.z);
      quaternion.setFromAxisAngle(up, this.random() * Math.PI * 2);
      scale.set(width, height, width);
      if (dryness) dryness[placed] = this.dryness(point.x, point.z);
      mesh.setMatrixAt(placed++, matrix.compose(position, quaternion, scale));
    }
    if (dryness) geometry.setAttribute('aDry', new THREE.InstancedBufferAttribute(dryness, 1));
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  // Sequedad de una mata: seca del todo cerca del centro de una zona `dryGrass` y a
  // manchas (mezcla aleatoria de matas secas y verdes) hacia el borde.
  dryness(x, z) {
    let weight = 0;
    for (const area of this.level.dryGrass ?? []) {
      const d = Math.hypot(x - area.x, z - area.z);
      weight = Math.max(weight, 1 - THREE.MathUtils.smoothstep(d, area.radius * CONFIG.vegetation.dryCore, area.radius));
    }
    return weight > this.dryRandom() ? 0.75 + this.dryRandom() * 0.25 : 0;
  }

  // Punto candidato en una de las zonas del nivel (`vegetationAreas`), elegida por peso.
  randomAreaPoint() {
    const areas = this.level.vegetationAreas ?? [{ ...this.level.center, radius: CONFIG.vegetation.radius, weight: 1 }];
    const total = areas.reduce((sum, area) => sum + area.weight, 0);
    let pick = this.random() * total;
    const area = areas.find((a) => (pick -= a.weight) <= 0) ?? areas[0];
    const stream = this.terrain.stream;
    if (area.stream && stream) {
      const p = stream.samples[Math.floor(this.random() * stream.samples.length)];
      const side = this.random() < 0.5 ? -1 : 1;
      const offset = p.width + CONFIG.stream.bankSlope + area.band[0] + this.random() * (area.band[1] - area.band[0]);
      return { x: p.x + p.nx * offset * side, z: p.z + p.nz * offset * side };
    }
    const angle = this.random() * Math.PI * 2;
    const distance = Math.sqrt(this.random()) * area.radius;
    return { x: area.x + Math.cos(angle) * distance, z: area.z + Math.sin(angle) * distance };
  }

  samplePoint(clustered) {
    const v = CONFIG.vegetation;
    const { x, z } = this.randomAreaPoint();

    if (clustered) {
      const n = this.clusters.fbm(x * v.clusterScale, z * v.clusterScale, { octaves: 3 });
      if (n < v.clusterThreshold && this.random() > v.sparseChance) return null;
    }
    if (this.terrain.isBareGround(x, z, v.bareMargin)) return null;
    if (this.terrain.waterLevelAt(x, z) !== null) return null;
    for (const c of this.colliders) {
      const dx = x - c.cx;
      const dz = z - c.cz;
      const lx = dx * c.cos - dz * c.sin;
      const lz = dx * c.sin + dz * c.cos;
      if (Math.abs(lx) < c.hx + 0.2 && Math.abs(lz) < c.hz + 0.2) return null;
    }
    return { x, z };
  }

  // Viento en espacio de mundo tras aplicar la instancia: las puntas se desplazan
  // (cuadrático con la altura) con ráfagas que recorren la pradera.
  addWind(shader) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uWindStrength;
        uniform float uWindSpeed;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 windOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 windOrigin = vec3(0.0);
        #endif
        float bend = position.y * position.y;
        float gust = sin(uTime * uWindSpeed + windOrigin.x * 0.3 + windOrigin.z * 0.2) * 0.6
                   + sin(uTime * uWindSpeed * 2.3 + windOrigin.x * 0.9 - windOrigin.z * 0.7) * 0.25 + 0.4;
        mvPosition.x += gust * uWindStrength * bend;
        mvPosition.z += gust * uWindStrength * 0.4 * bend;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  }
}

// Mata de hojas: triángulos finos con color de base a punta. Altura 1 (escala por instancia).
function createTuftGeometry(blades, baseHex, tipHex, width, random) {
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const positions = [];
  const colors = [];
  for (let i = 0; i < blades; i++) {
    const angle = random() * Math.PI * 2;
    const radius = random() * 0.12;
    const ox = Math.cos(angle) * radius;
    const oz = Math.sin(angle) * radius;
    const facing = random() * Math.PI;
    const wx = Math.cos(facing) * width;
    const wz = Math.sin(facing) * width;
    const lean = (random() - 0.5) * 0.35;
    const height = 0.7 + random() * 0.3;
    positions.push(
      ox - wx, 0, oz - wz,
      ox + wx, 0, oz + wz,
      ox + lean, height, oz + lean * 0.5,
    );
    colors.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  return finishGeometry(positions, colors);
}

// Flor: tallo fino + cabeza (color por instancia). Altura 1.
function createFlowerGeometry(stemHex) {
  const stem = new THREE.Color(stemHex);
  const white = new THREE.Color(1, 1, 1);
  const s = 0.025;
  const h = 0.12; // tamaño de la cabeza
  const positions = [
    // tallo
    -s, 0, 0, s, 0, 0, 0, 0.85, 0,
    // cabeza: dos triángulos cruzados (se ven desde cualquier lado)
    -h, 0.8, 0, h, 0.8, 0, 0, 1, 0,
    0, 0.8, -h, 0, 0.8, h, 0, 1, 0,
  ];
  const colors = [];
  for (let i = 0; i < 3; i++) colors.push(stem.r, stem.g, stem.b);
  for (let i = 0; i < 6; i++) colors.push(white.r, white.g, white.b);
  const geometry = finishGeometry(positions, colors);
  const tint = [0, 0, 0, 1, 1, 1, 1, 1, 1];
  geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 1));
  return geometry;
}

function addTint(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aTint;')
    .replace('#include <color_vertex>', `
      vColor = vec4(1.0);
      vColor.rgb *= color;
      #ifdef USE_INSTANCING_COLOR
        vColor.rgb = mix(vColor.rgb, vColor.rgb * instanceColor.rgb, aTint);
      #endif`);
}

// Mezcla el color de la mata con el del pasto seco (de base a punta por la altura).
function addDryness(shader) {
  const v = CONFIG.vegetation;
  shader.uniforms.uDryBase = { value: new THREE.Color(v.dryBaseColor) };
  shader.uniforms.uDryTip = { value: new THREE.Color(v.dryTipColor) };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aDry;\nuniform vec3 uDryBase;\nuniform vec3 uDryTip;')
    .replace('#include <color_vertex>', `#include <color_vertex>
      vColor.rgb = mix(vColor.rgb, mix(uDryBase, uDryTip, clamp(position.y, 0.0, 1.0)), aDry);`);
}

function finishGeometry(positions, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // Normales hacia arriba: se iluminan como el suelo sobre el que crecen.
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}
