// Parámetros ajustables del juego. Cualquier valor "mágico" debe vivir aquí.

export const CONFIG = {
  seed: 1337,

  render: {
    // Altura en píxeles del render interno; el ancho se deriva del aspect ratio.
    pixelHeight: 220,
    maxPixelRatio: 1,
    clearColor: 0xa9cdef,
    // Ajusta la posición de la cámara a una rejilla de mundo para reducir el
    // "shimmering" de texels al moverse (1 / texelsPerUnit = un texel).
    cameraSnap: true,
    cameraSnapUnit: 1 / 24,
  },

  camera: {
    fov: 70,
    near: 0.1,
    far: 400,
  },

  loop: {
    // Límite de delta time (s) para evitar saltos tras cambiar de pestaña.
    maxDelta: 0.1,
  },

  lighting: {
    sunColor: 0xfff2d6,
    sunIntensity: 2.2,
    // Dirección hacia el sol (desde el suelo). Debe coincidir con el sol del cielo.
    sunDirection: { x: 0.6, y: 0.45, z: -0.5 },
    skyColor: 0xdfeeff,
    groundColor: 0x9a9a80,
    hemiIntensity: 0.8,
    // Luz de relleno casi horizontal desde la cámara: ilumina las caras
    // verticales (piedras a contraluz) sin aclarar las sombras del suelo.
    fillColor: 0xe8eeff,
    fillIntensity: 1.9,
    fillElevation: 0.15,
    fillSideOffset: 0.4,   // desplaza la luz hacia la derecha de la cámara
    toonSteps: 4,
    shadow: {
      mapSize: 2048,
      extent: 45,       // semiancho (u) del área con sombras alrededor del jugador
      distance: 80,     // distancia de la luz al centro del área de sombras
      bias: -0.0005,
      normalBias: 0.04,
    },
  },

  fog: {
    color: 0xa9cdef,
    near: 45,
    far: 175,
  },

  sky: {
    zenithColor: 0x3f7fc4,
    horizonColor: 0xa9cdef, // igual que la niebla para fundir el horizonte
    cloudColor: 0xf4f8fb,
    cloudShadeColor: 0xb9cde2,
    cloudScale: 0.12,
    cloudStretch: 0.2,     // < 1 estira las nubes en horizontal (vetas)
    cloudCoverage: 0.44,    // umbral del ruido: más alto = menos nubes
    cloudSteps: 5,          // niveles de opacidad de las nubes (look pixel)
    cloudWind: { x: 0.004, z: 0.0015 },
    sunColor: 0xfff6e0,
    sunSize: 0.035,         // radio angular del disco solar (rad)
    sunGlowSize: 0.22,      // radio angular del halo (rad)
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

  textures: {
    size: 64,          // lado de cada textura en texels
    texelsPerUnit: 12, // densidad de texels por unidad de mundo
    // colors: de oscuro a claro. blotchWeight: peso de las manchas (fbm) frente al grano.
    stone: {
      colors: [0x6b6762, 0x837e77, 0x96918a, 0xa8a39a, 0xb8b3aa, 0xc8c3b9],
      frequency: 4,
      octaves: 4,
      blotchWeight: 0.75,
      speckleLight: 0.02,
      speckleDark: 0.03,
    },
    grass: {
      colors: [0x44681c, 0x5f8a24, 0x7fa83a, 0x9cc04a],
      frequency: 4,
      octaves: 3,
      blotchWeight: 0.55,
      speckleLight: 0.05,
      speckleDark: 0.03,
    },
    dirt: {
      colors: [0x9c8452, 0xae9762, 0xbfa86f, 0xcdb87e],
      frequency: 3,
      octaves: 3,
      blotchWeight: 0.6,
      speckleLight: 0.02,
      speckleDark: 0.04,
    },
    // Textura de ruido suave (escala de grises) para nubes y borde del camino.
    noise: {
      size: 128,
      frequency: 8,
      octaves: 4,
    },
  },

  terrain: {
    size: 400,
    segments: 160,
    heightAmplitude: 1.8,  // altura máxima de las ondulaciones (u)
    heightFrequency: 0.015,
    octaves: 4,
    flatRadius: 24,        // radio llano alrededor del centro del nivel
    flatBlend: 30,         // transición de llano a ondulado
  },

  path: {
    edgeNoise: 1.1,        // irregularidad del borde (u)
    edgeNoiseScale: 0.18,  // frecuencia del ruido del borde
  },

  structures: {
    sink: 0.25,            // cuánto se entierran las piezas en el suelo (u)
    roughness: 0.07,       // deformación de vértices (u)
    roughnessFrequency: 1.3,
    taper: 0.12,           // estrechamiento de los pilares hacia arriba (0-1)
  },

  player: {
    eyeHeight: 1.6,
    height: 1.8,
    radius: 0.35,
    stepHeight: 0.45,      // altura máxima que se sube sin saltar
    walkSpeed: 5,
    runSpeed: 9,
    flySpeed: 14,
    groundAccel: 12,
    airAccel: 3,
    jumpSpeed: 6.5,
    gravity: 20,
    mouseSensitivity: 0.0022,
    maxPitch: 89,          // grados
    boundsMargin: 20,      // distancia mínima al borde del terreno
  },

  audio: {
    enabled: true,
    masterVolume: 0.6,
    windVolume: 0.3,
  },

  // Pasos: dos capas de ruido filtrado (talón + planta) por superficie.
  // noise: 'pink' | 'brown'. filter: tipo de BiquadFilter. Tiempos en segundos.
  footsteps: {
    volume: 0.55,
    busLowpass: 3000,      // corta los agudos de todos los pasos (Hz)
    stepDistance: 1.9,     // metros entre pasos al andar
    runStride: 1.3,        // multiplicador de zancada al correr
    runIntensity: 1.25,
    landIntensity: 1.7,
    landMinSpeed: 4,       // velocidad de caída mínima para sonar al aterrizar (u/s)
    surfaces: {
      grass: {
        toeDelay: 0.08,
        heel: { noise: 'pink', filter: 'lowpass', frequency: 1300, q: 0.5, highpass: 250, attack: 0.018, decay: 0.12, gain: 0.55 },
        toe: { noise: 'pink', filter: 'lowpass', frequency: 1700, q: 0.5, highpass: 350, attack: 0.025, decay: 0.16, gain: 0.45 },
      },
      dirt: {
        toeDelay: 0.07,
        heel: { noise: 'brown', filter: 'lowpass', frequency: 750, q: 0.7, highpass: 70, attack: 0.006, decay: 0.09, gain: 0.9 },
        toe: { noise: 'pink', filter: 'bandpass', frequency: 1500, q: 0.9, highpass: 400, attack: 0.008, decay: 0.07, gain: 0.35 },
      },
      stone: {
        toeDelay: 0.06,
        heel: { noise: 'pink', filter: 'lowpass', frequency: 1100, q: 0.6, highpass: 120, attack: 0.002, decay: 0.035, gain: 0.5 },
        toe: { noise: 'pink', filter: 'bandpass', frequency: 900, q: 1.2, highpass: 200, attack: 0.002, decay: 0.03, gain: 0.3 },
        tone: { frequency: 125, drop: 0.6, decay: 0.08, gain: 0.45 },
      },
    },
  },

  debug: {
    showHud: false,
  },
};
