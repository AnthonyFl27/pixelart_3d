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

  // Camino de tierra: polilínea con ancho (radio) por punto.
  path: [
    { x: 0.4, z: 31.5, width: 2.6 },
    { x: 0.0, z: 28.5, width: 3.4 },
    { x: 0.3, z: 25.5, width: 2.2 },
    { x: 0.8, z: 22.5, width: 1.3 },
    { x: 0.2, z: 19.5, width: 1.1 },
    { x: -0.2, z: 16.8, width: 1.3 },
  ],
};
