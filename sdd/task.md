# Tareas — Spec v1 (completada)

Leyenda: `[ ]` pendiente · `[x]` completada · `[~]` en progreso

## Fase SDD
- [x] Crear `AGENTS.md`
- [x] Crear `sdd/specs/spec_v1.md`
- [x] Crear `sdd/plan.md`
- [x] Crear `sdd/task.md`

## Fase 0 — Base del proyecto
- [x] Crear `index.html` con `importmap` de Three.js (versión fijada)
- [x] Crear `src/config.js` con parámetros iniciales
- [x] Crear `src/core/renderer.js`
- [x] Crear `src/core/loop.js` (delta time limitado)
- [x] Crear `src/main.js` con escena, cámara y cubo de prueba
- [x] Actualizar `README.md` con instrucciones de ejecución

## Fase 1 — Pipeline pixel art
- [x] Render target de baja resolución con `NearestFilter` y depth texture
- [x] Quad de pantalla completa con shader de post-proceso
- [x] Manejo de `resize` manteniendo el tamaño de píxel
- [x] Cuantización a paleta (flag en config)
- [x] Dithering Bayer 4×4 (flag en config)
- [x] Outline por profundidad (flag en config)

## Fase 2 — Materiales y texturas procedurales
- [x] PRNG con semilla y ruido de valor 2D
- [x] Textura de piedra moteada
- [x] Textura de césped (3–4 tonos)
- [x] Textura de tierra ocre
- [x] Material toon con gradiente de 3–4 bandas

## Fase 3 — Mundo
- [x] Terreno ondulado con ruido y `getHeight(x, z)`
- [x] Camino de tierra con borde irregular mezclado con el césped
- [x] Cielo con degradado, nubes animadas y sol
- [x] Niebla con color del cielo
- [x] Luz direccional con sombras duras + luz ambiental/hemisférica
- [x] Ajustar frustum y bias de sombras

## Fase 4 — Estructuras y niveles
- [x] Piezas `pillar`, `lintel`, `fallenStone`, `boulder` con deformación de vértices
- [x] Pieza compuesta `trilithon`
- [x] Cajas de colisión por pieza
- [x] Nivel `src/levels/meadow.js` con ≥3 trilitos y piedras caídas
- [x] Cargador de nivel que instancia estructuras y registra colisionadores

## Fase 5 — Jugador y controles
- [x] `input.js` con teclado, ratón y Pointer Lock
- [x] Cámara primera persona (yaw/pitch limitado)
- [x] Movimiento con aceleración/fricción y correr
- [x] Gravedad, salto y seguimiento de altura del terreno
- [x] Modo vuelo (`F`)
- [x] Colisión contra estructuras (paso bajo dinteles)

## Fase 6 — UI
- [x] Pantalla de inicio "Clic para jugar"
- [x] Pausa con `Esc` y reanudar con clic
- [x] HUD de depuración (FPS, posición, modo) con `F3`

## Fase 7 — Pulido y validación
- [x] Ajustar paleta, resolución pixel, sombras y niebla contra la referencia
- [x] Optimizar (reutilizar geometrías/materiales, draw calls): piedras fusionadas en una malla, 5 draw calls por frame
- [ ] Verificar 60 FPS en hardware real (no medible en el entorno de pruebas sin GPU)
- [x] Consola sin errores ni warnings
- [x] Verificar criterios de aceptación de la spec
- [x] Actualizar `AGENTS.md` y `README.md`

## Opcional
- [x] Audio ambiente (viento, pasos)
- [x] Snap de cámara a la rejilla de píxeles para reducir shimmering

---

# Tareas — Spec v2

## Fase SDD v2
- [x] Crear `sdd/specs/spec_v2.md`
- [x] Añadir plan v2 a `sdd/plan.md`
- [x] Añadir tareas v2 a `sdd/task.md`

## Fase 8 — Sonido de pasos v2
- [x] Mover pasos a `src/audio/footsteps.js` con bus filtrado (paso bajo + compresor)
- [x] Síntesis por capas (talón + planta) con variación aleatoria
- [x] Sonido de césped suave
- [x] Sonido de tierra
- [x] Sonido de piedra y detección de superficie `stone` sobre estructuras
- [x] Volumen/ritmo según velocidad y paso de aterrizaje

## Fase 9 — Ciclo día/noche
- [x] `dayCycle.js`: hora, fase y direcciones de sol/luna (día de 15 min configurable)
- [x] Keyframes de color por fase (cielo, horizonte, sol, ambiente, niebla) en `config.js`
- [x] Cielo: horizonte cálido del lado del sol en amanecer/atardecer
- [x] Sol y luna pixelados que salen y se ponen
- [x] Estrellas que aparecen, titilan y rotan
- [x] Nubes teñidas según la hora
- [x] Luz con sombras que sigue al sol o a la luna; ambiente, relleno y niebla por hora
- [x] HUD con hora y fase; tecla `T` para acelerar el tiempo

## Fase 10 — Inventario y antorcha
- [x] `inventory.js` con 5 ranuras, teclas `1`–`5`, rueda y `Q`
- [x] `hotbar.js`: barra pixel art con iconos y ranura activa
- [x] Modelo de antorcha en primera persona con balanceo y sacar/guardar
- [x] Llama pixel art animada y chispas
- [x] Luz cálida con parpadeo que ilumina el entorno (sin sombras, siempre en escena)

## Fase 11 — Entorno
- [ ] Tipos `rubble`/`pebbles` y más rocas dispersas
- [ ] Musgo/liquen en las piedras
- [ ] Tipo `tree` y árboles en el horizonte (uno solitario destacado)
- [ ] Pasto alto instanciado con viento, fuera del camino y estructuras
- [ ] Ampliar `meadow.js` con los nuevos elementos

## Fase 12 — Pájaros
- [ ] Pájaros instanciados con aleteo y planeo
- [ ] Bandadas con comportamiento de boids y deambular
- [ ] Pájaros que se posan en dinteles y despegan
- [ ] Densidad según la hora del día
- [ ] (Opcional) Trinos procedurales de día

## Fase 13 — Pulido y validación v2
- [ ] Ajustar colores de cada fase del día
- [ ] Verificar rendimiento (draw calls, instancias)
- [ ] Consola sin errores ni warnings
- [ ] Verificar criterios de aceptación de la spec v2
- [ ] Actualizar `AGENTS.md` y `README.md`
