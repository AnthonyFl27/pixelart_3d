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
# Opción A (Python, sin caché: evita mezclar módulos viejos tras actualizar)
python3 serve.py 8080
# Opción B (Node)
npx serve .
```

Los errores de carga (módulo, CDN, `file://`, shader) se muestran en pantalla en lugar de dejarla en negro.

Abrir `http://localhost:8080`. También funciona tal cual en GitHub Pages.

## Estructura del proyecto

```
pixelart_3d/
├── index.html                  # Punto de entrada: importmap, canvas, contenedor de UI y errores de arranque
├── serve.py                    # Servidor estático de desarrollo sin caché
├── assets/audio/               # song.mp3 (local, no versionado: ver README.md de la carpeta)
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
│   │   ├── textures.js         # Texturas procedurales (piedra, césped, madera, tablas, tablillas, chapa, celosía, cristal…)
│   │   ├── materials.js        # Materiales toon por bandas, musgo y material por capas (array de texturas)
│   │   ├── geometryUtils.js    # UVs de densidad constante
│   │   ├── terrain.js          # Terreno por trozos de resolución variable, getHeight(x, z) y suelo (shader)
│   │   ├── terrainFeatures.js  # Relieve: ruido por capas, hundimientos, montículos, surcos, caminos
│   │   ├── groundMap.js        # Mapa de suelo (tierra, barro, grava) y getSurface
│   │   ├── stream.js           # Riachuelo: cauce, nivel del agua con rápidos, rocas y malla de agua
│   │   ├── dayCycle.js         # Reloj del mundo: hora, fase, sol/luna y colores por keyframes
│   │   ├── sky.js              # Cúpula de cielo: degradado, nubes, sol, luna y estrellas
│   │   ├── lighting.js         # Sol/luna con sombras, ambiente y luz de relleno según la hora
│   │   ├── structures.js       # Fábrica de estructuras: piedras, escombros, árboles, puente, leñera, valla, cabaña
│   │   ├── cabin.js            # Cabaña: paredes, tejado con agujero, porche, chimenea, pilotes e interior
│   │   ├── furniture.js        # Fábrica de muebles (sofá, chimenea, cocina de leña, nevera, televisor…)
│   │   ├── interiorLighting.js # Luces del interior en el shader: relleno según el día, lámpara y tele
│   │   ├── interiors.js        # Oculta el interior desde fuera y lejos
│   │   ├── zones.js            # Zonas con nombre (interior de la cabaña) y consulta de zona
│   │   ├── vegetation.js       # Pasto alto y flores instanciados con viento
│   │   └── levelLoader.js      # Instancia un nivel y fusiona las piezas por material
│   ├── player/
│   │   ├── controller.js       # Primera persona: andar, correr, saltar, volar
│   │   └── collision.js        # Cajas orientadas, suelo y techo
│   ├── combat/
│   │   ├── ballistics.js       # Perdigones: rayos con dispersión contra colisionadores, agua y terreno
│   │   └── impacts.js          # Partículas de impacto, humo, marcas de agujero y vainas recicladas
│   ├── items/
│   │   ├── inventory.js        # Ranuras con pilas, addItem, límites y catálogo de objetos
│   │   ├── viewModel.js        # Base de los objetos en primera persona: sacar/guardar y balanceo
│   │   ├── handLight.js        # Luz de mano compartida por antorcha y farol
│   │   ├── torch.js            # Antorcha en primera persona: llama y chispas
│   │   ├── shotgun.js          # Escopeta: iconos, modelo, cañones, disparo, recarga y fogonazo
│   │   └── lantern.js          # Farol de aceite: icono y modelo que se balancea
│   ├── interaction/
│   │   ├── interaction.js      # Rayo desde la cámara, objeto apuntado, tecla E y tipos interactivos
│   │   ├── door.js             # Puerta con bisagra, animación, colisión que gira y bloqueo
│   │   ├── seat.js             # Asientos: sentarse y levantarse
│   │   ├── lamp.js             # Lámpara de aceite
│   │   ├── television.js       # Televisor CRT: NO SIGNAL, encendido/apagado, luz y sonido
│   │   ├── pickup.js           # Objetos recogibles (escopeta, cartuchos, farol) y sus modelos
│   │   ├── radio.js            # Radio de válvulas: estados, dial iluminado, aguja y luz
│   │   └── hitBox.js           # Caja invisible de apuntado
│   ├── fauna/birds.js          # Pájaros: bandadas, posado, actividad según la hora
│   ├── levels/meadow.js        # Nivel como datos (spawn, caminos, relieve, estructuras)
│   ├── levels/cabinLayout.js   # Distribución interior de la cabaña (tabique, revestimientos, muebles)
│   ├── ui/                     # overlay.js (inicio/pausa), hud.js (F3), hotbar.js, prompt.js (mira y aviso [E]), ammo.js (cartuchos), ui.css
│   └── audio/
│       ├── ambient.js          # Viento, trinos y bus maestro (Web Audio)
│       ├── acoustics.js        # Zona interior y puertas: reverb de habitación (bus local) y exterior amortiguado
│       ├── radioChain.js       # Radio: <audio> en streaming, estática, EQ, saturación, panner, reverb, eco y zona
│       ├── footsteps.js        # Pasos por superficie (césped, tierra, barro, grava, piedra, madera con crujido, agua)
│       ├── water.js            # Sonido procedural del riachuelo según distancia y dirección
│       ├── sfx.js              # Efectos con posición: bisagra, golpe y pestillo, clic, tubo de la tele, recoger, asientos, lámpara
│       └── gunshot.js          # Estampido con eco exterior / reverb interior y compresor; recarga y vainas
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
  que devuelva piezas `{ geometry, position, rotationY, material, collider, surface, groundAt }`.
  Colisiones, sombras y fusión por material son automáticas. `collider` admite cajas explícitas
  (con `rise` para rampas), una pieza con `geometry: null` solo aporta colisionadores y el tipo
  recibe `ground(lx, lz)` para consultar el terreno. Puede devolver `{ pieces, baseY, zones }`
  con volúmenes con nombre (p. ej. el interior de la cabaña).
- **Cabaña:** dimensiones, huecos de puerta y ventanas, tejado, porche y chimenea en `CONFIG.cabin`;
  cualquier clave se puede sobrescribir en la entrada `cabin` del nivel. El interior (tabique,
  revestimientos, muebles) es `layout` = `CABIN_LAYOUT` de `src/levels/cabinLayout.js`.
- **Nuevo mueble:** añadir una función a `FURNITURE_TYPES` en `src/world/furniture.js` (cajas y cilindros
  con capa y tinte, colisionadores e interactivos como `seat`, `lamp` o `television`) y una entrada en
  `CABIN_LAYOUT.furniture`. Las piezas `interior` se fusionan aparte y se ocultan desde lejos.
- **Materiales por capas:** las texturas de `LAYERS` (`src/world/materials.js`) comparten un único material
  (array de texturas + color de vértice): una pieza con uno de esos nombres de material no añade draw calls.
- **Nuevo objeto interactivo:** añadir un tipo a `INTERACTABLE_TYPES` en `src/interaction/interaction.js`
  (objeto con `meshes`, `prompt()`, `interact()` y opcionalmente `object`, `collider` y `update()`) y
  declararlo como dato: las estructuras devuelven `interactables: [{ type, position, rotationY, … }]`.
  Las puertas de la cabaña están en `CONFIG.cabin.doors`.
- **Nuevo objeto de inventario:** añadirlo a `ITEMS` en `src/items/inventory.js` (con icono 16x16;
  `stackable`/`maxStack` para pilas, `limit` para un máximo total, `equippable: false` si no se lleva en
  la mano) y, si se ve en primera persona, una clase que extienda `ViewModel` registrada en `viewModels`
  de `main.js`. Los objetos con luz exponen `lightConfig` y `lightLevel` para la luz de mano.
- **Objeto recogible en el mundo:** un mueble declara `f.interactable({ type: 'pickup', item, count, model })`
  (ver `gunRack`, `shellBox` y `lanternHook` en `furniture.js`); el modelo va en `PICKUP_MODELS` de
  `src/interaction/pickup.js`. Las cajas de cartuchos son datos de `CABIN_LAYOUT`.
- **Pasos:** perfiles por superficie en `CONFIG.footsteps.surfaces` (capas de ruido + `tone`, `creak`, `grains`,
  `squelch`, `bubbles`); la superficie sale del colisionador (`surface` de la pieza), del mapa de suelo o del agua.
- **Acústica:** los sonidos nuevos van al bus `local` (reverb de habitación dentro) o `outdoor` (amortiguado dentro)
  de `src/audio/acoustics.js`; parámetros en `CONFIG.audio.acoustics`. Las puertas declaran su `zone`.
- **Radio:** tipo de mueble `radio` (declara el interactivo `radio`); la canción está en `CONFIG.radio.src`
  y el sonido (estática, EQ, reverb, eco, amortiguación fuera de su zona) en `CONFIG.audio.radio`.
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
  Riachuelo: `?pos=-53,20,1.2` (orilla este) y `?pos=-60,40,0.1` (dentro del agua).
  Puente: `?pos=-48,12,1.57` (rampa este) y `?pos=-59,27,0.1` (vista desde el agua).
  Cabaña: `?pos=-74,10,1.57` (delante del porche) y `?pos=-93,19,-0.92` (trasera y chimenea).
- `F3` muestra también la zona (`cabin` dentro de la cabaña, `exterior` fuera) y el objeto apuntado.
- Puertas: `?pos=-76.2,10.3,1.57` (porche, delante de la puerta principal) y `?pos=-87.5,7.5,-1.57`
  (escalones de la puerta trasera de la cocina). `E` abre y cierra; no se cierran con el jugador en el recorrido.
- Interior: `?pos=-81.2,11,3.14&hora=22` (sala de noche: lámpara en la mesa baja, sofá y televisor)
  y `?pos=-82,7.8,0` (cocina). Sentado, `E` sin objeto apuntado, `Espacio` o `WASD` levantan.
- Recoger: `?pos=-81.2,12.9,3.14` (escopeta sobre la chimenea, mirar arriba), `?pos=-80.5,7.9,0`
  (cartuchos en la mesa de la cocina, mirar abajo) y `?pos=-79.55,6.4,0&hora=21` (farol en la pared).
- Escopeta: coger la escopeta y los cartuchos (`?pos=-81.2,13.1,3.14`, escopeta arriba y cartuchos de la
  mesa baja detrás a la izquierda), `R` recarga y clic izquierdo dispara (primero el cañón derecho). Sin
  cartucho: clic en seco y `[R] Recargar` o `Sin munición`. `F3` muestra `MUNI` (cañones y reserva).
- Acústica: `F3` muestra en `ZONA` la apertura de la puerta y la amortiguación del exterior (`amort` 1 con las
  puertas cerradas, ≈ 0,45 con una abierta). Porche y suelo de la cabaña suenan a madera (`SUELO wood`); vadear
  en `?pos=-60,40,0.1` (chapoteo). Sentarse y levantarse suenan a tela (sofá) o madera (sillas); la lámpara hace clic.
- Radio: `?pos=-79.5,10.1,0` (delante del aparador, mirar abajo). `E` enciende: estática ≈ 3 s y la canción
  (`F3`: `RADIO estática` → `sonando`); sin `assets/audio/song.mp3`, `sin archivo (estática)`. Apagar y
  encender sigue la canción; `Esc` la pausa. Fuera de la cabaña se oye más grave, y menos con la puerta cerrada.
- Mantener `T` acelera el tiempo.
- Revisar visualmente contra la imagen/video de referencia.
- Comprobar controles: movimiento, cámara, salto, colisión con estructuras, pausa, inventario, antorcha, puertas,
  asientos, lámpara, televisor, radio, objetos recogibles (límite de 20 cartuchos y recogida parcial) y escopeta
  (disparo, recarga, impactos por superficie, cancelar la recarga al cambiar de ranura).

## Commits

Mensajes en imperativo y descriptivos (`Add pixel render pipeline`, `Fix collision with lintels`).
Marcar en la lista de tareas vigente (`sdd/task-v2.md`) las tareas completadas en el mismo commit.
