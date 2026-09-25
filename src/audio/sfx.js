import { CONFIG } from '../config.js';
import { createNoiseBuffer } from './footsteps.js';

// Efectos puntuales sintetizados con Web Audio, situados en el espacio con un PannerNode
// (el oyente es la cámara, ver ambient.js). Cada método crea sus nodos y los deja
// terminar solos.
export class Sfx {
  constructor(ctx, destination) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = CONFIG.audio.sfx.volume;
    this.output.connect(destination);
    this.noise = {
      pink: createNoiseBuffer(ctx, 1, 'pink'),
      brown: createNoiseBuffer(ctx, 1, 'brown'),
    };
  }

  // Fuente posicional en `position` ({ x, y, z }).
  spatial(position) {
    const s = CONFIG.audio.sfx;
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = s.refDistance;
    panner.rolloffFactor = s.rolloff;
    panner.maxDistance = s.maxDistance;
    if (panner.positionX) {
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
    panner.connect(this.output);
    return panner;
  }

  // Chirrido de bisagra: diente de sierra filtrado en banda estrecha cuyo tono deriva
  // durante el giro, con "tirones" (stick-slip) que modulan el volumen.
  creak(position, { duration = 0.6, gain = CONFIG.audio.sfx.creak.gain } = {}) {
    const c = CONFIG.audio.sfx.creak;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const length = Math.max(0.15, duration);
    const base = range(c.frequency);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, now);
    // Deriva del tono en varios tramos al azar.
    const segments = 3 + Math.floor(Math.random() * 3);
    for (let i = 1; i <= segments; i++) {
      osc.frequency.linearRampToValueAtTime(base * (1 + (Math.random() * 2 - 1) * c.glide), now + (i / segments) * length);
    }
    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.setValueAtTime(base * 3.1, now);
    partial.frequency.linearRampToValueAtTime(base * 3.1 * (1 + (Math.random() - 0.5) * c.glide), now + length);
    const partialGain = ctx.createGain();
    partialGain.gain.value = 0.25;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = base * (2 + Math.random());
    band.Q.value = c.q;

    // Tirones: onda cuadrada que abre y cierra el volumen.
    const flutter = ctx.createOscillator();
    flutter.type = 'square';
    flutter.frequency.setValueAtTime(range(c.flutter), now);
    flutter.frequency.linearRampToValueAtTime(range(c.flutter), now + length);
    const flutterDepth = ctx.createGain();
    flutterDepth.gain.value = 0.45;
    const tremolo = ctx.createGain();
    tremolo.gain.value = 0.55;
    flutter.connect(flutterDepth).connect(tremolo.gain);

    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(gain, now + 0.05);
    envelope.gain.setValueAtTime(gain * (0.7 + Math.random() * 0.3), now + length - 0.08);
    envelope.gain.linearRampToValueAtTime(0, now + length + 0.05);

    osc.connect(band);
    partial.connect(partialGain).connect(band);
    band.connect(tremolo).connect(envelope).connect(this.spatial(position));
    const end = now + length + 0.1;
    for (const node of [osc, partial, flutter]) {
      node.start(now);
      node.stop(end);
    }
  }

  // Cierre: golpe grave de la hoja contra el marco, ruido del impacto y el clic
  // metálico del pestillo un instante después.
  slam(position) {
    const s = CONFIG.audio.sfx.slam;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const output = this.spatial(position);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    const f = s.thump * vary(0.1);
    thump.frequency.setValueAtTime(f, now);
    thump.frequency.exponentialRampToValueAtTime(f * 0.6, now + 0.18);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0, now);
    thumpGain.gain.linearRampToValueAtTime(s.thumpGain * vary(0.1), now + 0.004);
    thumpGain.gain.setTargetAtTime(0, now + 0.004, 0.06);
    thump.connect(thumpGain).connect(output);
    thump.start(now);
    thump.stop(now + 0.4);

    this.burst('brown', 'lowpass', s.bodyLowpass * vary(0.1), 0.7, s.bodyGain, now, 0.003, 0.05, output);
    this.burst('pink', 'bandpass', 1600 * vary(0.15), 2, s.bodyGain * 0.35, now + 0.012, 0.002, 0.03, output);

    // Pestillo: chasquido agudo + tintineo metálico breve, y un segundo clic más débil.
    const latch = now + s.latchDelay * vary(0.2);
    for (const [time, level] of [[latch, 1], [latch + 0.035 * vary(0.3), 0.45]]) {
      this.burst('pink', 'highpass', 3200, 0.7, s.latchGain * level, time, 0.001, 0.006, output);
      const tick = ctx.createOscillator();
      tick.type = 'triangle';
      tick.frequency.value = s.latchFrequency * vary(0.08);
      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0, time);
      tickGain.gain.linearRampToValueAtTime(s.latchGain * 0.6 * level, time + 0.001);
      tickGain.gain.setTargetAtTime(0, time + 0.001, 0.012);
      tick.connect(tickGain).connect(output);
      tick.start(time);
      tick.stop(time + 0.1);
    }
  }

  // Ráfaga de ruido filtrado con envolvente rápida.
  burst(noise, type, frequency, q, gain, time, attack, decay, output) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise[noise];
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.setTargetAtTime(0, time + attack, decay);
    source.connect(filter).connect(envelope).connect(output);
    source.start(time, Math.random() * 0.5, attack + decay * 6);
  }
}

function range([min, max]) {
  return min + Math.random() * (max - min);
}

// Factor aleatorio 1 ± amount.
function vary(amount) {
  return 1 + (Math.random() * 2 - 1) * amount;
}
