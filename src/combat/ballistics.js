import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Perdigones de la escopeta (spec v3, RF-445): cada disparo lanza `pellets` rayos en un
// cono de `spread` grados con alcance `range`, contra los colisionadores (piedra, madera),
// el agua del riachuelo y el terreno. Devuelve los impactos { point, normal, surface,
// collider? }.

const UP = new THREE.Vector3(0, 1, 0);

export class Ballistics {
  constructor({ terrain, colliders }) {
    this.terrain = terrain;
    this.colliders = colliders;
    this.direction = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.up = new THREE.Vector3();
  }

  // origin y forward (unitario) en mundo; random() en [0, 1).
  fire(origin, forward, random) {
    const s = CONFIG.shotgun;
    const maxAngle = THREE.MathUtils.degToRad(s.spread);
    this.side.crossVectors(forward, Math.abs(forward.y) > 0.99 ? this.side.set(1, 0, 0) : UP).normalize();
    this.up.crossVectors(this.side, forward);
    const hits = [];
    for (let i = 0; i < s.pellets; i++) {
      // Reparto uniforme en el disco del cono.
      const angle = maxAngle * Math.sqrt(random());
      const around = random() * Math.PI * 2;
      this.direction.copy(forward).multiplyScalar(Math.cos(angle))
        .addScaledVector(this.side, Math.sin(angle) * Math.cos(around))
        .addScaledVector(this.up, Math.sin(angle) * Math.sin(around))
        .normalize();
      const hit = this.cast(origin, this.direction, s.range);
      if (hit) hits.push(hit);
    }
    return hits;
  }

  // Primer impacto del rayo o null.
  cast(origin, direction, range) {
    let best = null;
    for (const collider of this.colliders) {
      const hit = rayCollider(collider, origin, direction, best ? best.distance : range);
      if (hit) best = hit;
    }
    const ground = this.castGround(origin, direction, best ? best.distance : range);
    if (ground) best = ground;
    if (!best) return null;
    best.point = origin.clone().addScaledVector(direction, best.distance);
    return best;
  }

  // Terreno y agua: avance por pasos y bisección en el cruce con el terreno.
  castGround(origin, direction, far) {
    const { terrainStep } = CONFIG.shotgun;
    const terrain = this.terrain;
    let previous = 0;
    for (let t = terrainStep; t <= far + 1e-6; t += terrainStep) {
      const x = origin.x + direction.x * t;
      const y = origin.y + direction.y * t;
      const z = origin.z + direction.z * t;
      const height = terrain.getHeight(x, z);
      // Agua: solo cerca del suelo (el nivel del agua nunca está muy por encima del lecho).
      if (y - height < 1.5) {
        const level = terrain.waterLevelAt(x, z);
        if (level !== null && y <= level) {
          const distance = direction.y < -1e-4 ? THREE.MathUtils.clamp((level - origin.y) / direction.y, previous, t) : t;
          return { distance, normal: UP.clone(), surface: 'water' };
        }
      }
      if (y <= height) {
        let a = previous;
        let b = t;
        for (let i = 0; i < 6; i++) {
          const m = (a + b) / 2;
          if (origin.y + direction.y * m <= terrain.getHeight(origin.x + direction.x * m, origin.z + direction.z * m)) b = m;
          else a = m;
        }
        const hx = origin.x + direction.x * b;
        const hz = origin.z + direction.z * b;
        return { distance: b, normal: terrainNormal(terrain, hx, hz), surface: terrain.getSurface(hx, hz) };
      }
      previous = t;
    }
    return null;
  }
}

// Rayo contra una caja orientada (sin tener en cuenta la inclinación de las rampas):
// { distance, normal, surface } si la corta antes de `far`.
function rayCollider(c, origin, direction, far) {
  const dx = origin.x - c.cx;
  const dz = origin.z - c.cz;
  const o = [dx * c.cos - dz * c.sin, origin.y, dx * c.sin + dz * c.cos];
  const d = [direction.x * c.cos - direction.z * c.sin, direction.y, direction.x * c.sin + direction.z * c.cos];
  const min = [-c.hx, c.minY, -c.hz];
  const max = [c.hx, c.maxY, c.hz];
  let near = -Infinity;
  let exit = Infinity;
  let axis = 0;
  let sign = 1;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
      continue;
    }
    const t0 = (min[i] - o[i]) / d[i];
    const t1 = (max[i] - o[i]) / d[i];
    const enter = Math.min(t0, t1);
    if (enter > near) {
      near = enter;
      axis = i;
      sign = d[i] > 0 ? -1 : 1;
    }
    exit = Math.min(exit, Math.max(t0, t1));
  }
  if (near > exit || near < 0 || near > far) return null;
  // Normal de la cara: ejes locales X (cos, 0, -sin), Y y Z (sin, 0, cos) en mundo.
  const normal = axis === 1
    ? new THREE.Vector3(0, sign, 0)
    : axis === 0
      ? new THREE.Vector3(c.cos * sign, 0, -c.sin * sign)
      : new THREE.Vector3(c.sin * sign, 0, c.cos * sign);
  return { distance: near, normal, surface: c.surface ?? 'stone', collider: c };
}

function terrainNormal(terrain, x, z) {
  const e = 0.25;
  const dx = terrain.getHeight(x + e, z) - terrain.getHeight(x - e, z);
  const dz = terrain.getHeight(x, z + e) - terrain.getHeight(x, z - e);
  return new THREE.Vector3(-dx, 2 * e, -dz).normalize();
}
