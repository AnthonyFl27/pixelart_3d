import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';
import { createBuilder } from '../world/furniture.js';
import { paintGeometry } from '../world/materials.js';
import { ITEMS } from '../items/inventory.js';
import { createHitBox } from './hitBox.js';

// Objeto del mundo que se recoge con `E` y pasa al inventario (spec v3, 4.11 y 4.13).
// Datos: { item: id de ITEMS, count, model: nombre en PICKUP_MODELS, position, rotationY,
//          hitSize, hitOffset }. Si no cabe entero se recoge lo que cabe y el resto se
// queda en el mundo; al vaciarse el objeto desaparece (no reaparece).

// Modelos en el mundo, construidos como los muebles (furniture.js: f.box, f.cylinder)
// con el material por capas: una malla y un draw call por objeto.
export const PICKUP_MODELS = {
  // Escopeta recortada tumbada a lo largo de X (boca hacia -X), centrada en los cañones.
  shotgun(f) {
    const metal = 0x6a6e76;
    const dark = 0x2e3034;
    const wood = 0x8a5a32;
    for (const z of [-0.017, 0.017]) {
      f.cylinder('iron', { radius: 0.016, height: 0.34, axis: 'x', x: -0.15, z, color: metal, segments: 8 });
      f.cylinder('iron', { radius: 0.018, height: 0.012, axis: 'x', x: -0.314, z, color: dark, segments: 8 });
    }
    f.box('iron', [-0.32, 0.016, -0.005], [0.02, 0.022, 0.005], { color: 0x9aa0a8 });
    f.box('wood', [-0.14, -0.028, -0.022], [0.0, -0.012, 0.022], { color: wood });
    f.box('iron', [0.02, -0.016, -0.028], [0.11, 0.026, 0.028], { color: 0x8a9098 });
    f.box('iron', [0.07, 0.026, -0.006], [0.1, 0.032, 0.006], { color: 0x9aa0a8 });
    f.box('iron', [0.04, -0.03, -0.004], [0.1, -0.024, 0.004], { color: dark });
    f.box('wood', [0.11, -0.016, -0.021], [0.2, 0.02, 0.021], { color: wood });
    const grip = f.box('wood', [-0.024, -0.1, -0.02], [0.024, 0, 0.02], { color: shade(wood, 0.9) });
    grip.rotateZ(0.45);
    grip.translate(0.2, 0.004, 0);
    const cap = f.box('iron', [-0.026, -0.112, -0.021], [0.026, -0.1, 0.021], { color: dark });
    cap.rotateZ(0.45);
    cap.translate(0.2, 0.004, 0);
  },

  // Caja de cartón con la etiqueta roja y un cartucho dibujado (base en y = 0).
  shellBox(f) {
    f.box('grain', [-0.085, 0, -0.055], [0.085, 0.08, 0.055], { color: 0xb08850 });
    f.box('grain', [-0.086, 0.024, -0.056], [0.086, 0.058, 0.056], { color: 0xb02a20 });
    f.box('grain', [-0.04, 0.032, 0.056], [0.014, 0.05, 0.058], { color: 0xd84a3a });
    f.box('grain', [0.014, 0.032, 0.056], [0.036, 0.05, 0.058], { color: 0xe8b848 });
    f.box('grain', [-0.085, 0.08, -0.055], [0.085, 0.084, 0.055], { color: 0x9a7440 });
  },

  // Farol de aceite (base en y = 0, asa arriba en y ≈ 0,26).
  lantern(f) {
    const iron = 0x4a4a4e;
    f.cylinder('iron', { radius: 0.06, height: 0.008, y: 0.004, color: iron, segments: 8 });
    f.cylinder('iron', { radius: 0.058, height: 0.045, y: 0.03, color: 0x9a3424, segments: 8 });
    f.cylinder('iron', { radius: 0.03, height: 0.015, y: 0.06, color: iron, segments: 8 });
    f.cylinder('grain', { radius: 0.04, height: 0.1, y: 0.117, color: 0xe8d8a8, segments: 8 });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(angle) * 0.047;
      const z = Math.sin(angle) * 0.047;
      f.box('iron', [x - 0.003, 0.067, z - 0.003], [x + 0.003, 0.167, z + 0.003], { color: iron });
    }
    f.cylinder('iron', { radius: 0.045, height: 0.03, y: 0.182, color: iron, segments: 8 });
    f.cylinder('iron', { radius: 0.018, height: 0.02, y: 0.207, color: iron, segments: 8 });
    f.box('iron', [-0.035, 0.254, -0.003], [0.035, 0.26, 0.003], { color: iron });
    for (const x of [-0.035, 0.035]) f.box('iron', [x - 0.003, 0.18, -0.003], [x + 0.003, 0.26, 0.003], { color: iron });
  },
};

export class Pickup {
  constructor(data, { materials }) {
    this.item = ITEMS[data.item];
    if (!this.item) throw new Error(`Objeto desconocido: "${data.item}"`);
    this.name = data.name ?? data.item;
    this.zone = data.zone ?? null;
    this.count = data.count ?? 1;
    this.removed = false;
    this.object = new THREE.Group();
    this.object.name = `pickup-${this.name}`;
    this.object.position.fromArray(data.position);
    this.object.rotation.y = data.rotationY ?? 0;

    const model = createModel(data.model ?? data.item, this.name, materials);
    const hit = createHitBox(data.hitSize ?? [0.2, 0.2, 0.2], data.hitOffset ?? [0, 0, 0]);
    this.object.add(model, hit);
    this.meshes = [hit];
  }

  get position() {
    return this.object.position;
  }

  // Acción, o un aviso sin acción si no cabe: `Munición al máximo` al llegar al límite
  // del objeto y `Inventario lleno` si no hay ranura ni pila con sitio.
  prompt({ inventory }) {
    const { item } = this;
    if (inventory.room(item.id) <= 0) {
      const atLimit = item.limit !== undefined && inventory.count(item.id) + (inventory.external[item.id] ?? 0) >= item.limit;
      return { text: atLimit ? item.limitText ?? CONFIG.pickup.fullText : CONFIG.pickup.fullText, notice: true };
    }
    const action = `Coger ${item.name.toLowerCase()}`;
    return item.stackable ? `${action} (${this.count})` : action;
  }

  interact({ inventory, audio }) {
    const added = inventory.addItem(this.item.id, this.count);
    if (added <= 0) return;
    this.count -= added;
    if (this.item.pickupSound) audio?.playSfx('pickup', this.position, { kind: this.item.pickupSound });
    if (this.count > 0) return;
    this.removed = true;
    this.object.removeFromParent();
  }
}

// Una malla con todas las piezas del modelo pintadas para el material por capas.
function createModel(name, seedKey, materials) {
  const build = PICKUP_MODELS[name];
  if (!build) throw new Error(`Modelo de objeto desconocido: "${name}"`);
  const geometries = [];
  const random = createRandom(deriveSeed(CONFIG.seed, `pickup-${seedKey}`));
  build(createBuilder(random, { add: (layer, geometry, color) => geometries.push({ layer, geometry, color }) }));
  const merged = mergeGeometries(geometries.map(({ layer, geometry, color }) => paintGeometry(geometry, layer, color)));
  geometries.forEach(({ geometry }) => geometry.dispose());
  const mesh = new THREE.Mesh(merged, materials.layered);
  mesh.receiveShadow = true;
  return mesh;
}

function shade(hex, factor) {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}
