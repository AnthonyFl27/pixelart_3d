import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Materiales toon: la luz directa se reduce a `lighting.toonSteps` bandas sin degradado.

export function createToonGradient(steps) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    data[i] = Math.round((i / (steps - 1)) * 255);
  }
  const texture = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function createMaterials(textures) {
  const gradientMap = createToonGradient(CONFIG.lighting.toonSteps);
  const toon = (map) => new THREE.MeshToonMaterial({ map, gradientMap });
  const stone = toon(textures.stone);
  addMoss(stone, textures, CONFIG.moss);
  const masonry = toon(textures.masonry);
  addMoss(masonry, textures, CONFIG.masonryMoss);
  return {
    gradientMap,
    stone,
    wetStone: toon(textures.wetStone),
    masonry,
    wood: toon(textures.wood),
    leavesAutumn: toon(textures.leavesAutumn),
    grass: toon(textures.grass),
    dirt: toon(textures.dirt),
    bark: toon(textures.bark),
    leaves: toon(textures.leaves),
  };
}

// Mezcla la textura de musgo sobre la piedra según orientación, altura sobre la base de
// la estructura (atributo aBaseHeight) y ruido. La máscara se evalúa en la rejilla de
// texels para que el borde quede pixelado.
function addMoss(material, textures, m) {
  const uniforms = {
    uMossMap: { value: textures.moss },
    uMossNoise: { value: textures.noise },
    uMossTexels: { value: CONFIG.textures.texelsPerUnit },
    uMossWeights: { value: new THREE.Vector4(m.upWeight, m.northWeight, m.groundWeight, m.noiseWeight) },
    uMossScale: { value: m.noiseScale },
    uMossThreshold: { value: m.threshold },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBaseHeight;\nvarying vec3 vMossPos;\nvarying vec3 vMossNormal;\nvarying float vMossHeight;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vMossPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vMossNormal = normalize(mat3(modelMatrix) * objectNormal);
        vMossHeight = aBaseHeight;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vMossPos;
        varying vec3 vMossNormal;
        varying float vMossHeight;
        uniform sampler2D uMossMap;
        uniform sampler2D uMossNoise;
        uniform float uMossTexels;
        uniform vec4 uMossWeights;
        uniform float uMossScale;
        uniform float uMossThreshold;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 mossPos = (floor(vMossPos * uMossTexels) + 0.5) / uMossTexels;
        float mossNoise = texture2D(uMossNoise, (mossPos.xz + mossPos.y * vec2(0.7, -0.4)) * uMossScale).r;
        vec3 mossNormal = normalize(vMossNormal);
        float mossAmount = max(mossNormal.y, 0.0) * uMossWeights.x
          + max(mossNormal.z, 0.0) * uMossWeights.y
          + (1.0 - smoothstep(0.0, 0.9, vMossHeight)) * uMossWeights.z
          + mossNoise * uMossWeights.w;
        if (mossAmount > uMossThreshold) diffuseColor.rgb = texture2D(uMossMap, vMapUv).rgb;`);
  };
}
