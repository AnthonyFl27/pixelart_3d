import { CONFIG } from '../config.js';

// Acústica de zonas (spec v3, RF-423): dos buses entre las fuentes y el bus maestro.
// - `local`: pasos y efectos del jugador y del interior. Seco + envío a una reverberación
//   de habitación pequeña (convolución con respuesta al impulso procedural) que sube al
//   entrar en la cabaña.
// - `outdoor`: viento, agua y trinos. Dentro de la cabaña pasa por un paso bajo y baja de
//   volumen; con una puerta abierta la amortiguación es menor.
// `update()` detecta si el jugador está en una zona interior y cuánto están abiertas las
// puertas (0 cerradas … 1 abiertas) y mueve los parámetros con suavidad.
export class Acoustics {
  constructor(ctx, destination) {
    const a = CONFIG.audio.acoustics;
    this.ctx = ctx;

    this.local = ctx.createGain();
    this.local.connect(destination);
    this.roomSend = ctx.createGain();
    this.roomSend.gain.value = 0;
    const convolver = ctx.createConvolver();
    convolver.buffer = createRoomImpulse(ctx, a.room);
    const wet = ctx.createGain();
    wet.gain.value = a.room.wet;
    this.local.connect(this.roomSend).connect(convolver).connect(wet).connect(destination);

    this.outdoor = ctx.createGain();
    this.outdoorFilter = ctx.createBiquadFilter();
    this.outdoorFilter.type = 'lowpass';
    this.outdoorFilter.frequency.value = a.openLowpass;
    this.outdoorFilter.Q.value = 0.5;
    this.outdoorGain = ctx.createGain();
    this.outdoor.connect(this.outdoorFilter).connect(this.outdoorGain).connect(destination);

    this.indoor = 0;       // 0 fuera … 1 dentro (suavizado)
    this.openness = 0;     // apertura de la puerta más abierta de la zona
    this.muffle = 0;       // amortiguación aplicada al exterior
    this.zone = null;
    this.started = false;
  }

  // zone: zona interior del jugador o null; doors: [{ progress }] de esa construcción.
  update(dt, { zone, doors = [] }) {
    const a = CONFIG.audio.acoustics;
    this.zone = zone;
    // La primera vez (al empezar dentro o fuera) sin fundido.
    const blend = this.started ? Math.min(1, dt / a.fadeTime) : 1;
    this.started = true;
    this.indoor += ((zone ? 1 : 0) - this.indoor) * blend;
    this.openness = doors.reduce((max, door) => Math.max(max, door.progress), 0);
    this.muffle = this.indoor * (1 - this.openness * a.doorLeak);

    const now = this.ctx.currentTime;
    // Paso bajo con interpolación logarítmica (se oye lineal).
    const frequency = a.openLowpass * Math.pow(a.muffleLowpass / a.openLowpass, this.muffle);
    this.outdoorFilter.frequency.setTargetAtTime(frequency, now, 0.05);
    this.outdoorGain.gain.setTargetAtTime(1 - this.muffle * (1 - a.muffleGain), now, 0.05);
    this.roomSend.gain.setTargetAtTime(this.indoor * a.room.send, now, 0.05);
  }

  // Texto para el HUD.
  get state() {
    if (!this.zone) return 'exterior';
    return `${this.zone.name} puerta ${Math.round(this.openness * 100)}% amort ${this.muffle.toFixed(2)}`;
  }
}

// Respuesta al impulso de una sala: reflexiones tempranas discretas y cola de ruido
// estéreo con caída exponencial (`decay`) que pierde agudos con el tiempo (`damping`:
// 0 sin filtro … 1 muy apagada). `early`: número de reflexiones en los primeros `predelay` s.
export function createRoomImpulse(ctx, { duration, decay, damping = 0, early = 0, predelay = 0.02 }) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      // El filtro de un polo se cierra a medida que avanza la cola.
      const k = 1 - damping * Math.min(0.97, t * 1.5);
      low += (white - low) * k;
      data[i] = low * Math.pow(1 - t, decay);
    }
    for (let r = 0; r < early; r++) {
      const i = Math.floor(rate * predelay * (0.2 + Math.random() * 0.8));
      if (i < length) data[i] += (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4) * (1 - r / (early + 1));
    }
  }
  return buffer;
}
