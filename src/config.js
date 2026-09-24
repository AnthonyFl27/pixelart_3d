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
    paletteQuantize: false,
    dithering: false,
    outline: false,
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
