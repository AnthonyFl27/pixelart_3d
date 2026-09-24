import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Sol direccional con sombras duras + luz hemisférica de ambiente + relleno.
// El área de sombras sigue al jugador y se ajusta a la rejilla de texels del
// shadow map para que las sombras no "tiemblen" al moverse.
export class Lighting {
  constructor(scene) {
    const l = CONFIG.lighting;
    const s = l.shadow;

    this.hemi = new THREE.HemisphereLight(l.skyColor, l.groundColor, l.hemiIntensity);
    scene.add(this.hemi);

    this.direction = new THREE.Vector3(l.sunDirection.x, l.sunDirection.y, l.sunDirection.z).normalize();
    this.sun = new THREE.DirectionalLight(l.sunColor, l.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(s.mapSize, s.mapSize);
    this.sun.shadow.bias = s.bias;
    this.sun.shadow.normalBias = s.normalBias;
    const cam = this.sun.shadow.camera;
    cam.left = -s.extent;
    cam.right = s.extent;
    cam.top = s.extent;
    cam.bottom = -s.extent;
    cam.near = 1;
    cam.far = s.distance * 2;
    cam.updateProjectionMatrix();
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(l.fillColor, l.fillIntensity);
    scene.add(this.fill);
    scene.add(this.fill.target);
    this.viewDirection = new THREE.Vector3();

    // Base del espacio de luz para ajustar el centro a la rejilla de texels.
    this.forward = this.direction.clone().negate();
    this.right = new THREE.Vector3().crossVectors(this.forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.up = new THREE.Vector3().crossVectors(this.right, this.forward).normalize();
    this.texelSize = (2 * s.extent) / s.mapSize;
    this.center = new THREE.Vector3();
  }

  update(focus, camera) {
    const t = this.texelSize;
    const r = Math.round(focus.dot(this.right) / t) * t;
    const u = Math.round(focus.dot(this.up) / t) * t;
    const f = focus.dot(this.forward);
    this.center
      .copy(this.right).multiplyScalar(r)
      .addScaledVector(this.up, u)
      .addScaledVector(this.forward, f);

    this.sun.target.position.copy(this.center);
    this.sun.position.copy(this.center).addScaledVector(this.direction, CONFIG.lighting.shadow.distance);
    this.sun.target.updateMatrixWorld();

    // Relleno: desde detrás de la cámara, ligeramente a la derecha y elevado.
    const { fillElevation, fillSideOffset } = CONFIG.lighting;
    camera.getWorldDirection(this.viewDirection);
    const dx = -this.viewDirection.x;
    const dz = -this.viewDirection.z;
    const length = Math.hypot(dx, dz) || 1;
    this.fill.target.position.copy(focus);
    this.fill.position.set(
      focus.x + (dx + dz * fillSideOffset) / length,
      focus.y + fillElevation,
      focus.z + (dz - dx * fillSideOffset) / length,
    );
    this.fill.target.updateMatrixWorld();
  }
}
