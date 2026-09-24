# Spec v1 — Prototipo "Pradera de piedras" (pixel art 3D)

## 1. Objetivo

Construir un prototipo jugable en navegador de un mundo 3D con estética pixel art, similar a la imagen
de referencia y al video https://youtu.be/GhlTMsPoaJw: estructuras de piedra tipo Stonehenge sobre una
pradera, camino de tierra, cielo con nubes y movimiento libre en primera persona.

## 2. Alcance

### Incluido (v1)
- Escena 3D explorable con movimiento libre.
- Pipeline de render pixel art.
- Terreno, camino, estructuras de piedra, cielo y sol.
- Iluminación direccional con sombras duras.
- HUD mínimo y pantalla de inicio/pausa.
- Configuración centralizada y niveles definidos como datos.

### Fuera de alcance (v1)
- Enemigos, IA, combate, inventario.
- Audio (salvo que sobre tiempo, como tarea opcional).
- Multijugador, guardado de partida.
- Editor visual de niveles.
- Soporte táctil/móvil.

## 3. Requisitos funcionales

| ID    | Requisito |
|-------|-----------|
| RF-01 | El juego se inicia abriendo `index.html` servido estáticamente, sin paso de build. |
| RF-02 | Pantalla de inicio con "Clic para jugar"; al hacer clic se captura el ratón (Pointer Lock). |
| RF-03 | Cámara en primera persona controlada con el ratón (yaw/pitch, pitch limitado a ±89°). |
| RF-04 | Movimiento con `WASD` / flechas, correr con `Shift`, saltar con `Espacio`. |
| RF-05 | Modo vuelo libre alternable con `F` (subir `Espacio`, bajar `C`/`Ctrl`) para explorar y depurar. |
| RF-06 | El jugador camina sobre el terreno (respeta la altura) y colisiona con las estructuras de piedra. |
| RF-07 | `Esc` pausa el juego y libera el ratón; clic reanuda. |
| RF-08 | La escena contiene al menos 3 trilitos (2 pilares + dintel), piedras caídas/sueltas y un camino de tierra. |
| RF-09 | Los niveles se describen como datos (posición, rotación, escala, tipo de estructura). |
| RF-10 | HUD opcional con FPS y posición, alternable con `F3`. |
| RF-11 | La ventana puede redimensionarse sin deformar la imagen ni perder el efecto pixel. |

## 4. Requisitos visuales (estilo pixel art)

| ID    | Requisito |
|-------|-----------|
| RV-01 | La escena se renderiza en un render target de baja resolución (altura base ~240–320 px, configurable) y se escala a pantalla con filtrado `nearest`. |
| RV-02 | Texturas procedurales pixeladas (canvas 2D) con paleta limitada: piedra gris moteada, césped con 3–4 tonos de verde, tierra ocre. `NearestFilter`, sin mipmaps. |
| RV-03 | Iluminación cuantizada/toon: pocos niveles de luz (3–4 bandas), sin degradados suaves. |
| RV-04 | Sombras duras proyectadas por el sol desde las estructuras sobre el césped (como en la referencia). |
| RV-05 | Cielo con degradado azul y nubes estilizadas en movimiento lento; sol visible. |
| RV-06 | Borde irregular/“pixelado” entre camino de tierra y césped (mezcla por ruido, no bordes lisos). |
| RV-07 | Post-proceso opcional: cuantización de color a paleta y dithering ordenado (Bayer), activables en `config.js`. |
| RV-08 | Post-proceso opcional: contornos (outline) por diferencia de profundidad/normales. |
| RV-09 | Niebla atmosférica suave hacia el horizonte con el color del cielo. |
| RV-10 | Terreno con ondulaciones suaves (no plano perfecto), generado con ruido. |

## 5. Requisitos no funcionales

| ID     | Requisito |
|--------|-----------|
| RNF-01 | 60 FPS estables en un portátil medio con navegador moderno (Chrome, Firefox, Edge). |
| RNF-02 | Sin bundler ni dependencias locales; Three.js desde CDN vía `importmap` con versión fijada. |
| RNF-03 | Código modular (ES modules), un archivo por responsabilidad, fácil de extender. |
| RNF-04 | Todos los parámetros ajustables en `src/config.js` (resolución pixel, FOV, velocidades, gravedad, colores, sol, niebla, flags de post-proceso). |
| RNF-05 | Semilla de generación procedural configurable para resultados reproducibles. |
| RNF-06 | Sin errores ni warnings en consola en el flujo normal. |

## 6. Controles

| Tecla / entrada | Acción |
|-----------------|--------|
| Ratón           | Mirar |
| W A S D / flechas | Moverse |
| Shift           | Correr |
| Espacio         | Saltar (en vuelo: subir) |
| C / Ctrl        | Bajar (solo en vuelo) |
| F               | Alternar modo vuelo |
| F3              | Alternar HUD de depuración |
| Esc             | Pausa |

## 7. Arquitectura propuesta

```
index.html ─► src/main.js
                ├─ config.js
                ├─ core/     renderer.js · loop.js · input.js
                ├─ render/   pixelPipeline.js · shaders/ (toon, postfx)
                ├─ world/    terrain.js · sky.js · structures.js · textures.js · materials.js
                ├─ player/   controller.js · collision.js
                ├─ levels/   meadow.js
                └─ ui/       overlay.js · hud.js
```

- **Render pixel**: escena → `WebGLRenderTarget` (baja resolución, `NearestFilter`, con depth texture) →
  quad a pantalla completa con shader de post-proceso (paleta, dithering, outline) → canvas escalado.
- **Colisiones**: cajas AABB/OBB por pieza de estructura + altura del terreno por muestreo de la función de ruido.
- **Estructuras**: fábrica de piezas (`pillar`, `lintel`, `fallenStone`, `boulder`) con deformación ligera
  de vértices para aspecto tallado a mano.

## 8. Criterios de aceptación

- [ ] Se abre `index.html` en servidor local y el juego arranca sin errores.
- [ ] La imagen es claramente pixelada y reconocible frente a la referencia (piedras, césped, camino, cielo, sombras).
- [ ] El jugador puede recorrer la escena, saltar, correr y volar.
- [ ] No se atraviesan las piedras caminando.
- [ ] Cambiar la resolución pixel, colores o velocidades en `config.js` se refleja al recargar.
- [ ] Añadir un trilito nuevo solo requiere añadir una entrada en `src/levels/meadow.js`.
- [ ] ≥ 60 FPS en hardware medio.
