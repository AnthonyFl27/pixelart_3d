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
    // Piedra mojada del cauce: más oscura y saturada.
    wetStone: {
      colors: [0x2c3034, 0x3a3f44, 0x484e52, 0x585e60, 0x6a6f6c],
      frequency: 4,
      octaves: 3,
      blotchWeight: 0.7,
      speckleLight: 0.04,
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
    mud: {
      colors: [0x3e3022, 0x4a3a28, 0x584630, 0x66523a],
      frequency: 3,
      octaves: 3,
      blotchWeight: 0.65,
      speckleLight: 0.03,
      speckleDark: 0.05,
    },
    gravel: {
      colors: [0x5f5a52, 0x767064, 0x8a8475, 0x9f9888, 0xb4ad9c],
      frequency: 8,
      octaves: 2,
      blotchWeight: 0.3,
      speckleLight: 0.08,
      speckleDark: 0.1,
    },
    leavesAutumn: {
      colors: [0x6a2410, 0x8c3412, 0xb04a18, 0xcc6420, 0xe08a34],
      frequency: 5,
      octaves: 3,
      blotchWeight: 0.5,
      speckleLight: 0.06,
      speckleDark: 0.08,
    },
    // Madera gastada: vetas a lo largo del eje U (frecuencia [fx, fy]).
    wood: {
      colors: [0x4a4038, 0x5e5246, 0x726455, 0x857665, 0x9a8a76],
      frequency: [2, 24],
      octaves: 2,
      blotchWeight: 0.75,
      speckleLight: 0.01,
      speckleDark: 0.04,
    },
    // Mampostería del puente: bloques oscuros con mortero.
    masonry: {
      colors: [0x3e3c3e, 0x4c4a4c, 0x5a585a, 0x6a6868, 0x7a7876],
      mortar: 0x262426,
      rowHeight: [4, 6],     // texels
      blockWidth: [6, 12],   // texels
      grain: 0.8,
    },
    // Cabaña (src/world/cabin.js). Tablas gastadas: una fila de `rowHeight` texels por tabla.
    planks: {
      colors: [0x3b332c, 0x554940, 0x685b4f, 0x7b6d5e, 0x8e806e],
      rowHeight: 4,
      boardLength: [14, 34], // texels
      grain: 0.5,
      grainFrequency: [8, 32],
      knots: 0.35,
      nails: 0.5,
      weathering: 0.15,      // tablas más claras (lavadas por la lluvia)
    },
    shingles: {
      colors: [0x2b241f, 0x463b33, 0x564a3f, 0x685a4c, 0x7a6b5a],
      rowHeight: 4,
      shingleWidth: [3, 6],  // texels
      missing: 0.03,
      accent: 0x55602e,      // musgo
      accentChance: 0.06,
    },
    rustyMetal: {
      metal: [0x4e4f50, 0x646566, 0x7b7b7a],
      rust: [0x5e2e16, 0x7e401c, 0x9c5424, 0xb86c30],
      ribPeriod: 4,          // texels por onda
      rustAmount: 0.45,
      frequency: [3, 1],     // manchas estiradas en vertical
    },
    lattice: {
      colors: [0x7c786b, 0x969282, 0xaca796],
      gap: 0x15120f,
      period: 4,             // texels (debe dividir a `size`)
      slat: 1,
    },
    dirtyGlass: {
      tint: 0x5f7c88,
      alpha: 0.4,
      grime: 0x57513f,
      grimeAlpha: 0.82,
      grimeAmount: 0.35,
      drips: 0.15,           // columnas con chorretones
      highlight: 0xdfe9ee,
      highlightAlpha: 0.55,
      highlightPeriod: 23,
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
    // Trozos de malla con resolución propia; las regiones agrupan trozos en una malla.
    chunkSize: 10,
    regionSize: 100,
    // Tamaño de celda (u) según el detalle que necesita cada trozo.
    cellSizes: { fine: 0.5, mid: 1, base: 2 },
    normalSample: 0.5,     // paso para la normal analítica (u)
    heightAmplitude: 3,    // altura máxima de las ondulaciones grandes (u)
    heightFrequency: 0.015,
    octaves: 4,
    relief: { amplitude: 1.1, frequency: 0.05 }, // lomas medianas (≈ 20 m)
    // Micro-relieve: dos octavas pequeñas; dentro del centro llano se atenúa.
    micro: { amplitude: 0.2, frequency: 0.22, fineAmplitude: 0.07, fineFrequency: 0.6, insideFlat: 0.55 },
    flatRadius: 24,        // radio llano alrededor del centro del nivel
    flatBlend: 30,         // transición de llano a ondulado
    featureGrid: 20,       // tamaño de los cubos de búsqueda de modificadores (u)
    irregularity: 0.3,     // deformación del contorno de hundimientos y montículos (0-1)
    irregularityScale: 0.35,
    hollowGround: 0.55,    // fracción del radio de un hundimiento con fondo de tierra/barro
    gullyGround: 0.4,      // fracción del ancho de un surco con fondo de grava
    flattenCore: 0.55,     // fracción del radio de una zona allanada que queda plana del todo
    // Tierra acumulada al pie de las piedras: radio y altura por tipo (boulder: × radio).
    structureDirt: {
      trilithon: { radius: 3.4, height: 0.22, amount: 0.8 },
      pillar: { radius: 1.8, height: 0.18, amount: 0.8 },
      fallenStone: { radius: 2.4, height: 0.16, amount: 0.7 },
      boulder: { radius: 2, height: 0.2, amount: 0.8, scaleByRadius: true },
      outcrop: { radius: 1.3, height: 0.15, amount: 0.7, scaleByRadius: true },
    },
    // Capa procedural de relieve repartida por el mapa.
    scatter: {
      areaRadius: 175,
      centerClearance: 30, // distancia mínima al centro del nivel
      pathClearance: 3,    // distancia mínima a los caminos
      streamClearance: 8,  // distancia mínima a la orilla del riachuelo
      hollows: 34,
      hollowRadius: [2.5, 8],
      hollowDepth: [0.3, 1.3],
      muddyHollowChance: 0.35,
      mounds: 22,
      moundRadius: [5, 12],
      moundHeight: [1, 2.8],
      dirtPatches: 26,
      dirtPatchRadius: [1, 3],
      gravelPatchChance: 0.3,
    },
  },

  // Mapa de suelo (src/world/groundMap.js): tierra, barro y grava sobre el césped.
  groundMap: {
    resolution: 2,         // píxeles por unidad de mundo
    range: 2,              // distancia (u) en la que el peso pasa de 1 a 0 alrededor del borde
    edgeNoise: 1.1,        // irregularidad del borde (u)
    edgeNoiseScale: 0.18,  // frecuencia del ruido del borde
  },

  // Riachuelo (src/world/stream.js). Anchos y profundidades por punto en el nivel.
  stream: {
    sampleSpacing: 1,      // distancia entre muestras del recorrido suavizado (u)
    indexCell: 18,         // celda del índice espacial; debe cubrir valle + talud + radio
    freeboard: 0.45,       // la orilla queda este tanto por encima del agua
    maxStep: 0.35,         // altura máxima de un rápido (u)
    rapidFoamBefore: 2,    // muestras con espuma antes y después de cada rápido
    rapidFoamAfter: 5,
    minWaterDepth: 0.2,
    edgeDepth: 0.06,       // el lecho queda un poco bajo el agua en el borde
    bankSlope: 1.6,        // anchura del talud entre el agua y la orilla (u)
    bankIrregularity: 0.15,
    maxBankHeight: 0.6,    // altura máxima de la orilla sobre su cota junto al cauce
    valleySlope: 0.35,     // pendiente permitida al alejarse del cauce
    valleyWidth: 9,        // distancia en la que el valle se funde con el terreno
    fineMargin: 3,         // margen de malla fina alrededor del talud
    fineZoneMargin: 25,    // malla fina del cauce hasta esta distancia de una zona despejada (u)
    gravelFraction: 0.75,  // fracción del radio del agua con fondo de grava
    mudBand: 0,            // barro más allá del final del talud (u)
    mudSlopeFraction: 0.8, // fracción del talud cubierta de barro
    mudStrength: 1,        // < 1: el barro sale a manchas
    bankPileSpacing: 7,    // tierra acumulada en las orillas cada ~N metros
    rocks: {
      spacing: 6,          // una roca en el cauce cada ~N metros
      spread: 0.85,        // fracción del radio del agua donde pueden caer
      radius: [0.4, 1],
      sink: -0.1,          // negativo: la roca asoma sobre el lecho
      colliderRadius: 0.55,
      bankRubbleSpacing: 5,
    },
  },

  water: {
    colors: {
      deep: 0x16307e,
      mid: 0x2552b0,
      shallow: 0x3f7fd6,
      light: 0x6aa8ea,
      foam: 0xe8f2ff,
      sparkle: 0xffffff,
    },
    acrossSegments: 6,
    bankOverlap: 0.5,      // la cinta entra en el talud (u)
    flowSpeed: 1.1,        // velocidad media de la corriente (u/s)
    rapidSpeedBoost: 1.5,
    sparkleDensity: 0.05,
    maxRocks: 48,          // rocas con espuma alrededor (uniforms del shader)
    ambientWeight: 0.45,   // peso de la luz ambiente en el color del agua
    lightWeight: 0.24,     // peso de la luz directa (sol o luna)
    maxTint: 1.15,
    sparkleBase: 0.35,     // brillo de los destellos sin luz directa (luna)
    sparkleLight: 0.4,
  },

  // Caminos: hundidos por el paso con un reborde de tierra acumulada.
  paths: {
    sink: 0.1,
    berm: 0.08,
    bermWidth: 0.7,
  },

  structures: {
    sink: 0.25,            // cuánto se entierran las piezas en el suelo (u)
    roughness: 0.07,       // deformación de vértices (u)
    roughnessFrequency: 1.3,
    taper: 0.12,           // estrechamiento de los pilares hacia arriba (0-1)
  },

  bridge: {
    archSegments: 10,      // segmentos de cada arco
    rampLip: 0.03,         // la rampa sobresale este tanto sobre el terreno en su extremo
  },

  // Cabaña (src/world/cabin.js). Ejes locales: X a lo ancho de la fachada, +Z hacia el
  // porche, y = 0 en el suelo interior. Cualquier clave se puede sobrescribir en el nivel.
  // Huecos: `wall` ('front' | 'back' | 'left' | 'right'), `x` a lo largo de la pared vista
  // desde fuera (hacia la derecha), alturas sobre el suelo (se ajustan a filas de tablas).
  cabin: {
    width: 9,
    depth: 7,
    wallHeight: 2.8,
    ridgeHeight: 5,          // altura de la cara inferior de los cabios en la cumbrera
    floorClearance: 0.6,     // altura mínima del suelo sobre el terreno (pilotes)
    floorThickness: 0.2,
    groundSample: 0.5,       // paso para medir el terreno bajo la cabaña (u)
    // Tablas horizontales de las paredes.
    boardRows: 9,
    boardThickness: 0.05,
    boardTilt: 0.05,         // rad: el canto inferior sobresale (solape)
    boardLength: [1.6, 3.4],
    missingBoards: 0.04,
    looseBoards: 0.05,       // cuelgan de un clavo
    looseAngle: [0.12, 0.3],
    crookedBoards: 0.1,
    crookedAngle: 0.04,
    cornerBoard: 0.18,
    trimWidth: 0.1,          // marcos de puerta y ventanas
    wallColliderDepth: 0.12,
    door: { wall: 'front', x: -0.4, width: 1, height: 2.1 },
    windows: [
      { wall: 'front', x: -2.9, width: 1.1, bottom: 0.95, top: 2.15, cols: 2, rows: 2, shutters: true, brokenPane: 1 },
      { wall: 'front', x: 2.9, width: 1.1, bottom: 0.95, top: 2.15, cols: 2, rows: 2, shutters: true, crookedShutter: 1 },
      { wall: 'right', x: -0.5, width: 0.9, bottom: 1.1, top: 2.15, cols: 2, rows: 2 },
      { wall: 'back', x: -3, width: 0.9, bottom: 1.25, top: 2.15, cols: 2, rows: 1 },
      { wall: 'back', x: 2, width: 1, bottom: 0.95, top: 2.15, cols: 2, rows: 2, shutters: true, crookedShutter: -1 },
      { wall: 'left', x: 2.3, width: 0.7, bottom: 1.25, top: 2.15, cols: 1, rows: 2 },
    ],
    mullion: 0.04,           // grosor de los travesaños de las ventanas
    shutterAngle: 0.35,      // rad: contraventana descolgada
    // Tejado a dos aguas de tablillas con chapas y un agujero con los cabios a la vista.
    roof: {
      thickness: 0.08,
      eaveOverhang: 0.4,
      gableOverhang: 0.35,
      rafterHeight: 0.14,
      rafterWidth: 0.08,
      rafterSpacing: 0.9,
      // Agujero en el faldón delantero (x a lo ancho, d a lo largo de la pendiente desde la cumbrera).
      hole: { x0: -3.3, x1: -1.3, d0: 0.9, d1: 2.6 },
      brokenShingles: 0.6,   // probabilidad de tablilla rota en el borde del agujero
      laths: 3,              // listones que cruzan el agujero
      patches: [             // chapas oxidadas: side 1 delante, -1 detrás
        { side: 1, x: 1.9, d: 3.2, width: 1.3, length: 1.5, angle: 0.05 },
        { side: 1, x: -3.4, d: 3.6, width: 1, length: 1.1, angle: -0.08 },
        { side: -1, x: -1.2, d: 2.2, width: 1.4, length: 1.8, angle: -0.04 },
        { side: -1, x: 2.6, d: 3.4, width: 1.1, length: 1.3, angle: 0.1 },
      ],
      tieBeamEvery: 2,       // una viga horizontal cada N cabios
    },
    porch: {
      depth: 2.2,
      drop: 0.12,            // el porche queda este tanto por debajo del suelo interior
      thickness: 0.15,
      roofDrop: 0.3,         // arranque del tejado del porche bajo el alero principal
      roofSlope: 0.16,       // pendiente (tangente) del tejado del porche
      eave: 0.3,
      sheetWidth: 1.1,       // chapas del tejado del porche
      postSize: 0.14,
      beamHeight: 0.14,
      railHeight: 0.9,
      balusterSpacing: 0.16,
      balusterSize: 0.045,
      missingBalusters: 0.08,
      brokenBalusters: 0.06,
      stairsWidth: 1.5,
      stepRun: 0.3,
      maxStepRise: 0.2,
    },
    chimney: {
      z: 0,                  // posición a lo largo de la pared izquierda
      baseWidth: 1.7,
      baseDepth: 0.9,
      baseHeight: 2.2,
      shoulderWidth: 1.3,
      shoulderHeight: 0.45,
      stackWidth: 0.95,
      stackDepth: 0.7,
      aboveRoof: 0.7,        // sobre la cumbrera
    },
    pilingSpacing: 2.2,
    latticeSegment: 1.2,
    brokenLattice: 0.1,
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

  // Musgo del puente: solo en la parte baja y en manchas sueltas.
  masonryMoss: {
    upWeight: 0.2,
    northWeight: 0.15,
    groundWeight: 0.45,
    noiseWeight: 1.0,
    noiseScale: 0.4,
    threshold: 1.05,
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
    bareMargin: 0.7,       // distancia mínima al suelo desnudo: caminos, barro, grava (u)
    // Pasto seco en las zonas `dryGrass` del nivel: fracción seca 1 hasta `dryCore` del radio.
    dryBaseColor: 0x6e6232,
    dryTipColor: 0xc9b268,
    dryCore: 0.55,
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
    wadeSpeedFactor: 0.55, // velocidad al vadear el riachuelo (sin correr)
    wadeMinDepth: 0.05,    // profundidad mínima del agua para contar como vadeo
  },

  audio: {
    enabled: true,
    masterVolume: 0.6,
    windVolume: 0.3,
    chirpVolume: 0.05,     // trinos: volumen bajo y filtrados para no ser chillones
    chirpLowpass: 4200,
    // Riachuelo (src/audio/water.js): volumen según la distancia a la orilla más cercana.
    water: {
      volume: 0.55,
      fullDistance: 3,     // volumen máximo a esta distancia o menos (u)
      maxDistance: 35,     // inaudible más allá (u)
      curve: 1.6,          // > 1: cae más rápido al alejarse
      rumbleLowpass: 380,  // rumor grave
      rumbleGain: 0.9,
      babbleFrequency: [800, 1700], // burbujeo medio (banda que se mueve al azar)
      babbleQ: 0.9,
      babbleGain: 0.6,
      babbleDrift: 0.35,   // segundos entre cambios del burbujeo
      dropletRate: 5,      // gotas por segundo a volumen máximo
      dropletFrequency: [450, 1300],
      dropletGain: 0.25,
      rapidVoices: 2,      // fuentes extra en los rápidos más cercanos
      rapidGain: 0.45,
      rapidFullDistance: 2,
      rapidMaxDistance: 22,
      rapidFrequency: 2600,
    },
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
    // Superficies sin perfil propio todavía: usan el de otra.
    aliases: { mud: 'dirt', gravel: 'dirt', water: 'dirt' },
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
