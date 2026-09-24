import { createStructure } from './structures.js';

// Instancia las estructuras de un nivel y devuelve sus colisionadores.
export function loadLevel(level, { scene, terrain, materials }) {
  const colliders = [];
  const structures = [];
  level.structures.forEach((entry, index) => {
    const structure = createStructure(entry, index, { terrain, materials });
    scene.add(structure.group);
    structures.push(structure.group);
    colliders.push(...structure.colliders);
  });
  return { structures, colliders };
}
