import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createHitBox } from './hitBox.js';

// Radio de válvulas (spec v3, 4.14). `E` la enciende: clic, el dial se ilumina en ámbar,
// suena la estática de sintonización (la aguja recorre el dial) y después entra la
// canción con un fundido; `E` de nuevo la apaga con un clic y un fundido breve. Al volver
// a encender se repite la estática y la canción sigue donde se quedó. Sin archivo, solo
// estática. Con varias canciones (CONFIG.radio.tracks), la tecla secundaria
// (CONFIG.interaction.altKey) sintoniza la siguiente: estática breve y la aguja salta a su
// emisora del dial; al acabar una canción pasa sola a la siguiente (`autoAdvance`).
// El sonido lo genera RadioChain (src/audio/radioChain.js).
// Estados: 'off' | 'tuning' | 'playing' | 'static' (sin archivo).
// Datos: { position: centro del dial, rotationY, dialSize: [ancho, alto], hitSize, hitOffset }.

const PROMPTS = { on: 'Encender radio', off: 'Apagar radio', next: 'Cambiar canción' };
const STATUS = { off: 'apagada', tuning: 'estática', playing: 'sonando', static: 'estática' };

export class Radio {
  constructor(data, { interiorLighting }) {
    const r = CONFIG.radio;
    this.name = data.name ?? 'radio';
    this.zone = data.zone ?? null;
    this.interiorLighting = interiorLighting;
    this.object = new THREE.Group();
    this.object.name = `radio-${this.name}`;
    this.object.position.fromArray(data.position);
    this.object.rotation.y = data.rotationY ?? 0;

    // Dial: cristal que se ilumina (sin niebla ni luz) y aguja que lo recorre.
    const [w, h] = data.dialSize ?? [0.22, 0.05];
    this.dialWidth = w;
    this.dialMaterial = new THREE.MeshBasicMaterial({ color: r.dialOff, fog: false, toneMapped: false });
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.dialMaterial);
    this.needle = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.03, h * 0.8),
      new THREE.MeshBasicMaterial({ color: r.needleColor, fog: false }),
    );
    this.needle.position.z = 0.002;
    const hit = createHitBox(data.hitSize ?? [w, h, 0.05], data.hitOffset ?? [0, 0, 0]);
    this.object.add(dial, this.needle, hit);
    this.meshes = [hit];
    this.object.updateMatrixWorld(true);
    this.lightPosition = this.object.localToWorld(new THREE.Vector3(0, 0, r.lightOffset));
    this.soundPosition = this.object.localToWorld(new THREE.Vector3(0, 0.05, -0.08));

    this.state = 'off';
    this.timer = 0;
    this.glow = 0;         // 0 dial apagado … 1 iluminado
    this.tuning = 0.5;     // posición de la aguja (0-1)
    this.tracks = r.tracks;
    this.track = 0;        // índice de la canción en `tracks`
    this.station = this.stationOf(this.track); // donde queda la aguja con la emisora sintonizada
    this.sweep = { from: 0, to: 0, time: 0, length: 1 };
    this.chain = null;
    this.hasAudio = false;
    this.colors = { off: new THREE.Color(CONFIG.radio.dialOff), on: new THREE.Color(CONFIG.radio.dialOn) };
    this.placeNeedle();
  }

  get isOn() {
    return this.state !== 'off';
  }

  get src() {
    return this.tracks[this.track];
  }

  // Estado para el HUD.
  get status() {
    const track = `${this.track + 1}/${this.tracks.length} ${this.src.split('/').pop()}`;
    if (this.isOn && !this.hasAudio) return `${STATUS[this.state]} (sin audio)`;
    if (this.state === 'static') return `${STATUS.static} (${this.chain?.failure ?? 'sin archivo'}: ${this.src})`;
    if (this.state === 'playing' && this.chain?.blocked) return `${STATUS.playing} ${track} (bloqueada: pulsa una tecla)`;
    return this.isOn ? `${STATUS[this.state]} ${track}` : STATUS[this.state];
  }

  prompt() {
    if (!this.isOn) return PROMPTS.on;
    if (this.tracks.length < 2) return PROMPTS.off;
    return { text: PROMPTS.off, alt: { key: CONFIG.interaction.altKey.replace('Key', ''), text: PROMPTS.next } };
  }

  // Emisora de la canción `index`: las canciones se reparten por el dial.
  stationOf(index) {
    const [from, to] = CONFIG.radio.dialRange;
    return from + (to - from) * (index + 0.5) / this.tracks.length;
  }

  interact({ audio }) {
    audio?.playSfx('click', this.soundPosition);
    if (!this.chain && audio) this.chain = audio.createRadio(this.soundPosition);
    this.hasAudio = Boolean(this.chain);
    if (this.isOn) {
      this.state = 'off';
      this.chain?.stop(CONFIG.radio.offFade);
      return;
    }
    this.tuneTo(this.track, CONFIG.radio.tuningTime);
  }

  // Tecla secundaria: con la radio encendida, sintoniza la siguiente canción.
  altInteract({ audio }) {
    if (!this.isOn || this.tracks.length < 2) return;
    audio?.playSfx('click', this.soundPosition);
    this.next();
  }

  next() {
    this.tuneTo((this.track + 1) % this.tracks.length, CONFIG.radio.switchTime);
  }

  // Estática durante `time` s mientras la aguja busca la emisora de la canción `index`.
  tuneTo(index, time) {
    this.track = index;
    this.station = this.stationOf(index);
    this.state = 'tuning';
    this.timer = time;
    this.sweep.time = this.sweep.length;
    this.chain?.tune(time, this.src);
  }

  update(dt, { audio } = {}) {
    const r = CONFIG.radio;
    if (this.state === 'tuning') {
      this.timer -= dt;
      this.moveNeedle(dt);
      if (this.timer <= 0) {
        if (this.chain && !this.chain.missing) {
          this.state = 'playing';
          this.chain.startMusic(r.crossfade);
        } else {
          this.state = 'static';
          this.chain?.holdStatic();
        }
      }
    } else if (this.state === 'playing' && this.chain?.ended) {
      this.next();
    } else if (this.state === 'playing' && this.chain?.missing) {
      // El archivo falló después de empezar (p. ej. no existe): solo estática.
      this.state = 'static';
      this.chain.holdStatic();
    } else if (this.isOn) {
      this.tuning += (this.station - this.tuning) * Math.min(1, dt * 4);
    }
    this.chain?.update(dt, audio?.acoustics?.muffleFor(this.zone) ?? 0);

    this.glow = THREE.MathUtils.clamp(this.glow + (this.isOn ? dt : -dt) / r.dialFade, 0, 1);
    this.dialMaterial.color.lerpColors(this.colors.off, this.colors.on, this.glow);
    this.placeNeedle();
    this.interiorLighting.setLight(r.lightIndex, this.lightPosition, r.lightColor, r.lightIntensity * this.glow, r.lightRange);
  }

  // Sintonización: la aguja salta de un punto a otro del dial buscando la emisora y
  // termina en `station`.
  moveNeedle(dt) {
    const s = this.sweep;
    s.time += dt;
    if (s.time >= s.length) {
      s.from = this.tuning;
      s.to = this.timer < 0.6 ? this.station : Math.random();
      s.time = 0;
      s.length = 0.3 + Math.random() * 0.5;
    }
    const t = s.time / s.length;
    this.tuning = s.from + (s.to - s.from) * t * t * (3 - 2 * t);
  }

  placeNeedle() {
    this.needle.position.x = (this.tuning - 0.5) * this.dialWidth * CONFIG.radio.needleTravel;
  }
}
