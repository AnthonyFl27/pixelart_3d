import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { HeightField, createFeatures } from './terrainFeatures.js';
import { GroundMap } from './groundMap.js';
import { StreamCourse } from './stream.js';

// Terreno por trozos con resolución variable: celdas finas donde hay detalle
// (cauce, cabaña), medias en caminos, relieve y centro, y gruesas en el resto.
// Los bordes de un trozo fino junto a uno grueso se ajustan a la arista del grueso
// (sin grietas). Los trozos se agrupan en regiones (una malla y un draw call por
// región, con frustum culling). `getHeight(x, z)` interpola la triangulación real.
export class Terrain {
  constructor(level, materials, textures) {
    const { size, chunkSize } = CONFIG.terrain;
    this.size = size;
    this.half = size / 2;
    this.chunkSize = chunkSize;
    this.chunkCount = Math.round(size / chunkSize);
    this.center = level.center;

    this.features = createFeatures(level);
    this.heightField = new HeightField(level, this.features);
    // El cauce se calcula sobre el terreno sin él y después lo recorta.
    this.stream = level.stream ? new StreamCourse(level.stream, this.heightField, level.clearZones) : null;
    if (this.stream) {
      for (const feature of [this.stream.feature, ...this.stream.bankFeatures]) this.heightField.addFeature(feature);
    }
    this.groundMap = new GroundMap(size, this.features);

    this.chunks = this.createChunks();
    this.stitchChunks();
    this.mesh = this.createMeshes(this.createMaterial(materials, textures));
  }

  createChunks() {
    const { cellSizes } = CONFIG.terrain;
    const chunks = [];
    for (let cz = 0; cz < this.chunkCount; cz++) {
      for (let cx = 0; cx < this.chunkCount; cx++) {
        const minX = -this.half + cx * this.chunkSize;
        const minZ = -this.half + cz * this.chunkSize;
        const detail = this.heightField.detailIn(minX, minZ, minX + this.chunkSize, minZ + this.chunkSize);
        const cell = cellSizes[detail];
        const n = Math.round(this.chunkSize / cell);
        const heights = new Float32Array((n + 1) * (n + 1));
        for (let iz = 0; iz <= n; iz++) {
          for (let ix = 0; ix <= n; ix++) {
            heights[iz * (n + 1) + ix] = this.heightField.sample(minX + ix * cell, minZ + iz * cell);
          }
        }
        chunks.push({ cx, cz, minX, minZ, cell, n, heights, detail });
      }
    }
    return chunks;
  }

  chunkAt(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.chunkCount || cz >= this.chunkCount) return null;
    return this.chunks[cz * this.chunkCount + cx];
  }

  // Los vértices del borde de un trozo que no existen en el vecino más grueso se
  // colocan sobre la arista de este (interpolación lineal), así no se abren grietas.
  stitchChunks() {
    for (const chunk of this.chunks) {
      const { n, heights } = chunk;
      const edges = [
        { neighbor: this.chunkAt(chunk.cx, chunk.cz - 1), index: (i) => i },
        { neighbor: this.chunkAt(chunk.cx, chunk.cz + 1), index: (i) => n * (n + 1) + i },
        { neighbor: this.chunkAt(chunk.cx - 1, chunk.cz), index: (i) => i * (n + 1) },
        { neighbor: this.chunkAt(chunk.cx + 1, chunk.cz), index: (i) => i * (n + 1) + n },
      ];
      for (const { neighbor, index } of edges) {
        if (!neighbor || neighbor.cell <= chunk.cell) continue;
        const ratio = Math.round(neighbor.cell / chunk.cell);
        for (let i = 0; i <= n; i++) {
          const offset = i % ratio;
          if (offset === 0) continue;
          const a = heights[index(i - offset)];
          const b = heights[index(i - offset + ratio)];
          heights[index(i)] = a + (b - a) * (offset / ratio);
        }
      }
    }
  }

  createMeshes(material) {
    const { regionSize, normalSample } = CONFIG.terrain;
    const { size: textureSize, texelsPerUnit } = CONFIG.textures;
    const uvScale = texelsPerUnit / textureSize;
    const regionChunks = Math.round(regionSize / this.chunkSize);
    const group = new THREE.Group();
    group.name = 'terrain';
    this.triangleCount = 0;

    for (let rz = 0; rz < this.chunkCount; rz += regionChunks) {
      for (let rx = 0; rx < this.chunkCount; rx += regionChunks) {
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        for (let cz = rz; cz < Math.min(rz + regionChunks, this.chunkCount); cz++) {
          for (let cx = rx; cx < Math.min(rx + regionChunks, this.chunkCount); cx++) {
            const { minX, minZ, cell, n, heights } = this.chunkAt(cx, cz);
            const start = positions.length / 3;
            for (let iz = 0; iz <= n; iz++) {
              for (let ix = 0; ix <= n; ix++) {
                const x = minX + ix * cell;
                const z = minZ + iz * cell;
                positions.push(x, heights[iz * (n + 1) + ix], z);
                // Normal analítica (continua entre trozos de distinta resolución).
                const e = normalSample;
                const hx = this.heightField.sample(x - e, z) - this.heightField.sample(x + e, z);
                const hz = this.heightField.sample(x, z - e) - this.heightField.sample(x, z + e);
                const length = Math.hypot(hx, 2 * e, hz);
                normals.push(hx / length, (2 * e) / length, hz / length);
                uvs.push(x * uvScale, z * uvScale);
              }
            }
            for (let iz = 0; iz < n; iz++) {
              for (let ix = 0; ix < n; ix++) {
                const a = start + iz * (n + 1) + ix;
                const b = a + n + 1;
                indices.push(a, b, a + 1, b, b + 1, a + 1);
              }
            }
          }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        this.triangleCount += indices.length / 3;

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `terrain-${rx / regionChunks}-${rz / regionChunks}`;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
    return group;
  }

  getHeight(x, z) {
    const cx = THREE.MathUtils.clamp(Math.floor((x + this.half) / this.chunkSize), 0, this.chunkCount - 1);
    const cz = THREE.MathUtils.clamp(Math.floor((z + this.half) / this.chunkSize), 0, this.chunkCount - 1);
    const { minX, minZ, cell, n, heights } = this.chunkAt(cx, cz);
    const fx = (x - minX) / cell;
    const fz = (z - minZ) / cell;
    const ix = THREE.MathUtils.clamp(Math.floor(fx), 0, n - 1);
    const iz = THREE.MathUtils.clamp(Math.floor(fz), 0, n - 1);
    const tx = THREE.MathUtils.clamp(fx - ix, 0, 1);
    const tz = THREE.MathUtils.clamp(fz - iz, 0, 1);

    const a = heights[iz * (n + 1) + ix];
    const b = heights[(iz + 1) * (n + 1) + ix];
    const c = heights[(iz + 1) * (n + 1) + ix + 1];
    const d = heights[iz * (n + 1) + ix + 1];

    // Triángulos (a, b, d) y (b, c, d).
    if (tx + tz <= 1) return a + (d - a) * tx + (b - a) * tz;
    return c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
  }

  // 'grass' | 'dirt' | 'mud' | 'gravel' (sin el ruido del borde).
  getSurface(x, z) {
    return this.groundMap.surfaceAt(x, z);
  }

  // Nivel del agua en (x, z) o null si no hay agua.
  waterLevelAt(x, z) {
    return this.stream?.waterLevelAt(x, z) ?? null;
  }

  // true si (x, z) está sobre suelo desnudo o a menos de `margin` de su borde.
  isBareGround(x, z, margin = 0) {
    return this.groundMap.bareWeight(x, z) > 0.5 - margin / (2 * CONFIG.groundMap.range);
  }

  // Material toon de césped que mezcla tierra, barro y grava según el mapa de suelo.
  // La máscara se evalúa en posiciones ajustadas a la rejilla de texels, así los
  // bordes quedan "pixelados" al mismo tamaño que las texturas.
  createMaterial(materials, textures) {
    const material = new THREE.MeshToonMaterial({
      map: textures.grass,
      gradientMap: materials.gradientMap,
    });
    const g = CONFIG.groundMap;

    const uniforms = {
      uGroundMap: { value: this.groundMap.texture },
      uGroundSize: { value: this.size },
      uDirtMap: { value: textures.dirt },
      uMudMap: { value: textures.mud },
      uGravelMap: { value: textures.gravel },
      uNoiseMap: { value: textures.noise },
      uTexelsPerUnit: { value: CONFIG.textures.texelsPerUnit },
      uEdgeNoise: { value: g.edgeNoise / (2 * g.range) },
      uEdgeNoiseScale: { value: g.edgeNoiseScale },
    };

    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainWorld;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vTerrainWorld;
          uniform sampler2D uGroundMap;
          uniform float uGroundSize;
          uniform sampler2D uDirtMap;
          uniform sampler2D uMudMap;
          uniform sampler2D uGravelMap;
          uniform sampler2D uNoiseMap;
          uniform float uTexelsPerUnit;
          uniform float uEdgeNoise;
          uniform float uEdgeNoiseScale;

          float edgeNoise(vec2 p, vec2 offset) {
            float n1 = texture2D(uNoiseMap, p * uEdgeNoiseScale + offset).r - 0.5;
            float n2 = texture2D(uNoiseMap, p * uEdgeNoiseScale * 4.0 + offset + 0.37).r - 0.5;
            return (n1 * 2.0 + n2) * uEdgeNoise;
          }`)
        .replace('#include <map_fragment>', `
          vec2 snappedPos = (floor(vTerrainWorld.xz * uTexelsPerUnit) + 0.5) / uTexelsPerUnit;
          vec3 cover = texture2D(uGroundMap, snappedPos / uGroundSize + 0.5).rgb;
          cover += vec3(
            edgeNoise(snappedPos, vec2(0.0)),
            edgeNoise(snappedPos, vec2(0.21, 0.63)),
            edgeNoise(snappedPos, vec2(0.57, 0.14)));
          vec4 groundColor = texture2D(map, vMapUv);
          float strongest = 0.5;
          if (cover.b > strongest) { strongest = cover.b; groundColor = texture2D(uGravelMap, vMapUv); }
          if (cover.r > strongest) { strongest = cover.r; groundColor = texture2D(uDirtMap, vMapUv); }
          if (cover.g > strongest) { strongest = cover.g; groundColor = texture2D(uMudMap, vMapUv); }
          diffuseColor *= groundColor;`);
    };

    return material;
  }
}
