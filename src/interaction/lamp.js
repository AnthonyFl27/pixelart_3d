import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createHitBox } from './hitBox.js';

// Lámpara de aceite: `E` la enciende y la apaga. La llama es una malla sin niebla y la
// luz es una de las luces del interior (InteriorLighting), siempre presente.
// Datos: { position: llama, rotationY, hitSize, hitOffset }.
export class Lamp {
  constructor(data, { interiorLighting }) {
    const l = CONFIG.lamp;
    this.name = data.name ?? 'lamp';
    this.zone = data.zone ?? null;
    this.interiorLighting = interiorLighting;
    this.object = new THREE.Group();
    this.object.name = `lamp-${this.name}`;
    this.object.position.fromArray(data.position);
    this.object.rotation.y = data.rotationY ?? 0;

    this.flame = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.BoxGeometry(...l.flameSize), new THREE.MeshBasicMaterial({ color: l.flameColor, fog: false }));
    const core = new THREE.Mesh(new THREE.BoxGeometry(...l.flameSize.map((v) => v * 0.5)), new THREE.MeshBasicMaterial({ color: l.coreColor, fog: false }));
    core.position.y = -l.flameSize[1] * 0.2;
    this.flame.add(outer, core);
    this.flame.visible = false;
    const hit = createHitBox(data.hitSize ?? [0.16, 0.36, 0.16], data.hitOffset ?? [0, 0, 0]);
    this.object.add(this.flame, hit);
    this.meshes = [hit];

    this.on = false;
    this.level = 0;        // 0-1: la luz sube y baja con suavidad
    this.time = Math.random() * 10;
    this.lightPosition = new THREE.Vector3();
    this.object.updateMatrixWorld(true);
    this.update(0);
  }

  prompt() {
    return this.on ? 'Apagar lámpara' : 'Encender lámpara';
  }

  interact({ audio }) {
    this.on = !this.on;
    audio?.playSfx('lamp', this.lightPosition, { on: this.on });
  }

  update(dt) {
    const l = CONFIG.lamp;
    this.time += dt;
    this.level = THREE.MathUtils.clamp(this.level + (this.on ? dt : -dt) / l.fadeTime, 0, 1);
    const t = this.time;
    const flicker = 1 + l.flicker * (0.6 * Math.sin(t * 9.3) + 0.4 * Math.sin(t * 23.7 + 1.1));
    this.flame.visible = this.level > 0.05;
    this.flame.scale.set(1, (0.6 + 0.4 * this.level) * flicker, 1);
    this.object.localToWorld(this.lightPosition.set(0, l.lightHeight, 0));
    this.interiorLighting.setLight(l.lightIndex, this.lightPosition, l.lightColor, l.intensity * this.level * flicker, l.range);
  }
}
