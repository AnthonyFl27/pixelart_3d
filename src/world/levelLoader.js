import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStructure } from './structures.js';

// Instancia las estructuras de un nivel y devuelve sus colisionadores.
// Todas las piezas comparten material, así que se fusionan en una sola malla
// (1 draw call para la escena y otra para el shadow map).
export function loadLevel(level, { scene, terrain, materials }) {
  const colliders = [];
  const geometries = [];

  level.structures.forEach((entry, index) => {
    const structure = createStructure(entry, index, { terrain, materials });
    colliders.push(...structure.colliders);
    structure.group.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      geometries.push(geometry);
      object.geometry.dispose();
    });
  });

  const stones = new THREE.Mesh(mergeGeometries(geometries), materials.stone);
  stones.name = 'structures';
  stones.castShadow = true;
  stones.receiveShadow = true;
  scene.add(stones);
  geometries.forEach((geometry) => geometry.dispose());

  return { stones, colliders };
}
