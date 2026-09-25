"""Servidor estático para desarrollo sin caché del navegador.

Con `python3 -m http.server` el navegador puede reutilizar módulos antiguos tras
actualizar el código y mezclar versiones (pantalla en negro). Además atiende peticiones
`Range` (como GitHub Pages): sin ellas el navegador no puede saltar a otro punto de un
.mp3 y la radio no retoma cada canción donde se quedó. Uso: python3 serve.py [puerto]
"""
import http.server
import os
import re
import sys

RANGE = re.compile(r'bytes=(\d*)-(\d*)$')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
        self.remaining = None
        match = RANGE.match(self.headers.get('Range', '').strip())
        path = self.translate_path(self.path)
        if not match or not os.path.isfile(path) or match.groups() == ('', ''):
            return super().send_head()
        size = os.path.getsize(path)
        first, last = match.groups()
        if first:
            start, end = int(first), min(int(last), size - 1) if last else size - 1
        else:
            start, end = max(0, size - int(last)), size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.end_headers()
            return None
        source = open(path, 'rb')
        source.seek(start)
        self.remaining = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self.remaining))
        self.end_headers()
        return source

    def copyfile(self, source, outputfile):
        if self.remaining is None:
            return super().copyfile(source, outputfile)
        while self.remaining > 0:
            chunk = source.read(min(64 * 1024, self.remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            self.remaining -= len(chunk)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f'Sirviendo en http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
