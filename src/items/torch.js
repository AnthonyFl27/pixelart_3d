import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';

// Icono 16x16 para la barra de inventario.
export const TORCH_ICON = {
  palette: {
    W: '#fff2b0', Y: '#ffc93c', O: '#f07b1d', R: '#b3261e',
    C: '#3a2a1e', c: '#5a3f2a', B: '#8a5a32', b: '#6b4424',
  },
  rows: [
    '..........Y.....',
    '.........YWY....',
    '........YWWOY...',
    '........OYWYO...',
    '........ROYOR...',
    '.........RORR...',
    '........CcCc....',
    '.......cCcC.....',
    '......Bb........',
    '.....bB.........',
    '....Bb..........',
    '...bB...........',
    '..Bb............',
    '.bB.............',
    '.b..............',
    '................',
  ],
};

// Antorcha en primera persona. Se dibuja en una escena propia (capa superpuesta)
// para no atravesar paredes; su luz (`light`) vive en la escena del mundo.
export class Torch {
  constructor() {
    const t = CONFIG.torch;
    this.random = createRandom(deriveSeed(CONFIG.seed, 'torch'));

    // Escena y cámara de la vista en primera persona.
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(t.viewFov, 1, 0.01, 10);
    this.ambient = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(this.ambient);
    this.handLight = new THREE.PointLight(t.lightColor, 0, 1.5, 1);
    this.scene.add(this.handLight);

    this.model = new THREE.Group();
    this.model.scale.setScalar(t.viewScale);
    this.scene.add(this.model);
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.42, 0.045).translate(0, -0.21, 0),
      new THREE.MeshLambertMaterial({ map: createStripeTexture(['#8a5a32', '#6b4424', '#7a4e2c', '#5a3a1e']) }),
    );
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.1, 0.075).translate(0, 0.02, 0),
      new THREE.MeshLambertMaterial({ map: createStripeTexture(['#3a2a1e', '#5a3f2a', '#2a1e14', '#4a3424']) }),
    );
    this.model.add(handle, head);

    // Llama: plano con fotogramas pixel art precalculados.
    this.frames = createFlameFrames();
    this.flameCanvas = document.createElement('canvas');
    this.flameCanvas.width = FLAME_W;
    this.flameCanvas.height = FLAME_H;
    this.flameContext = this.flameCanvas.getContext('2d');
    this.flameTexture = new THREE.CanvasTexture(this.flameCanvas);
    this.flameTexture.colorSpace = THREE.SRGBColorSpace;
    this.flameTexture.magFilter = THREE.NearestFilter;
    this.flameTexture.minFilter = THREE.NearestFilter;
    this.flameTexture.generateMipmaps = false;
    const flameMaterial = new THREE.MeshBasicMaterial({
      map: this.flameTexture,
      transparent: true,
      alphaTest: 0.5,
      depthWrite: false,
      fog: false,
    });
    flameMaterial.color.setScalar(t.flameBrightness);
    this.flame = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.21), flameMaterial);
    this.flame.position.set(0, 0.16, 0);
    this.model.add(this.flame);
    this.frameIndex = -1;

    // Chispas: puntos de tamaño fijo en píxeles del render interno.
    const count = t.sparkCount;
    this.sparks = Array.from({ length: count }, () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 1 }));
    this.sparkGeometry = new THREE.BufferGeometry();
    this.sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.sparkGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.sparkPoints = new THREE.Points(this.sparkGeometry, new THREE.PointsMaterial({
      size: 2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false,
    }));
    this.sparkPoints.frustumCulled = false;
    this.model.add(this.sparkPoints);
    this.sparkColors = [new THREE.Color(0xfff2b0), new THREE.Color(0xf07b1d), new THREE.Color(0x3a1a10)];

    // Luz en el mundo: siempre presente (intensidad 0 al guardar) para no recompilar shaders.
    this.light = new THREE.PointLight(t.lightColor, 0, t.lightDistance, t.lightDecay);
    this.light.name = 'torch-light';

    this.equip = 0;        // 0 = guardada, 1 = en la mano
    this.bobPhase = 0;
    this.elapsed = 0;
    this.lastYaw = null;
    this.sway = 0;
    this.offset = new THREE.Vector3();
    this.tmpColor = new THREE.Color();
  }

  get visible() {
    return this.equip > 0.001;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  // active: si la antorcha está seleccionada. player: controlador. day: estado del ciclo.
  update(dt, { active, player, camera, day }) {
    const t = CONFIG.torch;
    this.elapsed += dt;
    this.equip = THREE.MathUtils.clamp(this.equip + (active ? dt : -dt) * t.equipSpeed, 0, 1);
    const eased = this.equip * this.equip * (3 - 2 * this.equip);
    this.model.visible = this.visible;

    // Parpadeo compartido por la luz del mundo y la de la mano.
    const e = this.elapsed;
    const flicker = 1 + t.flicker * (0.55 * Math.sin(e * 13.7) + 0.3 * Math.sin(e * 23.1 + 1.3) + 0.3 * (this.random() - 0.5));
    this.light.intensity = t.lightIntensity * flicker * eased;
    this.handLight.intensity = t.handLightIntensity * flicker * eased;

    // Posición de la luz: a la altura de la llama, delante-derecha de la cámara.
    this.offset.set(t.lightOffset.x, t.lightOffset.y, t.lightOffset.z).applyQuaternion(camera.quaternion);
    this.light.position.copy(camera.position).add(this.offset);
    this.light.position.x += Math.sin(e * 9.1) * t.lightJitter;
    this.light.position.y += Math.sin(e * 11.3 + 2) * t.lightJitter;

    if (!this.visible) return;

    // Luz ambiente de la vista = ambiente del mundo.
    this.ambient.color.copy(day.ambientSky).lerp(day.lightColor, 0.3);
    this.ambient.intensity = day.ambientIntensity * 0.9 + day.lightIntensity * 0.25;

    // Balanceo al caminar y retardo al girar.
    const speed = player.flying ? 0 : player.horizontalSpeed;
    const moving = Math.min(speed / CONFIG.player.walkSpeed, 1.5);
    this.bobPhase += dt * speed * t.bobFrequency;
    if (this.lastYaw === null) this.lastYaw = player.yaw;
    const yawDelta = THREE.MathUtils.clamp(player.yaw - this.lastYaw, -0.2, 0.2);
    this.lastYaw = player.yaw;
    this.sway += (yawDelta * t.swayAmount - this.sway) * Math.min(1, dt * 10);

    const base = t.viewPosition;
    this.model.position.set(
      base.x + Math.sin(this.bobPhase) * t.bobAmount * moving + this.sway,
      base.y - Math.abs(Math.cos(this.bobPhase)) * t.bobAmount * 1.4 * moving - (1 - eased) * 0.5,
      base.z,
    );
    this.model.rotation.set(t.viewRotation.x, t.viewRotation.y, t.viewRotation.z + this.sway * 2);
    // La llama siempre vertical y de cara a la cámara.
    this.flame.rotation.set(-t.viewRotation.x, 0, -t.viewRotation.z - this.sway * 2);
    const h = t.handLightOffset;
    this.handLight.position.copy(this.model.position).add(this.offset.set(h.x, h.y, h.z));

    this.updateFlame();
    this.updateSparks(dt);
  }

  updateFlame() {
    const index = Math.floor(this.elapsed * CONFIG.torch.flameFps) % this.frames.length;
    if (index === this.frameIndex) return;
    this.frameIndex = index;
    this.flameContext.putImageData(this.frames[index], 0, 0);
    this.flameTexture.needsUpdate = true;
  }

  updateSparks(dt) {
    const position = this.sparkGeometry.attributes.position;
    const color = this.sparkGeometry.attributes.color;
    this.sparks.forEach((spark, i) => {
      spark.life -= dt;
      if (spark.life <= 0) {
        spark.maxLife = 0.4 + this.random() * 0.7;
        spark.life = spark.maxLife * this.random();
        spark.position.set((this.random() - 0.5) * 0.05, 0.12 + this.random() * 0.06, (this.random() - 0.5) * 0.03);
        spark.velocity.set((this.random() - 0.5) * 0.08, 0.18 + this.random() * 0.2, 0);
      }
      spark.velocity.x += (this.random() - 0.5) * dt * 0.6;
      spark.position.addScaledVector(spark.velocity, dt);
      position.setXYZ(i, spark.position.x, spark.position.y, spark.position.z);

      const age = 1 - spark.life / spark.maxLife;
      const [hot, warm, cold] = this.sparkColors;
      if (age < 0.5) this.tmpColor.copy(hot).lerp(warm, age * 2);
      else this.tmpColor.copy(warm).lerp(cold, (age - 0.5) * 2);
      color.setXYZ(i, this.tmpColor.r * 2, this.tmpColor.g * 2, this.tmpColor.b * 2);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;
  }
}

// --- Texturas ----------------------------------------------------------------

function createStripeTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  const random = createRandom(deriveSeed(CONFIG.seed, colors.join('')));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = colors[Math.floor(random() * colors.length)];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

const FLAME_W = 16;
const FLAME_H = 24;
const FLAME_PALETTE = [
  [255, 246, 200], // núcleo
  [255, 201, 60],
  [240, 123, 29],
  [179, 38, 30],   // borde
];

// Fotogramas en bucle: ruido que sube con periodo igual al número de fotogramas.
function createFlameFrames() {
  const { flameFrames } = CONFIG.torch;
  const noise = new ValueNoise2D(deriveSeed(CONFIG.seed, 'flame'));
  const period = 8;
  const frames = [];
  for (let f = 0; f < flameFrames; f++) {
    const image = new ImageData(FLAME_W, FLAME_H);
    const scroll = (f / flameFrames) * period;
    for (let py = 0; py < FLAME_H; py++) {
      const y = 1 - py / (FLAME_H - 1); // 0 abajo, 1 arriba
      const halfWidth = 6.5 * Math.pow(Math.max(0, 1 - y), 0.65) * (0.55 + 0.45 * Math.min(1, y * 4));
      for (let px = 0; px < FLAME_W; px++) {
        const n = noise.fbm(px * 0.35, py * 0.33 + scroll, { octaves: 2, period });
        const sway = (noise.noise(y * 2, scroll, period) - 0.5) * 3 * y;
        const dx = Math.abs(px + 0.5 - FLAME_W / 2 - sway);
        const shape = 1 - dx / Math.max(halfWidth, 0.01);
        const v = shape * (0.55 + 0.9 * n) - y * 0.35;
        let color = null;
        if (v > 0.8) color = FLAME_PALETTE[0];
        else if (v > 0.55) color = FLAME_PALETTE[1];
        else if (v > 0.32) color = FLAME_PALETTE[2];
        else if (v > 0.14) color = FLAME_PALETTE[3];
        if (!color) continue;
        const o = (py * FLAME_W + px) * 4;
        image.data[o] = color[0];
        image.data[o + 1] = color[1];
        image.data[o + 2] = color[2];
        image.data[o + 3] = 255;
      }
    }
    frames.push(image);
  }
  return frames;
}
