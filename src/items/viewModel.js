import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';

// Objeto en primera persona (antorcha, escopeta, farol). Se dibuja en una escena propia
// (capa superpuesta del pipeline) para no atravesar paredes. Gestiona sacar/guardar,
// el balanceo al caminar y el retardo al girar; cada objeto añade su modelo a `model`.
// config: { equipSpeed, viewFov, viewPosition, viewScale, viewRotation, bobFrequency,
//           bobAmount, swayAmount }.
export class ViewModel {
  constructor(config) {
    this.config = config;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(config.viewFov, 1, 0.01, 10);
    this.ambient = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.ambient);

    this.model = new THREE.Group();
    this.model.scale.setScalar(config.viewScale);
    this.scene.add(this.model);

    this.equip = 0;        // 0 = guardado, 1 = en la mano
    this.eased = 0;
    this.bobPhase = 0;
    this.lastYaw = null;
    this.sway = 0;
    this.moving = 0;
  }

  get visible() {
    return this.equip > 0.001;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // active: si el objeto está seleccionado. Devuelve true si se ve (hay que animarlo).
  update(dt, { active, player, day }) {
    const c = this.config;
    this.equip = THREE.MathUtils.clamp(this.equip + (active ? dt : -dt) * c.equipSpeed, 0, 1);
    this.eased = this.equip * this.equip * (3 - 2 * this.equip);
    this.model.visible = this.visible;
    if (!this.visible) return false;

    // Luz ambiente de la vista = ambiente del mundo.
    this.ambient.color.copy(day.ambientSky).lerp(day.lightColor, 0.3);
    this.ambient.intensity = day.ambientIntensity * 0.9 + day.lightIntensity * 0.25;

    // Balanceo al caminar y retardo al girar.
    const speed = player.flying ? 0 : player.horizontalSpeed;
    this.moving = Math.min(speed / CONFIG.player.walkSpeed, 1.5);
    this.bobPhase += dt * speed * c.bobFrequency;
    if (this.lastYaw === null) this.lastYaw = player.yaw;
    const yawDelta = THREE.MathUtils.clamp(player.yaw - this.lastYaw, -0.2, 0.2);
    this.lastYaw = player.yaw;
    this.sway += (yawDelta * c.swayAmount - this.sway) * Math.min(1, dt * 10);

    const base = c.viewPosition;
    this.model.position.set(
      base.x + Math.sin(this.bobPhase) * c.bobAmount * this.moving + this.sway,
      base.y - Math.abs(Math.cos(this.bobPhase)) * c.bobAmount * 1.4 * this.moving - (1 - this.eased) * 0.5,
      base.z,
    );
    this.model.rotation.set(c.viewRotation.x, c.viewRotation.y, c.viewRotation.z + this.sway * 2);
    return true;
  }
}

// Textura pixel de 4x16 con colores al azar de `colors` (vetas de madera, metal).
export function createStripeTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const random = createRandom(deriveSeed(CONFIG.seed, colors.join('')));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = colors[Math.floor(random() * colors.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// Fusiona piezas [{ material, geometry }] en una malla por material (menos draw calls).
export function mergeByMaterial(parts) {
  const groups = new Map();
  for (const { material, geometry } of parts) {
    if (!groups.has(material)) groups.set(material, []);
    groups.get(material).push(geometry.index ? geometry.toNonIndexed() : geometry);
  }
  return [...groups].map(([material, geometries]) => new THREE.Mesh(mergeGeometries(geometries), material));
}
