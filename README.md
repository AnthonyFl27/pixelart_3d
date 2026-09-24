# pixelart_3d

Videojuego 3D con estética pixel art que se ejecuta en el navegador con Three.js. No necesita compilación.

Prototipo actual: **Pradera de piedras**, un círculo de trilitos al estilo Stonehenge sobre una pradera,
con camino de tierra, cielo con nubes animadas, sombras duras y exploración libre en primera persona.

## Ejecutar

Los navegadores bloquean ES modules desde `file://`, así que hay que servir la carpeta con un servidor estático:

```bash
python3 -m http.server 8080
# o bien
npx serve .
```

Abrir `http://localhost:8080` y hacer clic para jugar.

Se necesita conexión a internet: Three.js se carga desde el CDN jsDelivr (versión fijada en el `importmap`
de `index.html`) y la fuente pixel desde Google Fonts.

## Controles

| Tecla | Acción |
|-------|--------|
| Ratón | Mirar |
| W A S D / flechas | Moverse |
| Shift | Correr |
| Espacio | Saltar (en vuelo: subir) |
| C / Ctrl | Bajar (en vuelo) |
| F | Alternar modo vuelo |
| M | Silenciar audio |
| F3 | HUD de depuración |
| Esc | Pausa |

## Configuración

Todos los parámetros ajustables están en `src/config.js`, entre otros:

- `render.pixelHeight`: tamaño del píxel (altura del render interno).
- `postfx`: contorno, reducción a paleta y dithering (desactivados por defecto).
- `lighting`, `fog`, `sky`: sol, sombras, niebla y nubes.
- `textures`: paletas de piedra, césped y tierra.
- `player`: velocidades, salto, gravedad y sensibilidad del ratón.
- `audio`: volúmenes del viento y los pasos.

## Editar el nivel

El nivel es un archivo de datos: `src/levels/meadow.js`. Para añadir una estructura basta con añadir una entrada:

```js
{ type: 'trilithon', x: 20, z: -5, rotationY: 1.2, height: 4.5 },
```

Tipos disponibles: `trilithon`, `pillar`, `fallenStone`, `boulder`. El camino de tierra se define en `path`.

## Documentación

- `AGENTS.md`: descripción del proyecto, estructura y convenciones.
- `sdd/specs/spec_v1.md`: especificación.
- `sdd/plan.md`: plan de implementación.
- `sdd/task.md`: tareas.
