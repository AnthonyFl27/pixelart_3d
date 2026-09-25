// Nivel "Pradera de piedras": círculo de trilitos al estilo Stonehenge.
// Todo es dato: para añadir una estructura basta con añadir una entrada.
//
// Coordenadas en unidades de mundo (≈ metros). El eje -Z es "adelante" desde el spawn.
// rotationY en radianes.

export const MEADOW = {
  name: 'Pradera de piedras',

  // Centro del círculo: el terreno es llano a su alrededor (terrain.flatRadius).
  center: { x: 0, z: 0 },

  // Posición inicial del jugador. yaw 0 = mirando hacia -Z.
  spawn: { x: 0, z: 29, yaw: 0 },

  // Caminos de tierra: polilíneas con ancho (radio) por punto.
  paths: [
    {
      name: 'entrada',
      points: [
        { x: 0.4, z: 31.5, width: 2.6 },
        { x: 0.0, z: 28.5, width: 3.4 },
        { x: 0.3, z: 25.5, width: 2.2 },
        { x: 0.8, z: 22.5, width: 1.3 },
        { x: 0.2, z: 19.5, width: 1.1 },
        { x: -0.2, z: 16.8, width: 1.3 },
      ],
    },
  ],

  // Zonas sin relieve procedural (la cabaña y el puente necesitan suelo tranquilo).
  clearZones: [
    { x: -78, z: 10, radius: 16 },
    { x: -60, z: 12, radius: 10 },
  ],

  // Relieve (src/world/terrainFeatures.js). Además se generan hundimientos,
  // montículos y manchas procedurales (CONFIG.terrain.scatter) y tierra al pie de las piedras.
  //   hollow    { x, z, radius, depth, ground: 'dirt' | 'mud' | null }
  //   mound     { x, z, radius | radiusX + radiusZ, height, rotationY }
  //   ridge     { points: [{ x, z }], width, height }
  //   gully     { points: [{ x, z }], width, depth, ground }
  //   dirtPile  { x, z, radius, height }
  //   dirtPatch { x, z, radius, ground: 'dirt' | 'mud' | 'gravel' }
  terrainFeatures: [
    // Hundimientos cerca del recorrido principal.
    { type: 'hollow', x: -17, z: 31, radius: 5, depth: 0.7, ground: 'mud' },
    { type: 'hollow', x: 21, z: 27, radius: 4, depth: 0.5 },
    { type: 'hollow', x: 34, z: -16, radius: 7, depth: 1.1 },
    { type: 'hollow', x: -30, z: -30, radius: 6, depth: 0.8, ground: 'mud' },
    { type: 'hollow', x: 9, z: -41, radius: 3, depth: 0.45 },
    { type: 'hollow', x: 14, z: 44, radius: 3.5, depth: 0.5, ground: null },

    // Montículos y crestas que rompen el horizonte cercano.
    { type: 'mound', x: 56, z: 20, radiusX: 11, radiusZ: 6, rotationY: 0.5, height: 2.5 },
    { type: 'mound', x: -22, z: -56, radius: 9, height: 2 },
    { type: 'mound', x: 70, z: 56, radius: 13, height: 3 },
    { type: 'mound', x: -36, z: 62, radiusX: 8, radiusZ: 5, rotationY: -0.7, height: 1.6 },
    { type: 'ridge', points: [{ x: 40, z: -50 }, { x: 60, z: -68 }, { x: 86, z: -76 }], width: 7, height: 2.2 },
    { type: 'ridge', points: [{ x: -95, z: -60 }, { x: -110, z: -35 }, { x: -118, z: -5 }], width: 9, height: 2.6 },

    // Surcos secos que bajan hacia el riachuelo (oeste).
    { type: 'gully', points: [{ x: -26, z: -9 }, { x: -37, z: -13 }, { x: -49, z: -11 }], width: 2, depth: 0.5 },
    { type: 'gully', points: [{ x: -28, z: 42 }, { x: -41, z: 45 }, { x: -50, z: 51 }], width: 2.4, depth: 0.6 },

    // Tierra acumulada junto al camino.
    { type: 'dirtPile', x: 3.6, z: 27, radius: 1.2, height: 0.2 },
    { type: 'dirtPile', x: -3.8, z: 24, radius: 1, height: 0.15 },
    { type: 'dirtPatch', x: 2.8, z: 20.5, radius: 1.2 },
  ],

  // Estructuras. Tipos disponibles (src/world/structures.js):
  //   trilithon   { height, gap, pillarWidth, pillarDepth, lintelHeight, lintelDepth, overhang }
  //   pillar      { width, height, depth, lean }
  //   fallenStone { length, width, thickness, tilt }
  //   boulder     { radius, sink }                     sink: fracción del radio enterrada
  //   outcrop     { radius, count, minSize, maxSize, sink } afloramiento de rocas semienterradas
  //   rubble      { radius, count, minSize, maxSize }   piedras pequeñas sin colisión
  //   tree        { height, crownRadius, trunkRadius, lobes }
  //   grove       { radius, count, minHeight, maxHeight } bosquecillo
  // Comunes: x, z, rotationY (rad), scale.
  structures: [
    // Anillo de trilitos (radio ≈ 14), orientados hacia el centro.
    { type: 'trilithon', x: 0, z: 14, rotationY: 0, height: 4.6, gap: 1.9, pillarWidth: 1.9, pillarDepth: 1.2 },
    { type: 'trilithon', x: 13.3, z: 4.3, rotationY: 1.26 },
    { type: 'trilithon', x: -13.3, z: 4.3, rotationY: -1.26, height: 3.9 },
    { type: 'trilithon', x: 8.2, z: -11.3, rotationY: 2.51, height: 4.6 },
    { type: 'trilithon', x: -8.2, z: -11.3, rotationY: -2.51 },

    // Piedras sueltas entre los trilitos.
    { type: 'pillar', x: 8.4, z: 11.2, rotationY: 0.63, height: 3.2 },
    { type: 'pillar', x: -8.6, z: 11.0, rotationY: -0.63, height: 3.8, lean: 0.06 },
    { type: 'pillar', x: 13.6, z: -4.6, rotationY: 1.88, height: 2.6 },
    { type: 'pillar', x: 0, z: -14, rotationY: 3.14, height: 3.4 },
    { type: 'pillar', x: -11.2, z: 6.9, rotationY: -1.1, width: 0.9, height: 2.9 },
    { type: 'pillar', x: -13.5, z: -4.6, rotationY: -1.88, height: 2.2, lean: -0.12 },

    // Piedras caídas y rocas.
    { type: 'fallenStone', x: 3.1, z: 15.4, rotationY: 0.35, tilt: 0.18 },
    { type: 'fallenStone', x: -4.5, z: 2.5, rotationY: -0.8 },
    { type: 'fallenStone', x: 5.5, z: -3.5, rotationY: 1.9, length: 3.0, tilt: 0.05 },
    { type: 'fallenStone', x: 15.5, z: 9.5, rotationY: 2.4, length: 2.6 },
    { type: 'boulder', x: -3.8, z: 21.5, radius: 0.7 },
    { type: 'boulder', x: 6.5, z: 23.5, radius: 0.9 },
    { type: 'boulder', x: -19, z: 17, radius: 1.2 },
    { type: 'boulder', x: 22, z: -8, radius: 1.0 },
    { type: 'boulder', x: -26, z: -12, radius: 1.4, sink: 0.3 },
    { type: 'boulder', x: 30, z: 18, radius: 0.8 },
    { type: 'boulder', x: 12, z: 34, radius: 1.1 },
    { type: 'boulder', x: -14, z: 36, radius: 0.6 },
    { type: 'boulder', x: -34, z: 2, radius: 0.9 },
    { type: 'boulder', x: 18, z: -30, radius: 1.3, sink: 0.3 },
    { type: 'boulder', x: -8, z: -32, radius: 0.7 },
    { type: 'boulder', x: 40, z: -6, radius: 1.6, sink: 0.35 },

    // Rocas semienterradas y afloramientos.
    { type: 'boulder', x: -12, z: 46, radius: 1.3, sink: 0.45 },
    { type: 'boulder', x: 26, z: 8, radius: 1.1, sink: 0.4 },
    { type: 'boulder', x: -40, z: 20, radius: 1.5, sink: 0.5 },
    { type: 'boulder', x: 15, z: -56, radius: 1.8, sink: 0.55 },
    { type: 'outcrop', x: 28, z: -40, radius: 3, count: 6 },
    { type: 'outcrop', x: -40, z: -46, radius: 4, count: 7, maxSize: 1.6 },
    { type: 'outcrop', x: 50, z: 40, radius: 2.5, count: 4 },
    { type: 'outcrop', x: -12, z: 58, radius: 3, count: 5 },
    { type: 'outcrop', x: 76, z: -12, radius: 3.5, count: 6, maxSize: 1.8 },

    // Escombros al pie de las piedras.
    { type: 'rubble', x: 2.2, z: 13.2, radius: 1.6, count: 9 },
    { type: 'rubble', x: -2.6, z: 15.2, radius: 1.2, count: 6 },
    { type: 'rubble', x: 12.1, z: 6.2, radius: 1.8, count: 8 },
    { type: 'rubble', x: -12.5, z: 2.4, radius: 1.5, count: 7 },
    { type: 'rubble', x: 7.0, z: -9.6, radius: 1.6, count: 8 },
    { type: 'rubble', x: -9.4, z: -10.0, radius: 1.4, count: 6 },
    { type: 'rubble', x: -4.0, z: 3.8, radius: 2.2, count: 10 },
    { type: 'rubble', x: 5.5, z: -2.0, radius: 1.8, count: 7 },
    { type: 'rubble', x: 15.0, z: 11.0, radius: 1.5, count: 6 },
    { type: 'rubble', x: 0, z: 0, radius: 7, count: 18, maxSize: 0.2 },

    // Árboles: uno solitario destacado, algunos sueltos y bosquecillos en el horizonte.
    { type: 'tree', x: 30, z: -26, height: 9.5, crownRadius: 3.5, lobes: 6 },
    { type: 'tree', x: -38, z: 30, height: 7 },
    { type: 'tree', x: 46, z: 36, height: 6.5 },
    { type: 'grove', x: -60, z: -90, radius: 14, count: 7 },
    { type: 'grove', x: 40, z: -118, radius: 18, count: 9 },
    { type: 'grove', x: 108, z: -40, radius: 12, count: 6 },
    { type: 'grove', x: -118, z: -22, radius: 16, count: 8 },
    { type: 'grove', x: -90, z: 72, radius: 12, count: 5 },
    { type: 'grove', x: 94, z: 82, radius: 14, count: 6 },
  ],
};
