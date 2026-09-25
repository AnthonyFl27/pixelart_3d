# Spec v3 — Nuevas zonas: riachuelo, cabaña explorable y relieve del mundo

Extiende `spec_v1.md` y `spec_v2.md` (todo lo anterior sigue vigente salvo lo que esta spec modifique).

## 1. Objetivo

Dar al jugador **lugares que visitar** más allá del círculo de piedras. Se añade una segunda zona al oeste
del mapa: un **riachuelo** con piedras, orillas de tierra y un puente de piedra de dos arcos, y junto a él una
**cabaña vintage de madera** que se puede explorar por dentro. La cabaña transmite nostalgia: tablones
gastados, tejado dañado, porche con barandilla, una sala clásica con televisor de tubo y radio antigua, y una
cocina rústica. El jugador puede abrir y cerrar la puerta, sentarse, encender la tele (pantalla gris con
**NO SIGNAL**), encender la radio (primero **estática** y después una canción `.mp3` con eco, como música de
fondo) y **coger objetos**: una **escopeta de doble cañón** colgada en la pared que se puede disparar y recargar,
y **cajas de cartuchos** con un suministro limitado.

Además, **todo el mapa deja de verse plano**: hundimientos, montículos, tierra acumulada, afloramientos
rocosos y micro-relieve en todo el terreno. Los pájaros se oyen más bajo y solo de día y al aire libre.

## 2. Alcance

### Incluido (v3)
- Relieve del terreno en todo el mapa: hundimientos, montículos, tierra acumulada, cárcavas, rocas semienterradas y micro-relieve.
- Mapa de suelo (césped, tierra, barro, grava) que permite varios caminos y manchas de tierra.
- Riachuelo con cauce excavado, agua pixel art animada, piedras en el cauce, espuma, pequeños rápidos y orillas embarradas.
- Sonido del agua que depende de la distancia y la dirección al riachuelo.
- Puente de piedra de dos arcos sobre el riachuelo y un camino que une el círculo de piedras, el puente y la cabaña.
- Cabaña de madera clásica (exterior e interior) con colisiones, porche, chimenea de piedra y tejado dañado.
- Interior: sala (sofá, sillón, chimenea, televisor, radio, alfombra, estantería) y cocina (cocina de leña, fregadero con bomba de mano, mesa y sillas, armarios, nevera antigua).
- Sistema de interacción con la tecla `E`: puertas, asientos, televisor, radio, lámpara y objetos recogibles.
- Objetos recogibles: **escopeta de doble cañón**, **cajas de cartuchos** y **farol de aceite**.
- **Escopeta funcional:** disparo con retroceso, fogonazo, humo e impactos; recarga animada (abrir, expulsar vainas, meter dos cartuchos, cerrar).
- **Munición limitada:** cartuchos en el inventario (máximo 20), cajas de 4 cartuchos repartidas por la cabaña, sin reaparición.
- Radio que, al encenderse, emite **unos segundos de estática** y después reproduce la canción `.mp3` proporcionada con efecto de altavoz antiguo, eco y reverberación de habitación.
- Acústica: pasos de madera dentro de la cabaña y en el porche, chapoteo en el agua, sonidos de exterior amortiguados dentro de la cabaña.
- Pájaros: volumen de los trinos reducido; ni se ven ni se oyen de noche; no se oyen dentro de la cabaña.

### Fuera de alcance (v3)
- Enemigos, animales que se puedan cazar, daño o salud del jugador.
- Objetos destructibles o físicas por disparo (los impactos son solo efectos visuales y de sonido).
- Soltar objetos en el mundo, crafteo o durabilidad.
- Segundo piso o desván accesible (el desván se ve desde abajo pero no se puede subir).
- Nadar o agua profunda (el riachuelo solo cubre hasta la pantorrilla).
- Varias emisoras o lista de reproducción en la radio (una sola pista en bucle).
- Guardado de partida: el estado de puertas, tele, radio, objetos y munición se reinicia al recargar.

## 3. Distribución del mapa

Coordenadas en unidades de mundo (≈ metros); el círculo de piedras sigue en el centro `(0, 0)` y el spawn en `(0, 29)`.

```
                 N (-Z)
      bosquecillos      │
   ~~~~╮                │
       │ riachuelo      │         ○ ○ ○
       ╰~~╮             │       ○ círculo ○
  [cabaña]═╪═ puente ───┼─ camino ─○   ○
          ╭~╯           │         ○ ○ ○
      ~~~~╯             │           │ spawn
                 S (+Z)
  O (-X)                                   E (+X)
```

- **Riachuelo:** cruza el mapa de norte a sur por el oeste, aproximadamente en `x ≈ -50 … -70`, con curvas suaves,
  de `z = -190` a `z = 190`. Baja de nivel de norte a sur.
- **Puente:** en torno a `(-60, 12)`, orientado este-oeste.
- **Cabaña:** en la orilla oeste, en torno a `(-78, 10)`, con el porche mirando al este (hacia el puente).
- **Camino nuevo:** sale del camino actual cerca de `(0, 24)`, rodea el círculo por el sur, cruza el puente y llega a los escalones del porche.
- Se reubican los elementos existentes que choquen con el cauce (p. ej. el bosquecillo de `(-60, -90)`).

## 4. Requisitos funcionales

### 4.1 Relieve del terreno (todo el mapa)

| ID     | Requisito |
|--------|-----------|
| RF-301 | El terreno tiene relieve visible en todo el mapa: además de las ondulaciones actuales, se añade micro-relieve (0,1–0,3 m) que se aprecia con la luz en bandas. |
| RF-302 | **Hundimientos:** depresiones suaves de 2–10 m de radio y 0,3–1,5 m de profundidad, con el fondo de tierra o barro. |
| RF-303 | **Montículos y lomas:** elevaciones de 1–3 m y pequeñas crestas que rompen el horizonte cercano. |
| RF-304 | **Tierra acumulada:** montones y manchas de tierra al pie de las piedras, alrededor de la cabaña, en las orillas y a lo largo de los caminos. |
| RF-305 | **Rocas semienterradas** y afloramientos rocosos repartidos por el mapa, hundidos en el terreno (no apoyados encima). |
| RF-306 | **Cárcavas:** surcos secos poco profundos que bajan hacia el riachuelo. |
| RF-307 | Los elementos de relieve se definen como **datos del nivel** (`terrainFeatures`), más una capa procedural con semilla para los detalles repetitivos. |
| RF-308 | El círculo de piedras conserva un suelo transitable, pero deja de ser perfectamente llano (irregularidades ≤ 0,3 m). |
| RF-309 | `getHeight(x, z)` sigue devolviendo la altura exacta de la malla, incluido el cauce y las zonas de detalle. |

### 4.2 Mapa de suelo y caminos

| ID     | Requisito |
|--------|-----------|
| RF-310 | El tipo de suelo se define con un mapa de suelo (textura de datos generada al cargar) con capas: césped, tierra, barro y grava. |
| RF-311 | El nivel admite **varios caminos** (`paths`), cada uno como polilínea con ancho, sin el límite de 16 puntos actual. |
| RF-312 | `getSurface(x, z)` lee el mismo mapa de suelo y devuelve `grass`, `dirt`, `mud` o `gravel`. |

### 4.3 Riachuelo

| ID     | Requisito |
|--------|-----------|
| RF-320 | El riachuelo se define como datos: polilínea con ancho (2,5–5 m) y profundidad del cauce (0,6–1,2 m) por punto. |
| RF-321 | El terreno se excava a lo largo del cauce con orillas en pendiente suave y bordes irregulares; el fondo es de grava y barro. |
| RF-322 | La superficie del agua es una malla que sigue el cauce y baja de nivel aguas abajo; en los desniveles hay **pequeños rápidos** (escalones ≤ 0,4 m) con espuma. |
| RF-323 | El agua fluye visiblemente en la dirección de la corriente, más rápido en los estrechamientos y los rápidos. |
| RF-324 | **Piedras en el cauce:** rocas oscuras y húmedas, algunas sobresaliendo del agua con espuma alrededor, y cantos rodados en las orillas. |
| RF-325 | Las orillas tienen tierra y barro acumulados, piedras sueltas y pasto alto al borde (sin pasto dentro del agua). |
| RF-326 | El jugador puede **vadear** el riachuelo: el agua le llega a la pantorrilla, se mueve más lento (factor configurable) y no puede correr. |
| RF-327 | **Sonido del agua:** se oye fluir según la distancia al punto más cercano del cauce; audible hasta ≈ 35 m, a volumen máximo a ≤ 3 m, con curva configurable. |
| RF-328 | El sonido se ubica en estéreo hacia el punto del cauce más cercano; los rápidos son fuentes más intensas y brillantes. |
| RF-329 | El sonido del agua es procedural (Web Audio): rumor grave, burbujeo medio y gotas o chapoteos aleatorios, sin bucles perceptibles. |

### 4.4 Puente de piedra

| ID     | Requisito |
|--------|-----------|
| RF-330 | Nuevo tipo de estructura `archBridge`: puente de mampostería de dos arcos con pretil bajo, usando la textura de piedra con musgo. |
| RF-331 | Se puede cruzar caminando (tablero con rampa en cada extremo) y pasar por debajo de los arcos vadeando el agua. |
| RF-332 | Los pasos sobre el puente suenan a piedra. |

### 4.5 Cabaña — exterior

| ID     | Requisito |
|--------|-----------|
| RF-340 | Cabaña de madera clásica de una planta (≈ 9 × 7 m, paredes de 2,8 m, cumbrera ≈ 5,2 m) con tejado a dos aguas. |
| RF-341 | Paredes de **tablas horizontales** gastadas (gris-marrón), algunas sueltas, torcidas o que faltan. Esquinas con tablones verticales. |
| RF-342 | Tejado de tablillas de madera y chapas oxidadas, con un **agujero** que deja ver las vigas; la luz del sol entra por él (sombras reales). |
| RF-343 | **Porche** delantero con techo propio, 4 postes, barandilla de balaústres y escalones de madera hasta el suelo. |
| RF-344 | Ventanas con marco de madera, cristales sucios de varios paneles (uno roto) y contraventanas o cortinas vistas desde fuera. |
| RF-345 | Chimenea de piedra en un lateral que sale por el tejado. |
| RF-346 | La cabaña se apoya en pilotes con **zócalo de celosía**, de modo que el suelo interior queda plano aunque el terreno debajo sea irregular. |
| RF-347 | Alrededor: pasto seco en la base, tierra acumulada, una leñera, restos de una valla de madera y un árbol otoñal de copa naranja. |
| RF-348 | Tipo de estructura `cabin` en los datos del nivel (`x`, `z`, `rotationY`); su distribución interior y el mobiliario se definen como datos. |
| RF-349 | Colisiones: paredes con hueco de puerta, porche y escalones transitables (rampas de altura), barandillas, ventanas no atravesables y techo interior. |

### 4.6 Cabaña — interior

| ID     | Requisito |
|--------|-----------|
| RF-350 | Suelo de tablones, paredes de madera o papel pintado descolorido, vigas vistas en el techo. |
| RF-351 | **Sala:** sofá de 2–3 plazas, sillón, mesa baja, alfombra, chimenea de piedra (apagada), estantería con libros, cuadros, **televisor de tubo** con antena de cuernos sobre un mueble y **radio de válvulas** de madera sobre un aparador. |
| RF-352 | **Cocina:** cocina de leña de hierro con una olla, encimera con fregadero y bomba de mano, armarios y estantes con tarros y platos, mesa con 2 sillas, nevera antigua de esquinas redondeadas y sartenes colgadas. |
| RF-353 | La sala y la cocina se comunican por un vano sin puerta en un tabique interior. |
| RF-354 | **Iluminación interior:** de día entra luz por las ventanas y por el agujero del tejado; una luz de relleno interior sin sombras sigue la intensidad del día; una **lámpara de aceite** en la mesa se enciende y apaga con `E`. |
| RF-355 | De noche el interior está oscuro; se ilumina con la lámpara, el televisor encendido, la antorcha o el farol. |

### 4.7 Sistema de interacción

| ID     | Requisito |
|--------|-----------|
| RF-360 | Punto de mira pixel art en el centro de la pantalla mientras se juega. |
| RF-361 | Al mirar un objeto interactivo a ≤ 2,2 m (configurable) aparece un aviso pixel art con la acción: `[E] Abrir puerta`, `[E] Sentarse`, `[E] Encender radio`, `[E] Coger escopeta`, `[E] Coger cartuchos (4)`… |
| RF-362 | La tecla `E` ejecuta la acción; el aviso se actualiza con el estado (Abrir/Cerrar, Encender/Apagar). |
| RF-363 | Los objetos interactivos se declaran como datos (tipo, posición, parámetros) y el sistema es genérico: añadir uno nuevo no requiere tocar el bucle principal. |

### 4.8 Puertas

| ID     | Requisito |
|--------|-----------|
| RF-370 | La puerta principal (tablones con tirador de hierro) se abre y se cierra con `E`, girando sobre sus bisagras con una animación suave (≈ 0,6 s). |
| RF-371 | Sonidos: **chirrido** de bisagra al abrir (con variación de tono) y **golpe con clic de pestillo** al cerrar. |
| RF-372 | La colisión de la puerta sigue su rotación; la puerta no se cierra si el jugador está en su recorrido. |
| RF-373 | (Opcional) Puerta trasera de la cocina y puertas de armarios con la misma mecánica. |

### 4.9 Asientos

| ID     | Requisito |
|--------|-----------|
| RF-380 | Sofá (cada plaza), sillón y sillas de la cocina permiten **sentarse** con `E`. |
| RF-381 | Al sentarse la cámara baja a la altura de sentado con una transición suave, se bloquea el movimiento y se limita el giro a ±100° respecto al frente del asiento. |
| RF-382 | Para levantarse: `E`, `Espacio` o cualquier tecla de movimiento. Suena un crujido de madera o tela al sentarse y al levantarse. |
| RF-383 | Sentado se puede seguir interactuando con lo que esté al alcance (p. ej. encender la tele desde el sofá; el alcance sentado es configurable). |

### 4.10 Televisor

| ID     | Requisito |
|--------|-----------|
| RF-390 | Televisor de tubo (CRT) apagado por defecto: pantalla gris oscura, curvada, con reflejo. |
| RF-391 | Al encender (`E`): clic, línea horizontal brillante que se expande y después **pantalla gris con el texto `NO SIGNAL`** en fuente pixel, con líneas de barrido, ruido leve y parpadeo sutil. |
| RF-392 | Encendido, la pantalla emite luz fría que ilumina ligeramente la sala. |
| RF-393 | Sonido de encendido (clic + zumbido de tubo) y siseo de estática suave mientras está encendido, con posición en el espacio. |
| RF-394 | Al apagar: la imagen se contrae a una línea y a un punto blanco que se desvanece, con clic. |

### 4.11 Objetos recogibles e inventario

| ID     | Requisito |
|--------|-----------|
| RF-400 | **Escopeta de doble cañón** (cañones recortados de metal gris y culata de madera marrón) colgada en un soporte sobre la chimenea, **descargada**. |
| RF-401 | Al mirarla de cerca aparece `[E] Coger escopeta`; al cogerla desaparece de la pared (el soporte queda vacío), suena un golpe metálico y entra en la primera ranura libre del inventario. |
| RF-402 | La escopeta tiene icono pixel art de 16×16 en la barra y modelo en primera persona con balanceo al caminar y animación de sacar/guardar (como la antorcha). Disparo y recarga en 4.12. |
| RF-403 | **Farol de aceite** colgado junto a la mesa de la cocina, recogible con `E`. Equipado, da una luz cálida más estable y amplia que la antorcha. |
| RF-404 | Si el inventario está lleno se muestra `Inventario lleno` y el objeto no se recoge. |
| RF-405 | El catálogo de objetos (`ITEMS`) y los objetos colocados en el mundo son datos; recoger un objeto nuevo no requiere lógica específica. |
| RF-406 | Los objetos pueden ser **apilables** (`stackable`, con máximo por pila): la pila ocupa una sola ranura y la barra muestra la cantidad sobre el icono en cifras pixel. |

### 4.12 Escopeta: disparo y recarga

| ID     | Requisito |
|--------|-----------|
| RF-440 | Con la escopeta equipada, **clic izquierdo** dispara un cañón (primero el derecho y luego el izquierdo). Cada cañón admite **un cartucho**: con los dos cargados hay **dos disparos** antes de recargar. |
| RF-441 | Sin cartucho en el cañón no se dispara: suena un **clic en seco** y aparece `[R] Recargar` si hay cartuchos en el inventario o `Sin munición` si no los hay. |
| RF-442 | **Animación de disparo:** retroceso del arma hacia atrás y arriba, sacudida breve de cámara (pitch de ≈ 2°, recuperación suave), **fogonazo** pixel art de 2–3 fotogramas en la boca del cañón y **humo** que sale de él. |
| RF-443 | El fogonazo ilumina el entorno durante unos pocos fotogramas (luz siempre presente con intensidad 0 en reposo, sin sombras). |
| RF-444 | **Sonido de disparo:** estampido grave con chasquido inicial, cola larga y **eco**: al aire libre, repeticiones retardadas y filtradas que simulan el rebote en el paisaje; dentro de la cabaña, reverberación de habitación corta y seca. Pasa por un compresor para no saturar. |
| RF-445 | **Perdigones:** cada disparo lanza varios rayos (8 por defecto) en un cono de dispersión (≈ 4°) con alcance limitado (≈ 40 m). |
| RF-446 | **Impactos** según la superficie alcanzada: polvo y terrones en tierra y césped, esquirlas y polvo gris en piedra, astillas y una **marca de agujero** en madera, salpicadura en el agua. Las marcas se reciclan (máximo configurable, p. ej. 40). |
| RF-447 | **Recarga con `R`** si algún cañón está vacío o disparado y hay cartuchos: el arma baja y se inclina, **se abre** por la bisagra (los cañones caen), el extractor **expulsa las vainas** disparadas (salen despedidas, caen al suelo con tintineo y desaparecen a los pocos segundos), **se introducen los cartuchos uno a uno** en cada cañón vacío, **se cierra** con un chasquido y vuelve a su posición. Duración configurable (≈ 2,2 s). |
| RF-448 | Si solo queda un cartucho en el inventario se carga un único cañón. Los cartuchos sin disparar que ya están en un cañón no se expulsan. |
| RF-449 | Sonidos de recarga: apertura (clic metálico), expulsión (tintineo de vainas), inserción de cada cartucho (roce + clic) y cierre (chasquido fuerte). |
| RF-450 | Durante la recarga, la animación de sacar/guardar o estando sentado no se puede disparar. Cambiar de ranura cancela la recarga; los cartuchos ya introducidos quedan dentro. |
| RF-451 | El estado de los cañones (cargado, disparado o vacío) se conserva al guardar la escopeta y volver a sacarla. |
| RF-452 | Con la escopeta equipada, junto a la barra se muestran **dos iconos de cartucho** (llenos, disparados o vacíos) y la reserva del inventario (`×8`). |
| RF-453 | Los pájaros cercanos (≤ 40 m) se asustan con el disparo y levantan el vuelo alejándose. |

### 4.13 Munición

| ID     | Requisito |
|--------|-----------|
| RF-460 | Nuevo objeto apilable **Cartuchos** (icono de cartucho rojo con culote de latón), con pila máxima de **20**. |
| RF-461 | La munición llega en **cajas de 4 cartuchos** colocadas sobre muebles de la cabaña (por defecto: mesa de la cocina, mesa baja de la sala y aparador de la radio; posiciones como datos). Cada caja da munición para **dos recargas completas** (dos disparos por recarga). |
| RF-462 | `[E] Coger cartuchos (4)` suma los cartuchos a la pila del inventario (o la crea en la primera ranura libre) y la caja desaparece; suena el traqueteo de cartuchos. |
| RF-463 | **Límite de 20 cartuchos** entre la pila del inventario y los cargados en la escopeta. Si una caja no cabe entera se cogen solo los que caben y la caja se queda con el resto (`[E] Coger cartuchos (2)`); si no cabe ninguno, el aviso muestra `Munición al máximo`. |
| RF-464 | **Suministro limitado:** las cajas no reaparecen; la cantidad total en el mundo se define en los datos del nivel. |
| RF-465 | La pila de cartuchos no se equipa: al seleccionar su ranura se ve la mano vacía y el nombre con la cantidad. Al gastar el último cartucho la ranura queda libre. |

### 4.14 Radio con música

| ID     | Requisito |
|--------|-----------|
| RF-410 | Radio de válvulas de madera con dial iluminado. `E` la enciende y la apaga. |
| RF-411 | Al encender: clic, el dial se ilumina en ámbar y suenan **unos segundos de estática de sintonización** (≈ 3 s, configurable), con barridos, silbidos y chasquidos, como si se buscara la emisora. |
| RF-412 | Tras la estática, **la canción entra con un fundido** mientras la estática se desvanece; queda un crepitado leve de fondo mientras suena. |
| RF-413 | La canción es el archivo `assets/audio/radio.mp3` (ruta en `config.js`), proporcionado por el equipo: pista de ≈ 4:08 a 256 kbps VBR (≈ 8,3 MB). Se reproduce en bucle **por streaming** con un elemento `<audio>` conectado a Web Audio (`MediaElementAudioSourceNode`), sin decodificar la pista entera en memoria. Es una canción comercial con derechos de autor: el archivo **no se versiona** (`.gitignore`) y cada copia local lo coloca a mano. |
| RF-414 | **Efecto de radio antigua:** ecualización de altavoz pequeño (paso alto ≈ 180 Hz, paso bajo ≈ 4,5 kHz, realce de medios), saturación suave y el crepitado leve. |
| RF-415 | **Eco y música de fondo (requisito clave):** la canción debe sentirse lejana y envolvente, nunca seca ni en primer plano. Reverberación de habitación (convolución con respuesta al impulso generada por código, cola de 1,5–2,5 s) + eco con retardo (≈ 280 ms) y realimentación filtrada. La mezcla es mayoritariamente húmeda y el volumen moderado; todo configurable. |
| RF-416 | La música es **espacial**: se oye desde la posición de la radio, baja con la distancia y cambia al girar la cabeza. |
| RF-417 | Fuera de la cabaña se oye amortiguada, como música de fondo (más grave y con más reverberación), y aún más con la puerta cerrada. |
| RF-418 | Al apagar, la música se corta con un clic y un breve fundido. Al volver a encender se repite la estática y la canción **continúa donde se quedó**. |
| RF-419 | La radio respeta la pausa (`Esc`) y el silencio (`M`). Si el archivo no existe o no se puede reproducir, la radio solo emite estática y el HUD (`F3`) lo indica, sin errores en la consola. |

### 4.15 Audio de zonas y pasos

| ID     | Requisito |
|--------|-----------|
| RF-420 | Nuevas superficies de pasos: **madera** (golpe hueco con cuerpo grave y crujido ocasional aleatorio) para el suelo de la cabaña y el porche, y **agua** (chapoteo) al vadear. |
| RF-421 | Barro y grava tienen su propio perfil de pasos (barro: más blando y húmedo; grava: crujido granulado). |
| RF-422 | La superficie se obtiene del colisionador sobre el que se camina (cada pieza declara su `surface`) o del mapa de suelo y el agua. |
| RF-423 | **Zona interior:** dentro de la cabaña los pasos y sonidos interiores tienen reverberación de habitación pequeña, y el viento y el agua se amortiguan (paso bajo y menos volumen), menos con la puerta abierta. Los pájaros no se oyen dentro (ver 4.16). |
| RF-424 | Al recoger objetos, sentarse, abrir puertas y usar aparatos suena un efecto propio, generado con Web Audio. |

### 4.16 Pájaros (cambios sobre v2)

| ID     | Requisito |
|--------|-----------|
| RF-470 | El volumen de los trinos baja a la mitad respecto a v2 (valor en `config.js`). |
| RF-471 | Los pájaros **solo se ven y se oyen de día**: al anochecer todos (también los posados) se van, y de noche no hay ninguno visible ni se oye ningún trino. |
| RF-472 | **Dentro de la cabaña no se oyen pájaros** (silencio total, no solo amortiguado). Al salir, los trinos vuelven con un fundido corto si es de día. |
| RF-473 | Los trinos solo suenan al aire libre y de día; el HUD (`F3`) muestra si el audio de pájaros está activo. |

### 4.17 Depuración

| ID     | Requisito |
|--------|-----------|
| RF-430 | El HUD (`F3`) añade: zona (exterior o interior), superficie bajo el jugador, distancia al riachuelo y volumen del agua, objeto apuntado, estado de la radio (estática, sonando, sin archivo), munición (cañones y reserva) y audio de pájaros. |
| RF-431 | `?pos=-74,10,1.57` sirve para aparecer delante del porche; los puntos de prueba se documentan en `AGENTS.md`. |

## 5. Requisitos visuales

| ID     | Requisito |
|--------|-----------|
| RV-301 | Todo lo nuevo mantiene la estética pixel art: texturas procedurales de paleta limitada, `NearestFilter`, luz en bandas y contorno. |
| RV-302 | **Agua** con 3–4 tonos de azul (más oscuro en el centro), destellos blancos de 1 píxel que se desplazan con la corriente y espuma blanca en rápidos y alrededor de las rocas, como en la imagen de referencia del riachuelo. |
| RV-303 | El color del agua sigue al ciclo día/noche: azul intenso de día, cálido al atardecer, azul muy oscuro de noche con destellos de luna. |
| RV-304 | Rocas del cauce más oscuras y saturadas (efecto mojado) que las de la pradera; musgo en las orillas. |
| RV-305 | **Madera** de la cabaña: tablas con vetas, nudos y bordes marcados en 4–5 tonos gris-marrón; chapas del tejado con óxido naranja; aspecto abandonado pero acogedor (referencia: cabaña de madera con porche y tejado dañado). |
| RV-306 | El interior se lee bien a baja resolución: muebles con siluetas claras, contorno activo y colores cálidos (madera, tela gastada, alfombra roja o verde). |
| RV-307 | La pantalla del televisor, el dial de la radio, el fogonazo y las chispas de impacto no reciben niebla y se ven brillantes. |
| RV-308 | Modelos de primera persona de la escopeta (referencia: escopeta recortada pixel art, metal gris con brillos y madera marrón) y del farol con el mismo tamaño de píxel que la antorcha. La escopeta abierta muestra las recámaras y los culotes de latón de los cartuchos. |
| RV-309 | Sin grietas visibles entre zonas de terreno con distinta resolución de malla. |
| RV-310 | Cajas de cartuchos de cartón con etiqueta pixel art, reconocibles sobre las mesas; vainas expulsadas rojas con culote de latón. |
| RV-311 | Humo del disparo y partículas de impacto como píxeles cuadrados con 2–3 tonos, que se desvanecen en menos de 1 s. |

## 6. Requisitos no funcionales

| ID      | Requisito |
|---------|-----------|
| RNF-301 | Mantener 60 FPS en hardware medio. Presupuesto orientativo: ≤ 40 draw calls y ≤ 300k triángulos por frame en el peor punto de vista. |
| RNF-302 | Cabaña, puente y rocas fusionados por material; los objetos interactivos son mallas propias. El interior se oculta cuando el jugador está fuera y lejos (distancia configurable). |
| RNF-303 | Terreno con más resolución solo donde hace falta (cauce, cabaña, caminos): celdas ≤ 1 m en esas zonas y la resolución actual en el resto. |
| RNF-304 | Número de luces fijo: las luces nuevas (lámpara, televisor, relleno interior, fogonazo) existen siempre con intensidad 0 cuando están apagadas; la luz de mano es única y se reconfigura para antorcha o farol. Ninguna proyecta sombras. |
| RNF-305 | Todos los parámetros nuevos (relieve, riachuelo, agua, cabaña, interacción, escopeta, munición, audio, radio, pájaros) en `src/config.js`. |
| RNF-306 | Sin dependencias nuevas: Three.js, canvas y Web Audio. El único recurso binario es el `.mp3` de la radio. |
| RNF-307 | Consola sin errores ni warnings, también sin el archivo `.mp3`. |
| RNF-308 | Partículas (humo, impactos, vainas) con `InstancedMesh` o `Points` y grupos reciclados, sin crear objetos por disparo. |
| RNF-309 | El `.mp3` se reproduce por streaming (no se decodifica entero: una pista de 4 min en PCM ocuparía ≈ 85 MB). |

## 7. Controles (añadidos)

| Tecla / entrada | Acción |
|-----------------|--------|
| E               | Interactuar con el objeto apuntado (puerta, asiento, tele, radio, lámpara, recoger) / levantarse |
| Espacio o W/A/S/D (sentado) | Levantarse |
| Clic izquierdo (escopeta equipada) | Disparar un cañón |
| R (escopeta equipada) | Recargar |

## 8. Arquitectura propuesta (módulos nuevos o ampliados)

```
assets/
└── audio/
    └── radio.mp3            # Canción de la radio (la proporciona el equipo)
src/
├── world/
│   ├── terrain.js           # (ampliado) malla por trozos con detalle local, relieve por capas
│   ├── terrainFeatures.js   # Hundimientos, montículos, cárcavas, cauce: modificadores de altura
│   ├── groundMap.js         # Mapa de suelo (césped/tierra/barro/grava) y caminos múltiples
│   ├── stream.js            # Cauce, malla y shader de agua, rocas del cauce, consultas (distancia, nivel)
│   ├── cabin.js             # Carcasa de la cabaña: paredes, tejado, porche, chimenea, ventanas
│   ├── furniture.js         # Fábrica de muebles (sofá, sillón, mesas, cocina de leña, nevera…)
│   └── structures.js        # (ampliado) tipos archBridge, cabin, woodpile, fence; `surface` por pieza
├── interaction/
│   ├── interaction.js       # Rayo desde la cámara, objeto apuntado, aviso y tecla E
│   ├── door.js              # Puerta con bisagra, animación y colisión dinámica
│   ├── seat.js              # Sentarse y levantarse
│   ├── television.js        # CRT: encendido, NO SIGNAL, luz y sonido
│   ├── radio.js             # Estado de la radio (estática → canción), dial y control de la música
│   ├── lamp.js              # Lámpara de aceite interactiva
│   └── pickup.js            # Objetos del mundo que pasan al inventario (incluye cajas de cartuchos)
├── items/
│   ├── inventory.js         # (ampliado) escopeta, cartuchos y farol en ITEMS; pilas; añadir a ranura libre
│   ├── handLight.js         # Luz de mano compartida por antorcha y farol
│   ├── shotgun.js           # Modelo en primera persona, icono, estados de cañones, animaciones de disparo y recarga
│   └── lantern.js           # Modelo en primera persona e icono
├── combat/
│   ├── ballistics.js        # Rayos de perdigones con dispersión y detección de superficie
│   └── impacts.js           # Partículas de impacto, humo, vainas y marcas recicladas
├── fauna/
│   └── birds.js             # (ampliado) sin pájaros de noche, huida por disparos
├── audio/
│   ├── water.js             # Sonido procedural del riachuelo por distancia y dirección
│   ├── acoustics.js         # Zonas interior/exterior, reverberación y amortiguación
│   ├── radioChain.js        # Estática de sintonización + cadena: EQ, saturación, reverb, eco, panner
│   ├── gunshot.js           # Estampido con eco exterior / reverb interior, sonidos de recarga y clic en seco
│   ├── sfx.js               # Chirridos, golpes, clics, estática, crujidos, recoger objetos
│   ├── ambient.js           # (ampliado) trinos más bajos, solo de día y al aire libre
│   └── footsteps.js         # (ampliado) madera, agua, barro, grava
├── levels/
│   ├── meadow.js            # (ampliado) riachuelo, puente, cabaña, caminos, terrainFeatures
│   └── cabinLayout.js       # Distribución interior, objetos interactivos y cajas de cartuchos (datos)
└── ui/
    ├── prompt.js            # Punto de mira y aviso de interacción pixel art
    ├── ammo.js              # Indicador de cañones y reserva junto a la barra
    └── hotbar.js            # (ampliado) cantidad de las pilas sobre el icono
```

- **Relieve:** la altura final es `ruido base + micro-relieve + Σ terrainFeatures + excavación del cauce`, con una
  función analítica única que usan tanto la malla como `getHeight` (que sigue interpolando la triangulación real).
- **Zonas:** la cabaña declara un volumen interior; `acoustics.js`, los pájaros, el disparo y la iluminación consultan
  si el jugador está dentro y si la puerta está abierta.
- **Interacción:** cada objeto interactivo expone `{ mesh, prompt(), interact(player), update(dt) }` y se registra
  al cargar el nivel.
- **Escopeta:** máquina de estados `idle → firing → idle` y `idle → reloading(open → eject → insert×n → close) → idle`;
  cada cañón con estado `loaded | spent | empty`. La munición se consulta y descuenta en `inventory.js`.
- **Radio:** estados `off → tuning (estática) → playing`, con fundido cruzado entre estática y canción; el `<audio>`
  se pausa al apagar para conservar la posición.

## 9. Referencias visuales

- **Riachuelo y puente:** arroyo azul intenso con destellos blancos, rocas oscuras en el cauce, orillas de hierba
  verde con piedras, puente de piedra de dos arcos, árboles alrededor (uno de copa naranja otoñal), pixel art.
- **Cabaña:** casa de madera de una planta con tablas horizontales gastadas, tejado a dos aguas con tablillas y chapas
  oxidadas y un agujero con vigas vistas, chimenea de ladrillo o piedra, porche con techo, postes y barandilla,
  escalones de madera, zócalo de celosía y pasto seco alrededor.
- **Escopeta:** escopeta recortada de doble cañón en pixel art, cañones grises con brillos y empuñadura de madera marrón.

## 10. Criterios de aceptación

- [ ] Desde cualquier punto del mapa el terreno muestra hundimientos, montículos, tierra acumulada y rocas semienterradas; ya no se ve plano.
- [ ] Hay un riachuelo con agua animada que fluye, piedras en el cauce, espuma en los rápidos y orillas con tierra y barro.
- [ ] El agua se oye al acercarse, sube de volumen con la cercanía y se ubica en estéreo; a más de ≈ 35 m no se oye.
- [ ] Se puede cruzar el puente de piedra y vadear el riachuelo con chapoteos.
- [ ] Un camino lleva del círculo de piedras al puente y a la cabaña.
- [ ] La cabaña de madera se ve vintage y detallada por fuera (porche, tejado dañado, chimenea, ventanas).
- [ ] La puerta se abre y se cierra con `E`, con chirrido y golpe de cierre, y bloquea el paso cerrada.
- [ ] Dentro hay una sala y una cocina amuebladas; los pasos suenan a madera con reverberación y el exterior se oye amortiguado.
- [ ] Se puede sentar en el sofá, el sillón y las sillas y levantarse.
- [ ] El televisor se enciende con la pantalla gris `NO SIGNAL` y se apaga con la animación de contracción.
- [ ] La escopeta se coge de la pared y aparece en el inventario y en primera persona; el farol también.
- [ ] Sin cartuchos la escopeta solo hace clic en seco; con cartuchos se recarga con `R` (abre, expulsa, mete dos, cierra) y dispara dos veces con retroceso, fogonazo, humo, eco e impactos.
- [ ] Las cajas de cartuchos se cogen de los muebles, suman 4 cartuchos cada una y nunca se superan 20.
- [ ] Al encender la radio suenan unos segundos de estática y después la canción, con sonido de radio antigua, eco y reverberación, como música de fondo; espacial y amortiguada fuera de la cabaña.
- [ ] Sin el `.mp3`, la radio emite estática y la consola sigue limpia.
- [ ] Los trinos suenan más bajos; de noche no se ve ni se oye ningún pájaro y dentro de la cabaña no se oyen.
- [ ] Consola sin errores y rendimiento dentro de RNF-301.
