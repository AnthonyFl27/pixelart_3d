# Audio de la radio

Colocar aquí la canción de la radio como `radio.mp3` (ruta en `CONFIG.radio.src`, `src/config.js`).
El archivo no se versiona (`.gitignore`): cada copia local lo añade a mano.

Sin el archivo la radio solo emite estática y `F3` muestra `RADIO sin archivo (estática)`. El navegador
registra la petición fallida (404) al encender la radio por primera vez; no hay errores de JavaScript.
