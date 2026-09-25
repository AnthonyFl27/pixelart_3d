import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createLayeredTexture } from './textures.js';

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

// Capas del material por capas: nombre de material de las piezas → textura.
// Todas las piezas con uno de estos materiales comparten un único material (y un draw
// call por malla fusionada); la capa va en el atributo `aLayer` y el tinte en `color`.
export const LAYERS = {
  planks: 'planks',
  shingles: 'shingles',
  rustyMetal: 'rustyMetal',
  lattice: 'lattice',
  wood: 'wood',
  bark: 'bark',
  leaves: 'leaves',
  leavesAutumn: 'leavesAutumn',
  wetStone: 'wetStone',
  hearth: 'masonry',
  wallpaper: 'wallpaper',
  fabric: 'fabric',
  rug: 'rug',
  iron: 'iron',
  enamel: 'enamel',
  grain: 'grain',
};
const LAYER_NAMES = Object.keys(LAYERS);

// interiorLighting: InteriorLighting (luces del interior en el material por capas).
export function createMaterials(textures, interiorLighting) {
  const gradientMap = createToonGradient(CONFIG.lighting.toonSteps);
  const toon = (map) => new THREE.MeshToonMaterial({ map, gradientMap });
  const stone = toon(textures.stone);
  addMoss(stone, textures, CONFIG.moss);
  const masonry = toon(textures.masonry);
  addMoss(masonry, textures, CONFIG.masonryMoss);
  const layers = createLayeredTexture(textures, LAYER_NAMES.map((name) => LAYERS[name]));
  return {
    gradientMap,
    stone,
    masonry,
    glass: createGlassMaterial(textures.dirtyGlass, gradientMap),
    layered: createLayeredMaterial(layers, gradientMap, interiorLighting),
  };
}

// Material de una pieza por nombre: { material, layer } (layer = null si no va por capas).
export function resolveMaterial(materials, name) {
  if (name in LAYERS) return { material: materials.layered, layer: LAYER_NAMES.indexOf(name) };
  const material = materials[name];
  if (!material) throw new Error(`Material desconocido: "${name}"`);
  return { material, layer: null };
}

// Añade a una geometría la capa (`aLayer`) y el tinte por vértice (`color`, hex sRGB).
export function paintGeometry(geometry, name, color = 0xffffff) {
  const layer = LAYER_NAMES.indexOf(name);
  if (layer < 0) throw new Error(`Capa desconocida: "${name}"`);
  const count = geometry.attributes.position.count;
  const tint = new THREE.Color(color);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) tint.toArray(colors, i * 3);
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(new Float32Array(count).fill(layer), 1));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Toon con la textura de la capa `aLayer` de un array de texturas × color de vértice.
function createLayeredMaterial(layers, gradientMap, interiorLighting) {
  const material = new THREE.MeshToonMaterial({ gradientMap, vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLayers = { value: layers };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLayer;\nvarying float vLayer;\nvarying vec2 vLayerUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLayer = aLayer;\nvLayerUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform highp sampler2DArray uLayers;\nvarying float vLayer;\nvarying vec2 vLayerUv;')
      .replace('#include <map_fragment>', 'diffuseColor *= texture(uLayers, vec3(vLayerUv, floor(vLayer + 0.5)));');
    interiorLighting?.patch(shader);
  };
  material.customProgramCacheKey = () => 'layered';
  return material;
}

// Cristal sucio translúcido, visible por ambas caras. No proyecta sombras (la luz
// entra por las ventanas): `userData.castShadow` lo lee el cargador de niveles.
function createGlassMaterial(map, gradientMap) {
  const material = new THREE.MeshToonMaterial({
    map,
    gradientMap,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  material.userData.castShadow = false;
  return material;
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
