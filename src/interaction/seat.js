import * as THREE from 'three';
import { createHitBox } from './hitBox.js';

// Asiento (plaza de sofá, sillón, silla): `E` sienta al jugador mirando al frente del
// mueble (+Z local). El movimiento y el giro limitado los gestiona el controlador.
// Datos: { position: punto de apoyo sobre el cojín, rotationY, hitSize, hitOffset }.
export class Seat {
  constructor(data) {
    this.name = data.name ?? 'seat';
    this.zone = data.zone ?? null;
    this.object = new THREE.Group();
    this.object.name = `seat-${this.name}`;
    this.object.position.fromArray(data.position);
    this.object.rotation.y = data.rotationY ?? 0;
    const hit = createHitBox(data.hitSize, data.hitOffset);
    this.object.add(hit);
    this.meshes = [hit];
    this.rotationY = this.object.rotation.y;
  }

  get position() {
    return this.object.position;
  }

  prompt({ player }) {
    return player.seat === this ? 'Levantarse' : 'Sentarse';
  }

  interact({ player }) {
    if (player.seat === this) player.standUp();
    else player.sit(this);
  }
}
