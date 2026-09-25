import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Reloj del mundo. `time` va de 0 a 1 (0 = medianoche, 0.25 = 6:00, 0.5 = mediodía).
// El sol recorre un círculo inclinado; la luna va en el punto opuesto.
// Los colores y luces se interpolan entre keyframes según la elevación del sol.

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const COLOR_KEYS = [
  'zenith', 'horizon', 'glow', 'sunDisc', 'sunLight', 'ambientSky', 'ambientGround', 'fill', 'cloudLit', 'cloudShade',
];
const NUMBER_KEYS = ['sunIntensity', 'moonIntensity', 'ambientIntensity', 'fillIntensity', 'stars'];

export class DayCycle {
  constructor() {
    const c = CONFIG.dayCycle;
    this.time = c.startTime;
    this.keyframes = [...c.keyframes]
      .sort((a, b) => a.elevation - b.elevation)
      .map((k) => {
        const frame = { elevation: k.elevation };
        for (const key of COLOR_KEYS) frame[key] = new THREE.Color(k[key]);
        for (const key of NUMBER_KEYS) frame[key] = k[key];
        return frame;
      });

    // Eje de rotación del cielo (normal al plano de la órbita) para las estrellas.
    this.axis = new THREE.Vector3(0, 0, 1).applyAxisAngle(X_AXIS, -c.orbitTilt).applyAxisAngle(Y_AXIS, c.orbitYaw);
    this.moonLightColor = new THREE.Color(c.moonLightColor);

    this.state = {
      time: 0,
      hours: 0,
      phase: '',
      sunDirection: new THREE.Vector3(),
      moonDirection: new THREE.Vector3(),
      lightDirection: new THREE.Vector3(),
      lightColor: new THREE.Color(),
      lightIntensity: 0,
      daylight: 0, // 0 = noche cerrada, 1 = pleno día
      starRotation: new THREE.Matrix3(),
    };
    for (const key of COLOR_KEYS) this.state[key] = new THREE.Color();
    for (const key of NUMBER_KEYS) this.state[key] = 0;

    this.rotation = new THREE.Matrix4();
    this.update(0);
  }

  update(dt) {
    const c = CONFIG.dayCycle;
    this.time = (this.time + dt / c.dayLength) % 1;
    const s = this.state;
    s.time = this.time;
    s.hours = this.time * 24;
    s.phase = phaseName(s.hours);

    const angle = (this.time - 0.25) * Math.PI * 2;
    s.sunDirection
      .set(Math.cos(angle), Math.sin(angle), 0)
      .applyAxisAngle(X_AXIS, -c.orbitTilt)
      .applyAxisAngle(Y_AXIS, c.orbitYaw);
    s.moonDirection.copy(s.sunDirection).negate();

    this.interpolate(s.sunDirection.y);

    // La luz con sombras la da el astro que está sobre el horizonte.
    const sunUp = s.sunDirection.y >= 0;
    s.lightDirection.copy(sunUp ? s.sunDirection : s.moonDirection);
    s.lightDirection.y = Math.max(s.lightDirection.y, c.minLightElevation);
    s.lightDirection.normalize();
    if (sunUp) {
      s.lightColor.copy(s.sunLight);
      s.lightIntensity = s.sunIntensity;
    } else {
      s.lightColor.copy(this.moonLightColor);
      s.lightIntensity = s.moonIntensity;
    }
    s.daylight = THREE.MathUtils.smoothstep(s.sunDirection.y, -0.1, 0.2);

    // Rotación de la esfera celeste: estrellas fijas respecto al sol.
    this.rotation.makeRotationAxis(this.axis, -angle);
    s.starRotation.setFromMatrix4(this.rotation);
  }

  interpolate(elevation) {
    const frames = this.keyframes;
    let a = frames[0];
    let b = frames[0];
    if (elevation >= frames[frames.length - 1].elevation) a = b = frames[frames.length - 1];
    for (let i = 0; i < frames.length - 1; i++) {
      if (elevation >= frames[i].elevation && elevation <= frames[i + 1].elevation) {
        a = frames[i];
        b = frames[i + 1];
        break;
      }
    }
    const t = a === b ? 0 : THREE.MathUtils.smoothstep(elevation, a.elevation, b.elevation);
    const s = this.state;
    for (const key of COLOR_KEYS) s[key].copy(a[key]).lerp(b[key], t);
    for (const key of NUMBER_KEYS) s[key] = a[key] + (b[key] - a[key]) * t;
  }

  // "HH:MM"
  get clock() {
    const minutes = Math.floor(this.state.hours * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
}

function phaseName(hours) {
  let name = CONFIG.dayCycle.phases[0].name;
  for (const phase of CONFIG.dayCycle.phases) {
    if (hours >= phase.from) name = phase.name;
  }
  return name;
}
