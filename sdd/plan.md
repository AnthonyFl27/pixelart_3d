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

---

# Plan de implementación — Spec v3

Basado en `sdd/specs/spec_v3.md`. Tareas en `sdd/task-v2.md`. Primero el terreno y el suelo, porque el cauce,
los caminos y la cabaña dependen de ellos; después el sistema de interacción, que usan puertas, asientos,
aparatos y objetos; el audio avanzado (acústica y radio) va al final porque se apoya en las zonas de la cabaña.

## Fase 14 — Relieve del terreno y mapa de suelo
**Objetivo:** que ningún punto del mapa se vea plano.
- `src/world/terrainFeatures.js`: modificadores de altura como datos (`hollow`, `mound`, `ridge`, `gully`, `dirtPile`)
  con caída suave, más una capa procedural con semilla (micro-relieve, hundimientos y rocas repartidas).
- `terrain.js`: función de altura única (base + micro-relieve + modificadores); malla por trozos con celdas ≤ 1 m
  en zonas de detalle y faldones o costuras compartidas para evitar grietas; `getHeight` interpola la triangulación del trozo.
- `src/world/groundMap.js`: textura de datos con capas césped/tierra/barro/grava, generada desde `paths`,
  `terrainFeatures`, orillas y manchas procedurales; el shader del terreno la muestrea en la rejilla de texels.
- Varios caminos (`paths`) sin límite fijo de puntos; `getSurface` lee el mapa de suelo.
- Rocas semienterradas: `boulder` admite `sink` (fracción enterrada).
**Verificación:** recorrido por el mapa con `F3`; comprobar relieve, sin grietas y con los caminos intactos. (RF-301…RF-312, RV-309, RNF-303)

## Fase 15 — Riachuelo
**Objetivo:** un arroyo creíble que se ve y se oye.
- `src/world/stream.js`: polilínea suavizada (Catmull-Rom) con ancho y profundidad; excavación del cauce vía
  `terrainFeatures`; perfil de nivel del agua descendente con escalones (rápidos).
- Malla de agua en cinta con UV a lo largo del cauce; shader pixel: tonos por profundidad, flujo desplazado por
  la velocidad local, destellos de 1 píxel, espuma en rápidos, bordes y rocas; color por `dayCycle`.
- Rocas del cauce y cantos en las orillas (material de piedra mojada), tierra y barro en las orillas, pasto excluido del agua.
- Vadeo: consulta `waterLevelAt(x, z)`; reducción de velocidad, sin correr, superficie `water`.
- `src/audio/water.js`: capas procedurales (rumor, burbujeo, gotas); ganancia por distancia al punto más cercano
  del cauce y `PannerNode` en ese punto; fuentes extra en los rápidos.
**Verificación:** acercarse y alejarse del agua con `F3` (distancia y volumen); vadear; ver el agua de día y de noche. (RF-320…RF-329, RV-302…RV-304)

## Fase 16 — Puente, camino y entorno de la cabaña
**Objetivo:** conectar las zonas.
- Tipo `archBridge` en `structures.js`: arcos por geometría extruida, pilas, pretiles, tablero con `groundAt` en rampa.
- Nuevo camino círculo → puente → porche en `meadow.js`; reubicar lo que choque con el cauce.
- Árbol otoñal (variante de paleta de `tree`), leñera (`woodpile`) y valla rota (`fence`).
- Campo `surface` por pieza en los colisionadores (piedra, madera).
**Verificación:** cruzar el puente, pasar por debajo vadeando, seguir el camino hasta la cabaña. (RF-330…RF-332, RF-347)

## Fase 17 — Cabaña: exterior y estructura
**Objetivo:** la cabaña vintage por fuera, con colisiones.
- Texturas procedurales: tablas gastadas, tablillas, chapa oxidada, celosía, cristal sucio.
- `src/world/cabin.js`: paredes de tablas (con tablas sueltas o que faltan), esquinas, huecos de puerta y ventanas,
  tejado a dos aguas con agujero y vigas, porche con postes, barandilla y escalones, chimenea de piedra, pilotes y celosía.
- Tipo `cabin` en `structures.js`; fusión por material; colisionadores de paredes, porche, escalones (rampas), techo.
- Volumen interior declarado para las zonas.
**Verificación:** rodear la cabaña, subir al porche, comprobar que no se atraviesan paredes ni ventanas. (RF-340…RF-349, RV-305)

## Fase 18 — Sistema de interacción y puerta
**Objetivo:** base genérica para todo lo interactivo.
- `src/ui/prompt.js`: punto de mira y aviso pixel art.
- `src/interaction/interaction.js`: rayo desde la cámara contra mallas interactivas, alcance configurable, tecla `E`.
- `src/interaction/door.js`: bisagra con animación suavizada, colisionador que gira, bloqueo si el jugador está en el recorrido.
- `src/audio/sfx.js`: chirrido de bisagra y golpe con pestillo.
**Verificación:** abrir y cerrar la puerta desde dentro y desde fuera; intentar cerrarla estando en el hueco. (RF-360…RF-373)

## Fase 19 — Interior, mobiliario, asientos y lámpara
**Objetivo:** una sala y una cocina que invitan a explorar.
- `src/world/furniture.js`: fábrica de muebles a partir de cajas y cilindros deformados con texturas pixel.
- `src/levels/cabinLayout.js`: distribución de la sala y la cocina y lista de interactivos.
- Iluminación interior: relleno que sigue al día, lámpara de aceite (`lamp.js`), luces siempre presentes.
- `src/interaction/seat.js`: sentarse con transición de cámara, giro limitado, levantarse.
- Ocultar el interior cuando el jugador está fuera y lejos.
**Verificación:** recorrer el interior de día y de noche; sentarse en cada asiento. (RF-350…RF-355, RF-380…RF-383, RV-306)

## Fase 20 — Televisor
- `src/interaction/television.js`: pantalla con textura de canvas (NO SIGNAL, barrido, ruido), animaciones de
  encendido/apagado, luz fría y sonidos (clic, zumbido, estática) con posición en el espacio.
**Verificación:** encender desde el sofá y apagar; comprobar la luz en la sala de noche. (RF-390…RF-394, RV-307)

## Fase 21 — Objetos recogibles, pilas y munición
- `src/interaction/pickup.js`: objetos del mundo que se retiran y pasan a la primera ranura libre.
- `inventory.js`: `addItem`, pilas (`stackable`, máximo por pila), aviso de inventario lleno; `ITEMS` con escopeta, cartuchos y farol.
- `hotbar.js`: cantidad de la pila sobre el icono en cifras pixel.
- Cajas de cartuchos como datos en `cabinLayout.js`; recogida parcial si se supera el límite de 20 (pila + cañones).
- `src/items/shotgun.js` (modelo, icono, sacar/guardar) y `src/items/lantern.js`: iconos 16×16 y modelos en primera persona.
- `src/items/handLight.js`: la luz de la antorcha pasa a ser la luz de mano compartida.
**Verificación:** coger la escopeta, el farol y las cajas; comprobar el límite de 20 y la recogida parcial. (RF-400…RF-406, RF-460…RF-465, RV-308, RV-310)

## Fase 22 — Escopeta: disparo y recarga
- Máquina de estados de la escopeta y estado por cañón (`loaded | spent | empty`), conservado al guardarla.
- Disparo con clic izquierdo: retroceso, sacudida de cámara, fogonazo por fotogramas, luz de fogonazo, humo.
- `src/combat/ballistics.js`: perdigones con dispersión y alcance; superficie alcanzada (terreno, piedra, madera, agua).
- `src/combat/impacts.js`: polvo, esquirlas, astillas, salpicaduras, marcas recicladas y vainas expulsadas.
- Recarga con `R`: abrir, expulsar vainas, insertar 1–2 cartuchos, cerrar; cancelable al cambiar de ranura.
- `src/audio/gunshot.js`: estampido con eco exterior (retardos filtrados) o reverb interior, compresor; sonidos de recarga y clic en seco.
- `src/ui/ammo.js`: dos iconos de cartucho y reserva; avisos `[R] Recargar` y `Sin munición`.
- Pájaros cercanos que huyen al oír el disparo.
**Verificación:** disparar sin munición (clic), recargar con 1 y con 2 cartuchos, disparar dentro y fuera, impactos en cada superficie. (RF-440…RF-453, RV-311, RNF-308)

## Fase 23 — Acústica de zonas y pasos nuevos
- `src/audio/acoustics.js`: bus interior con convolución (IR procedural), amortiguación del exterior según zona y puerta.
- `footsteps.js`: perfiles de madera (crujido aleatorio), agua, barro y grava; superficie desde el colisionador.
- Efectos de sentarse, recoger y lámpara en `sfx.js`.
**Verificación:** caminar por el porche, el interior, el agua, el barro y la grava; entrar y salir con la puerta abierta y cerrada. (RF-420…RF-424)

## Fase 24 — Radio con música
- Copiar la canción a `assets/audio/radio.mp3` (ruta en `config.js`).
- `src/interaction/radio.js`: estados `off → tuning → playing`, dial iluminado, posición conservada al apagar.
- Estática de sintonización procedural (≈ 3 s): ruido filtrado con barrido de banda, silbidos heterodinos y chasquidos;
  fundido cruzado hacia la canción y crepitado leve residual.
- `src/audio/radioChain.js`: `<audio loop>` → `MediaElementAudioSourceNode` → EQ de radio → saturación (`WaveShaperNode`) →
  `PannerNode` en la radio → seco (bajo) + envío a reverb (`ConvolverNode`) y eco (`DelayNode` con realimentación
  filtrada) con mezcla mayoritariamente húmeda → bus que pasa por la amortiguación de zona de `acoustics.js`.
- Fallback a estática si el archivo falla, sin errores en consola.
**Verificación:** encender (estática → canción), escuchar dentro, en el porche y a 30 m; apagar y encender (continúa); pausa y silencio; probar sin el archivo. (RF-410…RF-419, RNF-309)

## Fase 25 — Pájaros: día, aire libre y volumen
- Bajar `chirpVolume` a la mitad.
- De noche, ningún pájaro visible (también los posados) ni trinos; al anochecer se van todos.
- Trinos silenciados dentro de la cabaña con fundido al entrar y salir; indicador en el HUD.
**Verificación:** con `T`, pasar del día a la noche fuera; entrar y salir de la cabaña de día. (RF-470…RF-473)

## Fase 26 — Pulido y validación v3
- Ajuste visual del agua, la madera y el interior a baja resolución; colores por fase del día.
- Rendimiento: draw calls, triángulos, ocultación del interior, partículas (RNF-301, RNF-302, RNF-308).
- HUD con los campos nuevos y puntos de prueba en `AGENTS.md`; actualizar `README.md`.
- Criterios de aceptación de la spec v3.

## Riesgos v3

| Riesgo | Mitigación |
|--------|-----------|
| Más resolución de terreno dispara los triángulos | Detalle solo en trozos con cauce, cabaña o caminos; resto con la resolución actual. |
| Grietas entre trozos de distinta resolución | Faldones verticales o bordes con la resolución del vecino más grueso. |
| Interior demasiado oscuro por la sombra del tejado | Relleno interior que sigue al día + luz por ventanas y agujero; ajustar con capturas. |
| Muchas luces encarecen los shaders | Número de luces fijo, sin sombras, intensidad 0 al apagar; luz de mano compartida. |
| Recompilación de shaders al encender aparatos | Todas las luces y uniforms creados al cargar. |
| Política de autoplay del navegador | El `AudioContext` ya se reanuda con el clic de inicio; la radio solo suena tras `E`. |
| Memoria del `.mp3` (≈ 85 MB decodificado) | Streaming con `<audio>` + `MediaElementAudioSourceNode`; fallback a estática. |
| Estampido del disparo que satura la mezcla | Compresor/limitador en el bus del disparo y ganancia moderada. |
| Coste de rayos y partículas por disparo | 8 rayos contra colisionadores y terreno; partículas instanciadas y recicladas. |
| Colisión con la puerta en movimiento | Colisionador desactivado durante la animación y cierre bloqueado si el jugador ocupa el recorrido. |
| Sonido del agua repetitivo | Capas con modulación lenta aleatoria y gotas en instantes aleatorios. |
