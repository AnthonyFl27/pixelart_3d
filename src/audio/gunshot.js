import { CONFIG } from '../config.js';
import { createNoiseBuffer } from './footsteps.js';

// Sonidos de la escopeta (spec v3, RF-444, RF-449) sintetizados con Web Audio:
// - Estampido: chasquido inicial, golpe grave con caída de tono y cola de ruido.
// - Al aire libre, ecos retardados y filtrados (rebote en el paisaje); dentro de la
//   cabaña, reverberación de habitación corta (convolución con respuesta generada).
// - Todo el disparo pasa por un compresor para no saturar la mezcla.
// - Recarga y clic en seco, cerca del oyente; tintineo de vainas en su posición.
export class Gunshot {
  // sfx: Sfx (reutiliza tonos, ráfagas y fuentes posicionales).
  constructor(ctx, destination, sfx) {
    const g = CONFIG.audio.gunshot;
    this.ctx = ctx;
    this.sfx = sfx;
    this.noise = {
      pink: createNoiseBuffer(ctx, 3, 'pink'),
      brown: createNoiseBuffer(ctx, 3, 'brown'),
    };

    this.output = ctx.createGain();
    this.output.gain.value = g.volume;
    this.output.connect(destination);
    const k = g.compressor;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = k.threshold;
    this.compressor.knee.value = k.knee;
    this.compressor.ratio.value = k.ratio;
    this.compressor.attack.value = k.attack;
    this.compressor.release.value = k.release;
    this.compressor.connect(this.output);

    // Entrada del estampido: seco + envío al eco exterior + envío a la sala.
    this.input = ctx.createGain();
    this.input.connect(this.compressor);
    this.echoSend = ctx.createGain();
    this.input.connect(this.echoSend);
    for (const echo of g.echoes) {
      const delay = ctx.createDelay(echo.delay + 0.1);
      delay.delayTime.value = echo.delay;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = echo.lowpass;
      const gain = ctx.createGain();
      gain.gain.value = echo.gain;
      this.echoSend.connect(delay).connect(filter).connect(gain).connect(this.compressor);
    }
    this.roomSend = ctx.createGain();
    const convolver = ctx.createConvolver();
    convolver.buffer = createRoomImpulse(ctx, g.room);
    const wet = ctx.createGain();
    wet.gain.value = g.room.wet;
    this.input.connect(this.roomSend).connect(convolver).connect(wet).connect(this.compressor);

    // Mecánica del arma (sin eco): va directa a la salida.
    this.near = ctx.createGain();
    this.near.connect(this.output);
  }

  // indoor: 0 al aire libre … 1 dentro de la cabaña.
  fire({ indoor = 0 } = {}) {
    const g = CONFIG.audio.gunshot;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.005;
    this.echoSend.gain.setValueAtTime(1 - indoor, now);
    this.roomSend.gain.setValueAtTime(indoor, now);

    this.noiseBurst('pink', 'highpass', g.crack.frequency, g.crack.gain, now, 0.001, g.crack.decay, this.input);
    const b = g.boom;
    this.sfx.tone('sine', b.frequency * vary(0.08), b.gain, now, 0.002, b.decay, this.input, b.drop);
    this.noiseBurst('brown', 'lowpass', b.lowpass, b.gain, now, 0.002, b.decay * 1.4, this.input);
    this.noiseBurst('pink', 'lowpass', g.tail.lowpass, g.tail.gain, now + 0.01, 0.01, g.tail.decay, this.input);
  }

  // Gatillo sin cartucho: clic metálico seco.
  dry() {
    const d = CONFIG.audio.gunshot.dry;
    const now = this.ctx.currentTime + 0.005;
    this.noiseBurst('pink', 'bandpass', d.frequency * vary(0.1), d.gain, now, 0.001, 0.006, this.near, 4);
    this.sfx.tone('triangle', d.frequency * 0.6 * vary(0.1), d.gain * 0.3, now, 0.001, 0.012, this.near);
  }

  // Apertura: palanca y cañones que caen sobre la bisagra.
  open() {
    const o = CONFIG.audio.gunshot.open;
    const now = this.ctx.currentTime + 0.005;
    this.noiseBurst('pink', 'bandpass', o.frequency * vary(0.1), o.gain, now, 0.001, 0.01, this.near, 3);
    this.sfx.tone('triangle', o.frequency * 1.4 * vary(0.05), o.gain * 0.2, now + 0.01, 0.001, 0.04, this.near);
    this.noiseBurst('brown', 'lowpass', 500, o.gain * 0.7, now + 0.06, 0.003, 0.03, this.near);
  }

  // Expulsión: roce del extractor y vainas que salen.
  eject() {
    const e = CONFIG.audio.gunshot.eject;
    const now = this.ctx.currentTime + 0.005;
    this.noiseBurst('pink', 'bandpass', e.frequency * vary(0.1), e.gain, now, 0.004, 0.03, this.near, 2);
    this.sfx.tone('triangle', e.frequency * 1.3 * vary(0.1), e.gain * 0.3, now + 0.02, 0.001, 0.05, this.near);
  }

  // Inserción de un cartucho: roce y clic al asentar.
  insert() {
    const i = CONFIG.audio.gunshot.insert;
    const now = this.ctx.currentTime + 0.005;
    this.noiseBurst('pink', 'bandpass', i.frequency * vary(0.1), i.gain * 0.6, now, 0.03, 0.04, this.near, 1.5);
    this.noiseBurst('pink', 'highpass', 2800, i.gain, now + 0.08, 0.001, 0.008, this.near);
  }

  // Cierre: chasquido fuerte.
  close() {
    const c = CONFIG.audio.gunshot.close;
    const now = this.ctx.currentTime + 0.005;
    this.noiseBurst('pink', 'bandpass', c.frequency * vary(0.1), c.gain, now, 0.001, 0.012, this.near, 2);
    this.noiseBurst('brown', 'lowpass', 700, c.gain * 0.8, now, 0.002, 0.04, this.near);
    this.sfx.tone('triangle', c.frequency * 1.9 * vary(0.05), c.gain * 0.15, now, 0.001, 0.05, this.near);
  }

  // Vaina que cae al suelo: tintineo agudo en su posición.
  casing(position) {
    const c = CONFIG.audio.gunshot.casing;
    const now = this.ctx.currentTime + 0.005;
    const output = this.sfx.spatial(position);
    for (const [delay, level] of [[0, 1], [0.07 + Math.random() * 0.05, 0.5], [0.16 + Math.random() * 0.06, 0.25]]) {
      const frequency = c.frequency[0] + Math.random() * (c.frequency[1] - c.frequency[0]);
      this.sfx.tone('sine', frequency, c.gain * level, now + delay, 0.001, 0.03, output);
    }
  }

  noiseBurst(noise, type, frequency, gain, time, attack, decay, output, q = 0.7) {
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
    const duration = Math.min(attack + decay * 6, 2.5);
    source.start(time, Math.random() * (3 - duration), duration);
  }
}

// Respuesta al impulso de una sala pequeña: ruido estéreo con caída exponencial.
function createRoomImpulse(ctx, { duration, decay }) {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

function vary(amount) {
  return 1 + (Math.random() * 2 - 1) * amount;
}
