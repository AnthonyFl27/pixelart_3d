import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applyBoxUVs, plankUVs } from './geometryUtils.js';

// Fábrica de muebles. Cada tipo recibe los parámetros de su entrada (levels/cabinLayout.js)
// y un constructor `f` en coordenadas locales del mueble:
//   f.box(layer, min, max, { color, uvs: 'box' | 'plank' | 'plankV' }), f.cylinder(layer, {...}),
//   f.add(layer, geometry, color), f.collider(min, max), f.interactable(data), f.random().
// Convención: el frente del mueble mira a +Z local. Los muebles "de pared" (`wall` en la
// tabla de abajo) tienen el fondo en z = 0 (la superficie de la pared) y crecen hacia +Z;
// el resto está centrado en el origen. `layer` es una capa del material por capas
// (materials.js: planks, wood, fabric, rug, iron, enamel, grain, hearth, bark…).

// Altura mínima de los colisionadores de muebles bajos: el jugador no se sube encima.
const MIN_COLLIDER = CONFIG.player.stepHeight + 0.05;

export const FURNITURE_TYPES = {
  // Sofá de `seats` plazas: base, cojines, respaldo y brazos. Cada plaza es un asiento.
  sofa(p, f) {
    const { width = 2, depth = 0.9, seats = 3, color = 0x7a4a3a, legColor = 0x6a4a30 } = p;
    const arm = 0.18;
    const back = 0.22;
    const hw = width / 2;
    const hd = depth / 2;
    legs(f, hw - 0.06, hd - 0.06, 0.1, 0.05, legColor);
    f.box('fabric', [-hw, 0.1, -hd], [hw, 0.4, hd], { color });
    f.box('fabric', [-hw, 0.1, -hd], [hw, 0.88, -hd + back], { color });
    for (const side of [-1, 1]) f.box('fabric', [side > 0 ? hw - arm : -hw, 0.1, -hd], [side > 0 ? hw : -hw + arm, 0.64, hd], { color: shade(color, 0.92) });
    const seatWidth = (width - arm * 2) / seats;
    for (let i = 0; i < seats; i++) {
      const x0 = -hw + arm + i * seatWidth;
      const tint = shade(color, 1 + (f.random() - 0.5) * 0.12);
      f.box('fabric', [x0 + 0.01, 0.4, -hd + back], [x0 + seatWidth - 0.01, 0.52, hd - 0.02], { color: tint });
      f.box('fabric', [x0 + 0.02, 0.52, -hd + back], [x0 + seatWidth - 0.02, 0.84, -hd + back + 0.14], { color: tint });
      seat(f, x0 + seatWidth / 2, 0.52, -hd + back + 0.14, hd, seatWidth, 'fabric');
    }
    f.collider([-hw, 0, -hd + back], [hw, 0.52, hd]);
    f.collider([-hw, 0, -hd], [hw, 0.88, -hd + back]);
    f.collider([-hw, 0, -hd], [-hw + arm, 0.64, hd]);
    f.collider([hw - arm, 0, -hd], [hw, 0.64, hd]);
  },

  armchair(p, f) {
    FURNITURE_TYPES.sofa({ width: 0.95, depth: 0.88, seats: 1, ...p }, f);
  },

  // Mesa baja con balda inferior.
  coffeeTable(p, f) {
    const { width = 1.1, depth = 0.6, height = 0.42, color = 0xa0704a } = p;
    const hw = width / 2;
    const hd = depth / 2;
    f.box('wood', [-hw, height - 0.05, -hd], [hw, height, hd], { color });
    f.box('wood', [-hw + 0.06, 0.1, -hd + 0.06], [hw - 0.06, 0.13, hd - 0.06], { color: shade(color, 0.85) });
    legs(f, hw - 0.05, hd - 0.05, height - 0.05, 0.05, shade(color, 0.8));
    f.collider([-hw, 0, -hd], [hw, Math.max(height, MIN_COLLIDER), hd]);
  },

  // Mesa de cocina con faldón.
  table(p, f) {
    const { width = 1.1, depth = 0.75, height = 0.76, color = 0xb08a5a } = p;
    const hw = width / 2;
    const hd = depth / 2;
    f.box('planks', [-hw, height - 0.05, -hd], [hw, height, hd], { color, uvs: 'plank' });
    f.box('wood', [-hw + 0.04, height - 0.14, -hd + 0.04], [hw - 0.04, height - 0.05, hd - 0.04], { color: shade(color, 0.8) });
    legs(f, hw - 0.06, hd - 0.06, height - 0.05, 0.06, shade(color, 0.8));
    f.collider([-hw, 0, -hd], [hw, height, hd]);
  },

  // Silla de madera con respaldo de travesaños. El asiento mira a +Z.
  chair(p, f) {
    const { color = 0x8a5e3a } = p;
    const h = 0.46;
    f.box('wood', [-0.22, h - 0.04, -0.2], [0.22, h, 0.22], { color });
    legs(f, 0.19, 0.18, h - 0.04, 0.04, shade(color, 0.85));
    for (const x of [-0.19, 0.19]) f.box('wood', [x - 0.025, h, -0.21], [x + 0.025, 1.0, -0.17], { color: shade(color, 0.85) });
    for (const y of [0.66, 0.82, 0.96]) f.box('wood', [-0.19, y - 0.03, -0.205], [0.19, y + 0.03, -0.175], { color });
    seat(f, 0, h, -0.17, 0.22, 0.44);
    f.collider([-0.22, 0, -0.21], [0.22, MIN_COLLIDER, 0.22]);
  },

  // Alfombra con cenefa (sin colisión).
  rug(p, f) {
    const { width = 2.4, depth = 1.8, border = 0.14, color = 0xffffff, borderColor = 0xc8a060 } = p;
    const hw = width / 2;
    const hd = depth / 2;
    f.box('rug', [-hw + border, 0, -hd + border], [hw - border, 0.016, hd - border], { color });
    f.box('grain', [-hw, 0, -hd], [hw, 0.014, -hd + border], { color: borderColor });
    f.box('grain', [-hw, 0, hd - border], [hw, 0.014, hd], { color: borderColor });
    f.box('grain', [-hw, 0, -hd + border], [-hw + border, 0.014, hd - border], { color: borderColor });
    f.box('grain', [hw - border, 0, -hd + border], [hw, 0.014, hd - border], { color: borderColor });
  },

  // Chimenea de piedra (de pared): hogar con leños, repisa y campana hasta el techo.
  fireplace(p, f) {
    const { width = 1.6, depth = 0.6, height = 1.25, top = 2.8, color = 0xffffff } = p;
    const hw = width / 2;
    const opening = { width: 0.8, height: 0.72 };
    const ow = opening.width / 2;
    f.box('hearth', [-hw, 0, 0], [-ow, height, depth], { color });
    f.box('hearth', [ow, 0, 0], [hw, height, depth], { color });
    f.box('hearth', [-ow, opening.height, 0], [ow, height, depth], { color });
    f.box('iron', [-ow, 0, 0], [ow, opening.height, 0.12], { color: 0x6a5a50 });
    f.box('hearth', [-hw - 0.1, 0, depth], [hw + 0.1, 0.06, depth + 0.4], { color: shade(color, 0.9) });
    f.box('wood', [-hw - 0.08, height, -0.02], [hw + 0.08, height + 0.08, depth + 0.08], { color: 0x6e4a2c });
    f.box('hearth', [-hw + 0.2, height + 0.08, 0], [hw - 0.2, top, depth - 0.2], { color: shade(color, 0.95) });
    // Leños y ceniza.
    for (const [x, z, angle] of [[-0.1, 0.3, 0.25], [0.12, 0.35, -0.2], [0, 0.22, 0.05]]) {
      const log = f.cylinder('bark', { radius: 0.06, height: 0.55, axis: 'x', x, y: 0.1 + (z < 0.25 ? 0.08 : 0), z });
      log.rotateY(angle);
    }
    f.box('grain', [-ow + 0.05, 0.001, 0.12], [ow - 0.05, 0.03, depth - 0.05], { color: 0x4a4644 });
    // Hogar y repisa; la campana, más estrecha, deja sitio al soporte de la escopeta.
    f.collider([-hw, 0, 0], [hw, height + 0.08, depth]);
    f.collider([-hw + 0.2, height + 0.08, 0], [hw - 0.2, top, depth - 0.2]);
    f.collider([-hw - 0.1, 0, depth], [hw + 0.1, MIN_COLLIDER, depth + 0.1]);
  },

  // Soporte de la escopeta (de pared, sobre la campana de la chimenea): dos ganchos de
  // madera y la escopeta descargada, que se recoge con `E` (el soporte queda vacío).
  gunRack(p, f) {
    const { hooks = [-0.2, 0.15], color = 0x6e4a2c } = p;
    for (const x of hooks) {
      f.box('wood', [x - 0.03, -0.06, 0], [x + 0.03, 0.03, 0.02], { color: shade(color, 0.85) });
      f.box('wood', [x - 0.018, -0.02, 0.02], [x + 0.018, 0.005, 0.1], { color });
      f.box('wood', [x - 0.018, 0.005, 0.08], [x + 0.018, 0.04, 0.1], { color });
    }
    f.interactable({ type: 'pickup', item: 'shotgun', model: 'shotgun', position: [0, 0.021, 0.05], name: p.name ?? 'shotgun', hit: { min: [-0.34, -0.1, 0.01], max: [0.3, 0.08, 0.11] } });
  },

  // Caja de cartuchos sobre un mueble: `count` cartuchos (spec v3, 4.13).
  shellBox(p, f) {
    const { count = CONFIG.ammo.boxCount } = p;
    f.interactable({ type: 'pickup', item: 'shells', count, model: 'shellBox', position: [0, 0, 0], name: p.name ?? 'shells', hit: { min: [-0.11, 0, -0.08], max: [0.11, 0.11, 0.08] } });
  },

  // Gancho de pared con el farol de aceite colgado a `hang` del suelo (de pared).
  lanternHook(p, f) {
    const { hang: y = 1.55 } = p;
    f.box('wood', [-0.04, y + 0.2, 0], [0.04, y + 0.3, 0.02], { color: 0x6e4a2c });
    f.box('iron', [-0.008, y + 0.24, 0.02], [0.008, y + 0.256, 0.1], { color: 0x3a3a3a });
    f.box('iron', [-0.008, y + 0.24, 0.085], [0.008, y + 0.28, 0.1], { color: 0x3a3a3a });
    f.interactable({ type: 'pickup', item: 'lantern', model: 'lantern', position: [0, y, 0.095], name: p.name ?? 'lantern', hit: { min: [-0.1, y - 0.02, 0.02], max: [0.1, y + 0.28, 0.18] } });
  },

  // Estantería de libros (de pared) con libros de colores y alguno inclinado.
  bookshelf(p, f) {
    const { width = 1, depth = 0.32, height = 1.9, shelves = 5, color = 0x7a5436 } = p;
    const hw = width / 2;
    const t = 0.03;
    f.box('wood', [-hw, 0, 0], [-hw + t, height, depth], { color });
    f.box('wood', [hw - t, 0, 0], [hw, height, depth], { color });
    f.box('wood', [-hw, height - t, 0], [hw, height, depth], { color });
    f.box('wood', [-hw + t, 0, 0], [hw - t, height, 0.015], { color: shade(color, 0.7) });
    const gap = (height - 0.08) / shelves;
    for (let i = 0; i < shelves; i++) {
      const y = 0.05 + i * gap;
      f.box('wood', [-hw + t, y, 0], [hw - t, y + t, depth], { color });
      if (i === shelves - 1) continue;
      let x = -hw + t + 0.01;
      while (x < hw - t - 0.06) {
        const bw = 0.025 + f.random() * 0.035;
        if (x + bw > hw - t) break;
        if (f.random() < 0.08) {
          x += bw * 2;
          continue;
        }
        const bh = gap * (0.6 + f.random() * 0.3);
        const bookColor = pick(CONFIG.furniture.bookColors, f.random);
        const book = f.box('grain', [-bw / 2, 0, 0.03], [bw / 2, bh, depth - 0.02 - f.random() * 0.06], { color: bookColor });
        if (f.random() < 0.08) book.rotateZ(-0.35);
        book.translate(x + bw / 2, y + t, 0);
        x += bw + 0.003;
      }
    }
    f.collider([-hw, 0, 0], [hw, height, depth]);
  },

  // Cuadro colgado (de pared) con el centro a `hang` del suelo: marco y paisaje de tres bandas con un sol.
  picture(p, f) {
    const { width = 0.5, height = 0.4, hang: y = 1.6, frame = 0x5a3a22, colors = [0x7fa6c8, 0x5f7a3a, 0x9a8452] } = p;
    const hw = width / 2;
    const hh = height / 2;
    const b = 0.04;
    f.box('wood', [-hw, y - hh, 0], [hw, y - hh + b, 0.03], { color: frame });
    f.box('wood', [-hw, y + hh - b, 0], [hw, y + hh, 0.03], { color: frame });
    f.box('wood', [-hw, y - hh + b, 0], [-hw + b, y + hh - b, 0.03], { color: frame });
    f.box('wood', [hw - b, y - hh + b, 0], [hw, y + hh - b, 0.03], { color: frame });
    const inner = height - b * 2;
    const band = [0.45, 0.25, 0.3];
    let y0 = y - hh + b;
    for (let i = band.length - 1; i >= 0; i--) {
      const y1 = y0 + inner * band[i];
      f.box('grain', [-hw + b, y0, 0.005], [hw - b, y1, 0.015], { color: colors[i] });
      y0 = y1;
    }
    f.box('grain', [hw * 0.3, y + hh - b - inner * 0.28, 0.015], [hw * 0.3 + 0.05, y + hh - b - inner * 0.28 + 0.05, 0.02], { color: 0xf0d890 });
  },

  // Mueble bajo con dos puertas (de pared): soporte del televisor o aparador de la radio.
  cabinet(p, f) {
    const { width = 1.1, depth = 0.5, height = 0.55, color = 0x6e4a30, drawers = 0 } = p;
    const hw = width / 2;
    f.box('wood', [-hw, 0.06, 0], [hw, height, depth], { color });
    f.box('wood', [-hw - 0.02, height - 0.03, -0.01], [hw + 0.02, height + 0.01, depth + 0.02], { color: shade(color, 1.1) });
    const fronts = drawers ? drawers : 2;
    const panelTop = height - 0.06;
    for (let i = 0; i < fronts; i++) {
      if (drawers) {
        const h = (panelTop - 0.1) / drawers;
        const y0 = 0.1 + i * h;
        f.box('wood', [-hw + 0.04, y0 + 0.02, depth], [hw - 0.04, y0 + h - 0.02, depth + 0.015], { color: shade(color, 0.9) });
        f.box('iron', [-0.06, y0 + h / 2 - 0.012, depth + 0.015], [0.06, y0 + h / 2 + 0.012, depth + 0.035], { color: 0xb09060 });
      } else {
        const x0 = -hw + 0.04 + i * (width - 0.08) / 2;
        const x1 = x0 + (width - 0.08) / 2 - 0.02;
        f.box('wood', [x0, 0.1, depth], [x1, panelTop, depth + 0.015], { color: shade(color, 0.9) });
        const knob = i === 0 ? x1 - 0.05 : x0 + 0.05;
        f.box('iron', [knob - 0.015, panelTop - 0.14, depth + 0.015], [knob + 0.015, panelTop - 0.11, depth + 0.04], { color: 0xb09060 });
      }
    }
    legs(f, hw - 0.04, depth / 2 - 0.04, 0.06, 0.04, shade(color, 0.8), depth / 2);
    f.collider([-hw, 0, 0], [hw, Math.max(height, MIN_COLLIDER), depth]);
  },

  // Armario alto de dos puertas (de pared).
  cupboard(p, f) {
    const { width = 0.9, depth = 0.45, height = 1.8, color = 0x8a6440 } = p;
    const hw = width / 2;
    f.box('wood', [-hw, 0, 0], [hw, height, depth], { color });
    f.box('wood', [-hw - 0.03, height, -0.01], [hw + 0.03, height + 0.05, depth + 0.04], { color: shade(color, 0.9) });
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -hw + 0.04 : 0.01;
      const x1 = side < 0 ? -0.01 : hw - 0.04;
      f.box('wood', [x0, 0.08, depth], [x1, height - 0.06, depth + 0.015], { color: shade(color, 0.92) });
      f.box('wood', [x0 + 0.06, 0.2, depth + 0.015], [x1 - 0.06, height - 0.2, depth + 0.025], { color: shade(color, 1.06) });
      const knob = side < 0 ? x1 - 0.05 : x0 + 0.05;
      f.box('iron', [knob - 0.015, height / 2, depth + 0.015], [knob + 0.015, height / 2 + 0.05, depth + 0.045], { color: 0xb09060 });
    }
    f.collider([-hw, 0, 0], [hw, height, depth]);
  },

  // Balda de pared (de pared) con tarros y platos.
  shelf(p, f) {
    const { width = 0.8, depth = 0.22, heights = [1.4], color = 0x7a5436, items = 5 } = p;
    const hw = width / 2;
    for (const y of heights) {
      f.box('wood', [-hw, y - 0.03, 0], [hw, y, depth], { color });
      for (const side of [-1, 1]) f.box('wood', [side * (hw - 0.08) - 0.02, y - 0.18, 0], [side * (hw - 0.08) + 0.02, y - 0.03, depth * 0.8], { color: shade(color, 0.85) });
      for (let i = 0; i < items; i++) {
        const x = -hw + 0.06 + (i + f.random() * 0.4) * ((width - 0.12) / items);
        if (f.random() < 0.45) {
          // Plato apoyado de canto contra la pared.
          const plate = f.cylinder('enamel', { radius: 0.09, height: 0.015, axis: 'z', x, y: y + 0.09, z: 0.03, color: pick(CONFIG.furniture.plateColors, f.random) });
          plate.rotateX(-0.12);
        } else {
          const r = 0.035 + f.random() * 0.02;
          const h = 0.08 + f.random() * 0.1;
          f.cylinder('grain', { radius: r, height: h, x, y: y + h / 2, z: depth / 2, color: pick(CONFIG.furniture.jarColors, f.random) });
          f.cylinder('iron', { radius: r * 0.8, height: 0.02, x, y: y + h + 0.01, z: depth / 2, color: 0x9a8a70 });
        }
      }
    }
  },

  // Cocina de leña de hierro (de pared) con olla, horno y tubo hasta `pipeTop`.
  woodStove(p, f) {
    const { width = 0.75, depth = 0.6, height = 0.8, pipeTop = 2.8 } = p;
    const hw = width / 2;
    f.box('iron', [-hw, 0.14, 0], [hw, height, depth]);
    f.box('iron', [-hw - 0.03, height, -0.02], [hw + 0.03, height + 0.04, depth + 0.03], { color: 0x8a8a8a });
    legs(f, hw - 0.05, depth / 2 - 0.05, 0.14, 0.05, 0xffffff, depth / 2, 'iron');
    // Puertas del hogar y del horno con tiradores.
    f.box('iron', [-hw + 0.06, 0.4, depth], [-0.02, height - 0.08, depth + 0.02], { color: 0x6a6a6a });
    f.box('iron', [0.02, 0.22, depth], [hw - 0.06, height - 0.08, depth + 0.02], { color: 0x6a6a6a });
    f.box('grain', [-hw + 0.1, 0.46, depth + 0.02], [-0.06, 0.5, depth + 0.03], { color: 0xc07030 });
    for (const x of [-0.18, 0.18]) f.box('iron', [x - 0.04, height - 0.14, depth + 0.02], [x + 0.04, height - 0.12, depth + 0.06], { color: 0xb0b0b0 });
    // Olla con tapa y asas.
    f.cylinder('iron', { radius: 0.13, height: 0.16, x: -0.15, y: height + 0.12, z: depth * 0.55, color: 0x5a5a5a });
    f.cylinder('iron', { radius: 0.135, height: 0.02, x: -0.15, y: height + 0.21, z: depth * 0.55, color: 0x707070 });
    f.box('iron', [-0.3, height + 0.16, depth * 0.55 - 0.015], [0, height + 0.18, depth * 0.55 + 0.015], { color: 0x404040 });
    // Tubo de humos.
    f.cylinder('iron', { radius: 0.07, height: pipeTop - height, x: 0.2, y: (height + pipeTop) / 2, z: 0.15 });
    f.collider([-hw, 0, 0], [hw, height, depth]);
  },

  // Encimera (de pared) con armarios bajos, fregadero esmaltado y bomba de mano.
  counter(p, f) {
    const { width = 1.3, depth = 0.6, height = 0.9, sink = 0, pump = -0.45, color = 0x7e6a50, top = 0xa08a6a } = p;
    const hw = width / 2;
    f.box('wood', [-hw, 0.08, 0], [hw, height - 0.05, depth - 0.02], { color });
    f.box('grain', [-hw, 0, 0.04], [hw, 0.08, depth - 0.06], { color: 0x3a3028 });
    // Encimera partida alrededor del fregadero.
    const sw = 0.5;
    f.box('planks', [-hw - 0.02, height - 0.05, 0], [sink - sw / 2, height, depth + 0.03], { color: top, uvs: 'plank' });
    f.box('planks', [sink + sw / 2, height - 0.05, 0], [hw + 0.02, height, depth + 0.03], { color: top, uvs: 'plank' });
    f.box('planks', [sink - sw / 2, height - 0.05, 0], [sink + sw / 2, height, 0.08], { color: top, uvs: 'plank' });
    f.box('planks', [sink - sw / 2, height - 0.05, depth - 0.05], [sink + sw / 2, height, depth + 0.03], { color: top, uvs: 'plank' });
    f.box('enamel', [sink - sw / 2, height - 0.2, 0.08], [sink + sw / 2, height - 0.04, depth - 0.05]);
    f.box('iron', [sink - sw / 2 + 0.04, height - 0.19, 0.12], [sink + sw / 2 - 0.04, height - 0.17, depth - 0.09], { color: 0x8a8a90 });
    // Puertas de los armarios bajos.
    const doors = Math.max(2, Math.round(width / 0.45));
    const dw = (width - 0.06) / doors;
    for (let i = 0; i < doors; i++) {
      const x0 = -hw + 0.03 + i * dw;
      f.box('wood', [x0 + 0.01, 0.12, depth - 0.02], [x0 + dw - 0.01, height - 0.1, depth], { color: shade(color, 0.9) });
      f.box('iron', [x0 + dw / 2 - 0.015, height - 0.2, depth], [x0 + dw / 2 + 0.015, height - 0.17, depth + 0.03], { color: 0xb09060 });
    }
    // Bomba de mano: cuerpo, caño y palanca.
    f.cylinder('iron', { radius: 0.05, height: 0.36, x: pump, y: height + 0.18, z: 0.12, color: 0x3a4a3a });
    f.box('iron', [pump - 0.02, height + 0.26, 0.12], [pump + 0.02, height + 0.3, 0.3], { color: 0x3a4a3a });
    const lever = f.box('iron', [-0.015, 0, -0.015], [0.015, 0.3, 0.015], { color: 0x2a2a2a });
    lever.rotateX(-0.6);
    lever.translate(pump, height + 0.36, 0.1);
    f.collider([-hw, 0, 0], [hw, height, depth]);
  },

  // Nevera antigua de esquinas redondeadas (de pared) con tirador cromado.
  fridge(p, f) {
    const { width = 0.65, depth = 0.6, height = 1.55, radius = 0.08, color = 0xffffff } = p;
    const hw = width / 2;
    const r = radius;
    f.box('enamel', [-hw + r, 0.06, 0], [hw - r, height - r, depth], { color });
    f.box('enamel', [-hw, 0.06, 0], [hw, height - r, depth - r], { color });
    for (const side of [-1, 1]) {
      f.cylinder('enamel', { radius: r, height: height - r - 0.06, x: side * (hw - r), y: (height - r + 0.06) / 2, z: depth - r, color, segments: 8 });
    }
    // Techo redondeado: medio cilindro a lo ancho sobre el frente y una losa detrás.
    f.cylinder('enamel', { radius: r, height: width - r * 2, axis: 'x', x: 0, y: height - r, z: depth - r, color, segments: 8 });
    f.box('enamel', [-hw + r, height - r, 0], [hw - r, height, depth - r], { color });
    f.box('grain', [-hw + 0.04, height * 0.62, depth], [hw - 0.04, height * 0.62 + 0.012, depth + 0.004], { color: 0x9a9488 });
    f.box('grain', [hw - 0.1, height * 0.68, depth], [hw - 0.07, height * 0.9, depth + 0.05], { color: 0xd8dde2 });
    f.box('grain', [-0.08, height * 0.92, depth], [0.08, height * 0.95, depth + 0.006], { color: 0xb09050 });
    f.box('iron', [-hw + 0.03, 0, 0.03], [hw - 0.03, 0.06, depth - 0.03], { color: 0x404040 });
    f.collider([-hw, 0, 0], [hw, height, depth]);
  },

  // Barra con sartenes colgadas (de pared) a `hang` del suelo.
  pans(p, f) {
    const { width = 0.7, hang: y = 1.55, count = 3 } = p;
    const hw = width / 2;
    f.box('iron', [-hw, y - 0.015, 0.05], [hw, y + 0.015, 0.08], { color: 0x606060 });
    for (const side of [-1, 1]) f.box('iron', [side * hw - 0.015, y - 0.015, 0], [side * hw + 0.015, y + 0.015, 0.08], { color: 0x606060 });
    for (let i = 0; i < count; i++) {
      const x = -hw + (i + 0.5) * (width / count);
      const r = 0.1 + f.random() * 0.05;
      const handle = 0.18;
      f.box('iron', [x - 0.012, y - handle, 0.055], [x + 0.012, y, 0.075], { color: 0x303030 });
      f.cylinder('iron', { radius: r, height: 0.02, axis: 'z', x, y: y - handle - r, z: 0.06, color: 0x3a3a3a });
    }
  },

  // Lámpara de aceite sobre un mueble: pie, depósito, tubo de cristal y la lámpara interactiva.
  oilLamp(p, f) {
    const { color = 0x7a9a6a } = p;
    f.cylinder('grain', { radius: 0.06, height: 0.02, y: 0.01, color: 0xb09050 });
    f.cylinder('grain', { radius: 0.02, height: 0.06, y: 0.05, color: 0xb09050 });
    f.cylinder('grain', { radius: 0.065, height: 0.08, y: 0.12, color, segments: 8 });
    f.cylinder('grain', { radius: 0.02, height: 0.02, y: 0.17, color: 0xb09050 });
    f.cylinder('grain', { radius: 0.035, height: 0.16, y: 0.26, color: 0xe8eee4, segments: 8 });
    f.interactable({ type: 'lamp', position: [0, 0.23, 0], name: p.name ?? 'lamp', hit: { min: [-0.08, 0, -0.08], max: [0.08, 0.36, 0.08] } });
  },

  // Televisor de tubo sobre un mueble (fase 20): mueble de madera, marco, mandos,
  // rejilla y antena de cuernos. La pantalla curvada la crea el interactivo `television`.
  television(p, f) {
    const { width = 0.78, height = 0.6, depth = 0.55, screen = [0.56, 0.42], color = 0x6a4428 } = p;
    const hw = width / 2;
    const hd = depth / 2;
    const [sw, sh] = screen;
    const sx = -hw + 0.06 + sw / 2;
    const sy = height / 2 + 0.02;
    // Caja con un hueco frontal para la pantalla (rodeado por el marco).
    f.box('wood', [-hw, 0, -hd], [hw, height, hd - 0.04], { color });
    f.box('wood', [-hw, 0, hd - 0.04], [hw, sy - sh / 2 - 0.02, hd], { color });
    f.box('wood', [-hw, sy + sh / 2 + 0.02, hd - 0.04], [hw, height, hd], { color });
    f.box('wood', [-hw, 0, hd - 0.04], [sx - sw / 2 - 0.02, height, hd], { color });
    f.box('wood', [sx + sw / 2 + 0.02, 0, hd - 0.04], [hw, height, hd], { color });
    // Marco oscuro alrededor de la pantalla.
    const bx0 = sx - sw / 2 - 0.02;
    const bx1 = sx + sw / 2 + 0.02;
    const by0 = sy - sh / 2 - 0.02;
    const by1 = sy + sh / 2 + 0.02;
    const bezel = { color: 0x2a2622 };
    f.box('grain', [bx0, by0, hd - 0.04], [bx1, by0 + 0.025, hd - 0.005], bezel);
    f.box('grain', [bx0, by1 - 0.025, hd - 0.04], [bx1, by1, hd - 0.005], bezel);
    f.box('grain', [bx0, by0, hd - 0.04], [bx0 + 0.025, by1, hd - 0.005], bezel);
    f.box('grain', [bx1 - 0.025, by0, hd - 0.04], [bx1, by1, hd - 0.005], bezel);
    // Panel de mandos: rejilla del altavoz y dos mandos.
    const px = (sx + sw / 2 + hw) / 2;
    f.box('fabric', [px - 0.05, 0.08, hd], [px + 0.05, 0.3, hd + 0.005], { color: 0x5a4a3a });
    for (const y of [0.4, 0.5]) f.cylinder('grain', { radius: 0.025, height: 0.03, axis: 'z', x: px, y, z: hd + 0.015, color: 0x2a2a2a });
    // Antena de cuernos.
    f.box('iron', [-0.08, height, -0.06], [0.08, height + 0.04, 0.06], { color: 0x2a2a2a });
    for (const side of [-1, 1]) {
      const rod = f.box('iron', [-0.006, 0, -0.006], [0.006, 0.55, 0.006], { color: 0xc0c0c0 });
      rod.rotateZ(side * -0.45);
      rod.rotateX(-0.15);
      rod.translate(side * 0.03, height + 0.04, 0);
      const tip = f.box('iron', [-0.012, -0.012, -0.012], [0.012, 0.012, 0.012], { color: 0xc0c0c0 });
      tip.translate(side * (0.03 + Math.sin(0.45) * 0.55), height + 0.04 + Math.cos(0.45) * 0.55 * Math.cos(0.15), -Math.sin(0.15) * 0.55);
    }
    f.interactable({ type: 'television', position: [sx, sy, hd - 0.035], width: sw, height: sh, name: p.name ?? 'television', hit: { min: [-hw, 0, -hd], max: [hw, height, hd + 0.02] } });
  },

  // Montón de leña junto a la chimenea.
  logs(p, f) {
    const { count = 5, length = 0.45 } = p;
    for (let i = 0; i < count; i++) {
      const row = i < 3 ? 0 : 1;
      const x = row === 0 ? (i - 1) * 0.13 : (i - 3.5) * 0.13;
      f.cylinder('bark', { radius: 0.06, height: length, axis: 'z', x, y: 0.06 + row * 0.11, z: 0 });
    }
  },
};

// Construye un mueble en su espacio local. `sink` recibe las piezas:
// { add(layer, geometry, color), collider(min, max), interactable(data) }. Las geometrías
// se pueden seguir modificando hasta que termina el tipo: `sink` debe colocarlas después.
export function buildFurniture(entry, random, sink) {
  const build = FURNITURE_TYPES[entry.type];
  if (!build) throw new Error(`Tipo de mueble desconocido: "${entry.type}"`);
  build(entry, createBuilder(random, sink));
}

// Constructor `f` de piezas en coordenadas locales (también lo usan los modelos de los
// objetos recogibles, src/interaction/pickup.js).
export function createBuilder(random, sink) {
  return {
    random,
    add: (layer, geometry, color) => sink.add(layer, geometry, color),
    // Caja de `min` a `max`; se devuelve la geometría por si el tipo quiere girarla
    // (alrededor del origen local) y moverla después.
    box(layer, min, max, { color = 0xffffff, uvs = 'box' } = {}) {
      const geometry = new THREE.BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
      if (uvs === 'plank') plankUVs(geometry, random);
      else if (uvs === 'plankV') plankUVs(geometry, random, true);
      else applyBoxUVs(geometry);
      geometry.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      sink.add(layer, geometry, color);
      return geometry;
    },
    // Cilindro centrado en (x, y, z) a lo largo de `axis`; se puede girar sobre su centro.
    cylinder(layer, { radius, height, x = 0, y = 0, z = 0, axis = 'y', color = 0xffffff, segments = 7 }) {
      const geometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1);
      if (axis === 'x') geometry.rotateZ(Math.PI / 2);
      if (axis === 'z') geometry.rotateX(Math.PI / 2);
      applyBoxUVs(geometry);
      geometry.translate(x, y, z);
      sink.add(layer, geometry, color);
      return {
        geometry,
        rotateX: (angle) => rotateAround(geometry, [x, y, z], 'X', angle),
        rotateY: (angle) => rotateAround(geometry, [x, y, z], 'Y', angle),
      };
    },
    collider: (min, max) => sink.collider?.(min, max),
    interactable: (data) => sink.interactable?.(data),
  };
}

function rotateAround(geometry, [x, y, z], axis, angle) {
  geometry.translate(-x, -y, -z);
  geometry[`rotate${axis}`](angle);
  geometry.translate(x, y, z);
}

// Cuatro patas cuadradas de `size` bajo un tablero a `height`, centradas en z = cz.
function legs(f, x, z, height, size, color, cz = 0, layer = 'wood') {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      f.box(layer, [sx * x - size / 2, 0, cz + sz * z - size / 2], [sx * x + size / 2, height, cz + sz * z + size / 2], { color });
    }
  }
}

// Asiento interactivo: punto de apoyo sobre el cojín, mirando a +Z, con caja de apuntado.
// `sound`: 'wood' (silla) o 'fabric' (tapizado) para el efecto de sentarse.
function seat(f, x, height, backZ, frontZ, width, sound = 'wood') {
  f.interactable({
    type: 'seat',
    sound,
    position: [x, height, backZ + 0.18],
    hit: { min: [x - width / 2 + 0.03, height - 0.06, backZ], max: [x + width / 2 - 0.03, height + 0.12, frontZ + 0.02] },
  });
}

// Color hex multiplicado por un factor (tonos del mismo mueble).
function shade(hex, factor) {
  return new THREE.Color(hex).multiplyScalar(factor).getHex();
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}
