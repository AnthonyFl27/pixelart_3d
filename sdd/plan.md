# Plan de implementación — Spec v1

Basado en `sdd/specs/spec_v1.md`. Cada fase termina con algo ejecutable y verificable en el navegador.

## Fase 0 — Base del proyecto
**Objetivo:** esqueleto que arranca y muestra un canvas.
- `index.html` con `importmap` (Three.js versión fijada desde CDN), canvas y contenedor de UI.
- `src/config.js` con todos los parámetros iniciales.
- `src/core/renderer.js`, `src/core/loop.js` (delta time con `THREE.Clock`, límite de dt).
- `src/main.js` que monta escena, cámara y un cubo de prueba.
- Actualizar `README.md` con instrucciones de ejecución.
**Verificación:** servidor local muestra un cubo girando sin errores. (RF-01)

## Fase 1 — Pipeline pixel art
**Objetivo:** todo lo renderizado se ve pixelado.
- `src/render/pixelPipeline.js`: render target de baja resolución (altura base configurable, ancho según aspect),
  `NearestFilter`, depth texture; quad a pantalla completa; manejo de `resize`.
- Shader de post-proceso con flags: paso directo, cuantización a paleta, dithering Bayer 4×4, outline por profundidad.
**Verificación:** el cubo de prueba se ve con píxeles grandes y nítidos al redimensionar. (RV-01, RV-07, RV-08, RF-11)

## Fase 2 — Materiales y texturas procedurales
**Objetivo:** texturas pixel con paleta limitada e iluminación escalonada.
- `src/world/textures.js`: generador con PRNG con semilla + ruido de valor; texturas de piedra, césped, tierra.
- `src/world/materials.js`: `MeshToonMaterial` con `gradientMap` de 3–4 bandas (`NearestFilter`) o shader toon propio.
**Verificación:** cubos de prueba con cada material, bandas de luz visibles. (RV-02, RV-03, RNF-05)

## Fase 3 — Mundo
**Objetivo:** escena como la referencia.
- `src/world/terrain.js`: plano subdividido con ondulación por ruido; función `getHeight(x, z)` reutilizable;
  camino de tierra mezclado con el césped mediante máscara con ruido (borde irregular).
- `src/world/sky.js`: esfera/cúpula con degradado + capa de nubes animada (shader) + sol; niebla de color cielo.
- Luz direccional (sol) con shadow map de resolución moderada y filtrado duro (`BasicShadowMap`) + luz ambiental/hemisférica.
**Verificación:** pradera ondulada con camino, cielo con nubes y sombras duras. (RV-04, RV-05, RV-06, RV-09, RV-10)

## Fase 4 — Estructuras y niveles como datos
**Objetivo:** trilitos y piedras definidos por datos.
- `src/world/structures.js`: fábrica de piezas `pillar`, `lintel`, `fallenStone`, `boulder`, `trilithon` (compuesta),
  con deformación ligera de vértices; cada pieza expone su caja de colisión.
- `src/levels/meadow.js`: lista de entradas `{ type, position, rotationY, scale }` que reproduce la composición de la referencia.
- Cargador de nivel que instancia estructuras y registra colisionadores.
**Verificación:** ≥3 trilitos, piedras caídas, camino hacia el trilito central. (RF-08, RF-09)

## Fase 5 — Jugador y controles
**Objetivo:** exploración libre en primera persona.
- `src/core/input.js`: estado de teclado y ratón, Pointer Lock.
- `src/player/controller.js`: yaw/pitch, aceleración/fricción, correr, gravedad, salto, modo vuelo.
- `src/player/collision.js`: jugador como cápsula/caja; resolución contra AABB/OBB por ejes; altura de terreno.
**Verificación:** caminar, correr, saltar, volar; no atravesar piedras; pasar bajo los dinteles. (RF-03…RF-06)

## Fase 6 — UI
- `src/ui/overlay.js`: pantalla de inicio "Clic para jugar" y pausa con `Esc`, estilo pixel (fuente pixel de Google Fonts o bitmap).
- `src/ui/hud.js`: FPS, posición y modo, alternable con `F3`.
**Verificación:** flujo inicio → juego → pausa → juego. (RF-02, RF-07, RF-10)

## Fase 7 — Pulido y validación
- Ajuste de paleta, resolución pixel, sombras y niebla comparando con la referencia.
- Perfilado: reutilizar geometrías/materiales, limitar draw calls, revisar 60 FPS.
- Revisión de consola limpia y de criterios de aceptación de la spec.
- Actualizar `AGENTS.md`/`README.md` con cualquier cambio de estructura.
**Verificación:** todos los criterios de aceptación de la spec marcados. (RNF-01…RNF-06)

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| ES modules no cargan desde `file://` | Documentar servidor estático de una línea; compatible con GitHub Pages. |
| Parpadeo de píxeles ("shimmering") al mover la cámara | Resolución base estable, texturas sin mipmaps, opción de snap de cámara a la rejilla de píxeles. |
| Acné/aliasing en sombras duras | Ajustar `shadow.bias`/`normalBias` y ajustar el frustum de sombra a la escena. |
| Colisiones con piezas rotadas | Usar OBB en plano XZ o descomponer en AABB; dinteles como cajas elevadas. |
| Rendimiento del terreno | Subdivisión moderada; el efecto pixel oculta la baja densidad. |
