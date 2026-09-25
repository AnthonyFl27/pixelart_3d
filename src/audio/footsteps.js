import { CONFIG } from '../config.js';

// Síntesis de pasos por superficie. Cada paso son dos capas (talón + planta)
// de ruido filtrado con envolvente suave, más capas opcionales según el perfil:
// - `tone`: golpe tonal grave (piedra, cuerpo hueco de la madera).
// - `creak`: crujido ocasional de tablón (madera, con probabilidad `chance`).
// - `grains`: chasquidos cortos repartidos en el tiempo (grava).
// - `squelch`: banda de ruido que barre hacia arriba (barro húmedo).
// - `bubbles`: senos cortos con subida de tono (chapoteo en el agua).
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
    if (profile.creak && Math.random() < profile.creak.chance) this.playCreak(profile.creak, now + profile.toeDelay, intensity);
    if (profile.grains) this.playGrains(profile.grains, now, intensity);
    if (profile.squelch) this.playSquelch(profile.squelch, now + profile.toeDelay * 0.5, intensity);
    if (profile.bubbles) this.playBubbles(profile.bubbles, now, intensity);
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

  // Crujido de tablón: diente de sierra en banda estrecha con el tono derivando y
  // "tirones" que cortan el volumen.
  playCreak(creak, time, intensity) {
    const ctx = this.ctx;
    const duration = range(creak.duration);
    const base = range(creak.frequency);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, time);
    osc.frequency.linearRampToValueAtTime(base * vary(creak.glide), time + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(base * vary(creak.glide), time + duration);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = base * 2.2;
    band.Q.value = creak.q;
    const flutter = ctx.createOscillator();
    flutter.type = 'square';
    flutter.frequency.value = range(creak.flutter);
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.6;
    flutter.connect(depth).connect(tremolo.gain);
    const envelope = ctx.createGain();
    const peak = creak.gain * intensity * vary(0.3);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(peak, time + duration * 0.3);
    envelope.gain.linearRampToValueAtTime(0, time + duration);
    osc.connect(band).connect(tremolo).connect(envelope).connect(this.input);
    for (const node of [osc, flutter]) {
      node.start(time);
      node.stop(time + duration + 0.05);
    }
  }

  // Grava: `count` chasquidos de ruido en banda repartidos en `spread` segundos.
  playGrains(grains, time, intensity) {
    const count = Math.round(range(grains.count));
    for (let i = 0; i < count; i++) {
      const start = time + Math.pow(Math.random(), 1.6) * grains.spread;
      this.playBurst('pink', 'bandpass', range(grains.frequency), grains.q, grains.gain * intensity * (0.4 + Math.random() * 0.6), start, 0.001, grains.decay);
    }
  }

  // Barro: ruido marrón en banda que sube de tono (la bota se despega).
  playSquelch(squelch, time, intensity) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.buffers.brown;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = squelch.q;
    const [low, high] = squelch.frequency;
    filter.frequency.setValueAtTime(low * vary(0.15), time);
    filter.frequency.exponentialRampToValueAtTime(high * vary(0.15), time + squelch.duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(squelch.gain * intensity * vary(0.2), time + squelch.duration * 0.4);
    envelope.gain.linearRampToValueAtTime(0, time + squelch.duration);
    source.connect(filter).connect(envelope).connect(this.input);
    source.start(time, Math.random() * 0.5, squelch.duration + 0.02);
  }

  // Agua: burbujas (seno con subida rápida de tono) tras el chapoteo.
  playBubbles(bubbles, time, intensity) {
    const ctx = this.ctx;
    const count = Math.round(range(bubbles.count));
    for (let i = 0; i < count; i++) {
      const start = time + bubbles.delay + Math.random() * bubbles.spread;
      const frequency = range(bubbles.frequency);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      osc.frequency.exponentialRampToValueAtTime(frequency * (1.5 + Math.random() * 0.8), start + 0.04);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(bubbles.gain * intensity * (0.4 + Math.random() * 0.6), start + 0.004);
      envelope.gain.setTargetAtTime(0, start + 0.01, 0.015);
      osc.connect(envelope).connect(this.input);
      osc.start(start);
      osc.stop(start + 0.08);
    }
  }

  // Ráfaga de ruido filtrado corta.
  playBurst(noise, type, frequency, q, gain, time, attack, decay) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.buffers[noise];
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.setTargetAtTime(0, time + attack, decay);
    source.connect(filter).connect(envelope).connect(this.input);
    source.start(time, Math.random() * 0.6, attack + decay * 6);
  }
}

function range([min, max]) {
  return min + Math.random() * (max - min);
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
