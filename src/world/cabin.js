import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyBoxUVs, extrudeAcross } from './geometryUtils.js';

// Carcasa de la cabaña de madera (spec v3, 4.5): paredes de tablas con huecos de puerta y
// ventanas, tejado a dos aguas con tablillas, chapas y un agujero, porche con techo,
// barandilla y escalones, chimenea de piedra, pilotes y zócalo de celosía.
//
// Ejes locales: X a lo ancho de la fachada, +Z hacia el porche, y = 0 en el suelo
// interior. Cada pieza se genera en un marco propio (pared, faldón, escalera) y se pasa
// al de la cabaña con `this.frame`. Los colisionadores son cajas en el marco de la cabaña
// (las paredes solo giran múltiplos de 90°) salvo la rampa de los escalones.

const WALLS = ['front', 'back', 'left', 'right'];

export function createCabin(params, random, { ground }) {
  const config = { ...CONFIG.cabin, ...params };
  return new CabinBuilder(config, random, ground).build();
}

// Marco de una pared: a lo largo de X, cara exterior hacia +Z, y = 0 en el suelo.
function wallMatrix(wall, width, depth) {
  const m = new THREE.Matrix4();
  if (wall === 'front') return m.makeTranslation(0, 0, depth / 2);
  if (wall === 'back') return m.makeRotationY(Math.PI).setPosition(0, 0, -depth / 2);
  if (wall === 'right') return m.makeRotationY(Math.PI / 2).setPosition(width / 2, 0, 0);
  return m.makeRotationY(-Math.PI / 2).setPosition(-width / 2, 0, 0);
}

// Marco de un faldón: X a lo ancho, Y normal al tejado, Z pendiente abajo desde (0, y, z).
// side = 1 baja hacia +Z, -1 hacia -Z (con X invertida para conservar la orientación).
function slopeMatrix(side, angle, y, z) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new THREE.Matrix4().makeBasis(
    new THREE.Vector3(side, 0, 0),
    new THREE.Vector3(0, cos, side * sin),
    new THREE.Vector3(0, -sin, side * cos),
  ).setPosition(0, y, z);
}

// UVs de tabla: cada pieza muestra una sola fila de la textura `planks` con un
// desplazamiento aleatorio a lo largo. `vertical`: la veta sigue el eje Y.
function plankUVs(geometry, random, vertical = false) {
  applyBoxUVs(geometry);
  const { size, planks } = CONFIG.textures;
  const rows = size / planks.rowHeight;
  const du = Math.floor(random() * size) / size;
  const dv = 1 - (Math.floor(random() * rows) * planks.rowHeight + planks.rowHeight / 2) / size;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (vertical) uv.setXY(i, v + du, u + dv);
    else uv.setXY(i, u + du, v + dv);
  }
  return geometry;
}

// Box mapping con los ejes U/V intercambiados (veta vertical en `wood`).
function verticalUVs(geometry) {
  applyBoxUVs(geometry);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
  return geometry;
}

// Tramos de [from, to] que quedan libres tras quitar los intervalos `blocked`.
function subtractIntervals(from, to, blocked) {
  const free = [];
  let start = from;
  for (const [a, b] of [...blocked].sort((p, q) => p[0] - q[0])) {
    if (a > start) free.push([start, Math.min(a, to)]);
    start = Math.max(start, b);
  }
  if (start < to) free.push([start, to]);
  return free.filter(([a, b]) => b - a > 1e-3);
}

class CabinBuilder {
  constructor(config, random, ground) {
    const c = config;
    this.c = c;
    this.random = random;
    this.W = c.width;
    this.D = c.depth;
    this.H = c.wallHeight;
    this.R = c.ridgeHeight;
    this.alpha = Math.atan2(this.R - this.H, this.D / 2);
    this.rowHeight = this.H / c.boardRows;
    this.porchFront = this.D / 2 + c.porch.depth;
    this.porchTop = -c.porch.drop;
    this.frame = null;
    this.pieces = [];
    this.woodColliders = [];
    this.stoneColliders = [];

    // El suelo interior queda `floorClearance` sobre el punto más alto bajo la cabaña.
    let max = -Infinity;
    let min = Infinity;
    const step = c.groundSample;
    for (let x = -this.W / 2 - 1; x <= this.W / 2 + 1 + 1e-6; x += step) {
      for (let z = -this.D / 2 - 1; z <= this.porchFront + 1 + 1e-6; z += step) {
        const g = ground(x, z);
        max = Math.max(max, g);
        min = Math.min(min, g);
      }
    }
    this.baseY = max + c.floorClearance;
    this.groundMin = min - this.baseY;
    this.ground = (x, z) => ground(x, z) - this.baseY;
  }

  range([min, max]) {
    return min + this.random() * (max - min);
  }

  add(material, geometry) {
    if (this.frame) geometry.applyMatrix4(this.frame);
    this.pieces.push({ geometry, position: [0, 0, 0], material, collider: false });
  }

  // Caja alineada con los ejes del marco actual, de `min` a `max`.
  box(material, min, max, uvs = applyBoxUVs) {
    const geometry = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    uvs(geometry);
    geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    this.add(material, geometry);
  }

  // Colisionador en el marco actual (solo marcos con giros de 90°).
  collide(min, max, list = this.woodColliders) {
    const a = new THREE.Vector3(...min);
    const b = new THREE.Vector3(...max);
    if (this.frame) {
      a.applyMatrix4(this.frame);
      b.applyMatrix4(this.frame);
    }
    list.push({ min: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z)], max: [Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z)] });
  }

  build() {
    this.buildFloor();
    this.buildWalls();
    this.buildRoof();
    this.buildPorch();
    this.buildChimney();
    this.buildFoundation();
    this.frame = null;

    const pieces = [
      ...this.pieces,
      { geometry: null, position: [0, 0, 0], collider: this.woodColliders, surface: 'wood' },
      { geometry: null, position: [0, 0, 0], collider: this.stoneColliders, surface: 'stone' },
      this.stairsCollider,
    ];
    // Volumen interior para las zonas (acústica, pájaros, iluminación, interior oculto).
    const zones = [{ name: 'cabin', min: [-this.W / 2, -0.5, -this.D / 2], max: [this.W / 2, this.R, this.D / 2] }];
    return { pieces, baseY: this.baseY, zones };
  }

  // --- Suelo, pilotes y celosía ----------------------------------------------

  buildFloor() {
    const { W, D, c } = this;
    const bottom = this.groundMin - 0.5;
    this.box('planks', [-W / 2, -c.floorThickness, -D / 2], [W / 2, 0, D / 2]);
    this.collide([-W / 2, bottom, -D / 2], [W / 2, 0, D / 2]);
  }

  buildFoundation() {
    const { W, D, c, porchFront, porchTop } = this;
    const porchBottom = porchTop - c.porch.thickness;
    const post = 0.2;

    // Pilotes: filas bajo la casa y bajo el borde del porche.
    const count = Math.round(W / c.pilingSpacing);
    for (let i = 0; i <= count; i++) {
      const x = -W / 2 + 0.3 + (i / count) * (W - 0.6);
      for (const [z, top] of [[-D / 2 + 0.3, -c.floorThickness], [0, -c.floorThickness], [D / 2 - 0.3, -c.floorThickness], [porchFront - 0.3, porchBottom]]) {
        const g = this.ground(x, z) - 0.2;
        this.box('wood', [x - post / 2, g, z - post / 2], [x + post / 2, top, z + post / 2]);
      }
    }

    // Zócalo de celosía por tramos que bajan hasta el terreno (algunos rotos).
    const inset = 0.05;
    const edges = [
      [[-W / 2, -D / 2 + inset], [W / 2, -D / 2 + inset], -c.floorThickness],
      [[-W / 2 + inset, -D / 2], [-W / 2 + inset, D / 2], -c.floorThickness],
      [[W / 2 - inset, -D / 2], [W / 2 - inset, D / 2], -c.floorThickness],
      [[-W / 2 + inset, D / 2], [-W / 2 + inset, porchFront], porchBottom],
      [[W / 2 - inset, D / 2], [W / 2 - inset, porchFront], porchBottom],
      [[-W / 2, porchFront - inset], [W / 2, porchFront - inset], porchBottom],
    ];
    for (const [[x0, z0], [x1, z1], top] of edges) {
      const length = Math.hypot(x1 - x0, z1 - z0);
      const segments = Math.ceil(length / c.latticeSegment);
      const alongX = z0 === z1;
      for (let s = 0; s < segments; s++) {
        if (this.random() < c.brokenLattice) continue;
        const t0 = s / segments;
        const t1 = (s + 1) / segments;
        const ax = x0 + (x1 - x0) * t0;
        const az = z0 + (z1 - z0) * t0;
        const bx = x0 + (x1 - x0) * t1;
        const bz = z0 + (z1 - z0) * t1;
        const bottom = Math.min(this.ground(ax, az), this.ground(bx, bz), this.ground((ax + bx) / 2, (az + bz) / 2)) - 0.15;
        const half = 0.015;
        if (alongX) this.box('lattice', [ax, bottom, az - half], [bx, top, az + half]);
        else this.box('lattice', [ax - half, bottom, az], [ax + half, top, bz]);
      }
    }
  }

  // --- Paredes -----------------------------------------------------------------

  buildWalls() {
    const { W, D, H, c } = this;
    const snap = (y) => Math.round(y / this.rowHeight) * this.rowHeight;
    const openings = Object.fromEntries(WALLS.map((wall) => [wall, []]));
    openings[c.door.wall].push({ ...c.door, bottom: 0, top: snap(c.door.height), door: true });
    for (const window of c.windows) openings[window.wall].push({ ...window, bottom: snap(window.bottom), top: snap(window.top) });

    for (const wall of WALLS) {
      const side = wall === 'left' || wall === 'right';
      const length = side ? D : W;
      this.frame = wallMatrix(wall, W, D);
      const list = openings[wall];

      for (let row = 0; row < c.boardRows; row++) {
        const y0 = row * this.rowHeight;
        const y1 = y0 + this.rowHeight;
        const blocked = list
          .filter((o) => o.bottom < y1 - 1e-3 && o.top > y0 + 1e-3)
          .map((o) => [o.x - o.width / 2, o.x + o.width / 2]);
        for (const [a, b] of subtractIntervals(-length / 2, length / 2, blocked)) this.boardRun(a, b, y0, y1);
      }
      if (side) this.buildGable();

      // Colisión: la pared entera salvo el hueco de la puerta (con dintel).
      const back = -c.wallColliderDepth;
      const doors = list.filter((o) => o.door);
      const spans = subtractIntervals(-length / 2, length / 2, doors.map((o) => [o.x - o.width / 2, o.x + o.width / 2]));
      for (const [a, b] of spans) this.collide([a, 0, back], [b, H, 0.04]);
      for (const door of doors) this.collide([door.x - door.width / 2, door.top, back], [door.x + door.width / 2, H, 0.04]);

      for (const opening of list) {
        if (opening.door) this.buildDoorFrame(opening);
        else this.buildWindow(opening);
      }
    }
    this.frame = null;

    // Tablones verticales en las esquinas.
    const size = c.cornerBoard;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * W / 2;
        const z = sz * D / 2;
        this.box('planks', [x - size / 2, -c.floorThickness, z - size / 2], [x + size / 2, H, z + size / 2], (g) => plankUVs(g, this.random, true));
      }
    }
  }

  // Fila de tablas entre a y b: largos variables, algunas faltan, cuelgan o están torcidas.
  boardRun(a, b, y0, y1) {
    const { c } = this;
    let x = a;
    while (b - x > 1e-3) {
      let length = this.range(c.boardLength);
      if (b - (x + length) < c.boardLength[0] * 0.5) length = b - x;
      this.wallBoard(x, x + length, y0, y1);
      x += length;
    }
  }

  wallBoard(x0, x1, y0, y1) {
    const { c } = this;
    const roll = this.random();
    if (roll < c.missingBoards) return;
    const length = x1 - x0;
    const t = c.boardThickness;
    const geometry = plankUVs(new THREE.BoxGeometry(length, y1 - y0, t), this.random);
    geometry.rotateX(-c.boardTilt);
    if (roll < c.missingBoards + c.looseBoards) {
      // Cuelga del clavo de un extremo (el otro cae como mucho ~0,4 u).
      const pivot = this.random() < 0.5 ? -1 : 1;
      const angle = Math.min(this.range(c.looseAngle), 0.4 / length);
      geometry.translate(-pivot * length / 2, 0, 0);
      geometry.rotateZ(pivot * angle);
      geometry.translate(pivot * length / 2, 0, 0.02);
    } else if (roll < c.missingBoards + c.looseBoards + c.crookedBoards) {
      geometry.rotateZ((this.random() - 0.5) * 2 * c.crookedAngle);
    }
    geometry.translate((x0 + x1) / 2, (y0 + y1) / 2, -t / 2);
    this.add('planks', geometry);
  }

  // Hastial: tablas trapezoidales hasta la cara inferior de los cabios.
  buildGable() {
    const { H, R, c } = this;
    const t = c.boardThickness;
    const half = (y) => Math.max(0.03, (R - y) / Math.tan(this.alpha));
    for (let y0 = H; y0 < R - 0.05; y0 += this.rowHeight) {
      const y1 = Math.min(y0 + this.rowHeight, R);
      const h = y1 - y0;
      const shape = new THREE.Shape();
      shape.moveTo(-half(y0), -h / 2);
      shape.lineTo(half(y0), -h / 2);
      shape.lineTo(half(y1), h / 2);
      shape.lineTo(-half(y1), h / 2);
      shape.lineTo(-half(y0), -h / 2);
      const geometry = plankUVs(extrudeAcross(shape, t), this.random);
      geometry.rotateX(-c.boardTilt);
      geometry.translate(0, (y0 + y1) / 2, -t / 2);
      this.add('planks', geometry);
    }
  }

  // Marco de la puerta: jambas, dintel, forro del hueco y umbral.
  buildDoorFrame(door) {
    const { c } = this;
    const t = c.boardThickness;
    const trim = c.trimWidth;
    const left = door.x - door.width / 2;
    const right = door.x + door.width / 2;
    this.box('wood', [left - trim, 0, 0], [left, door.top + trim, 0.04], verticalUVs);
    this.box('wood', [right, 0, 0], [right + trim, door.top + trim, 0.04], verticalUVs);
    this.box('wood', [left - trim, door.top, 0], [right + trim, door.top + trim, 0.04]);
    this.box('wood', [left, door.top - 0.02, -t - 0.02], [right, door.top, 0.02]);
    this.box('wood', [left, 0, -t - 0.02], [left + 0.03, door.top, 0.02], verticalUVs);
    this.box('wood', [right - 0.03, 0, -t - 0.02], [right, door.top, 0.02], verticalUVs);
    this.box('wood', [left, 0, -t - 0.05], [right, 0.03, 0.05]);
  }

  // Ventana: marco, alféizar, travesaños, cristales (uno puede estar roto) y contraventanas.
  buildWindow(w) {
    const { c } = this;
    const t = c.boardThickness;
    const trim = c.trimWidth;
    const left = w.x - w.width / 2;
    const right = w.x + w.width / 2;
    const height = w.top - w.bottom;

    this.box('wood', [left - trim, w.bottom - 0.02, 0], [left, w.top + trim, 0.04], verticalUVs);
    this.box('wood', [right, w.bottom - 0.02, 0], [right + trim, w.top + trim, 0.04], verticalUVs);
    this.box('wood', [left - trim, w.top, 0], [right + trim, w.top + trim, 0.04]);
    this.box('wood', [left - trim - 0.05, w.bottom - 0.05, -t - 0.03], [right + trim + 0.05, w.bottom, 0.1]);
    // Forro del hueco.
    this.box('wood', [left, w.top - 0.02, -t - 0.02], [right, w.top, 0.02]);
    this.box('wood', [left, w.bottom, -t - 0.02], [left + 0.03, w.top, 0.02], verticalUVs);
    this.box('wood', [right - 0.03, w.bottom, -t - 0.02], [right, w.top, 0.02], verticalUVs);

    // Hoja: bastidor y travesaños a media pared.
    const bar = c.mullion;
    const z0 = -t / 2 - bar / 2;
    const z1 = -t / 2 + bar / 2;
    const cols = w.cols ?? 2;
    const rows = w.rows ?? 2;
    this.box('wood', [left, w.bottom, z0], [right, w.bottom + bar * 1.5, z1]);
    this.box('wood', [left, w.top - bar * 1.5, z0], [right, w.top, z1]);
    for (let i = 1; i < cols; i++) {
      const x = left + (i / cols) * w.width;
      this.box('wood', [x - bar / 2, w.bottom, z0], [x + bar / 2, w.top, z1], verticalUVs);
    }
    for (let j = 1; j < rows; j++) {
      const y = w.bottom + (j / rows) * height;
      this.box('wood', [left, y - bar / 2, z0], [right, y + bar / 2, z1]);
    }

    // Cristales.
    const cellW = w.width / cols;
    const cellH = (height - bar * 3) / rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const cx = left + (i + 0.5) * cellW;
        const cy = w.bottom + bar * 1.5 + (j + 0.5) * cellH;
        const pw = cellW - bar;
        const ph = cellH - bar;
        const geometry = j * cols + i === w.brokenPane ? this.brokenPane(pw, ph) : new THREE.PlaneGeometry(pw, ph);
        applyBoxUVs(geometry);
        geometry.translate(cx, cy, -t / 2);
        this.add('glass', geometry);
      }
    }

    if (w.shutters) {
      for (const side of [-1, 1]) this.buildShutter(w, side, w.crookedShutter === side);
    }
  }

  // Cristal con un agujero de bordes dentados.
  brokenPane(width, height) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.lineTo(-width / 2, -height / 2);
    const hole = new THREE.Path();
    const points = 9;
    const rx = width * 0.42;
    const ry = height * 0.42;
    const ox = (this.random() - 0.5) * width * 0.1;
    const oy = (this.random() - 0.5) * height * 0.1;
    for (let k = 0; k < points; k++) {
      const angle = (k / points) * Math.PI * 2;
      const r = k % 2 ? 0.3 + this.random() * 0.3 : 0.75 + this.random() * 0.25;
      const x = ox + Math.cos(angle) * rx * r;
      const y = oy + Math.sin(angle) * ry * r;
      if (k === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  }

  // Contraventana abierta contra la pared: tres tablas verticales y dos travesaños.
  // `crooked`: cuelga de la bisagra de arriba.
  buildShutter(w, side, crooked) {
    const { c } = this;
    const width = w.width / 2 + 0.02;
    const height = w.top - w.bottom + 0.06;
    const hingeX = side < 0 ? w.x - w.width / 2 - c.trimWidth : w.x + w.width / 2 + c.trimWidth;
    const centerX = hingeX + side * (width / 2 + 0.01);
    const pivotX = -side * width / 2;
    const rotation = crooked ? -side * c.shutterAngle : 0;
    const parts = [];
    const boards = 3;
    for (let i = 0; i < boards; i++) {
      const bw = width / boards - 0.012;
      const g = plankUVs(new THREE.BoxGeometry(bw, height, 0.035), this.random, true);
      g.translate(-width / 2 + (i + 0.5) * (width / boards), 0, 0.0375);
      parts.push(g);
    }
    for (const y of [-height / 2 + 0.18, height / 2 - 0.18]) {
      const g = applyBoxUVs(new THREE.BoxGeometry(width - 0.04, 0.08, 0.03));
      g.translate(0, y, 0.07);
      parts.push({ geometry: g, material: 'wood' });
    }
    for (const part of parts) {
      const geometry = part.geometry ?? part;
      geometry.translate(-pivotX, -height / 2, 0);
      geometry.rotateZ(rotation);
      geometry.translate(pivotX + centerX, height / 2 + (w.top + w.bottom) / 2, 0.005);
      this.add(part.material ?? 'planks', geometry);
    }
  }

  // --- Tejado ------------------------------------------------------------------

  buildRoof() {
    const { W, D, H, R, c, alpha } = this;
    const r = c.roof;
    const rh = r.rafterHeight;
    const top = rh + r.thickness;
    const length = (D / 2 + r.eaveOverhang) / Math.cos(alpha);
    const X = W / 2 + r.gableOverhang;
    const count = Math.round(W / r.rafterSpacing);
    const rafters = Array.from({ length: count + 1 }, (_, i) => -W / 2 + (i / count) * W);

    for (const side of [1, -1]) {
      this.frame = slopeMatrix(side, alpha, R, 0);
      for (const x of rafters) this.box('wood', [x - r.rafterWidth / 2, 0, 0], [x + r.rafterWidth / 2, rh, length]);

      const hole = side === 1 ? r.hole : null;
      if (!hole) {
        this.box('shingles', [-X, rh, 0], [X, top, length]);
      } else {
        this.box('shingles', [-X, rh, 0], [X, top, hole.d0]);
        this.box('shingles', [-X, rh, hole.d1], [X, top, length]);
        this.box('shingles', [-X, rh, hole.d0], [hole.x0, top, hole.d1]);
        this.box('shingles', [hole.x1, rh, hole.d0], [X, top, hole.d1]);
        this.buildHoleEdges(hole, rh, top);
      }
      for (const patch of r.patches.filter((p) => p.side === side)) {
        const geometry = applyBoxUVs(new THREE.BoxGeometry(patch.width, 0.025, patch.length));
        geometry.rotateY(patch.angle);
        geometry.translate(patch.x, top + 0.018, patch.d);
        this.add('rustyMetal', geometry);
      }
      // Tabla que cierra el hueco entre la pared y el tejado, tabla de alero y remates.
      const wallLine = this.D / 2 / Math.cos(alpha);
      this.box('planks', [-W / 2, 0, wallLine - 0.1], [W / 2, rh, wallLine - 0.05]);
      this.box('wood', [-X, 0, length - 0.04], [X, top + 0.02, length]);
      for (const sx of [-1, 1]) this.box('wood', [sx * X - 0.025, 0, 0], [sx * X + 0.025, top + 0.03, length]);
    }
    this.frame = null;

    // Viga de cumbrera, caballete y vigas horizontales vistas desde dentro.
    const ridgeTop = R + top / Math.cos(alpha);
    this.box('wood', [-X, R, -0.06], [X, R + rh / Math.cos(alpha), 0.06]);
    this.box('wood', [-X - 0.05, ridgeTop - 0.05, -0.25], [X + 0.05, ridgeTop + 0.06, 0.25]);
    const beam = 0.16;
    rafters.forEach((x, i) => {
      if (i === 0 || i === count || i % r.tieBeamEvery) return;
      this.box('wood', [x - r.rafterWidth / 2, H - beam, -D / 2], [x + r.rafterWidth / 2, H, D / 2]);
    });
    this.roofTop = ridgeTop;
    // Techo interior: no se puede saltar por encima de las vigas.
    this.collide([-W / 2, H - beam, -D / 2], [W / 2, R, D / 2]);
  }

  // Tablillas rotas que asoman al agujero y listones que lo cruzan.
  buildHoleEdges(hole, rh, top) {
    const r = this.c.roof;
    const edge = (from, to, place) => {
      for (let p = from; p < to - 0.08;) {
        const size = Math.min(0.14 + this.random() * 0.16, to - p);
        if (this.random() < r.brokenShingles) place(p, p + size * 0.92, 0.08 + this.random() * 0.28);
        p += size;
      }
    };
    edge(hole.x0, hole.x1, (a, b, reach) => this.box('shingles', [a, rh, hole.d0], [b, top, hole.d0 + reach]));
    edge(hole.x0, hole.x1, (a, b, reach) => this.box('shingles', [a, rh, hole.d1 - reach], [b, top, hole.d1]));
    edge(hole.d0, hole.d1, (a, b, reach) => this.box('shingles', [hole.x0, rh, a], [hole.x0 + reach, top, b]));
    edge(hole.d0, hole.d1, (a, b, reach) => this.box('shingles', [hole.x1 - reach, rh, a], [hole.x1, top, b]));

    for (let i = 0; i < r.laths; i++) {
      const d = hole.d0 + ((i + 0.5) / r.laths) * (hole.d1 - hole.d0);
      const broken = this.random() < 0.4;
      const end = broken ? hole.x0 + (0.3 + this.random() * 0.4) * (hole.x1 - hole.x0) : hole.x1 + 0.1;
      this.box('wood', [hole.x0 - 0.1, rh, d - 0.035], [end, rh + 0.03, d + 0.035]);
    }
  }

  // --- Porche ------------------------------------------------------------------

  buildPorch() {
    const { W, D, H, c, porchFront, porchTop } = this;
    const p = c.porch;
    const doorX = c.door.x;
    const bottom = this.groundMin - 0.5;

    this.box('planks', [-W / 2, porchTop - p.thickness, D / 2], [W / 2, porchTop, porchFront]);
    this.collide([-W / 2, bottom, D / 2], [W / 2, porchTop, porchFront]);

    // Tejado propio de chapa sobre cabios, apoyado en una viga sobre cuatro postes.
    const beta = Math.atan(p.roofSlope);
    const roofY = H - p.roofDrop;
    const length = (p.depth + p.eave) / Math.cos(beta);
    const rafterHeight = 0.1;
    this.frame = slopeMatrix(1, beta, roofY, D / 2);
    const rafters = Math.round(W / p.sheetWidth);
    for (let i = 0; i <= rafters; i++) {
      const x = -W / 2 + (i / rafters) * W;
      this.box('wood', [x - 0.03, 0, 0], [x + 0.03, rafterHeight, length]);
    }
    const sheets = Math.ceil((W + 0.2) / p.sheetWidth);
    for (let i = 0; i < sheets; i++) {
      const x0 = -W / 2 - 0.1 + i * p.sheetWidth;
      const lift = rafterHeight + (i % 2) * 0.012;
      const geometry = applyBoxUVs(new THREE.BoxGeometry(p.sheetWidth + 0.06, 0.02, length + 0.05 + this.random() * 0.1));
      geometry.rotateY((this.random() - 0.5) * 0.03);
      geometry.translate(x0 + p.sheetWidth / 2, lift + 0.01, length / 2 + (this.random() - 0.5) * 0.06);
      this.add('rustyMetal', geometry);
    }
    this.box('wood', [-W / 2 - 0.1, 0, length - 0.035], [W / 2 + 0.1, rafterHeight + 0.03, length]);
    this.frame = null;
    this.box('wood', [-W / 2, roofY - 0.16, D / 2], [W / 2, roofY, D / 2 + 0.06]);

    const postZ = porchFront - 0.12;
    const beamTop = roofY - (postZ - D / 2) * p.roofSlope;
    const beamBottom = beamTop - p.beamHeight;
    this.box('wood', [-W / 2 - 0.05, beamBottom, postZ - 0.07], [W / 2 + 0.05, beamTop, postZ + 0.07]);
    this.collide([-W / 2, beamBottom, D / 2], [W / 2, roofY + 0.3, porchFront + p.eave]);

    const s = p.postSize;
    const posts = [-W / 2 + s / 2 + 0.02, doorX - p.stairsWidth / 2 - s / 2, doorX + p.stairsWidth / 2 + s / 2, W / 2 - s / 2 - 0.02];
    for (const x of posts) {
      this.box('wood', [x - s / 2, porchTop, postZ - s / 2], [x + s / 2, beamBottom, postZ + s / 2], verticalUVs);
      this.collide([x - s / 2, porchTop, postZ - s / 2], [x + s / 2, beamBottom, postZ + s / 2]);
    }

    // Barandilla: delante (sin el hueco de los escalones) y a los lados.
    this.railing([posts[0] + s / 2, postZ], [posts[1] - s / 2, postZ]);
    this.railing([posts[2] + s / 2, postZ], [posts[3] - s / 2, postZ]);
    this.railing([posts[0], D / 2 + 0.02], [posts[0], postZ - s / 2]);
    this.railing([posts[3], D / 2 + 0.02], [posts[3], postZ - s / 2]);

    this.buildStairs(doorX);
  }

  // Tramo de barandilla recto (a lo largo de X o de Z) con balaústres.
  railing([x0, z0], [x1, z1]) {
    const p = this.c.porch;
    const base = this.porchTop;
    const alongX = z0 === z1;
    const length = alongX ? x1 - x0 : z1 - z0;
    const at = (t, across, y0, y1, width) => {
      const a = alongX ? [x0 + t, y0, z0 - across] : [x0 - across, y0, z0 + t];
      const b = alongX ? [x0 + t + width, y1, z0 + across] : [x0 + across, y1, z0 + t + width];
      return [a, b];
    };
    const rail = (y, height) => this.box('wood', ...at(0, 0.03, y, y + height, length));
    rail(base + p.railHeight - 0.06, 0.06);
    rail(base + 0.1, 0.05);
    const count = Math.floor(length / p.balusterSpacing);
    const half = p.balusterSize / 2;
    for (let i = 1; i < count; i++) {
      const roll = this.random();
      if (roll < p.missingBalusters) continue;
      const broken = roll < p.missingBalusters + p.brokenBalusters;
      const top = broken ? base + 0.15 + this.random() * 0.35 : base + p.railHeight - 0.06;
      const t = (i / count) * length - half;
      this.box('wood', ...at(t, half, base + 0.1, top, p.balusterSize), verticalUVs);
    }
    this.collide(...at(0, 0.06, base, base + p.railHeight + 0.05, length));
  }

  // Escalones hasta el terreno con zancas laterales y una rampa como colisionador.
  // Marco propio: X hacia fuera del porche, girado -90° (X local → +Z de la cabaña).
  buildStairs(doorX) {
    const p = this.c.porch;
    const { porchFront, porchTop } = this;
    const width = p.stairsWidth;
    const groundAt = (run) => this.ground(doorX, porchFront + run);
    const n = Math.max(2, Math.ceil((porchTop - groundAt(p.stepRun * 2)) / p.maxStepRise));
    const run = (n - 1) * p.stepRun + p.stepRun * 0.5;
    const end = groundAt(run);
    const rise = (porchTop - end) / n;
    const rotation = -Math.PI / 2;
    this.frame = new THREE.Matrix4().makeRotationY(rotation).setPosition(doorX, 0, porchFront);

    for (let k = 1; k < n; k++) {
      const y = porchTop - k * rise;
      this.box('wood', [(k - 1) * p.stepRun - 0.02, y - 0.06, -width / 2], [k * p.stepRun, y, width / 2]);
      this.box('planks', [(k - 1) * p.stepRun - 0.02, y, -width / 2 + 0.03], [(k - 1) * p.stepRun, y + rise - 0.06, width / 2 - 0.03]);
    }
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape();
      shape.moveTo(0, porchTop + 0.02);
      shape.lineTo(run, end + rise * 0.5);
      shape.lineTo(run, end - 0.2);
      shape.lineTo(0, porchTop - 0.3);
      shape.lineTo(0, porchTop + 0.02);
      const geometry = extrudeAcross(shape, 0.05);
      geometry.translate(0, 0, side * (width / 2 + 0.025));
      this.add('wood', geometry);
    }
    this.frame = null;
    this.stairsCollider = {
      geometry: null,
      position: [doorX, 0, porchFront],
      rotationY: rotation,
      surface: 'wood',
      collider: [{ min: [0, end - 0.6, -width / 2], max: [run, porchTop, width / 2], rise: end - porchTop }],
    };
  }

  // --- Chimenea ----------------------------------------------------------------

  buildChimney() {
    const { W, c } = this;
    const ch = c.chimney;
    const wall = -W / 2;
    const z = ch.z;
    const footing = Math.min(
      this.ground(wall, z - ch.baseWidth / 2), this.ground(wall, z + ch.baseWidth / 2),
      this.ground(wall - ch.baseDepth, z - ch.baseWidth / 2), this.ground(wall - ch.baseDepth, z + ch.baseWidth / 2),
    ) - 0.3;
    const shoulderTop = ch.baseHeight + ch.shoulderHeight;
    const top = this.roofTop + ch.aboveRoof;
    const stackOut = wall - 0.05 - ch.stackDepth;

    this.box('masonry', [wall - ch.baseDepth, footing, z - ch.baseWidth / 2], [wall, ch.baseHeight, z + ch.baseWidth / 2]);
    this.box('masonry', [wall - ch.baseDepth * 0.85, ch.baseHeight, z - ch.shoulderWidth / 2], [wall, shoulderTop, z + ch.shoulderWidth / 2]);
    this.box('masonry', [stackOut, shoulderTop, z - ch.stackWidth / 2], [wall - 0.05, top, z + ch.stackWidth / 2]);
    this.box('masonry', [stackOut - 0.1, top, z - ch.stackWidth / 2 - 0.1], [wall + 0.05, top + 0.12, z + ch.stackWidth / 2 + 0.1]);
    this.collide([wall - ch.baseDepth, footing, z - ch.baseWidth / 2], [wall, top, z + ch.baseWidth / 2], this.stoneColliders);
  }
}
