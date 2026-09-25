# Spec v2 — Mundo vivo: día/noche, antorcha, fauna y entorno

Extiende `spec_v1.md` (todo lo de v1 sigue vigente salvo lo que esta spec modifique).

## 1. Objetivo

Dar vida a la pradera: un ciclo completo de día y noche que transforme el entorno, una antorcha
en un pequeño inventario para iluminar la oscuridad, pájaros que se mueven solos por el cielo,
más elementos en el escenario (piedras, árboles lejanos, pasto alto) y pasos con sonido suave y realista.

## 2. Alcance

### Incluido (v2)
- Sonido de pasos rediseñado por superficie: césped, tierra y piedra.
- Ciclo día/noche de 15 minutos reales: madrugada, amanecer, día, tarde, atardecer, anochecer y noche.
- Sol, luna y estrellas con movimiento continuo; la luz, el cielo, la niebla y las nubes cambian con la hora.
- Inventario básico (barra de ranuras) con una antorcha pixel art que ilumina el entorno.
- Pájaros animados con comportamiento propio.
- Más piedras y detalles en las estructuras, árboles a lo lejos y pasto alto con viento.

### Fuera de alcance (v2)
- Recoger/soltar objetos del mundo, crafteo, durabilidad o combustible de la antorcha.
- Clima (lluvia, tormentas), estaciones.
- IA de animales en tierra, interacción con los pájaros.
- Guardado de partida (la hora se reinicia al recargar).

## 3. Requisitos funcionales

### 3.1 Sonido de pasos

| ID     | Requisito |
|--------|-----------|
| RF-201 | Los pasos suenan suaves y realistas, sin agudos chillones: todo el audio de pasos pasa por un filtro paso bajo (≈3 kHz) y volumen moderado. |
| RF-202 | Sonido distinto por superficie: **césped** (roce suave y amortiguado), **tierra** (crujido grave y seco), **piedra** (golpe corto, sordo y sólido). |
| RF-203 | Se detecta la superficie **piedra** cuando el jugador camina sobre una estructura (losas caídas, dinteles…). |
| RF-204 | Cada paso tiene dos capas (talón + planta) con variación aleatoria de tono, volumen y duración para que no suene repetitivo. |
| RF-205 | El ritmo y volumen de los pasos dependen de la velocidad (andar/correr); al aterrizar de un salto suena un paso más fuerte. |

### 3.2 Ciclo día/noche

| ID     | Requisito |
|--------|-----------|
| RF-210 | Un día completo dura **15 minutos** reales (configurable). La hora avanza de forma continua. |
| RF-211 | Fases reconocibles: madrugada, amanecer, mañana/día, tarde, atardecer, anochecer y noche. |
| RF-212 | El sol recorre un arco en el cielo (sale por el este, se pone por el oeste); la luna recorre el arco opuesto. Al amanecer la luna se oculta; al anochecer vuelve a salir. |
| RF-213 | Las estrellas aparecen gradualmente al anochecer, titilan y desaparecen al amanecer; giran lentamente con el cielo (sensación de rotación terrestre). |
| RF-214 | Los colores del cielo cambian por fases: azul de día, naranja/rosa en amanecer y atardecer con el horizonte encendido del lado del sol, azul muy oscuro de noche. |
| RF-215 | La luz del mundo sigue la hora: color e intensidad del sol (cálido al ras, blanco a mediodía), luz de luna azulada y tenue de noche, ambiente y niebla acordes. |
| RF-216 | Las sombras las proyecta el sol de día y la luna de noche, alargándose al amanecer/atardecer. |
| RF-217 | Las nubes se tiñen con la luz del momento (doradas/rosadas al atardecer, grises oscuras de noche). |
| RF-218 | La hora inicial es configurable (por defecto, mañana). El HUD (`F3`) muestra la hora y la fase. |
| RF-219 | Tecla de depuración `T` (mantener) para acelerar el tiempo y comprobar el ciclo. |

### 3.3 Inventario y antorcha

| ID     | Requisito |
|--------|-----------|
| RF-220 | Barra de inventario pixel art en la parte inferior con ranuras numeradas (5 ranuras; la antorcha en la ranura 1). |
| RF-221 | Seleccionar ranura con las teclas `1`–`5` o la rueda del ratón; `Q` guarda el objeto (mano vacía). La ranura activa se resalta. |
| RF-222 | Con la antorcha equipada se ve en primera persona (abajo a la derecha): mango de madera pixelado y llama animada. Se balancea al caminar y tiene animación de sacar/guardar. |
| RF-223 | La llama es pixel art animada (fotogramas o partículas con colores de paleta de fuego) con chispas que suben. |
| RF-224 | La antorcha emite luz cálida con parpadeo (intensidad y ligero movimiento) y alcance limitado que ilumina piedras, césped y camino alrededor del jugador. |
| RF-225 | El efecto es notable de noche y casi imperceptible a pleno sol. |

### 3.4 Fauna: pájaros

| ID     | Requisito |
|--------|-----------|
| RF-230 | Bandadas de pájaros pixel art vuelan por el cielo con aleteo animado y planeos. |
| RF-231 | Comportamiento propio: cada bandada deambula (cohesión, separación, alineación suaves), cambia de rumbo y se mantiene dentro de los límites del mundo y por encima del terreno. |
| RF-232 | Algunos pájaros vuelan de forma independiente y pueden posarse en los dinteles y volver a despegar. |
| RF-233 | Los pájaros se ven sobre todo de día; al anochecer se van y de noche no hay (o casi ninguno). |
| RF-234 | Opcional: trinos procedurales ocasionales de día. |

### 3.5 Entorno

| ID     | Requisito |
|--------|-----------|
| RF-240 | Más piedras en el nivel: piedras pequeñas y escombros alrededor de las bases, más rocas dispersas por la pradera. |
| RF-241 | Detalles en las estructuras: musgo/liquen en la parte superior y en las caras a la sombra de las piedras. |
| RF-242 | Árboles pixel art a lo lejos (tronco + copa de bloques/lóbulos) formando un horizonte más rico, con al menos uno solitario destacado. |
| RF-243 | Pasto alto en matas por la pradera (no sobre el camino), que se mece con el viento y se ve alrededor del jugador. |
| RF-244 | Los nuevos elementos se definen como datos del nivel (tipos nuevos en `STRUCTURE_TYPES` o listas de decoración) y reaccionan a la luz del ciclo día/noche. |

## 4. Requisitos visuales

| ID     | Requisito |
|--------|-----------|
| RV-201 | Todo lo nuevo mantiene la estética pixel art: texturas procedurales de paleta limitada, `NearestFilter`, luz en bandas. |
| RV-202 | Sol y luna como discos pixelados; la luna con manchas (cráteres). Estrellas de 1 píxel con algunas más brillantes. |
| RV-203 | Transiciones de color suaves entre fases (interpolación por elevación del sol), sin saltos. |
| RV-204 | De noche el mundo se ve oscuro pero legible (luz de luna); con la antorcha, el círculo de luz cálida contrasta claramente. |
| RV-205 | La llama y las chispas de la antorcha no reciben niebla ni sombras y se ven brillantes. |

## 5. Requisitos no funcionales

| ID      | Requisito |
|---------|-----------|
| RNF-201 | Mantener 60 FPS en hardware medio: pasto y pájaros con `InstancedMesh`, decoración fusionada por material, sin sombras de la antorcha. |
| RNF-202 | La luz de la antorcha existe siempre en la escena (intensidad 0 si no está equipada) para evitar recompilar shaders. |
| RNF-203 | Todos los parámetros nuevos (duración del día, colores por fase, antorcha, pájaros, pasto, sonido) en `src/config.js`. |
| RNF-204 | Sin dependencias nuevas: audio con Web Audio, gráficos con Three.js y canvas. |

## 6. Controles (añadidos)

| Tecla / entrada | Acción |
|-----------------|--------|
| 1 – 5           | Seleccionar ranura del inventario |
| Rueda del ratón | Cambiar de ranura |
| Q               | Guardar objeto (mano vacía) |
| T (mantener)    | Acelerar el tiempo (depuración) |

## 7. Arquitectura propuesta (módulos nuevos)

```
src/
├── world/
│   ├── dayCycle.js      # Reloj del mundo: hora, fase, dirección de sol/luna, colores interpolados
│   ├── sky.js           # (ampliado) sol, luna y estrellas en el shader del cielo
│   ├── vegetation.js    # Pasto alto y flores (instanced + viento)
│   └── structures.js    # (ampliado) tipos rubble, tree y grove; musgo en materials.js
├── fauna/
│   └── birds.js         # Bandadas, vuelo, aterrizaje y animación de aleteo
├── items/
│   ├── inventory.js     # Ranuras, selección y objeto activo
│   └── torch.js         # Modelo en primera persona, llama, chispas y luz
├── audio/
│   └── footsteps.js     # Síntesis de pasos por superficie (separado del ambiente)
└── ui/
    └── hotbar.js        # Barra de inventario pixel art
```

- **Ciclo de día:** `DayCycle.update(dt)` produce un estado (`sunDirection`, `moonDirection`, `sunColor`,
  `skyZenith`, `skyHorizon`, `fogColor`, `ambient`, `starsOpacity`, `phase`…) interpolando keyframes por
  elevación del sol definidos en `config.js`. Cielo, luces, niebla, nubes y pájaros leen ese estado.
- **Sombras:** una sola `DirectionalLight` con sombras que se orienta al sol o a la luna según cuál esté arriba.

## 8. Criterios de aceptación

- [x] Los pasos en césped, tierra y piedra suenan claramente distintos y agradables, sin chirridos. *(Energía > 4 kHz: 3.4 % césped, 1.4 % tierra, 0.1 % piedra frente al 25.6 % de v1; pendiente de confirmar a oído.)*
- [x] En 15 minutos se observa un ciclo completo: madrugada → amanecer → día → tarde → atardecer → noche con estrellas y luna.
- [x] Sol y luna salen y se ponen; sombras e iluminación cambian de forma continua.
- [x] Con la tecla `1` se equipa la antorcha, se ve su llama animada y de noche ilumina el entorno cercano.
- [x] Hay bandadas de pájaros moviéndose solas de día que desaparecen de noche.
- [x] El nivel tiene más piedras, detalles de musgo, árboles a lo lejos y pasto alto que se mece.
- [ ] Consola sin errores y rendimiento dentro de RNF-201. *(Consola limpia y 16 draw calls / ~124k triángulos por frame; 60 FPS pendiente de medir en hardware real, el entorno de pruebas no tiene GPU.)*
