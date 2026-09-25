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
    this.clusters = new ValueNoise2D(deriveSeed(CONFIG.seed, 'vegetation-clusters'));
    this.level = level;
    this.terrain = terrain;
    this.colliders = colliders;

    const grassGeometry = createTuftGeometry(v.grassBlades, v.grassBaseColor, v.grassTipColor, 0.05, this.random);
    this.grass = this.createMesh(grassGeometry, gradientMap, v.grassCount, v.grassHeight, true, false);
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
  createMesh(geometry, gradientMap, count, heightRange, clustered, tinted) {
    const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      this.addWind(shader);
      if (tinted) addTint(shader);
    };
    material.customProgramCacheKey = () => (tinted ? 'vegetation-tinted' : 'vegetation');
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
      mesh.setMatrixAt(placed++, matrix.compose(position, quaternion, scale));
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    return mesh;
  }

  samplePoint(clustered) {
    const v = CONFIG.vegetation;
    const { center } = this.level;
    const angle = this.random() * Math.PI * 2;
    const distance = Math.sqrt(this.random()) * v.radius;
    const x = center.x + Math.cos(angle) * distance;
    const z = center.z + Math.sin(angle) * distance;

    if (clustered) {
      const n = this.clusters.fbm(x * v.clusterScale, z * v.clusterScale, { octaves: 3 });
      if (n < v.clusterThreshold && this.random() > v.sparseChance) return null;
    }
    if (this.terrain.isBareGround(x, z, v.bareMargin)) return null;
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
