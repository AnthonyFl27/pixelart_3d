# AGENTS.md — pixelart_3d

## Qué es este proyecto

Videojuego 3D con estética **pixel art** que se ejecuta en el navegador desde un único `index.html`.
El prototipo es una escena abierta tipo "Stonehenge": pradera con pasto alto y flores, un camino de tierra,
estructuras de piedra (trilitos) con musgo, árboles y un cielo con nubes, todo renderizado a baja resolución
con texturas pixeladas, iluminación escalonada y sombras duras. El jugador se mueve libremente en primera
persona. Desde la spec v2 el mundo tiene ciclo día/noche de 15 minutos, pájaros con comportamiento propio,
una antorcha en un inventario básico y pasos con sonido por superficie.

Referencias visuales: imagen del prototipo adjunta en la spec y el video
https://youtu.be/GhlTMsPoaJw

## Stack técnico

| Área            | Tecnología                                                                 |
|-----------------|----------------------------------------------------------------------------|
| Motor 3D        | [Three.js](https://threejs.org) (ES modules) cargado vía `importmap` desde CDN |
| Lenguaje        | JavaScript moderno (ES2022), sin transpilar                                 |
| Build           | **Ninguno**. Sin bundler, sin `npm install` obligatorio                      |
| Estilo pixel    | Render a baja resolución + escalado `nearest`, texturas procedurales, luz cuantizada |
| Controles       | Pointer Lock API (ratón) + teclado                                          |

## Cómo ejecutar

Los navegadores bloquean ES modules desde `file://`, por lo que se sirve la carpeta con cualquier servidor estático:

```bash
# Opción A (Python)
python3 -m http.server 8080
# Opción B (Node)
npx serve .
```

Abrir `http://localhost:8080`. También funciona tal cual en GitHub Pages.

## Estructura del proyecto

```
pixelart_3d/
├── index.html                  # Punto de entrada: importmap, canvas, contenedor de UI
├── src/
│   ├── main.js                 # Arranque: motor, mundo, jugador, UI, estados y bucle
│   ├── config.js               # TODOS los parámetros ajustables
│   ├── core/
│   │   ├── renderer.js         # WebGLRenderer, cámara y resize
│   │   ├── loop.js             # Bucle con THREE.Timer y delta limitado
│   │   ├── input.js            # Teclado, ratón, Pointer Lock
│   │   └── noise.js            # PRNG con semilla y ruido de valor 2D
│   ├── render/
│   │   ├── pixelPipeline.js    # Render a baja resolución + escalado entero + capas superpuestas
│   │   └── shaders/postfx.js   # Outline, paleta y dithering
│   ├── world/
│   │   ├── textures.js         # Texturas procedurales (piedra, césped, tierra, corteza, hojas, musgo, ruido)
│   │   ├── materials.js        # Materiales toon por bandas + musgo en la piedra
│   │   ├── geometryUtils.js    # UVs de densidad constante
│   │   ├── terrain.js          # Terreno por trozos de resolución variable, getHeight(x, z) y suelo (shader)
│   │   ├── terrainFeatures.js  # Relieve: ruido por capas, hundimientos, montículos, surcos, caminos
│   │   ├── groundMap.js        # Mapa de suelo (tierra, barro, grava) y getSurface
│   │   ├── dayCycle.js         # Reloj del mundo: hora, fase, sol/luna y colores por keyframes
│   │   ├── sky.js              # Cúpula de cielo: degradado, nubes, sol, luna y estrellas
│   │   ├── lighting.js         # Sol/luna con sombras, ambiente y luz de relleno según la hora
│   │   ├── structures.js       # Fábrica de estructuras: piedras, escombros, árboles
│   │   ├── vegetation.js       # Pasto alto y flores instanciados con viento
│   │   └── levelLoader.js      # Instancia un nivel y fusiona las piezas por material
│   ├── player/
│   │   ├── controller.js       # Primera persona: andar, correr, saltar, volar
│   │   └── collision.js        # Cajas orientadas, suelo y techo
│   ├── items/
│   │   ├── inventory.js        # Ranuras, selección y catálogo de objetos
│   │   └── torch.js            # Antorcha en primera persona: llama, chispas y luz
│   ├── fauna/birds.js          # Pájaros: bandadas, posado, actividad según la hora
│   ├── levels/meadow.js        # Nivel como datos (spawn, caminos, relieve, estructuras)
│   ├── ui/                     # overlay.js (inicio/pausa), hud.js (F3), hotbar.js, ui.css
│   └── audio/
│       ├── ambient.js          # Viento, trinos y bus maestro (Web Audio)
│       └── footsteps.js        # Pasos por superficie (césped, tierra, piedra)
├── sdd/                        # Spec-Driven Development
│   ├── specs/spec_v1.md        # Especificación del prototipo
│   ├── specs/spec_v2.md        # Mundo vivo: día/noche, antorcha, fauna y entorno
│   ├── specs/spec_v3.md        # Nuevas zonas: riachuelo, cabaña explorable y relieve
│   ├── plan.md                 # Plan de implementación
│   ├── task.md                 # Tareas de las specs v1 y v2 (completadas)
│   └── task-v2.md              # Tareas de la spec v3
└── AGENTS.md
```

## Puntos de extensión

- **Nueva estructura en el nivel:** añadir una entrada a `structures` en `src/levels/meadow.js`.
- **Nuevo tipo de estructura:** añadir una función a `STRUCTURE_TYPES` en `src/world/structures.js`
  que devuelva piezas `{ geometry, position, rotationY, material, collider, groundAt }`.
  Colisiones, sombras y fusión por material son automáticas.
- **Nuevo objeto de inventario:** añadirlo a `ITEMS` en `src/items/inventory.js` (con icono 16x16)
  y su comportamiento en `main.js` según `inventory.activeItem`.
- **Hora del día:** keyframes de color y luz en `CONFIG.dayCycle.keyframes`; duración en `dayLength`.
- **Relieve:** añadir entradas a `terrainFeatures` en el nivel (`hollow`, `mound`, `ridge`, `gully`, `dirtPile`,
  `dirtPatch`); nuevos tipos en `FEATURE_TYPES` de `src/world/terrainFeatures.js`.
- **Nuevo nivel:** crear `src/levels/<nombre>.js` con la misma forma que `MEADOW` e importarlo en `main.js`.
- **Aspecto visual:** paleta, resolución pixel, luz, niebla, nubes y post-proceso en `src/config.js`.

## Flujo de trabajo (SDD)

1. Leer `sdd/specs/` (la versión más alta es la vigente).
2. Seguir `sdd/plan.md` por fases.
3. Tomar la siguiente tarea pendiente de la lista vigente (`sdd/task-v2.md` para la spec v3), implementarla y marcarla `[x]` en el mismo commit.
4. Cambios de alcance → nueva spec (`spec_v2.md`, …) y actualización de plan y tareas.

## Convenciones de código

- Un módulo = una responsabilidad. Cada módulo exporta funciones/clases con nombre (sin `export default`).
- Ningún número mágico en el código de juego: todo parámetro ajustable vive en `src/config.js`.
- Los niveles son **datos** (`src/levels/*.js`): añadir una estructura no requiere tocar lógica.
- Texturas generadas proceduralmente en `<canvas>` con paleta limitada; siempre `NearestFilter` y sin mipmaps.
- Nombres en inglés en el código; documentación en español.
- Sin dependencias adicionales sin justificarlo en la spec.
- Mantener 60 FPS en un portátil medio: evitar geometría excesiva, reutilizar materiales y geometrías.

## Verificación

- Abrir el juego en el servidor local y comprobar que no hay errores en consola.
- `F3` muestra FPS, hora, posición, resolución interna, draw calls, triángulos y pájaros.
- Parámetros de URL para probar: `?hora=19.5` (hora inicial) y `?pos=x,z,yaw` (posición inicial).
- Mantener `T` acelera el tiempo.
- Revisar visualmente contra la imagen/video de referencia.
- Comprobar controles: movimiento, cámara, salto, colisión con estructuras, pausa, inventario y antorcha.

## Commits

Mensajes en imperativo y descriptivos (`Add pixel render pipeline`, `Fix collision with lintels`).
Marcar en la lista de tareas vigente (`sdd/task-v2.md`) las tareas completadas en el mismo commit.
