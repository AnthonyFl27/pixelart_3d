import { CONFIG } from '../config.js';
import { createNoiseBuffer } from './footsteps.js';

// Sonido procedural del riachuelo (Web Audio, sin archivos):
// - Rumor grave (ruido marrón con paso bajo).
// - Burbujeo medio (ruido rosa en una banda que se mueve al azar).
// - Gotas y chapoteos breves en instantes aleatorios.
// - Fuentes extra y más brillantes en los rápidos más cercanos.
// El volumen depende de la distancia a la orilla más cercana; la posición de la fuente
// sigue al punto del cauce más cercano (PannerNode), así el agua suena hacia donde está.
export class WaterAudio {
  constructor(ctx, destination) {
    const w = CONFIG.audio.water;
    this.ctx = ctx;
    this.pink = createNoiseBuffer(ctx, 3, 'pink');
    this.brown = createNoiseBuffer(ctx, 3, 'brown');

    this.output = ctx.createGain();
    this.output.gain.value = 0;
    this.output.connect(destination);

    // Fuente principal en el punto más cercano del cauce.
    this.panner = createPanner(ctx);
    this.panner.connect(this.output);

    const rumble = this.loop(this.brown);
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = w.rumbleLowpass;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = w.rumbleGain;
    rumble.connect(rumbleFilter).connect(rumbleGain).connect(this.panner);

    const babble = this.loop(this.pink);
    this.babbleFilter = ctx.createBiquadFilter();
    this.babbleFilter.type = 'bandpass';
    this.babbleFilter.frequency.value = w.babbleFrequency[0];
    this.babbleFilter.Q.value = w.babbleQ;
    this.babbleGain = ctx.createGain();
    this.babbleGain.gain.value = w.babbleGain;
    babble.connect(this.babbleFilter).connect(this.babbleGain).connect(this.panner);

    // Rápidos: ruido rosa brillante, cada voz con su propio panner.
    this.rapids = Array.from({ length: w.rapidVoices }, () => {
      const source = this.loop(this.pink);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = w.rapidFrequency;
      filter.Q.value = 0.6;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const panner = createPanner(ctx);
      source.connect(filter).connect(gain).connect(panner).connect(destination);
      return { gain, panner };
    });

    this.babbleTimer = 0;
    this.dropletTimer = 0;
    this.volume = 0;
    this.distance = Infinity;
  }

  loop(buffer) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = Math.random() * buffer.duration * 0.5;
    source.start(0, Math.random() * buffer.duration);
    return source;
  }

  // nearest: { x, y, z, distance } punto del cauce más cercano; rapids: [{ x, y, z }].
  update(dt, listener, nearest, rapids) {
    const w = CONFIG.audio.water;
    const now = this.ctx.currentTime;
    this.distance = nearest.distance;
    this.volume = falloff(nearest.distance, w.fullDistance, w.maxDistance, w.curve);
    this.output.gain.setTargetAtTime(this.volume * w.volume, now, 0.1);
    setPosition(this.panner, nearest.x, nearest.y, nearest.z, now);

    // Burbujeo que cambia de tono y fuerza al azar.
    this.babbleTimer -= dt;
    if (this.babbleTimer <= 0) {
      this.babbleTimer = w.babbleDrift * (0.5 + Math.random());
      const [low, high] = w.babbleFrequency;
      this.babbleFilter.frequency.setTargetAtTime(low + Math.random() * (high - low), now, w.babbleDrift * 0.6);
      this.babbleGain.gain.setTargetAtTime(w.babbleGain * (0.6 + Math.random() * 0.6), now, w.babbleDrift * 0.6);
    }

    // Gotas: más frecuentes cuanto más cerca.
    this.dropletTimer -= dt;
    if (this.volume > 0.02 && this.dropletTimer <= 0) {
      this.dropletTimer = (-Math.log(1 - Math.random()) / (w.dropletRate * this.volume));
      this.droplet(now);
    }

    // Rápidos más cercanos.
    const sorted = rapids
      .map((r) => ({ ...r, distance: Math.hypot(r.x - listener.x, r.z - listener.z) }))
      .sort((a, b) => a.distance - b.distance);
    this.rapids.forEach((voice, i) => {
      const rapid = sorted[i];
      const gain = rapid ? falloff(rapid.distance, w.rapidFullDistance, w.rapidMaxDistance, w.curve) * w.rapidGain : 0;
      voice.gain.gain.setTargetAtTime(gain, now, 0.15);
      if (rapid) setPosition(voice.panner, rapid.x, rapid.y, rapid.z, now);
    });
  }

  // "Plip": seno corto con subida rápida de tono.
  droplet(time) {
    const w = CONFIG.audio.water;
    const [low, high] = w.dropletFrequency;
    const start = time + 0.01;
    const frequency = low + Math.random() * (high - low);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);
    osc.frequency.exponentialRampToValueAtTime(frequency * (1.6 + Math.random() * 0.8), start + 0.04);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(w.dropletGain * (0.4 + Math.random() * 0.6), start + 0.004);
    gain.gain.setTargetAtTime(0, start + 0.01, 0.015);
    osc.connect(gain).connect(this.panner);
    osc.start(start);
    osc.stop(start + 0.08);
  }
}

// 1 hasta `full`, 0 desde `max`, con caída suave elevada a `curve`.
function falloff(distance, full, max, curve) {
  if (distance <= full) return 1;
  if (distance >= max) return 0;
  const t = (distance - full) / (max - full);
  return Math.pow(1 - t * t * (3 - 2 * t), curve);
}

// Panner sin atenuación propia (el volumen se controla a mano).
function createPanner(ctx) {
  const panner = ctx.createPanner();
  panner.panningModel = 'equalpower';
  panner.distanceModel = 'linear';
  panner.rolloffFactor = 0;
  return panner;
}

function setPosition(panner, x, y, z, time) {
  if (panner.positionX) {
    panner.positionX.setTargetAtTime(x, time, 0.05);
    panner.positionY.setTargetAtTime(y, time, 0.05);
    panner.positionZ.setTargetAtTime(z, time, 0.05);
  } else {
    panner.setPosition(x, y, z);
  }
}
