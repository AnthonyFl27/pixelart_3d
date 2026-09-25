import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';
import { applyBoxUVs, plankUVs } from '../world/geometryUtils.js';
import { paintGeometry } from '../world/materials.js';
import { circleOverlapsBox } from '../player/collision.js';
import { createHitBox } from './hitBox.js';

// Puerta con bisagra: hoja de tablones con travesaños y herrajes que gira con una
// animación suavizada. Su colisionador sigue la rotación; no empieza a moverse (ni sigue)
// si el jugador está en su recorrido.
//
// Datos: { position: bisagra en mundo, rotationY: giro de la pared (cara exterior hacia +Z),
//          width, height, hinge: 1 si la hoja se extiende hacia +X local desde la bisagra, -1 si hacia -X }.
// Abre hacia dentro (-Z local).

const PROMPTS = { open: 'Abrir puerta', close: 'Cerrar puerta' };

export class Door {
  constructor(data, { materials }) {
    const d = CONFIG.door;
    this.name = data.name ?? 'door';
    this.width = data.width;
    this.height = data.height;
    this.side = data.hinge ?? 1;
    this.baseRotation = data.rotationY ?? 0;
    this.openAngle = THREE.MathUtils.degToRad(d.openAngle) * this.side;

    this.object = new THREE.Group();
    this.object.name = `door-${this.name}`;
    this.object.position.fromArray(data.position);
    this.object.rotation.y = this.baseRotation;
    const random = createRandom(deriveSeed(CONFIG.seed, this.object.name));
    this.mesh = new THREE.Mesh(createDoorGeometry(this.width, this.height, this.side, random), materials.layered);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    // Caja invisible que recibe el rayo de interacción (sin huecos entre tablas).
    this.hitBox = createHitBox([this.width, this.height, d.thickness], [this.side * this.width / 2, this.height / 2, 0]);
    this.object.add(this.mesh, this.hitBox);
    this.meshes = [this.hitBox];

    this.progress = 0;     // 0 cerrada … 1 abierta
    this.target = 0;
    this.collider = {
      cx: 0, cz: 0, cos: 1, sin: 0, slope: 0,
      hx: this.width / 2,
      hz: d.thickness / 2 + d.colliderPadding,
      minY: this.object.position.y,
      maxY: this.object.position.y + this.height,
      top: this.object.position.y + this.height,
      surface: 'wood',
      owner: this,
    };
    this.probe = { ...this.collider };
    this.placeBox(this.collider, 0);
  }

  get isOpen() {
    return this.target === 1;
  }

  get position() {
    return this.object.position;
  }

  prompt() {
    return this.isOpen ? PROMPTS.close : PROMPTS.open;
  }

  interact({ player, audio }) {
    const target = this.isOpen ? 0 : 1;
    if (this.sweepBlocked(this.progress, target, player)) return;
    this.target = target;
    const { creak } = CONFIG.audio.sfx;
    audio?.playSfx('creak', this.center(), {
      duration: CONFIG.door.duration * Math.abs(target - this.progress),
      gain: target ? creak.gain : creak.closeGain,
    });
  }

  update(dt, { player, audio }) {
    if (this.progress === this.target) return;
    const step = dt / CONFIG.door.duration;
    const next = this.target > this.progress ? Math.min(this.target, this.progress + step) : Math.max(this.target, this.progress - step);
    // El jugador se ha metido en el recorrido: la puerta espera.
    if (this.sweepBlocked(this.progress, next, player)) return;
    this.progress = next;
    this.object.rotation.y = this.baseRotation + this.angle(next);
    this.object.updateMatrixWorld(true);
    this.placeBox(this.collider, next);
    if (next === 0) audio?.playSfx('slam', this.center());
  }

  // Ángulo de apertura con aceleración y frenado suaves.
  angle(progress) {
    return this.openAngle * progress * progress * (3 - 2 * progress);
  }

  // Coloca una caja (colisionador o sonda) sobre la hoja en el punto `progress` del recorrido.
  placeBox(box, progress) {
    const rotation = this.baseRotation + this.angle(progress);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const half = this.side * this.width / 2;
    box.cx = this.object.position.x + half * cos;
    box.cz = this.object.position.z - half * sin;
    box.cos = cos;
    box.sin = sin;
  }

  // ¿Ocupa el jugador alguna posición intermedia de la hoja entre `from` y `to`?
  sweepBlocked(from, to, player) {
    if (!player) return false;
    const p = player.position;
    const { radius, height } = player.body;
    if (p.y >= this.collider.maxY || p.y + height <= this.collider.minY) return false;
    const samples = CONFIG.door.sweepSamples;
    for (let i = 1; i <= samples; i++) {
      this.placeBox(this.probe, from + (to - from) * (i / samples));
      if (circleOverlapsBox(this.probe, p.x, p.z, radius - 1e-3)) return true;
    }
    return false;
  }

  // Centro de la hoja en mundo (fuente de los sonidos).
  center() {
    return new THREE.Vector3(this.collider.cx, this.object.position.y + this.height / 2, this.collider.cz);
  }
}

// Hoja en el marco de la bisagra: tablas verticales hacia side·X, travesaños y una
// riostra en diagonal por dentro (-Z), bisagras de cinta y tirador de hierro.
function createDoorGeometry(width, height, side, random) {
  const d = CONFIG.door;
  const t = d.thickness;
  const parts = [];
  const box = (sx, sy, sz, x, y, z, uvs, layer = 'planks') => {
    const geometry = paintGeometry(uvs(new THREE.BoxGeometry(sx, sy, sz)), layer);
    geometry.translate(side * x, y, z);
    parts.push(geometry);
    return geometry;
  };
  const plank = (g) => plankUVs(g, random, true);
  const batten = (g) => plankUVs(g, random);
  const iron = (sx, sy, sz, x, y, z) => box(sx, sy, sz, x, y, z, applyBoxUVs, 'iron');

  const boardWidth = width / d.boards;
  for (let i = 0; i < d.boards; i++) {
    box(boardWidth - 0.008, height, t, (i + 0.5) * boardWidth, height / 2, 0, plank);
  }
  const inside = -t / 2 - 0.015;
  const battens = [0.25, height / 2, height - 0.25];
  for (const y of battens) box(width - 0.08, d.battenHeight, 0.03, width / 2, y, inside, batten);
  // Riostras entre travesaños, subiendo hacia la bisagra.
  for (let k = 0; k < 2; k++) {
    const y0 = battens[k] + d.battenHeight / 2;
    const y1 = battens[k + 1] - d.battenHeight / 2;
    const run = width - 0.2;
    const length = Math.hypot(run, y1 - y0);
    const brace = paintGeometry(batten(new THREE.BoxGeometry(length, d.battenHeight * 0.9, 0.03)), 'planks');
    brace.rotateZ(-side * Math.atan2(y1 - y0, run));
    brace.translate(side * width / 2, (y0 + y1) / 2, inside);
    parts.push(brace);
  }

  // Herrajes: bisagras de cinta por fuera y tirador (anilla por fuera, pestillo por dentro).
  for (const y of [0.3, height - 0.3]) iron(0.42, 0.05, 0.012, 0.21, y, t / 2 + 0.006);
  const handleX = width - 0.12;
  iron(0.035, 0.2, 0.035, handleX, d.handleHeight, t / 2 + 0.04);
  iron(0.03, 0.03, 0.04, handleX, d.handleHeight + 0.09, t / 2 + 0.02);
  iron(0.03, 0.03, 0.04, handleX, d.handleHeight - 0.09, t / 2 + 0.02);
  iron(0.22, 0.03, 0.03, handleX - 0.08, d.handleHeight, inside - 0.02);

  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}
