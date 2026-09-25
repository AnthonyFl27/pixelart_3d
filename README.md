# pixelart_3d

Videojuego 3D con estética pixel art que se ejecuta en el navegador con Three.js. No necesita compilación.

Prototipo actual: **Pradera de piedras**, un círculo de trilitos al estilo Stonehenge sobre una pradera,
con camino de tierra, cielo con nubes animadas, sombras duras y exploración libre en primera persona.

- Ciclo día/noche de 15 minutos: madrugada, amanecer, día, tarde, atardecer, anochecer y noche,
  con sol, luna, estrellas y luz que cambian de forma continua.
- Antorcha pixel art en un inventario de 5 ranuras que ilumina el entorno de noche.
- Pájaros en bandadas o solitarios que se posan en las piedras y se marchan al anochecer.
- Pasto alto con viento, flores, musgo, escombros y árboles en el horizonte.
- Pasos con sonido distinto en césped, tierra y piedra; viento y trinos procedurales.

## Ejecutar

Los navegadores bloquean ES modules desde `file://`, así que hay que servir la carpeta con un servidor estático:

```bash
python3 serve.py 8080
# o bien
npx serve .
```

`serve.py` desactiva la caché del navegador: con `python3 -m http.server` una recarga normal puede mezclar
módulos viejos y nuevos tras actualizar el código y dejar la pantalla en negro (se arregla con Ctrl+Shift+R).
Si algo falla al cargar, el error aparece en pantalla.

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
| 1 – 5 / rueda del ratón | Seleccionar ranura del inventario (1 = antorcha) |
| Q | Guardar objeto |
| T (mantener) | Acelerar el tiempo |
| M | Silenciar audio |
| F3 | HUD de depuración |
| Esc | Pausa |

## Configuración

Todos los parámetros ajustables están en `src/config.js`, entre otros:

- `render.pixelHeight`: tamaño del píxel (altura del render interno).
- `dayCycle`: duración del día, hora inicial y colores/luz de cada momento del día.
- `torch`, `birds`, `vegetation`, `moss`: antorcha, pájaros, pasto alto y musgo.
- `postfx`: contorno, reducción a paleta y dithering (desactivados por defecto).
- `lighting`, `fog`, `sky`: sol, sombras, niebla y nubes.
- `textures`: paletas de piedra, césped y tierra.
- `player`: velocidades, salto, gravedad y sensibilidad del ratón.
- `audio`, `footsteps`: volúmenes y sonido de viento, trinos y pasos por superficie.

Para probar se puede abrir con parámetros: `?hora=19.5` (hora inicial) y `?pos=x,z,yaw` (posición inicial).

## Editar el nivel

El nivel es un archivo de datos: `src/levels/meadow.js`. Para añadir una estructura basta con añadir una entrada:

```js
{ type: 'trilithon', x: 20, z: -5, rotationY: 1.2, height: 4.5 },
```

Tipos disponibles: `trilithon`, `pillar`, `fallenStone`, `boulder`, `rubble`, `tree`, `grove`.
El camino de tierra se define en `path`.

## Documentación

- `AGENTS.md`: descripción del proyecto, estructura y convenciones.
- `sdd/specs/spec_v1.md`, `sdd/specs/spec_v2.md`: especificaciones.
- `sdd/plan.md`: plan de implementación.
- `sdd/task.md`: tareas.
