# Plan de implementación — Spec v1

Basado en `sdd/specs/spec_v1.md`. Cada fase termina con algo ejecutable y verificable en el navegador.

## Fase 0 — Base del proyecto
**Objetivo:** esqueleto que arranca y muestra un canvas.
- `index.html` con `importmap` (Three.js versión fijada desde CDN), canvas y contenedor de UI.
- `src/config.js` con todos los parámetros iniciales.
- `src/core/renderer.js`, `src/core/loop.js` (delta time con `THREE.Timer`, límite de dt).
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

---

# Plan de implementación — Spec v2

Basado en `sdd/specs/spec_v2.md`. Se implementa primero el ciclo día/noche porque la antorcha,
los pájaros y la vegetación dependen de su estado.

## Fase 8 — Sonido de pasos v2
**Objetivo:** pasos suaves y realistas por superficie.
- Extraer los pasos a `src/audio/footsteps.js` con un bus propio (paso bajo ≈3 kHz + compresor suave).
- Síntesis por capas (talón + planta) con ruido rosa/marrón filtrado y envolventes suaves:
  césped (roce amortiguado), tierra (crujido grave), piedra (golpe sordo con cuerpo tonal breve).
- Superficie `stone` cuando el suelo bajo el jugador es un colisionador; paso de aterrizaje tras un salto.
- Volumen y ritmo según velocidad; variación aleatoria por paso.
**Verificación:** caminar por césped, camino y sobre una losa; comparar los tres sonidos. (RF-201…RF-205)

## Fase 9 — Ciclo día/noche
**Objetivo:** 15 minutos de día completo que transforman el mundo.
- `src/world/dayCycle.js`: hora normalizada (0–1), fase, direcciones de sol y luna en un eje inclinado,
  keyframes de color por elevación del sol (noche, madrugada, amanecer, día, atardecer) en `config.js`.
- Cielo: degradado y horizonte cálido del lado del sol, sol y luna pixelados, estrellas procedurales
  que titilan y rotan, nubes teñidas por la luz del momento.
- Luces: sol/luna comparten la luz con sombras (se elige el astro visible), ambiente y relleno según hora; niebla acorde.
- HUD: hora y fase. Tecla `T` para acelerar el tiempo.
**Verificación:** con `T` recorrer un ciclo completo y capturar amanecer, mediodía, atardecer y noche. (RF-210…RF-219)

## Fase 10 — Inventario y antorcha
**Objetivo:** equipar una antorcha que ilumina la noche.
- `src/items/inventory.js`: 5 ranuras, selección por teclas/rueda, `Q` para guardar.
- `src/ui/hotbar.js`: barra pixel art con iconos generados en canvas y ranura activa resaltada.
- `src/items/torch.js`: modelo en primera persona (render en capa propia sobre la escena), llama por
  fotogramas pixelados, chispas, balanceo al caminar, animación de sacar/guardar.
- `PointLight` cálida con parpadeo, siempre presente (intensidad 0 al guardar), sin sombras.
**Verificación:** equipar de noche y comprobar la iluminación en piedras y suelo. (RF-220…RF-225)

## Fase 11 — Entorno
**Objetivo:** escenario más rico.
- Nuevos tipos de datos de nivel: `pebbles`/`rubble` (piedras pequeñas), `tree` (tronco + copa de lóbulos).
- Musgo en las piedras (máscara por normal/altura en el shader de piedra).
- `src/world/vegetation.js`: matas de pasto alto con `InstancedMesh` y viento en el vertex shader,
  excluidas del camino y de las estructuras.
- Ampliar `meadow.js`: escombros en bases, rocas dispersas, árboles en el horizonte y uno solitario.
**Verificación:** recorrido visual; draw calls y FPS en el HUD. (RF-240…RF-244)

## Fase 12 — Pájaros
**Objetivo:** fauna con vida propia.
- `src/fauna/birds.js`: pájaros con `InstancedMesh` (cuerpo + alas, aleteo en shader o por instancia),
  bandadas con reglas de boids suaves y objetivos errantes, límites del mundo y altura mínima.
- Pájaros solitarios que se posan en dinteles y despegan.
- Densidad según la hora (salen al amanecer, se van al anochecer). Trinos opcionales.
**Verificación:** observar bandadas durante un día acelerado. (RF-230…RF-234)

## Fase 13 — Pulido y validación v2
- Ajuste de colores de cada fase contra referencias de amanecer/atardecer pixel art.
- Rendimiento: instancias, draw calls, sin sombras extra.
- Criterios de aceptación de la spec v2, `AGENTS.md` y `README.md` actualizados.

## Riesgos v2

| Riesgo | Mitigación |
|--------|-----------|
| Recompilación de shaders al encender/apagar la antorcha | PointLight permanente con intensidad variable. |
| Noche demasiado oscura o plana | Luz de luna mínima configurable + ambiente azulado; ajustar con capturas. |
| Coste del pasto alto | Instancias solo en un radio alrededor del jugador, geometría de pocas caras. |
| Sombras que "saltan" al cambiar de sol a luna | Transición con intensidad a 0 en el horizonte antes de cambiar de astro. |
| Pasos repetitivos | Variación aleatoria por capa y superficie. |
