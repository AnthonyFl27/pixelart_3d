import * as THREE from 'three';

// Caja invisible que recibe el rayo de interacción (Raycaster no mira `visible`).
const MATERIAL = new THREE.MeshBasicMaterial();

export function createHitBox(size, offset = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), MATERIAL);
  mesh.position.fromArray(offset);
  mesh.visible = false;
  return mesh;
}
