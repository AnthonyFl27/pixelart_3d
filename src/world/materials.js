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
  return {
    stone: toon(textures.stone),
    grass: toon(textures.grass),
    dirt: toon(textures.dirt),
  };
}
