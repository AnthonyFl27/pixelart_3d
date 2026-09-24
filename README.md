# pixelart_3d

Videojuego 3D con estética pixel art que se ejecuta en el navegador con Three.js. No necesita compilación.

## Ejecutar

Los navegadores bloquean ES modules desde `file://`, así que hay que servir la carpeta con un servidor estático:

```bash
python3 -m http.server 8080
# o bien
npx serve .
```

Abrir `http://localhost:8080`.

Se necesita conexión a internet: Three.js se carga desde el CDN jsDelivr (versión fijada en el `importmap` de `index.html`).

## Configuración

Todos los parámetros ajustables están en `src/config.js`.

## Documentación

- `AGENTS.md`: descripción del proyecto y convenciones.
- `sdd/specs/spec_v1.md`: especificación.
- `sdd/plan.md`: plan de implementación.
- `sdd/task.md`: tareas.
