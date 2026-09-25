import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';
import { applyBoxUVs, extrudeAcross } from './geometryUtils.js';
import { createBoxCollider } from '../player/collision.js';
import { createCabin } from './cabin.js';
import { createZone } from './zones.js';

// Fábrica de estructuras. Cada tipo recibe los parámetros de su entrada de nivel, un
// generador aleatorio y un contexto { ground(lx, lz) -> altura del terreno en un punto local },
// y devuelve piezas (o { pieces, baseY } para fijar la altura del origen de la estructura):
//   { geometry, position: [x, y, z], rotationY?, material?: 'stone' | 'wetStone' | 'bark' | 'leaves' | …,
//     collider?: boolean (true) | [{ min: [x, y, z], max: [x, y, z], rise? }],
//     surface?: 'stone' | 'wood', groundAt?: [x, z] }
// `groundAt` apoya la pieza en el terreno medido en ese punto local (piezas sueltas
// o árboles de un bosquecillo sobre terreno irregular). Un `collider` con cajas explícitas
// sustituye al bounding box (p. ej. arcos por los que se puede pasar); `rise` inclina la
// cara superior de la caja a lo largo de su eje X local (rampas). Una pieza con
// `geometry: null` solo aporta colisionadores.
// Un tipo puede devolver también `zones: [{ name, min, max }]`: volúmenes con nombre en
// coordenadas locales (p. ej. el interior de la cabaña).

const noise = new ValueNoise2D(deriveSeed(CONFIG.seed, 'structures'));

export const STRUCTURE_TYPES = {
  // Dos pilares y un dintel encima. El hueco queda a lo largo del eje X local.
  trilithon(params, random) {
    const {
      height = 4.2, gap = 1.6, pillarWidth = 1.4, pillarDepth = 1.0,
      lintelHeight = 0.85, lintelDepth = 1.05, overhang = 0.25,
    } = params;
    const offsetX = gap / 2 + pillarWidth / 2;
    const lintelWidth = gap + pillarWidth * 2 + overhang * 2;
    return [
      { geometry: pillarGeometry(pillarWidth, height, pillarDepth, random), position: [-offsetX, 0, 0] },
      { geometry: pillarGeometry(pillarWidth, height, pillarDepth, random), position: [offsetX, 0, 0] },
      {
        geometry: stoneBoxGeometry(lintelWidth, lintelHeight, lintelDepth, random, 0),
        position: [0, height - 0.08, 0],
      },
    ];
  },

  // Piedra vertical suelta. `lean` inclina la piedra (radianes) sobre su eje Z.
  pillar(params, random) {
    const { width = 1.3, height = 3.6, depth = 0.9, lean = 0 } = params;
    const geometry = pillarGeometry(width, height, depth, random);
    if (lean) geometry.rotateZ(lean);
    return [{ geometry, position: [0, 0, 0] }];
  },

  // Losa caída en el suelo; `tilt` levanta uno de sus extremos.
  fallenStone(params, random) {
    const { length = 3.6, width = 1.3, thickness = 0.75, tilt = 0.12 } = params;
    const geometry = stoneBoxGeometry(length, thickness, width, random, 0);
    geometry.rotateZ(tilt);
    geometry.computeBoundingBox();
    geometry.translate(0, -geometry.boundingBox.min.y - thickness * 0.3, 0);
    return [{ geometry, position: [0, 0, 0] }];
  },

  // Roca redondeada semienterrada. `sink`: fracción del radio enterrada (además del hundimiento común).
  boulder(params, random) {
    const { radius = 0.8, sink = 0, material = 'stone', collider = true } = params;
    const geometry = blobGeometry(radius, random, 0.7, 1);
    geometry.translate(0, -sink * radius, 0);
    return [{ geometry, position: [0, 0, 0], material, collider }];
  },

  // Afloramiento rocoso: rocas semienterradas agrupadas, cada una apoyada en el terreno.
  outcrop(params, random) {
    const { radius = 3, count = 5, minSize = 0.5, maxSize = 1.4, sink = 0.35 } = params;
    return Array.from({ length: count }, (_, i) => {
      const angle = random() * Math.PI * 2;
      const distance = i === 0 ? 0 : (0.35 + random() * 0.65) * radius;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const size = i === 0 ? maxSize : minSize + random() * (maxSize - minSize);
      const geometry = blobGeometry(size, random, 0.55 + random() * 0.3, 1);
      geometry.translate(0, -sink * size, 0);
      return { geometry, position: [x, 0, z], rotationY: random() * Math.PI * 2, groundAt: [x, z] };
    });
  },

  // Piedras pequeñas y escombros dispersos en un círculo (sin colisión).
  rubble(params, random) {
    const { radius = 1.5, count = 8, minSize = 0.1, maxSize = 0.32, material = 'stone' } = params;
    return Array.from({ length: count }, () => {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const size = minSize + random() * (maxSize - minSize);
      return {
        geometry: blobGeometry(size, random, 0.6, 0),
        position: [x, 0, z],
        rotationY: random() * Math.PI * 2,
        material,
        collider: false,
        groundAt: [x, z],
      };
    });
  },

  // Árbol: tronco facetado y copa de lóbulos. `autumn`: copa de hojas otoñales.
  tree(params, random) {
    return treePieces(params, random, 0, 0);
  },

  // Puente de mampostería con arcos a lo largo del eje X local, pretiles y una rampa en
  // cada extremo hasta el terreno. La altura del tablero deja pasar al jugador bajo los
  // arcos (vadeando) y queda al menos `minDeckAbove` sobre las orillas.
  // { arches, span, pier, abutment, width, deckThickness, headroom, minDeckAbove, rampLength, parapetHeight }
  archBridge(params, random, { ground }) {
    const {
      arches = 2, span = 2.6, pier = 0.9, abutment = 1.4, width = 3.2, deckThickness = 0.6,
      headroom = 2.2, minDeckAbove = 0.6, rampLength = 6, parapetHeight = 0.55, parapetWidth = 0.3,
      foundation = 0.4,
    } = params;
    const half = (arches * span + (arches - 1) * pier) / 2 + abutment;
    let bed = Infinity;
    for (let x = -half; x <= half; x += 0.5) bed = Math.min(bed, ground(x, 0), ground(x, width / 2), ground(x, -width / 2));
    const bank = Math.max(ground(-half, 0), ground(half, 0));
    const baseY = bed - foundation;
    const deckTop = Math.max(bank + minDeckAbove, bed + headroom + deckThickness) - baseY;
    const crown = deckTop - deckThickness;
    const radius = span / 2;
    const spring = Math.max(0.2, crown - radius);

    // Perfil del cuerpo con los arcos recortados por abajo (sentido antihorario).
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    const colliders = [];
    let x = -half + abutment;
    colliders.push({ min: [-half, 0, -width / 2], max: [x, crown, width / 2] });
    for (let i = 0; i < arches; i++) {
      shape.lineTo(x, 0);
      shape.lineTo(x, spring);
      for (let k = 1; k <= CONFIG.bridge.archSegments; k++) {
        const angle = Math.PI - (k / CONFIG.bridge.archSegments) * Math.PI;
        shape.lineTo(x + radius + Math.cos(angle) * radius, spring + Math.sin(angle) * radius);
      }
      shape.lineTo(x + span, 0);
      // Arranques del arco: piedra hasta ~1/3 de la altura del arco junto a cada apoyo.
      const haunch = radius * 0.36;
      const haunchTop = spring + radius * 0.77;
      colliders.push({ min: [x, 0, -width / 2], max: [x + haunch, haunchTop, width / 2] });
      colliders.push({ min: [x + span - haunch, 0, -width / 2], max: [x + span, haunchTop, width / 2] });
      x += span;
      const next = i < arches - 1 ? x + pier : half;
      colliders.push({ min: [x, 0, -width / 2], max: [next, crown, width / 2] });
      x = next;
    }
    shape.lineTo(half, 0);
    shape.lineTo(half, deckTop);
    shape.lineTo(-half, deckTop);
    shape.lineTo(-half, 0);
    colliders.push({ min: [-half, crown, -width / 2], max: [half, deckTop, width / 2] });

    const body = extrudeAcross(shape, width);
    const pieces = [{ geometry: body, position: [0, 0, 0], material: 'masonry', collider: colliders }];

    // Pretiles a ambos lados del tablero.
    for (const side of [-1, 1]) {
      const parapet = new THREE.BoxGeometry(half * 2, parapetHeight, parapetWidth, 8, 1, 1);
      parapet.translate(0, deckTop + parapetHeight / 2, side * (width / 2 - parapetWidth / 2));
      applyBoxUVs(parapet);
      pieces.push({ geometry: parapet, position: [0, 0, 0], material: 'masonry' });
    }

    // Rampas: cuña desde el tablero hasta el terreno en cada extremo.
    for (const side of [-1, 1]) {
      const end = side * (half + rampLength);
      const endTop = ground(end, 0) - baseY + CONFIG.bridge.rampLip;
      const ramp = new THREE.Shape();
      const near = side * half;
      ramp.moveTo(near, 0);
      ramp.lineTo(end, Math.min(0, endTop - 1));
      ramp.lineTo(end, endTop);
      ramp.lineTo(near, deckTop);
      ramp.lineTo(near, 0);
      const minX = Math.min(near, end);
      const maxX = Math.max(near, end);
      pieces.push({
        geometry: extrudeAcross(ramp, width),
        position: [0, 0, 0],
        material: 'masonry',
        collider: [{ min: [minX, Math.min(0, endTop - 1), -width / 2], max: [maxX, deckTop, width / 2], rise: side * (endTop - deckTop) }],
      });
    }
    return { pieces, baseY };
  },

  // Cabaña de madera con porche (src/world/cabin.js). El porche mira a +Z local.
  cabin(params, random, context) {
    return createCabin(params, random, context);
  },

  // Leñera: troncos apilados en filas con dos estacas. { length, rows }
  woodpile(params, random) {
    const { length = 1.8, rows = 4, logRadius = 0.15 } = params;
    const pieces = [];
    const rowWidth = rows * logRadius * 2;
    for (let row = 0; row < rows; row++) {
      const count = rows - row;
      for (let i = 0; i < count; i++) {
        const radius = logRadius * (0.85 + random() * 0.3);
        const log = new THREE.CylinderGeometry(radius, radius, length * (0.9 + random() * 0.15), 7, 1);
        log.rotateX(Math.PI / 2);
        log.rotateZ(random() * Math.PI);
        applyBoxUVs(log);
        const x = -rowWidth / 2 + logRadius * (1 + row) + i * logRadius * 2;
        pieces.push({
          geometry: log,
          position: [x, logRadius + row * logRadius * 1.7, (random() - 0.5) * 0.15],
          material: 'bark',
          collider: false,
        });
      }
    }
    for (const side of [-1, 1]) {
      const stake = new THREE.BoxGeometry(0.1, rows * logRadius * 2, 0.1);
      stake.translate(0, rows * logRadius, 0);
      applyBoxUVs(stake);
      pieces.push({ geometry: stake, position: [side * (rowWidth / 2 + 0.08), 0, 0], material: 'wood', collider: false });
    }
    pieces[0].collider = [{ min: [-rowWidth / 2 - logRadius, -logRadius, -length / 2], max: [rowWidth / 2 - logRadius, rows * logRadius * 1.9, length / 2] }];
    pieces[0].surface = 'wood';
    return pieces;
  },

  // Valla de madera rota a lo largo del eje X local: postes y dos travesaños por tramo;
  // algunos travesaños faltan o cuelgan. { length, spacing, height, broken }
  fence(params, random) {
    const { length = 12, spacing = 2, height = 1.1, broken = 0.35 } = params;
    const pieces = [];
    const posts = Math.max(2, Math.round(length / spacing) + 1);
    const step = length / (posts - 1);
    for (let i = 0; i < posts; i++) {
      const x = -length / 2 + i * step;
      if (i > 0 && i < posts - 1 && random() < broken * 0.3) continue; // poste caído
      const post = new THREE.BoxGeometry(0.12, height + 0.2, 0.12);
      post.translate(0, (height + 0.2) / 2 - 0.2, 0);
      post.rotateZ((random() - 0.5) * 0.15);
      post.rotateX((random() - 0.5) * 0.1);
      applyBoxUVs(post);
      pieces.push({ geometry: post, position: [x, 0, 0], material: 'wood', surface: 'wood', groundAt: [x, 0] });
      if (i === posts - 1) continue;
      for (const railHeight of [height * 0.45, height * 0.85]) {
        const roll = random();
        if (roll < broken * 0.5) continue; // travesaño que falta
        const rail = new THREE.BoxGeometry(step, 0.09, 0.05);
        rail.translate(step / 2, 0, 0);
        const hanging = roll < broken;
        if (hanging) rail.rotateZ(-0.35 - random() * 0.4); // cuelga de un extremo
        rail.translate(0, railHeight, 0.08);
        applyBoxUVs(rail);
        pieces.push({ geometry: rail, position: [x, 0, 0], material: 'wood', surface: 'wood', groundAt: [x, 0], collider: !hanging });
      }
    }
    return pieces;
  },

  // Bosquecillo de árboles en un círculo (para el horizonte).
  grove(params, random) {
    const { radius = 8, count = 6, minHeight = 5, maxHeight = 9 } = params;
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const height = minHeight + random() * (maxHeight - minHeight);
      pieces.push(...treePieces({ height, crownRadius: height * 0.38 }, random,
        Math.cos(angle) * distance, Math.sin(angle) * distance));
    }
    return pieces;
  },
};

// Crea el grupo de una entrada de nivel y sus colisionadores en coordenadas de mundo.
export function createStructure(entry, index, { terrain, materials }) {
  const build = STRUCTURE_TYPES[entry.type];
  if (!build) throw new Error(`Tipo de estructura desconocido: "${entry.type}"`);

  const random = createRandom(deriveSeed(CONFIG.seed, `structure-${index}`));
  const scale = entry.scale ?? 1;
  const rotationY = entry.rotationY ?? 0;
  const group = new THREE.Group();
  group.name = `${entry.type}-${index}`;
  group.scale.setScalar(scale);
  group.rotation.y = rotationY;
  group.position.set(entry.x, 0, entry.z);
  group.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  const ground = (lx, lz) => {
    point.set(lx, 0, lz).applyMatrix4(group.matrixWorld);
    return terrain.getHeight(point.x, point.z);
  };

  const built = build(entry, random, { ground });
  const list = Array.isArray(built) ? built : built.pieces;
  const pieces = list.map((piece) => {
    let mesh;
    if (piece.geometry) {
      const material = materials[piece.material ?? 'stone'];
      if (!material) throw new Error(`Material desconocido: "${piece.material}"`);
      mesh = new THREE.Mesh(piece.geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    } else {
      mesh = new THREE.Object3D();
    }
    mesh.position.fromArray(piece.position);
    mesh.rotation.y = piece.rotationY ?? 0;
    mesh.userData.piece = piece;
    group.add(mesh);
    return mesh;
  });

  const baseY = Array.isArray(built) || built.baseY === undefined
    ? lowestGroundUnder(group, entry, terrain) - CONFIG.structures.sink * scale
    : built.baseY;
  group.position.y = baseY;
  group.updateMatrixWorld(true);

  // Apoyar en el terreno las piezas con `groundAt`.
  const local = new THREE.Vector3();
  for (const mesh of pieces) {
    const { groundAt } = mesh.userData.piece;
    if (!groundAt) continue;
    local.set(groundAt[0], 0, groundAt[1]).applyMatrix4(group.matrixWorld);
    const ground = terrain.getHeight(local.x, local.z);
    mesh.position.y += (ground - group.position.y) / scale - CONFIG.structures.sink * 0.5;
  }
  group.updateMatrixWorld(true);

  const colliders = [];
  for (const mesh of pieces) {
    const { collider = true, surface = 'stone' } = mesh.userData.piece;
    if (collider === false) continue;
    if (Array.isArray(collider)) {
      for (const box of collider) colliders.push(createBoxCollider(mesh, group, { box, rise: box.rise, surface }));
    } else {
      colliders.push(createBoxCollider(mesh, group, { surface }));
    }
  }
  const zones = (Array.isArray(built) ? [] : built.zones ?? []).map((zone) => createZone(zone, group));
  return { group, colliders, zones };
}

// Altura mínima del terreno bajo la huella de la estructura (grupo ya colocado en x, z).
function lowestGroundUnder(group, entry, terrain) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  let min = Infinity;
  for (const [x, z] of [
    [box.min.x, box.min.z], [box.min.x, box.max.z],
    [box.max.x, box.min.z], [box.max.x, box.max.z], [entry.x, entry.z],
  ]) {
    min = Math.min(min, terrain.getHeight(x, z));
  }
  return min;
}

function treePieces({ height = 7, trunkRadius, crownRadius, lobes = 6, autumn = false }, random, x, z) {
  const trunkHeight = height * 0.42;
  const radius = trunkRadius ?? height * 0.06;
  const crown = crownRadius ?? height * 0.4;
  const trunkLength = trunkHeight + crown * 0.6;
  const trunk = new THREE.CylinderGeometry(radius * 0.6, radius, trunkLength, 6, 3);
  trunk.translate(0, trunkLength / 2, 0);
  applyBoxUVs(trunk);
  const bend = (random() - 0.5) * 0.4;
  deform(trunk, random, (px, py, pz) => [px + bend * (py / trunkLength) ** 2, py, pz]);

  const pieces = [{ geometry: trunk, position: [x, 0, z], material: 'bark', surface: 'wood', groundAt: [x, z] }];
  for (let i = 0; i < lobes; i++) {
    const center = i === 0;
    const angle = (i / lobes) * Math.PI * 2 + random() * 0.8;
    const distance = center ? 0 : crown * (0.55 + random() * 0.3);
    const lobe = crown * (center ? 0.75 : 0.45 + random() * 0.25);
    pieces.push({
      geometry: blobGeometry(lobe, random, 0.8, 0),
      position: [
        x + Math.cos(angle) * distance + bend,
        trunkHeight + crown * (center ? 0.55 : 0.1 + random() * 0.6),
        z + Math.sin(angle) * distance,
      ],
      material: autumn ? 'leavesAutumn' : 'leaves',
      collider: false,
      groundAt: [x, z],
    });
  }
  return pieces;
}

// --- Geometrías -------------------------------------------------------------

function pillarGeometry(width, height, depth, random) {
  return stoneBoxGeometry(width, height, depth, random, CONFIG.structures.taper);
}

// Caja subdividida apoyada en y = 0, con UVs de densidad constante y deformación por ruido.
function stoneBoxGeometry(width, height, depth, random, taper) {
  const segX = Math.max(1, Math.round(width * 1.5));
  const segY = Math.max(1, Math.round(height * 1.5));
  const segZ = Math.max(1, Math.round(depth * 1.5));
  const geometry = new THREE.BoxGeometry(width, height, depth, segX, segY, segZ);
  geometry.translate(0, height / 2, 0);
  applyBoxUVs(geometry);
  deform(geometry, random, (x, y, z) => {
    const s = 1 - taper * THREE.MathUtils.clamp(y / height, 0, 1);
    return [x * s, y, z * s];
  });
  return geometry;
}

// Bola facetada deformada (rocas, piedras pequeñas, lóbulos de copa).
// squash aplasta en Y; detail = subdivisiones del icosaedro.
function blobGeometry(radius, random, squash, detail) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const ox = random() * 100;
  const oz = random() * 100;
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n = noise.noise(v.x / radius * 1.7 + ox, (v.y + v.z) / radius * 1.7 + oz);
    v.multiplyScalar(1 + (n - 0.5) * 0.45);
    v.y = v.y * squash + radius * 0.35;
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return applyBoxUVs(geometry);
}

// Desplaza cada vértice según su posición (vértices coincidentes se desplazan
// igual, así no se abren grietas entre caras).
function deform(geometry, random, shape) {
  const { roughness, roughnessFrequency: f } = CONFIG.structures;
  const ox = random() * 100;
  const oy = random() * 100;
  const oz = random() * 100;
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = shape(position.getX(i), position.getY(i), position.getZ(i));
    const dx = (noise.noise(y * f + ox, z * f + oy) - 0.5) * 2 * roughness;
    const dy = (noise.noise(x * f + oy, z * f + oz) - 0.5) * 2 * roughness;
    const dz = (noise.noise(x * f + oz, y * f + ox) - 0.5) * 2 * roughness;
    position.setXYZ(i, x + dx, y + dy, z + dz);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
}
