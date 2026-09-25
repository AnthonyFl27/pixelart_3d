"""Servidor estático para desarrollo sin caché del navegador.

Con `python3 -m http.server` el navegador puede reutilizar módulos antiguos tras
actualizar el código y mezclar versiones (pantalla en negro). Uso: python3 serve.py [puerto]
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f'Sirviendo en http://localhost:{port}')
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
