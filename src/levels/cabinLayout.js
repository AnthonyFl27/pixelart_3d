// Distribución interior de la cabaña como datos (src/world/cabin.js y furniture.js).
// Coordenadas locales de la cabaña: X a lo ancho (-4.5 … 4.5), Z de la pared trasera
// (-3.5) al porche (3.5), y = 0 en el suelo interior. `rotationY` orienta el frente del
// mueble (+Z local): 0 → +Z, π → -Z, π/2 → +X, -π/2 → -X. Los muebles de pared tienen el
// origen en la superficie de la pared (ver furniture.js). `y` eleva el mueble (p. ej. sobre
// una mesa); cuadros y sartenes cuelgan a `hang`. Los interactivos (asientos,
// lámpara, televisor) los declaran los propios muebles.

const WALL = { back: -3.42, front: 3.42, left: -4.42, right: 4.42 };
const PARTITION = 1.5;
const HALF_PI = Math.PI / 2;

export const CABIN_LAYOUT = {
  // Tabique entre la sala (x < 1,5) y la cocina, con un vano sin puerta.
  partition: { x: PARTITION, thickness: 0.1, opening: { z: 0.25, width: 1.1, height: 2.1 } },

  // Revestimiento interior de las paredes por estancia (entre x0 y x1).
  // wainscot: altura del friso de tablas bajo el papel pintado.
  rooms: [
    { name: 'sala', x0: -4.5, x1: PARTITION, lining: 'wallpaper', wainscot: 0.9, wainscotColor: 0xb89a78 },
    { name: 'cocina', x0: PARTITION, x1: 4.5, lining: 'planks', color: 0xe6d6bc },
  ],

  // Altillo sobre la cocina (tablas sobre las vigas, visto desde abajo).
  loft: { x0: PARTITION, x1: 4.5 },

  // Tubo de la cocina de leña que sale por el tejado (x, z y altura sobre la cumbrera local).
  stovePipe: { x: 4.27, z: -1.1, radius: 0.07, above: 0.6 },

  furniture: [
    // --- Sala ---
    { type: 'fireplace', x: WALL.left, z: 0, rotationY: HALF_PI, top: 2.8 },
    { type: 'logs', x: -4.05, z: 1.25, rotationY: 0.3 },
    { type: 'rug', x: -2.35, z: -0.3, width: 2.2, depth: 2.3 },
    { type: 'sofa', x: -2.5, z: 1.3, rotationY: Math.PI, width: 2, seats: 3, color: 0x6e4034 },
    { type: 'armchair', x: -0.7, z: -1.3, rotationY: -2.04, color: 0x3e5a44 },
    { type: 'coffeeTable', x: -2.4, z: -0.35 },
    { type: 'oilLamp', x: -2.65, y: 0.42, z: -0.3, name: 'lamp' },
    { type: 'cabinet', x: -3.35, z: WALL.back, width: 1.1, depth: 0.5, height: 0.55 },
    { type: 'television', x: -3.35, y: 0.56, z: WALL.back + 0.3, name: 'television' },
    { type: 'bookshelf', x: PARTITION - 0.05, z: -2.6, rotationY: -HALF_PI },
    { type: 'cabinet', x: PARTITION - 0.05, z: 2.2, rotationY: -HALF_PI, width: 1.2, depth: 0.45, height: 0.85, drawers: 3, color: 0x7a5234 },
    { type: 'picture', x: -0.3, z: WALL.back, hang: 1.55, width: 0.5, height: 0.4 },
    { type: 'picture', x: 0.6, z: WALL.back, hang: 1.7, width: 0.36, height: 0.46, colors: [0xc8b08a, 0x8a5a3a, 0x5a4a3a] },
    { type: 'picture', x: -1.65, z: WALL.front, hang: 1.6, rotationY: Math.PI, width: 0.42, height: 0.52, frame: 0x8a6a3a, colors: [0xa8c0d0, 0x6a8a5a, 0x4a6a3a] },
    { type: 'picture', x: WALL.left, z: -2.2, hang: 1.5, rotationY: HALF_PI, width: 0.6, height: 0.42 },

    // --- Cocina ---
    { type: 'counter', x: 3.75, z: WALL.back, width: 1.3, sink: 0, pump: -0.45 },
    { type: 'woodStove', x: WALL.right, z: -1.3, rotationY: -HALF_PI, pipeTop: 2.8 },
    { type: 'pans', x: WALL.right, z: -0.45, rotationY: -HALF_PI, hang: 1.6, width: 0.7 },
    { type: 'shelf', x: WALL.right, z: -2.35, rotationY: -HALF_PI, width: 0.7, heights: [1.3, 1.7], items: 4 },
    { type: 'shelf', x: PARTITION + 0.05, z: 2.4, rotationY: HALF_PI, width: 1, heights: [1.4, 1.78], items: 5 },
    { type: 'cupboard', x: PARTITION + 0.05, z: -1.6, rotationY: HALF_PI, width: 0.9, depth: 0.45 },
    { type: 'fridge', x: 4.05, z: WALL.front, rotationY: Math.PI },
    { type: 'table', x: 3, z: 1.1, width: 1.1, depth: 0.75 },
    { type: 'chair', x: 3, z: 0.45, rotationY: 0 },
    { type: 'chair', x: 3, z: 1.78, rotationY: Math.PI, color: 0x7a5232 },
  ],
};
