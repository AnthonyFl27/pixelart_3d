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

  // Clic de interruptor: chasquido agudo y un golpecito grave.
  click(position) {
    const c = CONFIG.audio.sfx.click;
    const now = this.ctx.currentTime + 0.005;
    const output = this.spatial(position);
    this.burst('pink', 'highpass', c.frequency * vary(0.1), 0.7, c.gain, now, 0.001, 0.008, output);
    this.burst('brown', 'lowpass', 400, 0.7, c.gain * 0.6, now, 0.002, 0.02, output);
  }

  // Tubo de imagen encendido (bucle): zumbido de red, silbido agudo y estática.
  // Devuelve { stop() } para apagarlo con un fundido corto.
  tube(position) {
    const t = CONFIG.audio.sfx.tube;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + t.fadeIn);
    envelope.connect(this.spatial(position));

    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = t.hum;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = t.hum * 4;
    const humGain = ctx.createGain();
    humGain.gain.value = t.humGain;
    hum.connect(humFilter).connect(humGain).connect(envelope);

    const whine = ctx.createOscillator();
    whine.type = 'sine';
    whine.frequency.value = t.whine;
    const whineGain = ctx.createGain();
    whineGain.gain.value = t.whineGain;
    whine.connect(whineGain).connect(envelope);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noise.pink;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = t.staticBand;
    band.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = t.staticGain;
    // Crepitar: el volumen de la estática oscila despacio.
    const wobble = ctx.createOscillator();
    wobble.frequency.value = 3.3;
    const wobbleDepth = ctx.createGain();
    wobbleDepth.gain.value = t.staticGain * 0.3;
    wobble.connect(wobbleDepth).connect(noiseGain.gain);
    noise.connect(band).connect(noiseGain).connect(envelope);

    const sources = [hum, whine, noise, wobble];
    for (const source of sources) source.start(now);
    return {
      stop: () => {
        const end = ctx.currentTime;
        envelope.gain.cancelScheduledValues(end);
        envelope.gain.setValueAtTime(envelope.gain.value, end);
        envelope.gain.linearRampToValueAtTime(0, end + t.fadeOut);
        for (const source of sources) source.stop(end + t.fadeOut + 0.05);
      },
    };
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

  // Recoger un objeto: 'metal' (golpe metálico de la escopeta), 'rattle' (traqueteo de
  // cartuchos) o 'lantern' (asa que chirría y el cristal que tintinea).
  pickup(position, { kind = 'metal' } = {}) {
    const p = CONFIG.audio.sfx.pickup;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const output = this.spatial(position);

    if (kind === 'metal') {
      const m = p.metal;
      this.tone('sine', m.thump * vary(0.1), m.thumpGain, now, 0.004, 0.05, output, 0.6);
      this.burst('brown', 'lowpass', 900, 0.7, m.thumpGain * 0.6, now, 0.002, 0.03, output);
      // Resonancia metálica: parciales inarmónicos que se apagan a ritmos distintos.
      m.ring.forEach((frequency, i) => {
        this.tone('triangle', frequency * vary(0.04), m.ringGain / (i + 1), now + 0.005, 0.002, m.ringDecay / (1 + i * 0.4), output);
      });
      this.burst('pink', 'highpass', 3000, 0.7, m.ringGain, now, 0.001, 0.01, output);
      return;
    }

    if (kind === 'rattle') {
      const r = p.rattle;
      const clicks = Math.round(range(r.clicks));
      for (let i = 0; i < clicks; i++) {
        const time = now + Math.pow(Math.random(), 1.4) * r.duration;
        const level = r.gain * (0.4 + Math.random() * 0.6);
        this.burst('pink', 'bandpass', r.frequency * vary(0.35), 3, level, time, 0.001, 0.008, output);
        this.tone('triangle', r.tick * vary(0.25), level * 0.25, time, 0.001, 0.015, output);
      }
      this.burst('brown', 'lowpass', 500, 0.7, r.gain * 0.5, now, 0.004, 0.04, output);
      return;
    }

    const l = p.lantern;
    const squeak = ctx.createOscillator();
    squeak.type = 'sawtooth';
    squeak.frequency.setValueAtTime(l.squeak * vary(0.1), now);
    squeak.frequency.linearRampToValueAtTime(l.squeak * vary(0.2) * 1.2, now + 0.12);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = l.squeak * 2;
    band.Q.value = 6;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(l.squeakGain, now + 0.02);
    envelope.gain.linearRampToValueAtTime(0, now + 0.14);
    squeak.connect(band).connect(envelope).connect(output);
    squeak.start(now);
    squeak.stop(now + 0.2);
    for (const [delay, level] of [[0.1, 1], [0.16, 0.5]]) {
      this.tone('sine', range(l.clink), l.clinkGain * level, now + delay, 0.001, 0.05, output);
    }
    this.burst('brown', 'lowpass', 600, 0.7, l.clinkGain * 0.8, now + 0.1, 0.003, 0.03, output);
  }

  // Sentarse o levantarse (action: 'sit' | 'stand') en un asiento de `material`:
  // 'wood' (silla: golpe y crujido) o 'fabric' (sofá: roce de tela, muelles y golpe sordo).
  seat(position, { action = 'sit', material = 'wood' } = {}) {
    const s = CONFIG.audio.sfx.seat;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const output = this.spatial(position);
    const level = action === 'stand' ? s.standGain : 1;

    if (material === 'fabric') {
      const f = s.fabric;
      const source = ctx.createBufferSource();
      source.buffer = this.noise.pink;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(f.rustle * vary(0.2), now);
      band.frequency.linearRampToValueAtTime(f.rustle * 1.6 * vary(0.2), now + f.duration);
      band.Q.value = 0.9;
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(f.rustleGain * level, now + f.duration * 0.3);
      envelope.gain.linearRampToValueAtTime(0, now + f.duration);
      source.connect(band).connect(envelope).connect(output);
      source.start(now, Math.random() * 0.5, f.duration + 0.02);
      // Al sentarse: golpe sordo del cojín y los muelles que vibran.
      const hit = action === 'sit' ? now + f.duration * 0.35 : now;
      this.tone('sine', f.thump * vary(0.1), f.thumpGain * level, hit, 0.01, 0.05, output, 0.7);
      this.tone('triangle', range(f.spring), f.springGain * level, hit, 0.005, 0.12, output);
      return;
    }

    const w = s.wood;
    const duration = range(w.duration);
    const base = range(w.creak);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.linearRampToValueAtTime(base * vary(0.3), now + duration);
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = base * 2.5;
    band.Q.value = 7;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(w.gain * level, now + duration * 0.25);
    envelope.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(band).connect(envelope).connect(output);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    this.tone('sine', w.thump * vary(0.1), w.thumpGain * level, now, 0.004, 0.04, output, 0.6);
    this.burst('brown', 'lowpass', 600, 0.7, w.thumpGain * 0.8 * level, now, 0.002, 0.03, output);
  }

  // Lámpara de aceite: clic de la rueda de la mecha y soplo de la llama (on: prende;
  // off: se apaga con un soplido más corto).
  lamp(position, { on = true } = {}) {
    const l = CONFIG.audio.sfx.lamp;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const output = this.spatial(position);
    this.burst('pink', 'highpass', l.click * vary(0.1), 0.7, l.clickGain, now, 0.001, 0.006, output);
    this.tone('triangle', l.click * 0.5 * vary(0.1), l.clickGain * 0.2, now, 0.001, 0.01, output);

    const source = ctx.createBufferSource();
    source.buffer = this.noise.brown;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const start = now + 0.05;
    const length = on ? l.whooshTime : l.whooshTime * 0.5;
    filter.frequency.setValueAtTime(l.whoosh * (on ? 0.5 : 1.5), start);
    filter.frequency.exponentialRampToValueAtTime(l.whoosh * (on ? 1.5 : 0.4), start + length);
    const envelope = ctx.createGain();
    const gain = on ? l.whooshGain : l.puffGain;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + (on ? length * 0.4 : 0.01));
    envelope.gain.linearRampToValueAtTime(0, start + length);
    source.connect(filter).connect(envelope).connect(output);
    source.start(start, Math.random() * 0.5, length + 0.02);
  }

  // Tono con ataque y caída exponencial; `drop` baja la frecuencia durante la caída.
  tone(type, frequency, gain, time, attack, decay, output, drop = 1) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    if (drop !== 1) osc.frequency.exponentialRampToValueAtTime(frequency * drop, time + attack + decay * 3);
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.setTargetAtTime(0, time + attack, decay);
    osc.connect(envelope).connect(output);
    osc.start(time);
    osc.stop(time + attack + decay * 6);
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
