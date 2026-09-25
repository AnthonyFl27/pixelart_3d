import { CONFIG } from '../config.js';
import { createNoiseBuffer } from './footsteps.js';
import { createRoomImpulse } from './acoustics.js';

// Sonido de la radio (spec v3, 4.14):
//   <audio loop> → MediaElementAudioSourceNode → música ┐
//   estática de sintonización + crepitado ──────────────┴→ EQ de altavoz pequeño
//   (paso alto, realce de medios, paso bajo) → saturación suave → PannerNode en la radio
//   → seco (bajo) + reverberación de habitación (convolución) + eco con realimentación
//   filtrada → amortiguación de zona (paso bajo fuera de la cabaña) → salida.
// La canción se reproduce por streaming (el elemento <audio> no decodifica la pista
// entera). Si el archivo falla, `missing` pasa a true (`failure` dice por qué) y la radio
// solo emite estática; al volver a encenderla se reintenta la carga. Si el navegador
// bloquea la reproducción fuera de un gesto del usuario, se reintenta con la siguiente
// tecla o clic.
export class RadioChain {
  constructor(ctx, destination, position) {
    const r = CONFIG.audio.radio;
    this.ctx = ctx;
    this.noise = createNoiseBuffer(ctx, 3, 'pink');
    this.missing = false;
    this.failure = null;   // motivo del fallo del archivo (HUD)
    this.blocked = false;  // play() rechazado por la política de reproducción automática
    this.wantsPlay = false;
    this.requested = false;
    this.pauseTimer = 0;
    this.popTimer = 0;
    this.sweepTimer = 0;
    this.crackling = false;
    this.drifting = false;
    this.resumeOnStart = false;

    // Salida y amortiguación de zona.
    this.output = ctx.createGain();
    this.output.gain.value = r.volume;
    this.output.connect(destination);
    this.zoneFilter = ctx.createBiquadFilter();
    this.zoneFilter.type = 'lowpass';
    this.zoneFilter.frequency.value = 20000;
    this.zoneFilter.Q.value = 0.5;
    this.zoneFilter.connect(this.output);

    // Espacio: panner → seco + reverb + eco.
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'equalpower';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = r.refDistance;
    this.panner.rolloffFactor = r.rolloff;
    this.panner.maxDistance = r.maxDistance;
    setPosition(this.panner, position);
    this.dry = ctx.createGain();
    this.dry.gain.value = r.dry;
    this.panner.connect(this.dry).connect(this.zoneFilter);
    const convolver = ctx.createConvolver();
    convolver.buffer = createRoomImpulse(ctx, r.reverb);
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = r.reverb.wet;
    this.panner.connect(convolver).connect(this.reverbWet).connect(this.zoneFilter);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = r.echo.delay;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = r.echo.lowpass;
    const feedback = ctx.createGain();
    feedback.gain.value = r.echo.feedback;
    const echoWet = ctx.createGain();
    echoWet.gain.value = r.echo.wet;
    this.panner.connect(delay).connect(echoFilter).connect(feedback).connect(delay);
    echoFilter.connect(echoWet).connect(this.zoneFilter);

    // Altavoz antiguo: EQ y saturación.
    this.mix = ctx.createGain();
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = r.eq.highpass;
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = r.eq.mid;
    mid.Q.value = r.eq.midQ;
    mid.gain.value = r.eq.midGain;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = r.eq.lowpass;
    const shaper = ctx.createWaveShaper();
    shaper.curve = createSaturationCurve(r.drive);
    shaper.oversample = '2x';
    this.mix.connect(highpass).connect(mid).connect(lowpass).connect(shaper).connect(this.panner);

    // Música: elemento <audio> en streaming.
    this.element = new Audio();
    this.element.loop = true;
    this.element.preload = 'none';
    this.element.addEventListener('error', () => {
      this.missing = true;
      this.failure = MEDIA_ERRORS[this.element.error?.code] ?? 'error';
    });
    this.music = ctx.createGain();
    this.music.gain.value = 0;
    ctx.createMediaElementSource(this.element).connect(this.music).connect(this.mix);

    // Estática: banda de ruido que barre, silbido heterodino y chasquidos.
    this.staticBus = ctx.createGain();
    this.staticBus.gain.value = 0;
    this.staticBus.connect(this.mix);
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    this.band = ctx.createBiquadFilter();
    this.band.type = 'bandpass';
    this.band.frequency.value = r.static.band[0];
    this.band.Q.value = r.static.q;
    source.connect(this.band).connect(this.staticBus);
    source.start();
    this.whistle = ctx.createOscillator();
    this.whistle.type = 'sine';
    this.whistleGain = ctx.createGain();
    this.whistleGain.gain.value = 0;
    this.whistle.connect(this.whistleGain).connect(this.staticBus);
    this.whistle.start();
    // Los chasquidos no pasan por la banda (van directos a la mezcla).
    this.pops = ctx.createGain();
    this.pops.connect(this.mix);
  }

  // Estática de sintonización durante `duration` s (la música sigue en silencio).
  tune(duration) {
    const s = CONFIG.audio.radio.static;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    if (!this.requested || this.missing) {
      // Empieza a cargar la canción mientras suena la estática (o reintenta tras un fallo).
      this.requested = true;
      this.missing = false;
      this.failure = null;
      this.element.src = CONFIG.radio.src;
      this.element.preload = 'auto';
      this.element.load();
    }
    this.pauseTimer = 0;
    this.crackling = false;
    this.drifting = false;
    fadeTo(this.music.gain, 0, now, 0.02);
    fadeTo(this.staticBus.gain, s.gain, now, 0.03);
    // Barrido: saltos de banda al azar.
    this.band.frequency.cancelScheduledValues(now);
    for (let t = 0; t < duration; t += range(s.sweepStep)) {
      this.band.frequency.setTargetAtTime(range(s.band), now + t, 0.08);
    }
    // Silbidos que se deslizan de tono al cruzar emisoras.
    const whistles = Math.round(range(s.whistles));
    this.whistle.frequency.cancelScheduledValues(now);
    this.whistleGain.gain.cancelScheduledValues(now);
    this.whistleGain.gain.setValueAtTime(0, now);
    for (let i = 0; i < whistles; i++) {
      const start = now + (i + Math.random() * 0.6) * (duration / whistles);
      const length = Math.min(duration / whistles, 0.3 + Math.random() * 0.5);
      this.whistle.frequency.setValueAtTime(range(s.whistle), start);
      this.whistle.frequency.exponentialRampToValueAtTime(range(s.whistle), start + length);
      this.whistleGain.gain.setValueAtTime(0, start);
      this.whistleGain.gain.linearRampToValueAtTime(s.whistleGain, start + length * 0.3);
      this.whistleGain.gain.linearRampToValueAtTime(0, start + length);
    }
    const clicks = Math.round(range(s.clicks));
    for (let i = 0; i < clicks; i++) this.pop(now + Math.random() * duration, s.clickGain * (0.3 + Math.random() * 0.7));
  }

  // Tras la sintonización: fundido cruzado hacia la canción, con crepitado leve.
  startMusic(fade) {
    const r = CONFIG.audio.radio;
    const now = this.ctx.currentTime;
    this.play();
    fadeTo(this.music.gain, r.musicGain, now, fade / 3);
    fadeTo(this.staticBus.gain, r.crackle.hiss, now, fade / 3);
    this.crackling = true;
  }

  // Reproduce el elemento; si el navegador lo bloquea, lo reintenta en el siguiente gesto.
  play() {
    this.wantsPlay = true;
    this.element.play().then(() => {
      this.blocked = false;
    }).catch((error) => {
      if (this.element.error) {
        this.missing = true;
        this.failure = MEDIA_ERRORS[this.element.error.code] ?? 'error';
      } else if (error?.name === 'NotAllowedError' && !this.blocked) {
        this.blocked = true;
        const retry = () => {
          window.removeEventListener('keydown', retry, true);
          window.removeEventListener('pointerdown', retry, true);
          if (this.wantsPlay) this.play();
          else this.blocked = false;
        };
        window.addEventListener('keydown', retry, true);
        window.addEventListener('pointerdown', retry, true);
      }
    });
  }

  // Sin archivo: estática continua con la banda derivando.
  holdStatic() {
    const now = this.ctx.currentTime;
    fadeTo(this.music.gain, 0, now, 0.05);
    fadeTo(this.staticBus.gain, CONFIG.audio.radio.static.gain * CONFIG.audio.radio.static.noFile, now, 0.2);
    this.crackling = true;
    this.drifting = true;
  }

  // Apagar: fundido corto y pausa del elemento (la canción sigue donde se quedó).
  stop(fade) {
    const now = this.ctx.currentTime;
    this.wantsPlay = false;
    fadeTo(this.music.gain, 0, now, fade / 3);
    fadeTo(this.staticBus.gain, 0, now, fade / 3);
    this.whistleGain.gain.cancelScheduledValues(now);
    this.whistleGain.gain.setTargetAtTime(0, now, fade / 3);
    this.band.frequency.cancelScheduledValues(now);
    this.crackling = false;
    this.drifting = false;
    this.pauseTimer = fade * 1.5;
  }

  // Pausa del juego: el elemento se para y vuelve a sonar al reanudar.
  suspend() {
    this.resumeOnStart = !this.element.paused;
    this.element.pause();
  }

  resume() {
    if (this.resumeOnStart && this.wantsPlay) this.play();
    this.resumeOnStart = false;
  }

  // muffle: 0 en la zona de la radio … 1 fuera con las puertas cerradas.
  update(dt, muffle) {
    const r = CONFIG.audio.radio;
    const o = r.outside;
    const now = this.ctx.currentTime;
    if (this.pauseTimer > 0) {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) this.element.pause();
    }
    this.zoneFilter.frequency.setTargetAtTime(20000 * Math.pow(o.lowpass / 20000, muffle), now, 0.08);
    this.output.gain.setTargetAtTime(r.volume * (1 - muffle * (1 - o.gain)), now, 0.08);
    this.dry.gain.setTargetAtTime(r.dry * (1 - muffle * (1 - o.dry)), now, 0.08);
    this.reverbWet.gain.setTargetAtTime(r.reverb.wet * (1 + muffle * o.reverbBoost), now, 0.08);

    if (this.crackling) {
      this.popTimer -= dt;
      if (this.popTimer <= 0) {
        this.popTimer = -Math.log(1 - Math.random()) / r.crackle.rate;
        this.pop(now + 0.01, r.crackle.gain * (0.3 + Math.random() * 0.7) * (this.drifting ? 2 : 1));
      }
    }
    if (this.drifting) {
      this.sweepTimer -= dt;
      if (this.sweepTimer <= 0) {
        this.sweepTimer = range(r.static.sweepStep) * 3;
        this.band.frequency.setTargetAtTime(range(r.static.band), now, 0.3);
      }
    }
  }

  // Chasquido: ráfaga de ruido muy corta con paso alto.
  pop(time, gain) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200 + Math.random() * 2000;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + 0.001);
    envelope.gain.setTargetAtTime(0, time + 0.001, 0.004 + Math.random() * 0.01);
    source.connect(filter).connect(envelope).connect(this.pops);
    source.start(time, Math.random() * 2.5, 0.08);
  }
}

// Códigos de MediaError → motivo para el HUD.
const MEDIA_ERRORS = { 1: 'carga cancelada', 2: 'error de red', 3: 'no se puede decodificar', 4: 'sin archivo o formato no soportado' };

// Curva tanh normalizada: saturación suave de válvula.
function createSaturationCurve(drive) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

function fadeTo(param, value, time, constant) {
  param.cancelScheduledValues(time);
  param.setValueAtTime(param.value, time);
  param.setTargetAtTime(value, time, constant);
}

function setPosition(panner, { x, y, z }) {
  if (panner.positionX) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    panner.setPosition(x, y, z);
  }
}

function range([min, max]) {
  return min + Math.random() * (max - min);
}
