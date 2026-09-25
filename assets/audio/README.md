# Audio de la radio

Colocar aquí las canciones de la radio (`.mp3`) y añadir cada ruta a la lista `CONFIG.radio.tracks`
de `src/config.js` (el navegador no puede listar la carpeta):

```js
tracks: [
  'assets/audio/song.mp3',
  'assets/audio/otra.mp3',
],
```

Los archivos no se versionan (`.gitignore`): cada copia local los añade a mano.

Con la radio encendida y apuntándola, `N` (`CONFIG.interaction.altKey`) sintoniza la siguiente canción;
cada una sigue donde se quedó y, al acabar, pasa sola a la siguiente (`autoAdvance`). Retomar el punto
de cada canción requiere un servidor con peticiones `Range` (`serve.py`, `npx serve`, GitHub Pages).

Si falta un archivo, esa emisora solo emite estática y `F3` muestra `RADIO estática (sin archivo…: ruta)`;
`N` pasa a la siguiente. El navegador registra la petición fallida (404); no hay errores de JavaScript.
