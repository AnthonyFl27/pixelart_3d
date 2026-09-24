# Tareas — Spec v1

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
- [ ] Ajustar paleta, resolución pixel, sombras y niebla contra la referencia
- [ ] Optimizar (reutilizar geometrías/materiales, draw calls) y verificar 60 FPS
- [ ] Consola sin errores ni warnings
- [ ] Verificar criterios de aceptación de la spec
- [ ] Actualizar `AGENTS.md` y `README.md`

## Opcional
- [x] Audio ambiente (viento, pasos)
- [x] Snap de cámara a la rejilla de píxeles para reducir shimmering
