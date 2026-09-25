import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rayBoxDistance } from '../player/collision.js';
import { Door } from './door.js';

// Sistema de interacción genérico. Cada objeto interactivo expone:
//   { meshes: Object3D[] (lo que apunta el rayo), object?: Object3D (se añade a la escena),
//     collider?: caja de colisión (se añade a los colisionadores del jugador),
//     prompt(context) -> texto de la acción o null, interact(context), update?(dt, context) }
// Los objetos se crean a partir de datos del nivel con INTERACTABLE_TYPES: añadir un tipo
// nuevo no requiere tocar el bucle principal.

export const INTERACTABLE_TYPES = {
  door: (data, context) => new Door(data, context),
};

const SCREEN_CENTER = new THREE.Vector2(0, 0);

export class Interaction {
  constructor({ scene, camera, colliders }) {
    this.scene = scene;
    this.camera = camera;
    this.colliders = colliders;
    this.items = [];
    this.meshes = [];
    this.target = null;
    this.raycaster = new THREE.Raycaster();
  }

  // Crea y registra los interactivos declarados como datos ({ type, ... }).
  load(entries, context) {
    for (const data of entries) {
      const build = INTERACTABLE_TYPES[data.type];
      if (!build) throw new Error(`Tipo de interactivo desconocido: "${data.type}"`);
      this.register(build(data, context));
    }
  }

  register(item) {
    this.items.push(item);
    for (const mesh of item.meshes) {
      mesh.userData.interactable = item;
      this.meshes.push(mesh);
    }
    if (item.object) this.scene.add(item.object);
    if (item.collider) this.colliders.push(item.collider);
  }

  // context: { player, audio, ... }. Devuelve el texto del aviso o null.
  update(dt, input, context) {
    for (const item of this.items) item.update?.(dt, context);
    this.target = this.findTarget();
    if (!this.target) return null;
    if (input.wasPressed(CONFIG.interaction.key)) this.target.interact(context);
    return this.target.prompt(context);
  }

  // Objeto interactivo en el centro de la pantalla dentro del alcance, si ningún
  // colisionador (paredes, muebles) se interpone.
  findTarget() {
    const { reach, occlusionMargin } = CONFIG.interaction;
    this.raycaster.setFromCamera(SCREEN_CENTER, this.camera);
    this.raycaster.far = reach;
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    if (!hit) return null;
    const item = hit.object.userData.interactable;
    const { origin, direction } = this.raycaster.ray;
    for (const collider of this.colliders) {
      if (collider.owner === item) continue;
      if (rayBoxDistance(collider, origin, direction, hit.distance) < hit.distance - occlusionMargin) return null;
    }
    return item;
  }
}
