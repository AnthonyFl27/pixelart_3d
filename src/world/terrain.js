import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { deriveSeed, ValueNoise2D } from '../core/noise.js';

export const MAX_PATH_POINTS = 16;

// Terreno ondulado con césped y un camino de tierra de borde irregular.
// `getHeight(x, z)` devuelve la altura exacta de la malla (misma triangulación).
export class Terrain {
  constructor(level, materials, textures) {
    const { size, segments } = CONFIG.terrain;
    this.size = size;
    this.segments = segments;
    this.cellSize = size / segments;
    this.half = size / 2;
    this.center = level.center;
    this.path = level.path.slice(0, MAX_PATH_POINTS);
    this.noise = new ValueNoise2D(deriveSeed(CONFIG.seed, 'terrain'));
    this.heights = new Float32Array((segments + 1) * (segments + 1));

    this.mesh = new THREE.Mesh(this.createGeometry(), this.createMaterial(materials, textures));
    this.mesh.name = 'terrain';
    this.mesh.receiveShadow = true;
  }

  // Altura "ideal" (ruido) antes de triangular.
  sampleHeight(x, z) {
    const { heightAmplitude, heightFrequency, octaves, flatRadius, flatBlend } = CONFIG.terrain;
    const n = this.noise.fbm(x * heightFrequency, z * heightFrequency, { octaves });
    const height = (n - 0.5) * 2 * heightAmplitude;
    const r = Math.hypot(x - this.center.x, z - this.center.z);
    const t = THREE.MathUtils.smoothstep(r, flatRadius, flatRadius + flatBlend);
    return height * t;
  }

  createGeometry() {
    const { size, segments } = this;
    const { size: textureSize, texelsPerUnit } = CONFIG.textures;
    const uvScale = texelsPerUnit / textureSize;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments).rotateX(-Math.PI / 2);
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;

    // PlaneGeometry: índice = iz * (segments + 1) + ix, con z creciente en iz tras rotar.
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const h = this.sampleHeight(x, z);
      position.setY(i, h);
      uv.setXY(i, x * uvScale, z * uvScale);
      this.heights[i] = h;
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  heightAt(ix, iz) {
    return this.heights[iz * (this.segments + 1) + ix];
  }

  getHeight(x, z) {
    const fx = (x + this.half) / this.cellSize;
    const fz = (z + this.half) / this.cellSize;
    const ix = THREE.MathUtils.clamp(Math.floor(fx), 0, this.segments - 1);
    const iz = THREE.MathUtils.clamp(Math.floor(fz), 0, this.segments - 1);
    const tx = THREE.MathUtils.clamp(fx - ix, 0, 1);
    const tz = THREE.MathUtils.clamp(fz - iz, 0, 1);

    const a = this.heightAt(ix, iz);
    const b = this.heightAt(ix, iz + 1);
    const c = this.heightAt(ix + 1, iz + 1);
    const d = this.heightAt(ix + 1, iz);

    // Triángulos (a, b, d) y (b, c, d), igual que PlaneGeometry.
    if (tx + tz <= 1) return a + (d - a) * tx + (b - a) * tz;
    return c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
  }

  // Distancia con signo al borde del camino (< 0 dentro), sin el ruido del borde.
  pathDistance(x, z) {
    let best = Infinity;
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i];
      const b = this.path[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
      const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)) - (a.width + (b.width - a.width) * t);
      best = Math.min(best, d);
    }
    return best;
  }

  getSurface(x, z) {
    return this.pathDistance(x, z) < 0 ? 'dirt' : 'grass';
  }

  // Material toon de césped que mezcla la tierra del camino por fragmento.
  // La máscara se evalúa en posiciones ajustadas a la rejilla de texels, así
  // el borde del camino queda "pixelado" al mismo tamaño que las texturas.
  createMaterial(materials, textures) {
    const material = new THREE.MeshToonMaterial({
      map: textures.grass,
      gradientMap: materials.gradientMap,
    });

    const pathPoints = [];
    for (let i = 0; i < MAX_PATH_POINTS; i++) {
      const p = this.path[Math.min(i, this.path.length - 1)];
      pathPoints.push(new THREE.Vector3(p.x, p.z, p.width));
    }

    const uniforms = {
      uDirtMap: { value: textures.dirt },
      uNoiseMap: { value: textures.noise },
      uPath: { value: pathPoints },
      uPathCount: { value: this.path.length },
      uTexelsPerUnit: { value: CONFIG.textures.texelsPerUnit },
      uEdgeNoise: { value: CONFIG.path.edgeNoise },
      uEdgeNoiseScale: { value: CONFIG.path.edgeNoiseScale },
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
          #define MAX_PATH_POINTS ${MAX_PATH_POINTS}
          varying vec3 vTerrainWorld;
          uniform sampler2D uDirtMap;
          uniform sampler2D uNoiseMap;
          uniform vec3 uPath[MAX_PATH_POINTS]; // (x, z, ancho)
          uniform int uPathCount;
          uniform float uTexelsPerUnit;
          uniform float uEdgeNoise;
          uniform float uEdgeNoiseScale;

          float pathMask(vec2 p) {
            float edge = 1e5;
            for (int i = 0; i < MAX_PATH_POINTS - 1; i++) {
              if (i >= uPathCount - 1) break;
              vec3 a = uPath[i];
              vec3 b = uPath[i + 1];
              vec2 ab = b.xy - a.xy;
              float t = clamp(dot(p - a.xy, ab) / dot(ab, ab), 0.0, 1.0);
              float d = length(p - (a.xy + ab * t)) - mix(a.z, b.z, t);
              edge = min(edge, d);
            }
            float n1 = texture2D(uNoiseMap, p * uEdgeNoiseScale).r - 0.5;
            float n2 = texture2D(uNoiseMap, p * uEdgeNoiseScale * 4.0 + 0.37).r - 0.5;
            return step(edge + (n1 * 2.0 + n2) * uEdgeNoise, 0.0);
          }`)
        .replace('#include <map_fragment>', `
          vec2 snappedPos = (floor(vTerrainWorld.xz * uTexelsPerUnit) + 0.5) / uTexelsPerUnit;
          vec4 grassColor = texture2D(map, vMapUv);
          vec4 dirtColor = texture2D(uDirtMap, vMapUv);
          diffuseColor *= mix(grassColor, dirtColor, pathMask(snappedPos));`);
    };

    return material;
  }
}
