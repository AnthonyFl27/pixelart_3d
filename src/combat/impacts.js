import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';
import { groundInfo } from '../player/collision.js';

// Efectos del disparo en el mundo (spec v3, RF-446, RV-310, RV-311, RNF-308), todos con
// grupos reciclados (sin crear objetos por disparo):
// - Partículas de impacto: polvo y terrones, esquirlas, astillas y salpicaduras (Points).
// - Humo: humo del cañón y bocanadas de polvo (Points más grandes que se desvanecen).
// - Marcas de agujero en madera y piedra (InstancedMesh, las más antiguas se reciclan).
// - Vainas expulsadas que rebotan, se quedan en el suelo y desaparecen (InstancedMesh).

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export class Impacts {
  // onCasingLand(position): primera vez que una vaina toca el suelo (tintineo).
  constructor({ terrain, colliders }, { onCasingLand } = {}) {
    const c = CONFIG.impacts;
    this.terrain = terrain;
    this.colliders = colliders;
    this.onCasingLand = onCasingLand;
    this.random = createRandom(deriveSeed(CONFIG.seed, 'impacts'));
    this.object = new THREE.Group();
    this.object.name = 'impacts';

    this.debris = new ParticlePool(c.maxParticles, 2);
    this.smoke = new ParticlePool(c.maxSmoke, 4);
    this.object.add(this.debris.points, this.smoke.points);

    // Marcas: plano pequeño con una textura de agujero en grises, teñida por instancia.
    const markMaterial = new THREE.MeshLambertMaterial({
      map: createHoleTexture(this.random),
      alphaTest: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(c.markSize, c.markSize), markMaterial, c.maxMarks);
    // Color por instancia creado desde el principio (sin recompilar el shader al disparar).
    for (let i = 0; i < c.maxMarks; i++) this.marks.setColorAt(i, new THREE.Color(0xffffff));
    this.marks.count = 0;
    this.marks.frustumCulled = false;
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.nextMark = 0;
    this.object.add(this.marks);

    // Vainas: cartucho rojo con culote de latón (color por vértice).
    this.casings = new THREE.InstancedMesh(createCasingGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), c.maxCasings);
    this.casings.count = 0;
    this.casings.frustumCulled = false;
    this.casings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.casingList = Array.from({ length: c.maxCasings }, () => ({
      alive: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(), spin: new THREE.Vector3(), age: 0, landed: false, resting: false,
    }));
    this.nextCasing = 0;
    this.object.add(this.casings);

    this.matrix = new THREE.Matrix4();
    this.quaternion = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.color = new THREE.Color();
    this.body = { radius: 0.05, stepHeight: 0.05 };
  }

  // hit: { point, normal, surface, collider? } de Ballistics.
  hit({ point, normal, surface, collider }) {
    const c = CONFIG.impacts;
    const s = c.surfaces[surface] ?? c.surfaces.stone;
    const random = this.random;
    for (let i = 0; i < s.count; i++) {
      const speed = range(s.speed, random);
      const velocity = this.tmp.set(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(speed * 1.2)
        .addScaledVector(normal, speed * (0.5 + random() * 0.5));
      if (s.up) velocity.y += speed * (0.6 + random());
      this.debris.spawn(point, velocity, pick(s.colors, random), range(s.life, random), { gravity: c.gravity, drag: 1.5 });
    }
    if (surface !== 'water' && surface !== 'wood') {
      for (let i = 0; i < c.dust; i++) {
        const velocity = this.tmp.copy(normal).multiplyScalar(0.3 + random() * 0.5).add({ x: (random() - 0.5) * 0.6, y: 0.2, z: (random() - 0.5) * 0.6 });
        this.smoke.spawn(point, velocity, pick(s.colors, random), 0.5 + random() * 0.4, { gravity: -0.2, drag: 2, alpha: 0.7 });
      }
    }
    // Marca (no en objetos que se mueven, como las puertas).
    if (s.mark !== null && !collider?.owner) this.addMark(point, normal, s.mark);
  }

  addMark(point, normal, tint) {
    const c = CONFIG.impacts;
    const index = this.nextMark;
    this.nextMark = (this.nextMark + 1) % c.maxMarks;
    this.marks.count = Math.max(this.marks.count, index + 1);
    this.quaternion.setFromUnitVectors(Z_AXIS, normal);
    this.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, this.random() * Math.PI * 2));
    const position = this.tmp.copy(point).addScaledVector(normal, 0.004);
    this.matrix.compose(position, this.quaternion, this.scale.setScalar(0.8 + this.random() * 0.4));
    this.marks.setMatrixAt(index, this.matrix);
    this.marks.setColorAt(index, this.color.set(tint));
    this.marks.instanceMatrix.needsUpdate = true;
    this.marks.instanceColor.needsUpdate = true;
  }

  // Humo del cañón desde `position` hacia `direction` (unitario).
  muzzleSmoke(position, direction) {
    const s = CONFIG.shotgun.smoke;
    const random = this.random;
    for (let i = 0; i < s.count; i++) {
      const velocity = this.tmp.copy(direction).multiplyScalar(range(s.speed, random))
        .add({ x: (random() - 0.5) * 0.4, y: s.rise * random(), z: (random() - 0.5) * 0.4 });
      this.smoke.spawn(position, velocity, pick(CONFIG.impacts.smokeColors, random), range(s.life, random), { gravity: -s.rise, drag: 2.5, alpha: 0.85 });
    }
  }

  // Vaina expulsada en `position` con `velocity`.
  ejectCasing(position, velocity) {
    const casing = this.casingList[this.nextCasing];
    this.nextCasing = (this.nextCasing + 1) % this.casingList.length;
    casing.alive = true;
    casing.age = 0;
    casing.landed = false;
    casing.resting = false;
    casing.position.copy(position);
    casing.velocity.copy(velocity);
    casing.rotation.set(this.random() * 3, this.random() * 3, this.random() * 3);
    casing.spin.set((this.random() - 0.5) * 20, (this.random() - 0.5) * 10, (this.random() - 0.5) * 20);
  }

  update(dt) {
    this.debris.update(dt);
    this.smoke.update(dt);
    this.updateCasings(dt);
  }

  updateCasings(dt) {
    const c = CONFIG.impacts;
    let count = 0;
    for (const casing of this.casingList) {
      if (!casing.alive) continue;
      casing.age += dt;
      if (casing.age > c.casingLife) {
        casing.alive = false;
        continue;
      }
      if (!casing.resting) {
        casing.velocity.y -= c.gravity * dt;
        casing.position.addScaledVector(casing.velocity, dt);
        casing.rotation.x += casing.spin.x * dt;
        casing.rotation.y += casing.spin.y * dt;
        casing.rotation.z += casing.spin.z * dt;
        const ground = groundInfo(casing.position, this.body, this.colliders, this.terrain).height + 0.012;
        if (casing.position.y <= ground) {
          casing.position.y = ground;
          if (!casing.landed) this.onCasingLand?.(casing.position);
          casing.landed = true;
          casing.velocity.y = -casing.velocity.y * c.casingBounce;
          casing.velocity.x *= 0.5;
          casing.velocity.z *= 0.5;
          casing.spin.multiplyScalar(0.5);
          if (casing.velocity.y < 0.4) {
            // Tumbada en el suelo.
            casing.resting = true;
            casing.rotation.set(Math.PI / 2, 0, casing.rotation.z);
          }
        }
      }
      // Desaparece encogiéndose en el último tramo.
      const fade = THREE.MathUtils.clamp((c.casingLife - casing.age) / 0.3, 0, 1);
      this.quaternion.setFromEuler(casing.rotation);
      this.matrix.compose(casing.position, this.quaternion, this.scale.setScalar(fade));
      this.casings.setMatrixAt(count++, this.matrix);
    }
    this.casings.count = count;
    this.casings.visible = count > 0;
    if (count) this.casings.instanceMatrix.needsUpdate = true;
  }
}

// Grupo de partículas cuadradas de `size` píxeles del render interno con color y alfa
// por partícula. Solo se dibujan las vivas (drawRange); sin ninguna viva no se dibuja.
class ParticlePool {
  constructor(max, size) {
    this.list = Array.from({ length: max }, () => ({
      alive: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(),
      color: new THREE.Color(), life: 0, maxLife: 1, gravity: 0, drag: 0, alpha: 1,
    }));
    this.next = 0;
    this.geometry = new THREE.BufferGeometry();
    this.positions = new THREE.BufferAttribute(new Float32Array(max * 3), 3);
    this.colors = new THREE.BufferAttribute(new Float32Array(max * 4), 4);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('color', this.colors);
    this.geometry.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geometry, new THREE.PointsMaterial({
      size, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false,
    }));
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  spawn(position, velocity, color, life, { gravity = 0, drag = 0, alpha = 1 } = {}) {
    const p = this.list[this.next];
    this.next = (this.next + 1) % this.list.length;
    p.alive = true;
    p.position.copy(position);
    p.velocity.copy(velocity);
    p.color.set(color);
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    p.drag = drag;
    p.alpha = alpha;
  }

  update(dt) {
    let count = 0;
    for (const p of this.list) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.position.addScaledVector(p.velocity, dt);
      const t = p.life / p.maxLife;
      // Alfa en escalones (se desvanece en el último 50 % de la vida).
      const alpha = p.alpha * Math.ceil(Math.min(1, t * 2) * 3) / 3;
      this.positions.setXYZ(count, p.position.x, p.position.y, p.position.z);
      this.colors.setXYZW(count, p.color.r, p.color.g, p.color.b, alpha);
      count++;
    }
    this.geometry.setDrawRange(0, count);
    this.points.visible = count > 0;
    if (count) {
      this.positions.needsUpdate = true;
      this.colors.needsUpdate = true;
    }
  }
}

// Agujero de 8x8 en grises: centro casi negro y borde claro irregular (se tiñe por instancia).
function createHoleTexture(random) {
  const size = 8;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2);
      if (d < 1.6) ctx.fillStyle = '#141414';
      else if (d < 2.4) ctx.fillStyle = '#505050';
      else if (d < 3.6 && random() < 0.7) ctx.fillStyle = random() < 0.5 ? '#ffffff' : '#c8c8c8';
      else continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

// Vaina a lo largo de Y: tubo rojo y culote de latón.
function createCasingGeometry() {
  const body = new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6, 1).translate(0, 0.006, 0);
  const base = new THREE.CylinderGeometry(0.0125, 0.0125, 0.014, 6, 1).translate(0, -0.024, 0);
  const parts = [[body, 0xb02a20], [base, 0xd8a840]].map(([geometry, hex]) => {
    const g = geometry.toNonIndexed();
    const color = new THREE.Color(hex);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arrays = parts.map((g) => g.attributes[name].array);
    const data = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const a of arrays) {
      data.set(a, offset);
      offset += a.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(data, 3));
  }
  return merged;
}

function range([min, max], random) {
  return min + random() * (max - min);
}

function pick(list, random) {
  return list[Math.floor(random() * list.length)];
}
