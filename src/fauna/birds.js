import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';

// Pájaros con vida propia (InstancedMesh, 1 draw call):
// - Bandadas con reglas de boids suaves que persiguen objetivos errantes.
// - Pájaros solitarios que deambulan, se posan en lo alto de las piedras y
//   despegan al cabo de un rato o si el jugador se acerca.
// - Según la hora salen al amanecer y se marchan al anochecer.
// El aleteo se anima en el vertex shader con atributos por instancia.

const UP = new THREE.Vector3(0, 1, 0);

export class Birds {
  constructor(level, terrain, colliders, { onChirp } = {}) {
    const b = CONFIG.birds;
    this.level = level;
    this.terrain = terrain;
    this.onChirp = onChirp;
    this.random = createRandom(deriveSeed(CONFIG.seed, 'birds'));
    this.perches = createPerches(colliders, this.random);
    this.time = 0;
    this.started = false;

    const total = b.flocks * b.flockSize + b.solo;
    this.uniforms = {
      uTime: { value: 0 },
      uFlapSpeed: { value: b.flapSpeed },
      uFlapAmplitude: { value: b.flapAmplitude },
    };
    const geometry = createBirdGeometry();
    this.flapAttribute = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
    this.flapAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFlap', this.flapAttribute);

    const material = new THREE.MeshToonMaterial({ color: b.color, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => this.addFlap(shader);
    this.mesh = new THREE.InstancedMesh(geometry, material, total);
    this.mesh.name = 'birds';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    this.flocks = Array.from({ length: b.flocks }, () => ({
      target: this.randomSkyPoint(),
      timer: 0,
      roost: null,
      shyness: this.random(),
    }));
    this.birds = Array.from({ length: total }, (_, i) => {
      const flockIndex = i < b.flocks * b.flockSize ? Math.floor(i / b.flockSize) : -1;
      const flock = this.flocks[flockIndex];
      const position = this.randomSkyPoint();
      if (flock) position.copy(flock.target).add(this.randomOffset(6));
      return {
        flock: flockIndex,
        position,
        velocity: new THREE.Vector3(this.random() - 0.5, 0, this.random() - 0.5).setLength(b.minSpeed),
        target: this.randomSkyPoint(),
        state: 'fly', // fly | land | perched | leave | hidden
        timer: 2 + this.random() * 10,
        chirpTimer: this.randomRange(b.chirpInterval),
        perch: null,
        heading: 0,
        phase: this.random() * Math.PI * 2,
        flap: 1,
        fold: 0,
        shyness: flock ? flock.shyness : this.random(),
      };
    });

    this.matrix = new THREE.Matrix4();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.lookMatrix = new THREE.Matrix4();
    this.acc = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.average = new THREE.Vector3();
  }

  get visibleCount() {
    return this.birds.filter((bird) => bird.state !== 'hidden').length;
  }

  get perchedCount() {
    return this.birds.filter((bird) => bird.state === 'perched').length;
  }

  update(dt, { day, player, camera }) {
    const b = CONFIG.birds;
    this.time += dt;
    this.uniforms.uTime.value = this.time;

    for (const flock of this.flocks) {
      flock.timer -= dt;
      const centroid = this.flockCentroid(flock);
      if (flock.timer <= 0 || (centroid && centroid.distanceTo(flock.target) < 12)) {
        flock.target = this.randomSkyPoint();
        flock.timer = this.randomRange(b.retargetTime);
      }
    }

    this.birds.forEach((bird, i) => {
      const active = day.daylight > bird.shyness * 0.8 + 0.1;
      // Al cargar de noche los pájaros inactivos empiezan ya fuera de escena.
      if (!this.started && !active) bird.state = 'hidden';
      this.updateState(bird, active, dt, player);
      if (bird.state === 'hidden') {
        this.hide(i);
        return;
      }
      if (bird.state === 'perched') this.updatePerched(bird, dt);
      else this.updateFlight(bird, dt);
      this.updateChirp(bird, dt, day, camera);
      this.writeInstance(bird, i);
    });
    this.started = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.flapAttribute.needsUpdate = true;
  }

  // Transiciones: salir/volver según la hora, posarse, asustarse y despegar.
  updateState(bird, active, dt, player) {
    const b = CONFIG.birds;
    bird.timer -= dt;

    if (!active && bird.state !== 'leave' && bird.state !== 'hidden') {
      this.releasePerch(bird);
      bird.state = 'leave';
      // Una bandada se marcha unida hacia el mismo punto.
      const flock = this.flocks[bird.flock];
      bird.target = flock ? (flock.roost ??= this.roostPoint()) : this.roostPoint();
    }
    const gone = bird.position.distanceTo(player.position) > b.hideDistance
      || bird.position.distanceTo(bird.target) < 15;
    if (bird.state === 'leave' && gone) {
      bird.state = 'hidden';
    }
    if (bird.state === 'hidden' && active) {
      if (this.flocks[bird.flock]) this.flocks[bird.flock].roost = null;
      bird.state = 'fly';
      bird.position.copy(this.roostPoint());
      bird.target = this.randomSkyPoint();
      bird.velocity.copy(bird.target).sub(bird.position).setLength(b.maxSpeed);
    }
    if (bird.flock >= 0) return;

    if (bird.state === 'fly' && bird.timer <= 0) {
      const perch = this.random() < b.perchChance ? this.freePerch() : null;
      if (perch) {
        perch.bird = bird;
        bird.perch = perch;
        bird.state = 'land';
      } else {
        bird.target = this.randomSkyPoint();
        bird.timer = this.randomRange(b.retargetTime);
      }
    }
    if (bird.state === 'perched') {
      const scared = bird.position.distanceTo(player.position) < b.scareDistance;
      if (scared || bird.timer <= 0) this.takeOff(bird);
    }
  }

  updateFlight(bird, dt) {
    const b = CONFIG.birds;
    const acc = this.acc.set(0, 0, 0);
    let target = bird.target;

    if (bird.flock >= 0) {
      const flock = this.flocks[bird.flock];
      target = bird.state === 'leave' ? bird.target : flock.target;
      this.addFlocking(bird, acc);
    }

    if (bird.state === 'land') {
      // Llegada suave al punto de posado.
      const toPerch = this.tmp.copy(bird.perch.position).sub(bird.position);
      const distance = toPerch.length();
      if (distance < 0.25) {
        bird.state = 'perched';
        bird.position.copy(bird.perch.position);
        bird.velocity.set(0, 0, 0);
        bird.timer = this.randomRange(b.perchTime);
        return;
      }
      const desired = toPerch.setLength(Math.min(b.maxSpeed, distance * 1.4 + 0.5));
      acc.add(desired.sub(bird.velocity).multiplyScalar(3));
    } else {
      const desired = this.tmp.copy(target).sub(bird.position).setLength(b.maxSpeed);
      acc.add(desired.sub(bird.velocity).multiplyScalar(b.seek));
    }

    // Mantener altura mínima sobre el terreno (salvo al aterrizar).
    const ground = this.terrain.getHeight(bird.position.x, bird.position.z);
    const altitude = bird.position.y - ground;
    if (bird.state !== 'land' && altitude < b.minAltitude) acc.y += (b.minAltitude - altitude) * 2;

    acc.clampLength(0, b.maxAccel);
    bird.velocity.addScaledVector(acc, dt);
    const minSpeed = bird.state === 'land' ? 0.5 : b.minSpeed;
    bird.velocity.clampLength(minSpeed, b.maxSpeed);
    bird.position.addScaledVector(bird.velocity, dt);
    if (bird.position.y < ground + 0.3) bird.position.y = ground + 0.3;

    // Aleteo al subir o frenar; planeo al bajar o de vez en cuando.
    const gliding = bird.state !== 'land' && (bird.velocity.y < -0.4 || Math.sin(this.time * 0.35 + bird.phase * 3) > 0.55);
    bird.flap += ((gliding ? 0 : 1) - bird.flap) * Math.min(1, dt * 4);
    bird.fold += (0 - bird.fold) * Math.min(1, dt * 6);
    bird.heading = Math.atan2(bird.velocity.x, bird.velocity.z);
  }

  updatePerched(bird, dt) {
    bird.flap += (0 - bird.flap) * Math.min(1, dt * 8);
    bird.fold += (1 - bird.fold) * Math.min(1, dt * 5);
    // De vez en cuando gira sobre sí mismo.
    if (this.random() < dt * 0.3) bird.heading += (this.random() - 0.5) * 2;
  }

  addFlocking(bird, acc) {
    const b = CONFIG.birds;
    const center = this.center.set(0, 0, 0);
    const average = this.average.set(0, 0, 0);
    let count = 0;
    for (const other of this.birds) {
      if (other === bird || other.flock !== bird.flock || other.state === 'hidden') continue;
      center.add(other.position);
      average.add(other.velocity);
      count++;
      const distance = bird.position.distanceTo(other.position);
      if (distance < b.separationDistance && distance > 0.001) {
        acc.addScaledVector(this.tmp.copy(bird.position).sub(other.position), b.separation / (distance * distance));
      }
    }
    if (count === 0) return;
    center.divideScalar(count).sub(bird.position).multiplyScalar(b.cohesion);
    average.divideScalar(count).sub(bird.velocity).multiplyScalar(b.alignment);
    acc.add(center).add(average);
  }

  updateChirp(bird, dt, day, camera) {
    const b = CONFIG.birds;
    bird.chirpTimer -= dt;
    if (bird.chirpTimer > 0) return;
    bird.chirpTimer = this.randomRange(b.chirpInterval) * (bird.state === 'perched' ? 1 : 3);
    const distance = bird.position.distanceTo(camera.position);
    if (!this.onChirp || day.daylight < 0.3 || distance > b.chirpDistance) return;
    const toBird = this.tmp.copy(bird.position).sub(camera.position).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    this.onChirp(THREE.MathUtils.clamp(toBird.dot(right), -1, 1), 1 - distance / b.chirpDistance);
  }

  takeOff(bird) {
    const b = CONFIG.birds;
    this.releasePerch(bird);
    bird.state = 'fly';
    bird.target = this.randomSkyPoint();
    bird.timer = this.randomRange(b.retargetTime);
    bird.velocity.set(this.random() - 0.5, 1.2, this.random() - 0.5).setLength(b.minSpeed);
  }

  releasePerch(bird) {
    if (bird.perch) bird.perch.bird = null;
    bird.perch = null;
  }

  freePerch() {
    const free = this.perches.filter((perch) => !perch.bird);
    return free.length ? free[Math.floor(this.random() * free.length)] : null;
  }

  flockCentroid(flock) {
    const index = this.flocks.indexOf(flock);
    const members = this.birds.filter((bird) => bird.flock === index && bird.state === 'fly');
    if (!members.length) return null;
    const centroid = new THREE.Vector3();
    for (const bird of members) centroid.add(bird.position);
    return centroid.divideScalar(members.length);
  }

  randomSkyPoint() {
    const b = CONFIG.birds;
    const angle = this.random() * Math.PI * 2;
    const distance = Math.sqrt(this.random()) * b.areaRadius;
    const x = this.level.center.x + Math.cos(angle) * distance;
    const z = this.level.center.z + Math.sin(angle) * distance;
    const y = this.terrain.getHeight(x, z) + b.minAltitude + this.random() * (b.maxAltitude - b.minAltitude);
    return new THREE.Vector3(x, y, z);
  }

  roostPoint() {
    const b = CONFIG.birds;
    const angle = this.random() * Math.PI * 2;
    return new THREE.Vector3(
      this.level.center.x + Math.cos(angle) * b.roostDistance,
      b.maxAltitude,
      this.level.center.z + Math.sin(angle) * b.roostDistance,
    );
  }

  randomOffset(radius) {
    return new THREE.Vector3(this.random() - 0.5, (this.random() - 0.5) * 0.5, this.random() - 0.5).multiplyScalar(radius);
  }

  randomRange([min, max]) {
    return min + this.random() * (max - min);
  }

  writeInstance(bird, i) {
    const b = CONFIG.birds;
    if (bird.state === 'perched') {
      this.quaternion.setFromAxisAngle(UP, bird.heading);
    } else {
      this.tmp.copy(bird.position).add(bird.velocity);
      this.lookMatrix.lookAt(this.tmp, bird.position, UP);
      this.quaternion.setFromRotationMatrix(this.lookMatrix);
    }
    this.scale.setScalar(b.scale);
    this.mesh.setMatrixAt(i, this.matrix.compose(bird.position, this.quaternion, this.scale));
    this.flapAttribute.setXYZ(i, bird.phase, bird.flap, bird.fold);
  }

  hide(i) {
    this.scale.setScalar(0);
    this.mesh.setMatrixAt(i, this.matrix.compose(this.tmp.set(0, -100, 0), this.quaternion.identity(), this.scale));
  }

  addFlap(shader) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aWing;
        attribute vec3 aFlap; // fase, aleteo (0 = planeo), plegado
        uniform float uTime;
        uniform float uFlapSpeed;
        uniform float uFlapAmplitude;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wingBeat = sin(uTime * uFlapSpeed + aFlap.x);
        float lift = mix(0.15, wingBeat, aFlap.y) * (1.0 - aFlap.z);
        transformed.y += lift * pow(aWing, 1.3) * uFlapAmplitude;
        transformed.x *= 1.0 - aFlap.z * aWing * 0.8;
        transformed.y -= aFlap.z * aWing * 0.04;`);
  }
}

// Puntos de posado: parte superior de piezas altas (dinteles y pilares).
function createPerches(colliders, random) {
  const perches = [];
  for (const c of colliders) {
    if (c.maxY < CONFIG.birds.perchHeight || c.slope || c.surface !== 'stone') continue;
    const slots = c.hx > 1 ? 2 : 1;
    for (let s = 0; s < slots; s++) {
      const lx = (random() - 0.5) * c.hx * 1.2;
      const lz = (random() - 0.5) * c.hz * 0.6;
      perches.push({
        position: new THREE.Vector3(c.cx + lx * c.cos + lz * c.sin, c.maxY, c.cz - lx * c.sin + lz * c.cos),
        bird: null,
      });
    }
  }
  return perches;
}

// Pájaro mirando a +Z: cuerpo en rombo, cola y dos alas de dos segmentos.
// aWing: 0 en el cuerpo, 1 en la punta del ala.
function createBirdGeometry() {
  const positions = [];
  const wing = [];
  const tri = (a, b, c, wa, wb, wc) => {
    positions.push(...a, ...b, ...c);
    wing.push(wa, wb, wc);
  };
  // Cuerpo y cola
  tri([0, 0, 0.2], [-0.05, 0, 0], [0.05, 0, 0], 0, 0, 0);
  tri([-0.05, 0, 0], [0, 0, -0.14], [0.05, 0, 0], 0, 0, 0);
  tri([0, 0, -0.1], [-0.07, 0, -0.26], [0.07, 0, -0.26], 0, 0, 0);
  // Alas (interior y exterior)
  for (const side of [-1, 1]) {
    const root = [side * 0.04, 0, 0.07];
    const rootBack = [side * 0.04, 0, -0.06];
    const mid = [side * 0.24, 0, 0.03];
    const midBack = [side * 0.22, 0, -0.08];
    const tip = [side * 0.46, 0, -0.06];
    tri(root, rootBack, mid, 0, 0, 0.5);
    tri(rootBack, midBack, mid, 0, 0.5, 0.5);
    tri(mid, midBack, tip, 0.5, 0.5, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  const normals = new Float32Array(positions.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}
