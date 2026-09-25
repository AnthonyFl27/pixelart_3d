// Parámetros ajustables del juego. Cualquier valor "mágico" debe vivir aquí.

export const CONFIG = {
  seed: 1337,

  render: {
    // Altura en píxeles del render interno; el ancho se deriva del aspect ratio.
    pixelHeight: 220,
    maxPixelRatio: 1,
    clearColor: 0x000000,
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
    // Colores e intensidades de sol, ambiente y relleno vienen de dayCycle.keyframes.
    // Luz de relleno casi horizontal desde la cámara: ilumina las caras
    // verticales (piedras a contraluz) sin aclarar las sombras del suelo.
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
    // El color de la niebla es el del horizonte del cielo en cada momento.
    near: 45,
    far: 175,
  },

  sky: {
    cloudScale: 0.12,
    cloudStretch: 0.2,     // < 1 estira las nubes en horizontal (vetas)
    cloudCoverage: 0.44,    // umbral del ruido: más alto = menos nubes
    cloudSteps: 5,          // niveles de opacidad de las nubes (look pixel)
    cloudWind: { x: 0.004, z: 0.0015 },
    sunSize: 0.035,         // radio angular del disco solar (rad)
    sunGlowSize: 0.22,      // radio angular del halo (rad)
    moonSize: 0.045,
    moonColor: 0xe8ecf4,
    moonCraterColor: 0xa9b0c0,
    horizonGlowPower: 3,    // concentración del resplandor del horizonte del lado del sol
    starDensity: 60,        // celdas por radian: más alto = estrellas más pequeñas y juntas
    starProbability: 0.07,
    starSize: 0.3,          // radio relativo a la celda
  },

  // Ciclo día/noche. time: 0 = medianoche, 0.25 = 6:00, 0.5 = mediodía, 0.75 = 18:00.
  dayCycle: {
    dayLength: 900,          // segundos reales por día completo (15 min)
    startTime: 0.33,         // ≈ 8:00
    fastForward: 40,         // multiplicador de tiempo con la tecla T
    orbitTilt: 0.55,         // rad: inclina la órbita del sol (a mediodía queda hacia -Z)
    orbitYaw: 0.35,          // rad: gira la órbita alrededor del eje Y
    minLightElevation: 0.06, // altura mínima de la luz con sombras (estabilidad)
    moonLightColor: 0xa8bcff,
    phases: [
      { from: 0, name: 'noche' },
      { from: 3.5, name: 'madrugada' },
      { from: 5.5, name: 'amanecer' },
      { from: 7, name: 'mañana' },
      { from: 12, name: 'tarde' },
      { from: 17.5, name: 'atardecer' },
      { from: 19, name: 'anochecer' },
      { from: 20.5, name: 'noche' },
    ],
    // Keyframes por elevación del sol (componente Y de su dirección, -1 a 1).
    // Colores en hex sRGB. sunLight/sunIntensity: luz del sol; moonIntensity: luz de luna.
    keyframes: [
      {
        elevation: -1, // noche cerrada
        zenith: 0x03061a, horizon: 0x0a1330, glow: 0x0a1330, sunDisc: 0xff8a40, sunLight: 0xff8a40,
        sunIntensity: 0, moonIntensity: 0.5,
        ambientSky: 0x34488a, ambientGround: 0x151a28, ambientIntensity: 0.3,
        fill: 0x8fa6e0, fillIntensity: 0.25,
        cloudLit: 0x232c48, cloudShade: 0x10162a, stars: 1,
      },
      {
        elevation: -0.14, // madrugada / final del anochecer
        zenith: 0x0b1540, horizon: 0x262b58, glow: 0x5a3a6a, sunDisc: 0xff8a40, sunLight: 0xff8a40,
        sunIntensity: 0, moonIntensity: 0.45,
        ambientSky: 0x44548f, ambientGround: 0x20242f, ambientIntensity: 0.4,
        fill: 0x9aaae0, fillIntensity: 0.35,
        cloudLit: 0x40406c, cloudShade: 0x1e2240, stars: 0.8,
      },
      {
        elevation: -0.04, // crepúsculo: cielo rosado, horizonte encendido
        zenith: 0x28397a, horizon: 0xb45e78, glow: 0xff8a50, sunDisc: 0xff7a3a, sunLight: 0xff7a3a,
        sunIntensity: 0, moonIntensity: 0.25,
        ambientSky: 0x8484b4, ambientGround: 0x38343c, ambientIntensity: 0.7,
        fill: 0xffc0a0, fillIntensity: 0.8,
        cloudLit: 0xf08a78, cloudShade: 0x5e5282, stars: 0.25,
      },
      {
        elevation: 0.04, // salida/puesta del sol
        zenith: 0x4868ae, horizon: 0xeea070, glow: 0xff7a30, sunDisc: 0xff9a50, sunLight: 0xff9a50,
        sunIntensity: 1.2, moonIntensity: 0,
        ambientSky: 0xd0b0a0, ambientGround: 0x6a6050, ambientIntensity: 0.75,
        fill: 0xffd0b0, fillIntensity: 1.2,
        cloudLit: 0xffb080, cloudShade: 0xb07a8a, stars: 0,
      },
      {
        elevation: 0.15, // mañana / tarde
        zenith: 0x4884c6, horizon: 0xc2d6ea, glow: 0xffd8b0, sunDisc: 0xffe6b0, sunLight: 0xffd9a8,
        sunIntensity: 1.9, moonIntensity: 0,
        ambientSky: 0xdfe8ff, ambientGround: 0x9a9a80, ambientIntensity: 0.8,
        fill: 0xf0eeff, fillIntensity: 1.7,
        cloudLit: 0xfff2e4, cloudShade: 0xc0c8d8, stars: 0,
      },
      {
        elevation: 0.4, // pleno día
        zenith: 0x3f7fc4, horizon: 0xa9cdef, glow: 0xa9cdef, sunDisc: 0xfff6e0, sunLight: 0xfff2d6,
        sunIntensity: 2.2, moonIntensity: 0,
        ambientSky: 0xdfeeff, ambientGround: 0x9a9a80, ambientIntensity: 0.8,
        fill: 0xe8eeff, fillIntensity: 1.9,
        cloudLit: 0xf4f8fb, cloudShade: 0xb9cde2, stars: 0,
      },
      {
        elevation: 1,
        zenith: 0x3f7fc4, horizon: 0xa9cdef, glow: 0xa9cdef, sunDisc: 0xfff6e0, sunLight: 0xfff2d6,
        sunIntensity: 2.2, moonIntensity: 0,
        ambientSky: 0xdfeeff, ambientGround: 0x9a9a80, ambientIntensity: 0.8,
        fill: 0xe8eeff, fillIntensity: 1.9,
        cloudLit: 0xf4f8fb, cloudShade: 0xb9cde2, stars: 0,
      },
    ],
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
    bark: {
      colors: [0x3a2818, 0x4e3620, 0x62462a, 0x765634],
      frequency: 2,
      octaves: 3,
      blotchWeight: 0.45,
      speckleLight: 0.03,
      speckleDark: 0.06,
    },
    leaves: {
      colors: [0x23401a, 0x2f5420, 0x3f6a26, 0x55822e, 0x6e9a3a],
      frequency: 5,
      octaves: 3,
      blotchWeight: 0.5,
      speckleLight: 0.06,
      speckleDark: 0.08,
    },
    moss: {
      colors: [0x3d5a1e, 0x4f6e24, 0x62802c, 0x7a9636],
      frequency: 4,
      octaves: 3,
      blotchWeight: 0.5,
      speckleLight: 0.04,
      speckleDark: 0.05,
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

  // Musgo/liquen sobre las piedras: aparece en caras hacia arriba, en el lado
  // norte (+Z, a la sombra) y cerca del suelo, con borde irregular por ruido.
  moss: {
    upWeight: 0.5,
    northWeight: 0.2,
    groundWeight: 0.35,    // cerca de y = 0
    noiseWeight: 1.0,
    noiseScale: 0.45,
    threshold: 0.93,       // más alto = menos musgo
  },

  // Pasto alto y flores (InstancedMesh). Se colocan alrededor del centro del nivel.
  vegetation: {
    radius: 85,
    grassCount: 9000,
    grassHeight: [0.35, 0.8],
    grassBlades: 5,
    grassBaseColor: 0x5a8424,
    grassTipColor: 0xb4d25a,
    clusterScale: 0.06,    // frecuencia de las manchas de pasto alto
    clusterThreshold: 0.5, // más alto = manchas más pequeñas
    sparseChance: 0.12,    // probabilidad de mata suelta fuera de las manchas
    flowerCount: 700,
    flowerColors: [0xf4f0e0, 0xf2d24a, 0xb58ad8, 0xe86a5a],
    pathMargin: 0.7,       // distancia mínima al camino (u)
    windStrength: 0.12,
    windSpeed: 1.6,
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
    chirpVolume: 0.05,     // trinos: volumen bajo y filtrados para no ser chillones
    chirpLowpass: 4200,
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

  birds: {
    flocks: 3,
    flockSize: 7,
    solo: 6,               // pájaros sueltos que pueden posarse
    areaRadius: 70,        // zona de vuelo alrededor del centro del nivel
    minAltitude: 8,
    maxAltitude: 28,
    minSpeed: 4,
    maxSpeed: 9,
    maxAccel: 9,
    seek: 1.1,
    cohesion: 0.5,
    alignment: 0.8,
    separation: 3,
    separationDistance: 1.8,
    retargetTime: [8, 20], // segundos hasta cambiar de rumbo
    perchChance: 0.6,
    perchHeight: 2.5,      // altura mínima de una piedra para posarse
    perchTime: [8, 22],
    scareDistance: 6,      // el jugador los espanta a esta distancia
    roostDistance: 170,    // adonde se van al anochecer
    hideDistance: 150,
    color: 0x3e3630,
    scale: 1.8,
    flapSpeed: 16,
    flapAmplitude: 0.32,
    chirpInterval: [2.5, 8],
    chirpDistance: 35,
  },

  inventory: {
    slots: 5,
    startItems: ['torch'], // ids de ITEMS (src/items/inventory.js) por ranura
    startSlot: -1,         // -1 = mano vacía
  },

  torch: {
    lightColor: 0xffa04a,
    lightIntensity: 10,
    lightDistance: 14,     // alcance máximo (u)
    lightDecay: 1.3,
    lightOffset: { x: 0.35, y: -0.1, z: -0.5 }, // posición de la llama respecto a la cámara
    lightJitter: 0.03,     // temblor de la posición de la luz (u)
    flicker: 0.18,         // amplitud del parpadeo (0-1)
    handLightIntensity: 1.6,
    handLightOffset: { x: -0.06, y: 0.1, z: 0.18 }, // respecto a la cabeza de la antorcha
    flameFrames: 8,
    flameFps: 12,
    flameBrightness: 1.6,
    sparkCount: 10,
    equipSpeed: 4,         // 1 / segundos para sacar o guardar
    viewFov: 55,
    viewPosition: { x: 0.34, y: -0.24, z: -0.8 },
    viewScale: 0.8,
    viewRotation: { x: -0.25, y: 0, z: -0.3 },
    bobFrequency: 1.5,
    bobAmount: 0.012,
    swayAmount: 0.4,
  },

  debug: {
    showHud: false,
  },
};
