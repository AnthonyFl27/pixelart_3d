import { CONFIG } from '../config.js';

// Audio procedural con Web Audio (sin archivos): viento de fondo y pasos.
// El AudioContext se crea en `start()`, que debe llamarse tras un gesto del usuario.
export class AmbientAudio {
  constructor() {
    this.context = null;
    this.muted = !CONFIG.audio.enabled;
  }

  start() {
    if (!CONFIG.audio.enabled) return;
    if (this.context) {
      this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    this.context = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
    this.master.connect(ctx.destination);

    this.whiteNoise = createNoiseBuffer(ctx, 1, 'white');
    this.createWind(ctx);
  }

  suspend() {
    this.context?.suspend();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : CONFIG.audio.masterVolume, this.context.currentTime, 0.05);
    }
    return this.muted;
  }

  // Viento: ruido marrón filtrado con volumen y filtro modulados lentamente.
  createWind(ctx) {
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx, 4, 'brown');
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = CONFIG.audio.windVolume;

    // LFOs: ráfagas de viento.
    const gustLfo = ctx.createOscillator();
    gustLfo.frequency.value = 0.07;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = CONFIG.audio.windVolume * 0.6;
    gustLfo.connect(gustDepth).connect(gain.gain);

    const filterLfo = ctx.createOscillator();
    filterLfo.frequency.value = 0.11;
    const filterDepth = ctx.createGain();
    filterDepth.gain.value = 250;
    filterLfo.connect(filterDepth).connect(filter.frequency);

    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    gustLfo.start();
    filterLfo.start();
  }

  // Paso: ráfaga corta de ruido filtrado; más grave y seca en tierra que en césped.
  step(surface) {
    const ctx = this.context;
    if (!ctx || this.muted || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.whiteNoise;
    source.playbackRate.value = 0.85 + Math.random() * 0.3;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const volume = CONFIG.audio.stepVolume * (0.8 + Math.random() * 0.4);
    let duration;
    if (surface === 'dirt') {
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      duration = 0.09;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 2600;
      filter.Q.value = 0.8;
      duration = 0.14;
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now, Math.random() * 0.5, duration + 0.02);
  }
}

function createNoiseBuffer(ctx, seconds, type) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'brown') {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}
