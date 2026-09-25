import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';

// Luz de mano en el mundo, compartida por la antorcha y el farol (spec v3, RNF-304): una
// única PointLight siempre presente (intensidad 0 sin luz equipada, sin recompilar
// shaders) que toma el perfil del objeto que más luce. Perfil (`CONFIG.<objeto>.light`):
// { color, intensity, distance, decay, offset, jitter, flicker }.
export class HandLight {
  constructor() {
    this.light = new THREE.PointLight(0xffffff, 0, 1, 1);
    this.light.name = 'hand-light';
    this.random = createRandom(deriveSeed(CONFIG.seed, 'hand-light'));
    this.profile = null;
    this.elapsed = 0;
    this.offset = new THREE.Vector3();
  }

  // sources: objetos con { lightConfig, lightLevel (0-1) }.
  update(dt, camera, sources) {
    this.elapsed += dt;
    let source = null;
    for (const candidate of sources) {
      if (candidate.lightLevel > (source?.lightLevel ?? 0)) source = candidate;
    }
    if (!source) {
      this.light.intensity = 0;
      return;
    }
    const p = source.lightConfig;
    if (p !== this.profile) {
      this.profile = p;
      this.light.color.set(p.color);
      this.light.distance = p.distance;
      this.light.decay = p.decay;
    }
    const e = this.elapsed;
    const flicker = 1 + p.flicker * (0.55 * Math.sin(e * 13.7) + 0.3 * Math.sin(e * 23.1 + 1.3) + 0.3 * (this.random() - 0.5));
    this.light.intensity = p.intensity * flicker * source.lightLevel;

    // Posición: a la altura de la llama, delante-derecha de la cámara, con un leve temblor.
    this.offset.set(p.offset.x, p.offset.y, p.offset.z).applyQuaternion(camera.quaternion);
    this.light.position.copy(camera.position).add(this.offset);
    this.light.position.x += Math.sin(e * 9.1) * p.jitter;
    this.light.position.y += Math.sin(e * 11.3 + 2) * p.jitter;
  }
}
