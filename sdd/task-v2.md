# Tareas — Spec v3

Basadas en `sdd/specs/spec_v3.md` y en el plan v3 de `sdd/plan.md`. Las tareas de las specs v1 y v2 están en `sdd/task.md`.

Leyenda: `[ ]` pendiente · `[x]` completada · `[~]` en progreso

## Fase SDD v3
- [x] Crear `sdd/specs/spec_v3.md`
- [x] Añadir plan v3 a `sdd/plan.md`
- [x] Crear `sdd/task-v2.md`
- [x] Actualizar `AGENTS.md` con la nueva lista de tareas

## Fase 14 — Relieve del terreno y mapa de suelo
- [ ] `terrainFeatures.js`: modificadores `hollow`, `mound`, `ridge`, `gully` y `dirtPile` como datos
- [ ] Capa procedural con semilla: micro-relieve, hundimientos y montículos repartidos
- [ ] Función de altura única (base + micro-relieve + modificadores) usada por la malla y `getHeight`
- [ ] Terreno por trozos con celdas ≤ 1 m en zonas de detalle, sin grietas entre trozos
- [ ] Círculo de piedras con irregularidades ≤ 0,3 m
- [ ] `groundMap.js`: mapa de suelo césped/tierra/barro/grava y muestreo en el shader del terreno
- [ ] Varios caminos (`paths`) sin límite de puntos
- [ ] `getSurface` con `grass`, `dirt`, `mud` y `gravel`
- [ ] `boulder` con `sink` y rocas semienterradas por el mapa
- [ ] Tierra acumulada al pie de las piedras y a lo largo de los caminos
- [ ] Añadir `terrainFeatures` a `meadow.js`

## Fase 15 — Riachuelo
- [ ] `stream.js`: polilínea suavizada con ancho y profundidad desde los datos del nivel
- [ ] Excavación del cauce con orillas en pendiente y bordes irregulares
- [ ] Perfil del nivel del agua descendente con rápidos (escalones ≤ 0,4 m)
- [ ] Malla de agua en cinta con UV a lo largo del cauce
- [ ] Shader de agua pixel: tonos por profundidad, flujo, destellos y espuma
- [ ] Color del agua según el ciclo día/noche
- [ ] Rocas del cauce (piedra mojada) y cantos en las orillas
- [ ] Orillas con tierra y barro; pasto excluido del agua
- [ ] Vadeo: `waterLevelAt`, velocidad reducida, sin correr
- [ ] `audio/water.js`: rumor, burbujeo y gotas procedurales
- [ ] Volumen por distancia al cauce (máximo a ≤ 3 m, inaudible a ≈ 35 m) y panner en el punto más cercano
- [ ] Fuentes de sonido extra en los rápidos
- [ ] Reubicar elementos del nivel que choquen con el cauce

## Fase 16 — Puente, camino y entorno de la cabaña
- [ ] Tipo `archBridge`: dos arcos, pilas, pretiles y tablero con rampas (`groundAt`)
- [ ] Paso bajo los arcos vadeando el agua
- [ ] Campo `surface` por pieza en los colisionadores
- [ ] Camino círculo → puente → porche en `meadow.js`
- [ ] Variante otoñal del árbol (copa naranja) junto a la cabaña
- [ ] Tipos `woodpile` (leñera) y `fence` (valla rota)

## Fase 17 — Cabaña: exterior y estructura
- [ ] Texturas: tablas gastadas, tablillas, chapa oxidada, celosía y cristal sucio
- [ ] Paredes de tablas horizontales con tablas sueltas, torcidas o ausentes
- [ ] Huecos de puerta y ventanas con marcos; cristales de varios paneles (uno roto)
- [ ] Tejado a dos aguas con tablillas, chapas y agujero con vigas vistas
- [ ] Porche con techo, 4 postes, barandilla de balaústres y escalones
- [ ] Chimenea de piedra lateral
- [ ] Pilotes y zócalo de celosía; suelo interior plano
- [ ] Pasto seco y tierra acumulada en la base
- [ ] Tipo `cabin` en `structures.js` y entrada en `meadow.js`
- [ ] Colisiones: paredes, ventanas, barandillas, porche, escalones y techo
- [ ] Volumen interior declarado para las zonas

## Fase 18 — Sistema de interacción y puerta
- [ ] `ui/prompt.js`: punto de mira y aviso `[E] …` pixel art
- [ ] `interaction.js`: rayo desde la cámara, alcance configurable, registro genérico y tecla `E`
- [ ] `door.js`: puerta con bisagra y animación suave
- [ ] Colisión de la puerta que sigue la rotación y bloqueo si el jugador está en el recorrido
- [ ] `audio/sfx.js`: chirrido de bisagra con variación y golpe con clic de pestillo
- [ ] (Opcional) Puerta trasera de la cocina y puertas de armarios

## Fase 19 — Interior, mobiliario, asientos y lámpara
- [ ] Suelo de tablones, paredes interiores, tabique con vano y vigas del techo
- [ ] `furniture.js`: fábrica de muebles
- [ ] Sala: sofá, sillón, mesa baja, alfombra, chimenea, estantería, cuadros, mueble de la tele
- [ ] Cocina: cocina de leña, encimera con fregadero y bomba, armarios, estantes, mesa, sillas, nevera, sartenes
- [ ] `levels/cabinLayout.js` con la distribución y los interactivos como datos
- [ ] Luz de relleno interior que sigue al día
- [ ] `lamp.js`: lámpara de aceite que se enciende y apaga
- [ ] `seat.js`: sentarse con transición de cámara, giro limitado y levantarse
- [ ] Alcance de interacción configurable estando sentado
- [ ] Ocultar el interior cuando el jugador está fuera y lejos

## Fase 20 — Televisor
- [ ] Modelo CRT con antena de cuernos y pantalla curvada
- [ ] Textura de canvas `NO SIGNAL` con barrido, ruido y parpadeo
- [ ] Animación de encendido (línea que se expande) y apagado (línea y punto)
- [ ] Luz fría de la pantalla (siempre presente, intensidad 0 apagada)
- [ ] Sonidos: clic, zumbido de tubo y estática con posición en el espacio

## Fase 21 — Objetos recogibles: escopeta y farol
- [ ] `pickup.js`: objetos del mundo que pasan a la primera ranura libre
- [ ] `inventory.js`: `addItem` y aviso `Inventario lleno`
- [ ] Escopeta en el soporte sobre la chimenea; soporte vacío al cogerla
- [ ] `shotgun.js`: icono 16×16 y modelo en primera persona con balanceo y sacar/guardar
- [ ] Farol de aceite colgado junto a la mesa de la cocina
- [ ] `lantern.js`: icono 16×16 y modelo en primera persona
- [ ] `handLight.js`: luz de mano compartida por antorcha y farol
- [ ] Sonido al recoger objetos

## Fase 22 — Acústica de zonas y pasos nuevos
- [ ] `audio/acoustics.js`: detección de zona interior y estado de la puerta
- [ ] Reverberación de habitación con respuesta al impulso procedural
- [ ] Amortiguación del viento, los pájaros y el agua dentro de la cabaña
- [ ] Pasos de madera con crujido ocasional
- [ ] Pasos en agua (chapoteo), barro y grava
- [ ] Efectos de sentarse, levantarse y lámpara

## Fase 23 — Radio con música
- [ ] Modelo de radio de válvulas con dial iluminado
- [ ] `radio.js`: estados apagada, sintonizando, cargando, sonando y sin archivo
- [ ] Carga diferida del `.mp3` desde `assets/audio/` (ruta en `config.js`) y reproducción en bucle
- [ ] `radioChain.js`: EQ de radio antigua, saturación suave y crepitado
- [ ] Reverberación (convolución) y eco con retardo y realimentación filtrada
- [ ] Sonido espacial con `PannerNode` en la radio
- [ ] Música amortiguada fuera de la cabaña según la puerta
- [ ] Estática de sintonización al encender y fundido de entrada
- [ ] Respeta pausa (`Esc`) y silencio (`M`)
- [ ] Fallback a estática sin archivo, sin errores en la consola
- [ ] Añadir `assets/audio/radio.mp3` (lo proporciona el equipo)

## Fase 24 — Pulido y validación v3
- [ ] HUD `F3`: zona, superficie, distancia y volumen del agua, objeto apuntado y estado de la radio
- [ ] Ajustar colores del agua, la madera y el interior por fase del día
- [ ] Verificar rendimiento: ≤ 40 draw calls y ≤ 300k triángulos por frame
- [ ] Medir 60 FPS en hardware real
- [ ] Consola sin errores ni warnings (con y sin `.mp3`)
- [ ] Verificar criterios de aceptación de la spec v3
- [ ] Actualizar `AGENTS.md` (estructura, puntos de prueba) y `README.md`
