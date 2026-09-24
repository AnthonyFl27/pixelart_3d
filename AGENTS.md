# AGENTS.md — pixelart_3d

## Qué es este proyecto

Videojuego 3D con estética **pixel art** que se ejecuta en el navegador desde un único `index.html`.
El prototipo inicial es una escena abierta tipo "Stonehenge": pradera de césped, un camino de tierra,
estructuras de piedra (trilitos) y un cielo con nubes, todo renderizado a baja resolución con texturas
pixeladas, iluminación escalonada y sombras duras. El jugador se mueve libremente en primera persona.

Referencias visuales: imagen del prototipo adjunta en la spec y el video
https://youtu.be/GhlTMsPoaJw

## Stack técnico

| Área            | Tecnología                                                                 |
|-----------------|----------------------------------------------------------------------------|
| Motor 3D        | [Three.js](https://threejs.org) (ES modules) cargado vía `importmap` desde CDN |
| Lenguaje        | JavaScript moderno (ES2022), sin transpilar                                 |
| Build           | **Ninguno**. Sin bundler, sin `npm install` obligatorio                      |
| Estilo pixel    | Render a baja resolución + escalado `nearest`, texturas procedurales, luz cuantizada |
| Controles       | Pointer Lock API (ratón) + teclado                                          |

## Cómo ejecutar

Los navegadores bloquean ES modules desde `file://`, por lo que se sirve la carpeta con cualquier servidor estático:

```bash
# Opción A (Python)
python3 -m http.server 8080
# Opción B (Node)
npx serve .
```

Abrir `http://localhost:8080`. También funciona tal cual en GitHub Pages.

## Estructura del proyecto

```
pixelart_3d/
├── index.html              # Punto de entrada: importmap, canvas, HUD
├── src/
│   ├── main.js             # Arranque: crea motor, mundo, jugador y bucle
│   ├── config.js           # TODOS los parámetros ajustables (resolución, velocidad, colores...)
│   ├── core/               # Renderer, bucle de juego, input
│   ├── render/             # Pipeline pixel art (render target, post-proceso, shaders)
│   ├── world/              # Terreno, cielo, estructuras, materiales/texturas procedurales
│   ├── player/             # Controlador de primera persona y colisiones
│   ├── levels/             # Definición de niveles como datos (JSON/objetos JS)
│   └── ui/                 # HUD, menú de pausa, overlay de inicio
├── assets/                 # Texturas/modelos externos opcionales
├── sdd/                    # Spec-Driven Development
│   ├── specs/spec_v1.md    # Especificación del prototipo
│   ├── plan.md             # Plan de implementación
│   └── task.md             # Lista de tareas con checkboxes
└── AGENTS.md
```

## Flujo de trabajo (SDD)

1. Leer `sdd/specs/` (la versión más alta es la vigente).
2. Seguir `sdd/plan.md` por fases.
3. Tomar la siguiente tarea pendiente de `sdd/task.md`, implementarla y marcarla `[x]` en el mismo commit.
4. Cambios de alcance → nueva spec (`spec_v2.md`, …) y actualización de plan y tareas.

## Convenciones de código

- Un módulo = una responsabilidad. Cada módulo exporta funciones/clases con nombre (sin `export default`).
- Ningún número mágico en el código de juego: todo parámetro ajustable vive en `src/config.js`.
- Los niveles son **datos** (`src/levels/*.js`): añadir una estructura no requiere tocar lógica.
- Texturas generadas proceduralmente en `<canvas>` con paleta limitada; siempre `NearestFilter` y sin mipmaps.
- Nombres en inglés en el código; documentación en español.
- Sin dependencias adicionales sin justificarlo en la spec.
- Mantener 60 FPS en un portátil medio: evitar geometría excesiva, reutilizar materiales y geometrías.

## Verificación

- Abrir el juego en el servidor local y comprobar que no hay errores en consola.
- Revisar visualmente contra la imagen/video de referencia.
- Comprobar controles: movimiento, cámara, salto, colisión con estructuras, pausa.

## Commits

Mensajes en imperativo y descriptivos (`Add pixel render pipeline`, `Fix collision with lintels`).
Marcar en `sdd/task.md` las tareas completadas en el mismo commit.
