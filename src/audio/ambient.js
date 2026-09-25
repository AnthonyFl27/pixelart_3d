import { CONFIG } from '../config.js';
import { Footsteps } from './footsteps.js';

// Audio procedural con Web Audio (sin archivos): viento de fondo y pasos (footsteps.js).
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

    this.createWind(ctx);
    this.footsteps = new Footsteps(ctx, this.master);
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
    source.buffer = createBrownNoiseBuffer(ctx, 4);
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

  // Paso sobre `surface` ('grass' | 'dirt' | 'stone').
  step(surface, intensity = 1) {
    if (!this.footsteps || this.muted || this.context.state !== 'running') return;
    this.footsteps.play(surface, intensity);
  }
}

function createBrownNoiseBuffer(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}
