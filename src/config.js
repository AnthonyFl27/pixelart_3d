// Parámetros ajustables del juego. Cualquier valor "mágico" debe vivir aquí.

export const CONFIG = {
  seed: 1337,

  render: {
    // Altura en píxeles del render interno; el ancho se deriva del aspect ratio.
    pixelHeight: 270,
    maxPixelRatio: 1,
    clearColor: 0x7fb4e0,
  },

  camera: {
    fov: 70,
    near: 0.1,
    far: 400,
    startPosition: { x: 0, y: 1.7, z: 12 },
    lookAt: { x: 0, y: 1.5, z: 0 },
  },

  loop: {
    // Límite de delta time (s) para evitar saltos tras cambiar de pestaña.
    maxDelta: 0.1,
  },

  lighting: {
    sunColor: 0xfff2d6,
    sunIntensity: 2.2,
    sunDirection: { x: -0.5, y: 0.8, z: -0.4 },
    skyColor: 0xbfdcff,
    groundColor: 0x5a7a2a,
    hemiIntensity: 1.0,
    toonSteps: 4,
  },

  fog: {
    color: 0xa9cdef,
    near: 60,
    far: 220,
  },

  postfx: {
    // Contorno oscuro en los bordes de los objetos (por diferencia de profundidad).
    outline: false,
    outlineThreshold: 0.15, // diferencia relativa de profundidad para dibujar borde
    outlineStrength: 0.45,  // 0 = sin oscurecer, 1 = negro

    // Reduce cada píxel al color más cercano de `palette` (máx. 32 colores, sRGB).
    paletteQuantize: false,
    palette: [
      // Cielo y nubes
      0x3f7fc4, 0x5b9bd8, 0x7fb4e0, 0xa9cdef, 0xd6e8f7, 0xf4f8fb,
      // Césped
      0x2e4a14, 0x44681c, 0x5f8a24, 0x7fa83a, 0xa3c54f, 0xc8dc6e,
      // Piedra
      0x3c3a38, 0x5e5b57, 0x817d77, 0x9a948a, 0xb7b1a6, 0xd2cdc3,
      // Tierra
      0x6e5a36, 0x9c8452, 0xbfa86f, 0xd8c78f,
      // Sombras y luz
      0x1b1f24, 0xfff2d6,
    ],

    // Dithering ordenado Bayer 4x4. Sin paleta, cuantiza cada canal a `colorLevels` niveles.
    dithering: false,
    ditherStrength: 0.06,
    colorLevels: 16,
  },

  world: {
    size: 300,
    segments: 128,
  },

  player: {
    eyeHeight: 1.7,
    walkSpeed: 5,
    runSpeed: 9,
    flySpeed: 14,
    jumpSpeed: 6,
    gravity: 18,
    mouseSensitivity: 0.0022,
  },

  debug: {
    showHud: false,
    testCube: true,
  },
};
