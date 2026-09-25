# Tareas — Spec v3

Basadas en `sdd/specs/spec_v3.md` y en el plan v3 de `sdd/plan.md`. Las tareas de las specs v1 y v2 están en `sdd/task.md`.

Leyenda: `[ ]` pendiente · `[x]` completada · `[~]` en progreso

## Fase SDD v3
- [x] Crear `sdd/specs/spec_v3.md`
- [x] Añadir plan v3 a `sdd/plan.md`
- [x] Crear `sdd/task-v2.md`
- [x] Actualizar `AGENTS.md` con la nueva lista de tareas

## Fase 14 — Relieve del terreno y mapa de suelo
- [x] `terrainFeatures.js`: modificadores `hollow`, `mound`, `ridge`, `gully` y `dirtPile` como datos
- [x] Capa procedural con semilla: micro-relieve, hundimientos y montículos repartidos
- [x] Función de altura única (base + micro-relieve + modificadores) usada por la malla y `getHeight`
- [x] Terreno por trozos con celdas ≤ 1 m en zonas de detalle, sin grietas entre trozos
- [x] Círculo de piedras con irregularidades ≤ 0,3 m
- [x] `groundMap.js`: mapa de suelo césped/tierra/barro/grava y muestreo en el shader del terreno
- [x] Varios caminos (`paths`) sin límite de puntos
- [x] `getSurface` con `grass`, `dirt`, `mud` y `gravel`
- [x] `boulder` con `sink` y rocas semienterradas por el mapa
- [x] Tierra acumulada al pie de las piedras y a lo largo de los caminos
- [x] Añadir `terrainFeatures` a `meadow.js`

## Fase 15 — Riachuelo
- [x] `stream.js`: polilínea suavizada con ancho y profundidad desde los datos del nivel
- [x] Excavación del cauce con orillas en pendiente y bordes irregulares
- [x] Perfil del nivel del agua descendente con rápidos (escalones ≤ 0,4 m)
- [x] Malla de agua en cinta con UV a lo largo del cauce
- [x] Shader de agua pixel: tonos por profundidad, flujo, destellos y espuma
- [x] Color del agua según el ciclo día/noche
- [x] Rocas del cauce (piedra mojada) y cantos en las orillas
- [x] Orillas con tierra y barro; pasto excluido del agua
- [x] Vadeo: `waterLevelAt`, velocidad reducida, sin correr
- [x] `audio/water.js`: rumor, burbujeo y gotas procedurales
- [x] Volumen por distancia al cauce (máximo a ≤ 3 m, inaudible a ≈ 35 m) y panner en el punto más cercano
- [x] Fuentes de sonido extra en los rápidos
- [x] Reubicar elementos del nivel que choquen con el cauce

## Fase 16 — Puente, camino y entorno de la cabaña
- [x] Tipo `archBridge`: dos arcos, pilas, pretiles y tablero con rampas (`groundAt`)
- [x] Paso bajo los arcos vadeando el agua
- [x] Campo `surface` por pieza en los colisionadores
- [x] Camino círculo → puente → porche en `meadow.js`
- [x] Variante otoñal del árbol (copa naranja) junto a la cabaña
- [x] Tipos `woodpile` (leñera) y `fence` (valla rota)

## Fase 17 — Cabaña: exterior y estructura
- [x] Texturas: tablas gastadas, tablillas, chapa oxidada, celosía y cristal sucio
- [x] Paredes de tablas horizontales con tablas sueltas, torcidas o ausentes
- [x] Huecos de puerta y ventanas con marcos; cristales de varios paneles (uno roto)
- [x] Tejado a dos aguas con tablillas, chapas y agujero con vigas vistas
- [x] Porche con techo, 4 postes, barandilla de balaústres y escalones
- [x] Chimenea de piedra lateral
- [x] Pilotes y zócalo de celosía; suelo interior plano
- [x] Pasto seco y tierra acumulada en la base
- [x] Tipo `cabin` en `structures.js` y entrada en `meadow.js`
- [x] Colisiones: paredes, ventanas, barandillas, porche, escalones y techo
- [x] Volumen interior declarado para las zonas

## Fase 18 — Sistema de interacción y puerta
- [x] `ui/prompt.js`: punto de mira y aviso `[E] …` pixel art
- [x] `interaction.js`: rayo desde la cámara, alcance configurable, registro genérico y tecla `E`
- [x] `door.js`: puerta con bisagra y animación suave
- [x] Colisión de la puerta que sigue la rotación y bloqueo si el jugador está en el recorrido
- [x] `audio/sfx.js`: chirrido de bisagra con variación y golpe con clic de pestillo
- [~] (Opcional) Puerta trasera de la cocina y puertas de armarios — puerta trasera hecha; armarios con los muebles (fase 19)

## Fase 19 — Interior, mobiliario, asientos y lámpara
- [x] Suelo de tablones, paredes interiores, tabique con vano y vigas del techo
- [x] `furniture.js`: fábrica de muebles
- [x] Sala: sofá, sillón, mesa baja, alfombra, chimenea, estantería, cuadros, mueble de la tele
- [x] Cocina: cocina de leña, encimera con fregadero y bomba, armarios, estantes, mesa, sillas, nevera, sartenes
- [x] `levels/cabinLayout.js` con la distribución y los interactivos como datos
- [x] Luz de relleno interior que sigue al día
- [x] `lamp.js`: lámpara de aceite que se enciende y apaga
- [x] `seat.js`: sentarse con transición de cámara, giro limitado y levantarse
- [x] Alcance de interacción configurable estando sentado
- [x] Ocultar el interior cuando el jugador está fuera y lejos

## Fase 20 — Televisor
- [x] Modelo CRT con antena de cuernos y pantalla curvada
- [x] Textura de canvas `NO SIGNAL` con barrido, ruido y parpadeo
- [x] Animación de encendido (línea que se expande) y apagado (línea y punto)
- [x] Luz fría de la pantalla (siempre presente, intensidad 0 apagada)
- [x] Sonidos: clic, zumbido de tubo y estática con posición en el espacio

## Fase 21 — Objetos recogibles, pilas y munición
- [x] `pickup.js`: objetos del mundo que pasan a la primera ranura libre
- [x] `inventory.js`: `addItem`, aviso `Inventario lleno`
- [x] Objetos apilables (`stackable`) con máximo por pila
- [x] `hotbar.js`: cantidad de la pila sobre el icono en cifras pixel
- [x] Escopeta descargada en el soporte sobre la chimenea; soporte vacío al cogerla
- [x] `shotgun.js`: icono 16×16 y modelo en primera persona con balanceo y sacar/guardar
- [x] Objeto `Cartuchos` apilable (máximo 20) con icono de cartucho rojo y latón
- [x] Cajas de 4 cartuchos en la mesa de la cocina, la mesa baja y el aparador de la radio (datos en `cabinLayout.js`)
- [x] Límite de 20 entre pila y cañones; recogida parcial y aviso `Munición al máximo`
- [x] Las cajas no reaparecen; la ranura de cartuchos se libera al gastar el último
- [x] La ranura de cartuchos no se equipa (mano vacía + nombre y cantidad)
- [x] Farol de aceite colgado junto a la mesa de la cocina
- [x] `lantern.js`: icono 16×16 y modelo en primera persona
- [x] `handLight.js`: luz de mano compartida por antorcha y farol
- [x] Sonidos al recoger objetos y traqueteo de cartuchos

## Fase 22 — Escopeta: disparo y recarga
- [ ] Máquina de estados de la escopeta y estado por cañón (`loaded`, `spent`, `empty`), conservado al guardarla
- [ ] Disparo con clic izquierdo, primero el cañón derecho y luego el izquierdo
- [ ] Clic en seco sin cartucho; avisos `[R] Recargar` y `Sin munición`
- [ ] Animación de retroceso y sacudida de cámara
- [ ] Fogonazo pixel art por fotogramas y luz de fogonazo (siempre presente, intensidad 0 en reposo)
- [ ] Humo pixel desde la boca del cañón
- [ ] `ballistics.js`: 8 perdigones con dispersión ≈ 4° y alcance ≈ 40 m contra terreno, colisionadores y agua
- [ ] `impacts.js`: polvo, esquirlas, astillas, salpicaduras y marcas de agujero recicladas
- [ ] Recarga con `R`: abrir, expulsar vainas, insertar 1–2 cartuchos uno a uno, cerrar
- [ ] Vainas expulsadas que caen al suelo y desaparecen
- [ ] Cancelar la recarga al cambiar de ranura; no disparar al recargar, sacar/guardar o sentado
- [ ] `gunshot.js`: estampido con eco exterior y reverb interior, con compresor
- [ ] Sonidos de apertura, expulsión, inserción, cierre y clic en seco
- [ ] `ui/ammo.js`: dos iconos de cartucho y reserva `×N` junto a la barra
- [ ] Pájaros cercanos que huyen al disparar

## Fase 23 — Acústica de zonas y pasos nuevos
- [ ] `audio/acoustics.js`: detección de zona interior y estado de la puerta
- [ ] Reverberación de habitación con respuesta al impulso procedural
- [ ] Amortiguación del viento y el agua dentro de la cabaña
- [ ] Pasos de madera con crujido ocasional
- [ ] Pasos en agua (chapoteo), barro y grava
- [ ] Efectos de sentarse, levantarse y lámpara

## Fase 24 — Radio con música
- [x] Colocar la canción en `assets/audio/radio.mp3` (local, excluida en `.gitignore`)
- [ ] Ruta del archivo en `config.js`
- [ ] Modelo de radio de válvulas con dial iluminado
- [ ] `radio.js`: estados `off`, `tuning`, `playing` y sin archivo
- [ ] Estática de sintonización procedural de ≈ 3 s (barridos, silbidos, chasquidos) al encender
- [ ] Fundido cruzado de la estática a la canción y crepitado leve de fondo
- [ ] Reproducción en bucle por streaming (`<audio>` + `MediaElementAudioSourceNode`)
- [ ] `radioChain.js`: EQ de radio antigua y saturación suave
- [ ] Reverberación (convolución, cola 1,5–2,5 s) y eco (≈ 280 ms) con mezcla mayoritariamente húmeda: música de fondo
- [ ] Sonido espacial con `PannerNode` en la radio
- [ ] Música amortiguada fuera de la cabaña según la puerta
- [ ] Apagar con clic y fundido; al encender de nuevo, estática y la canción continúa donde se quedó
- [ ] Respeta pausa (`Esc`) y silencio (`M`)
- [ ] Fallback a estática sin archivo, sin errores en la consola

## Fase 25 — Pájaros: día, aire libre y volumen
- [ ] Bajar el volumen de los trinos a la mitad (`config.js`)
- [ ] De noche ningún pájaro visible (también los posados) ni trinos
- [ ] Trinos silenciados dentro de la cabaña con fundido al entrar y salir
- [ ] Indicador de audio de pájaros en el HUD

## Fase 26 — Pulido y validación v3
- [ ] HUD `F3`: zona, superficie, distancia y volumen del agua, objeto apuntado, estado de la radio, munición y pájaros
- [ ] Ajustar colores del agua, la madera y el interior por fase del día
- [ ] Verificar rendimiento: ≤ 40 draw calls y ≤ 300k triángulos por frame
- [ ] Medir 60 FPS en hardware real
- [ ] Consola sin errores ni warnings (con y sin `.mp3`)
- [ ] Verificar criterios de aceptación de la spec v3
- [ ] Actualizar `AGENTS.md` (estructura, puntos de prueba) y `README.md`
