import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';
import { applyBoxUVs } from './geometryUtils.js';
import { createBoxCollider } from '../player/collision.js';

// Fábrica de estructuras. Cada tipo recibe los parámetros de su entrada de nivel y
// devuelve piezas:
//   { geometry, position: [x, y, z], rotationY?, material?: 'stone' | 'bark' | 'leaves',
//     collider?: boolean (true), groundAt?: [x, z] }
// `groundAt` apoya la pieza en el terreno medido en ese punto local (piezas sueltas
// o árboles de un bosquecillo sobre terreno irregular).

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
    const { radius = 0.8, sink = 0 } = params;
    const geometry = blobGeometry(radius, random, 0.7, 1);
    geometry.translate(0, -sink * radius, 0);
    return [{ geometry, position: [0, 0, 0] }];
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
    const { radius = 1.5, count = 8, minSize = 0.1, maxSize = 0.32 } = params;
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
        collider: false,
        groundAt: [x, z],
      };
    });
  },

  // Árbol: tronco facetado y copa de lóbulos.
  tree(params, random) {
    return treePieces(params, random, 0, 0);
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

  const pieces = build(entry, random).map((piece) => {
    const mesh = new THREE.Mesh(piece.geometry, materials[piece.material ?? 'stone']);
    mesh.position.fromArray(piece.position);
    mesh.rotation.y = piece.rotationY ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.piece = piece;
    group.add(mesh);
    return mesh;
  });

  group.scale.setScalar(scale);
  group.rotation.y = rotationY;
  group.position.set(entry.x, lowestGroundUnder(group, entry, terrain) - CONFIG.structures.sink * scale, entry.z);
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

  const colliders = pieces
    .filter((mesh) => mesh.userData.piece.collider !== false)
    .map((mesh) => createBoxCollider(mesh, group));
  return { group, colliders };
}

// Altura mínima del terreno bajo la huella de la estructura.
function lowestGroundUnder(group, entry, terrain) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  let min = Infinity;
  for (const [x, z] of [
    [box.min.x, box.min.z], [box.min.x, box.max.z],
    [box.max.x, box.min.z], [box.max.x, box.max.z], [0, 0],
  ]) {
    min = Math.min(min, terrain.getHeight(entry.x + x, entry.z + z));
  }
  return min;
}

function treePieces({ height = 7, trunkRadius, crownRadius, lobes = 6 }, random, x, z) {
  const trunkHeight = height * 0.42;
  const radius = trunkRadius ?? height * 0.06;
  const crown = crownRadius ?? height * 0.4;
  const trunkLength = trunkHeight + crown * 0.6;
  const trunk = new THREE.CylinderGeometry(radius * 0.6, radius, trunkLength, 6, 3);
  trunk.translate(0, trunkLength / 2, 0);
  applyBoxUVs(trunk);
  const bend = (random() - 0.5) * 0.4;
  deform(trunk, random, (px, py, pz) => [px + bend * (py / trunkLength) ** 2, py, pz]);

  const pieces = [{ geometry: trunk, position: [x, 0, z], material: 'bark', groundAt: [x, z] }];
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
      material: 'leaves',
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
