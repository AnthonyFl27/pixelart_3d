import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Luz direccional con sombras duras (sol de día, luna de noche) + luz hemisférica
// de ambiente + relleno desde la cámara. Colores e intensidades vienen del ciclo de día.
// El área de sombras sigue al jugador y se ajusta a la rejilla de texels del
// shadow map para que las sombras no "tiemblen" al moverse.
export class Lighting {
  constructor(scene) {
    const s = CONFIG.lighting.shadow;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
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

    this.fill = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(this.fill);
    scene.add(this.fill.target);
    this.viewDirection = new THREE.Vector3();

    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.worldUp = new THREE.Vector3(0, 1, 0);
    this.texelSize = (2 * s.extent) / s.mapSize;
    this.center = new THREE.Vector3();
  }

  update(focus, camera, day) {
    this.hemi.color.copy(day.ambientSky);
    this.hemi.groundColor.copy(day.ambientGround);
    this.hemi.intensity = day.ambientIntensity;

    this.sun.color.copy(day.lightColor);
    this.sun.intensity = day.lightIntensity;

    // Centro del área de sombras ajustado a la rejilla de texels en el espacio de la luz.
    this.forward.copy(day.lightDirection).negate();
    this.right.crossVectors(this.forward, this.worldUp).normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
    const t = this.texelSize;
    const r = Math.round(focus.dot(this.right) / t) * t;
    const u = Math.round(focus.dot(this.up) / t) * t;
    const f = focus.dot(this.forward);
    this.center
      .copy(this.right).multiplyScalar(r)
      .addScaledVector(this.up, u)
      .addScaledVector(this.forward, f);

    this.sun.target.position.copy(this.center);
    this.sun.position.copy(this.center).addScaledVector(day.lightDirection, CONFIG.lighting.shadow.distance);
    this.sun.target.updateMatrixWorld();

    // Relleno: desde detrás de la cámara, ligeramente a la derecha y elevado.
    this.fill.color.copy(day.fill);
    this.fill.intensity = day.fillIntensity;
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
