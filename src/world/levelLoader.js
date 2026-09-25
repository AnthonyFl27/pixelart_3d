import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createStructure } from './structures.js';

// Instancia las estructuras de un nivel y devuelve sus colisionadores, zonas
// (volúmenes con nombre, p. ej. el interior de la cabaña), objetos interactivos (datos)
// e interiores. Las piezas se fusionan en una malla por material (1 draw call por material
// para la escena y otra para el shadow map, salvo materiales sin sombra). Las piezas
// `interior` de cada estructura se fusionan aparte en un grupo que se puede ocultar
// (sin sombras propias): `interiors: [{ group, zone }]`.
export function loadLevel(level, { scene, terrain, materials }) {
  const colliders = [];
  const zones = [];
  const interactables = [];
  const interiors = [];
  const exterior = new Map();

  level.structures.forEach((entry, index) => {
    const structure = createStructure(entry, index, { terrain, materials });
    colliders.push(...structure.colliders);
    zones.push(...structure.zones);
    interactables.push(...structure.interactables);
    const interior = new Map();
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
      const target = object.userData.piece.interior ? interior : exterior;
      if (!target.has(object.material)) target.set(object.material, []);
      target.get(object.material).push(geometry);
      object.geometry.dispose();
    });
    if (interior.size) {
      const group = new THREE.Group();
      group.name = `${structure.group.name}-interior`;
      for (const mesh of mergeByMaterial(interior)) {
        mesh.castShadow = false;
        group.add(mesh);
      }
      scene.add(group);
      interiors.push({ group, zone: structure.zones[0] ?? null });
    }
  });

  const meshes = mergeByMaterial(exterior);
  for (const mesh of meshes) {
    mesh.castShadow = mesh.material.userData.castShadow !== false;
    scene.add(mesh);
  }
  return { meshes, colliders, zones, interactables, interiors };
}

function mergeByMaterial(geometriesByMaterial) {
  const meshes = [];
  for (const [material, geometries] of geometriesByMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.name = `structures-${material.map?.name ?? 'mesh'}`;
    mesh.receiveShadow = true;
    meshes.push(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  }
  return meshes;
}
