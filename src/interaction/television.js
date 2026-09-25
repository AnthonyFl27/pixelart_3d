import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createHitBox } from './hitBox.js';

// Televisor de tubo (spec v3, 4.10). Pantalla curvada con textura de canvas: apagada es
// gris oscura con reflejo; al encender, una línea brillante se abre hasta mostrar la
// pantalla gris `NO SIGNAL` con barrido, ruido y parpadeo; al apagar la imagen se
// contrae a una línea y a un punto que se desvanece. La pantalla no recibe niebla ni
// luz, ilumina la sala con una luz fría del interior y suena con posición en el espacio.
// Datos: { position: centro de la pantalla, rotationY, width, height, hitSize, hitOffset }.

const PROMPTS = { on: 'Encender televisor', off: 'Apagar televisor' };

// Fuente pixel 4x5 (I de 3) para el texto de la pantalla.
const GLYPHS = {
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  S: ['.###', '#...', '.##.', '...#', '###.'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  L: ['#...', '#...', '#...', '#...', '####'],
  ' ': ['..', '..', '..', '..', '..'],
};

export class Television {
  constructor(data, { interiorLighting }) {
    const tv = CONFIG.television;
    this.name = data.name ?? 'television';
    this.zone = data.zone ?? null;
    this.interiorLighting = interiorLighting;
    this.object = new THREE.Group();
    this.object.name = `television-${this.name}`;
    this.object.position.fromArray(data.position);
    this.object.rotation.y = data.rotationY ?? 0;

    const [w, h] = tv.resolution;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.context = this.canvas.getContext('2d');
    this.image = this.context.createImageData(w, h);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.screen = new THREE.Mesh(
      createScreenGeometry(data.width, data.height, tv.bulge),
      new THREE.MeshBasicMaterial({ map: this.texture, fog: false, toneMapped: false }),
    );
    const hit = createHitBox(data.hitSize ?? [data.width, data.height, 0.1], data.hitOffset ?? [0, 0, 0]);
    this.object.add(this.screen, hit);
    this.meshes = [hit];
    this.object.updateMatrixWorld(true);

    this.state = 'off';    // off | starting | on | stopping
    this.progress = 0;     // avance de la animación de encendido o apagado (0-1)
    this.frameTime = 0;
    this.time = 0;
    this.roll = 0;
    this.sound = null;
    this.text = layoutText(tv.text, w, h);
    this.lightPosition = this.object.localToWorld(new THREE.Vector3(0, 0, tv.lightOffset));
    this.soundPosition = this.object.localToWorld(new THREE.Vector3());
    this.draw();
  }

  get isOn() {
    return this.state === 'on' || this.state === 'starting';
  }

  prompt() {
    return this.isOn ? PROMPTS.off : PROMPTS.on;
  }

  interact({ audio }) {
    audio?.playSfx('click', this.soundPosition);
    if (this.isOn) {
      this.state = 'stopping';
      this.progress = 0;
      this.sound?.stop();
      this.sound = null;
    } else {
      this.state = 'starting';
      this.progress = 0;
      this.sound = audio?.startSfx('tube', this.soundPosition) ?? null;
    }
  }

  update(dt) {
    const tv = CONFIG.television;
    this.time += dt;
    this.roll = (this.roll + dt * tv.rollSpeed) % tv.resolution[1];
    if (this.state === 'starting' || this.state === 'stopping') {
      this.progress = Math.min(1, this.progress + dt / (this.state === 'starting' ? tv.onTime : tv.offTime));
      if (this.progress >= 1) this.state = this.state === 'starting' ? 'on' : 'off';
    }
    // Redibujar a la cadencia de la tele (ruido) salvo apagada.
    this.frameTime += dt;
    if (this.state !== 'off' || this.drawnState !== 'off') {
      if (this.frameTime >= 1 / tv.fps || this.state !== this.drawnState) {
        this.frameTime = 0;
        this.draw();
      }
    }
    const flicker = 1 - tv.flicker * Math.random();
    this.interiorLighting.setLight(tv.lightIndex, this.lightPosition, tv.lightColor, tv.lightIntensity * this.brightness() * flicker, tv.lightRange);
  }

  // Fracción de la pantalla encendida (para la luz).
  brightness() {
    const p = this.progress;
    if (this.state === 'on') return 1;
    if (this.state === 'starting') return p < 0.15 ? 0.1 : (p - 0.15) / 0.85;
    if (this.state === 'stopping') return p < 0.4 ? 1 - p / 0.4 * 0.9 : Math.max(0, 0.1 * (1 - p));
    return 0;
  }

  draw() {
    const tv = CONFIG.television;
    const [w, h] = tv.resolution;
    const data = this.image.data;
    const p = this.progress;
    const ease = (t) => t * t * (3 - 2 * t);
    const put = (x, y, r, g, b) => {
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    };
    this.drawnState = this.state;

    if (this.state === 'off') {
      // Cristal apagado: gris oscuro con viñeta y un reflejo diagonal.
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x - w / 2) / (w / 2);
          const dy = (y - h / 2) / (h / 2);
          const v = 44 - (dx * dx + dy * dy) * 14;
          const glare = Math.abs(x + y * 1.2 - w * 0.35) < 1.2 && y < h * 0.45 ? 26 : 0;
          put(x, y, v + glare, v + 2 + glare, v + 3 + glare);
        }
      }
    } else {
      // Ventana visible: franja vertical [top, bottom] y horizontal [left, right] alrededor del centro.
      let band = h;
      let line = w;
      let glow = 0;
      if (this.state === 'starting') {
        if (p < 0.15) {
          band = 1;
          line = Math.max(1, Math.round(ease(p / 0.15) * w));
          glow = 1;
        } else {
          band = Math.max(1, Math.round(ease((p - 0.15) / 0.85) * h));
          glow = 1 - (p - 0.15) / 0.85;
        }
      } else if (this.state === 'stopping') {
        if (p < 0.4) {
          band = Math.max(1, Math.round((1 - ease(p / 0.4)) * h));
          glow = p / 0.4;
        } else if (p < 0.7) {
          band = 1;
          line = Math.max(2, Math.round((1 - ease((p - 0.4) / 0.3)) * w));
          glow = 1;
        } else {
          band = 2;
          line = 2;
          glow = 1 - (p - 0.7) / 0.3;
        }
      }
      const top = Math.floor((h - band) / 2);
      const left = Math.floor((w - line) / 2);
      const flicker = 1 - tv.flicker * Math.random();
      const collapsed = band <= 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (y < top || y >= top + band || x < left || x >= left + line) {
            put(x, y, 8, 9, 10);
            continue;
          }
          if (collapsed) {
            const v = Math.round(90 + 165 * glow);
            put(x, y, v, v, v);
            continue;
          }
          // Imagen: gris con ruido, líneas de barrido y una franja que baja.
          let v = tv.gray + (Math.random() - 0.5) * tv.noise;
          if (y % 2) v *= tv.scanline;
          const d = Math.abs(y - this.roll);
          if (d < tv.rollHeight) v += tv.rollBoost * (1 - d / tv.rollHeight);
          const text = this.text[y * w + x];
          if (text === 1) v = 235;
          else if (text === 2) v = 30;
          v = v * flicker + glow * 120;
          const c = THREE.MathUtils.clamp(Math.round(v), 0, 255);
          put(x, y, c, c, Math.min(255, c + 4));
        }
      }
    }
    this.context.putImageData(this.image, 0, 0);
    this.texture.needsUpdate = true;
  }
}

// Máscara del texto centrado: 1 = letra, 2 = contorno oscuro, 0 = nada.
function layoutText(text, w, h) {
  const mask = new Uint8Array(w * h);
  const glyphs = [...text].map((char) => GLYPHS[char] ?? GLYPHS[' ']);
  const width = glyphs.reduce((sum, g) => sum + g[0].length, 0) + glyphs.length - 1;
  let x0 = Math.floor((w - width) / 2);
  const y0 = Math.floor((h - 5) / 2);
  for (const glyph of glyphs) {
    glyph.forEach((row, gy) => {
      [...row].forEach((cell, gx) => {
        if (cell !== '#') return;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const i = (y0 + gy + oy) * w + x0 + gx + ox;
            if (mask[i] === 0) mask[i] = 2;
          }
        }
      });
    });
    glyph.forEach((row, gy) => [...row].forEach((cell, gx) => {
      if (cell === '#') mask[(y0 + gy) * w + x0 + gx] = 1;
    }));
    x0 += glyph[0].length + 1;
  }
  return mask;
}

// Pantalla abombada: plano subdividido desplazado hacia +Z en el centro.
function createScreenGeometry(width, height, bulge) {
  const geometry = new THREE.PlaneGeometry(width, height, 8, 6);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / (width / 2);
    const y = position.getY(i) / (height / 2);
    position.setZ(i, bulge * (1 - x * x * 0.8) * (1 - y * y * 0.8));
  }
  geometry.computeVertexNormals();
  return geometry;
}
