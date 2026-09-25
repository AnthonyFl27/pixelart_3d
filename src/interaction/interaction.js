import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rayBoxDistance } from '../player/collision.js';
import { Door } from './door.js';
import { Seat } from './seat.js';
import { Lamp } from './lamp.js';
import { Television } from './television.js';
import { Pickup } from './pickup.js';
import { Radio } from './radio.js';

// Sistema de interacción genérico. Cada objeto interactivo expone:
//   { meshes: Object3D[] (lo que apunta el rayo), object?: Object3D (se añade a la escena),
//     collider?: caja de colisión (se añade a los colisionadores del jugador),
//     prompt(context) -> texto de la acción, { text, notice } (aviso sin acción) o null,
//     interact(context), update?(dt, context), removed? (true: se retira tras interactuar) }
// Los objetos se crean a partir de datos del nivel con INTERACTABLE_TYPES: añadir un tipo
// nuevo no requiere tocar el bucle principal.

export const INTERACTABLE_TYPES = {
  door: (data, context) => new Door(data, context),
  seat: (data) => new Seat(data),
  lamp: (data, context) => new Lamp(data, context),
  television: (data, context) => new Television(data, context),
  pickup: (data, context) => new Pickup(data, context),
  radio: (data, context) => new Radio(data, context),
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
    this.prompt = null;
    this.raycaster = new THREE.Raycaster();
  }

  // Crea y registra los interactivos declarados como datos ({ type, ... }).
  load(entries, context) {
    for (const data of entries) {
      const build = INTERACTABLE_TYPES[data.type];
      if (!build) throw new Error(`Tipo de interactivo desconocido: "${data.type}"`);
      const item = build(data, context);
      item.type = data.type;
      this.register(item);
    }
  }

  // Interactivos de un tipo que pertenecen a la zona `zone` (p. ej. las puertas de la cabaña).
  itemsOf(type, zone) {
    return this.items.filter((item) => item.type === type && item.zone === zone);
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

  // Retira un objeto (p. ej. recogido): deja de recibir el rayo y de colisionar.
  remove(item) {
    this.items = this.items.filter((other) => other !== item);
    this.meshes = this.meshes.filter((mesh) => mesh.userData.interactable !== item);
    if (item.collider) this.colliders.splice(this.colliders.indexOf(item.collider), 1);
    item.object?.removeFromParent();
    if (this.target === item) this.target = null;
  }

  // context: { player, audio, inventory, ... }. Devuelve el aviso (ver Prompt.show) o null.
  // Sentado, el alcance es mayor y `E` sin objeto apuntado levanta al jugador.
  update(dt, input, context) {
    for (const item of this.items) item.update?.(dt, context);
    const { player } = context;
    const { reach, seatedReach, key } = CONFIG.interaction;
    this.target = this.findTarget(player?.seat ? seatedReach : reach);
    const pressed = input.wasPressed(key);
    if (!this.target) {
      if (pressed && player?.seat) player.standUp();
      this.prompt = null;
      return null;
    }
    if (pressed) this.target.interact(context);
    if (this.target.removed) this.remove(this.target);
    this.prompt = this.target?.prompt(context) ?? null;
    return this.prompt;
  }

  // Texto del aviso actual (HUD).
  get promptText() {
    return typeof this.prompt === 'string' ? this.prompt : this.prompt?.text ?? '-';
  }

  // Objeto interactivo en el centro de la pantalla dentro del alcance, si ningún
  // colisionador (paredes, muebles) se interpone.
  findTarget(reach) {
    const { occlusionMargin } = CONFIG.interaction;
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
