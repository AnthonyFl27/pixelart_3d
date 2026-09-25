import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStructure } from './structures.js';

// Instancia las estructuras de un nivel y devuelve sus colisionadores y los
// puntos de posado (parte superior de piezas altas, p. ej. dinteles).
// Las piezas se fusionan en una malla por material (1 draw call por material
// para la escena y otra para el shadow map).
export function loadLevel(level, { scene, terrain, materials }) {
  const colliders = [];
  const geometriesByMaterial = new Map();

  level.structures.forEach((entry, index) => {
    const structure = createStructure(entry, index, { terrain, materials });
    colliders.push(...structure.colliders);
    const baseY = structure.group.position.y;
    structure.group.traverse((object) => {
      if (!object.isMesh) return;
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      // Altura sobre la base de la estructura (el musgo crece cerca del suelo).
      const position = geometry.attributes.position;
      const baseHeight = new Float32Array(position.count);
      for (let i = 0; i < position.count; i++) baseHeight[i] = position.getY(i) - baseY;
      geometry.setAttribute('aBaseHeight', new THREE.BufferAttribute(baseHeight, 1));
      if (!geometriesByMaterial.has(object.material)) geometriesByMaterial.set(object.material, []);
      geometriesByMaterial.get(object.material).push(geometry);
      object.geometry.dispose();
    });
  });

  const meshes = [];
  for (const [material, geometries] of geometriesByMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.name = `structures-${material.map?.name ?? 'mesh'}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  }

  return { meshes, colliders };
}
