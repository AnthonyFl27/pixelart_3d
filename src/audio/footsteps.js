import { CONFIG } from '../config.js';

// Síntesis de pasos por superficie. Cada paso son dos capas (talón + planta)
// de ruido filtrado con envolvente suave; la piedra añade un golpe tonal grave.
// Todo pasa por un bus con paso bajo y compresor para evitar agudos chillones.
export class Footsteps {
  constructor(ctx, destination) {
    const cfg = CONFIG.footsteps;
    this.ctx = ctx;
    this.buffers = {
      pink: createNoiseBuffer(ctx, 1, 'pink'),
      brown: createNoiseBuffer(ctx, 1, 'brown'),
    };

    this.input = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = cfg.busLowpass;
    lowpass.Q.value = 0.5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    this.output = ctx.createGain();
    this.output.gain.value = cfg.volume;
    this.input.connect(lowpass).connect(compressor).connect(this.output).connect(destination);
  }

  // intensity: 1 = andar, >1 = correr o aterrizar.
  play(surface, intensity = 1) {
    const { surfaces, aliases } = CONFIG.footsteps;
    const profile = surfaces[surface] ?? surfaces[aliases[surface]] ?? surfaces.grass;
    const now = this.ctx.currentTime + 0.005;
    this.playLayer(profile.heel, now, intensity);
    this.playLayer(profile.toe, now + profile.toeDelay * vary(0.25), intensity * 0.8);
    if (profile.tone) this.playTone(profile.tone, now, intensity);
  }

  playLayer(layer, time, intensity) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.buffers[layer.noise];
    source.playbackRate.value = vary(0.1);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = layer.highpass;

    const filter = ctx.createBiquadFilter();
    filter.type = layer.filter;
    filter.frequency.value = layer.frequency * vary(0.15);
    filter.Q.value = layer.q;

    const gain = ctx.createGain();
    const peak = layer.gain * intensity * vary(0.15);
    const attack = layer.attack;
    const decay = layer.decay * vary(0.15);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.setTargetAtTime(0, time + attack, decay / 3);

    source.connect(highpass).connect(filter).connect(gain).connect(this.input);
    source.start(time, Math.random() * 0.6, attack + decay * 1.5);
  }

  // Golpe sordo: seno grave con caída de tono.
  playTone(tone, time, intensity) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const frequency = tone.frequency * vary(0.12);
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(frequency * tone.drop, time + tone.decay);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(tone.gain * intensity * vary(0.15), time + 0.004);
    gain.gain.setTargetAtTime(0, time + 0.004, tone.decay / 3);

    osc.connect(gain).connect(this.input);
    osc.start(time);
    osc.stop(time + tone.decay * 1.5);
  }
}

// Factor aleatorio 1 ± amount.
function vary(amount) {
  return 1 + (Math.random() * 2 - 1) * amount;
}

export function createNoiseBuffer(ctx, seconds, type) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Ruido rosa (Paul Kellet, versión económica) y marrón (integrado).
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  return buffer;
}
