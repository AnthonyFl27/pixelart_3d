# Tareas — Spec v1

Leyenda: `[ ]` pendiente · `[x]` completada · `[~]` en progreso

## Fase SDD
- [x] Crear `AGENTS.md`
- [x] Crear `sdd/specs/spec_v1.md`
- [x] Crear `sdd/plan.md`
- [x] Crear `sdd/task.md`

## Fase 0 — Base del proyecto
- [ ] Crear `index.html` con `importmap` de Three.js (versión fijada)
- [ ] Crear `src/config.js` con parámetros iniciales
- [ ] Crear `src/core/renderer.js`
- [ ] Crear `src/core/loop.js` (delta time limitado)
- [ ] Crear `src/main.js` con escena, cámara y cubo de prueba
- [ ] Actualizar `README.md` con instrucciones de ejecución

## Fase 1 — Pipeline pixel art
- [ ] Render target de baja resolución con `NearestFilter` y depth texture
- [ ] Quad de pantalla completa con shader de post-proceso
- [ ] Manejo de `resize` manteniendo el tamaño de píxel
- [ ] Cuantización a paleta (flag en config)
- [ ] Dithering Bayer 4×4 (flag en config)
- [ ] Outline por profundidad (flag en config)

## Fase 2 — Materiales y texturas procedurales
- [ ] PRNG con semilla y ruido de valor 2D
- [ ] Textura de piedra moteada
- [ ] Textura de césped (3–4 tonos)
- [ ] Textura de tierra ocre
- [ ] Material toon con gradiente de 3–4 bandas

## Fase 3 — Mundo
- [ ] Terreno ondulado con ruido y `getHeight(x, z)`
- [ ] Camino de tierra con borde irregular mezclado con el césped
- [ ] Cielo con degradado, nubes animadas y sol
- [ ] Niebla con color del cielo
- [ ] Luz direccional con sombras duras + luz ambiental/hemisférica
- [ ] Ajustar frustum y bias de sombras

## Fase 4 — Estructuras y niveles
- [ ] Piezas `pillar`, `lintel`, `fallenStone`, `boulder` con deformación de vértices
- [ ] Pieza compuesta `trilithon`
- [ ] Cajas de colisión por pieza
- [ ] Nivel `src/levels/meadow.js` con ≥3 trilitos y piedras caídas
- [ ] Cargador de nivel que instancia estructuras y registra colisionadores

## Fase 5 — Jugador y controles
- [ ] `input.js` con teclado, ratón y Pointer Lock
- [ ] Cámara primera persona (yaw/pitch limitado)
- [ ] Movimiento con aceleración/fricción y correr
- [ ] Gravedad, salto y seguimiento de altura del terreno
- [ ] Modo vuelo (`F`)
- [ ] Colisión contra estructuras (paso bajo dinteles)

## Fase 6 — UI
- [ ] Pantalla de inicio "Clic para jugar"
- [ ] Pausa con `Esc` y reanudar con clic
- [ ] HUD de depuración (FPS, posición, modo) con `F3`

## Fase 7 — Pulido y validación
- [ ] Ajustar paleta, resolución pixel, sombras y niebla contra la referencia
- [ ] Optimizar (reutilizar geometrías/materiales, draw calls) y verificar 60 FPS
- [ ] Consola sin errores ni warnings
- [ ] Verificar criterios de aceptación de la spec
- [ ] Actualizar `AGENTS.md` y `README.md`

## Opcional
- [ ] Audio ambiente (viento, pasos)
- [ ] Snap de cámara a la rejilla de píxeles para reducir shimmering
