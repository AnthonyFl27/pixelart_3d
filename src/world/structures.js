import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed, ValueNoise2D } from '../core/noise.js';
import { applyBoxUVs } from './geometryUtils.js';
import { createBoxCollider } from '../player/collision.js';

// Fábrica de estructuras de piedra. Cada tipo recibe los parámetros de su
// entrada de nivel y devuelve piezas { geometry, position, rotationY }.
// Las piezas se deforman ligeramente para parecer talladas a mano.

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

  // Roca redondeada semienterrada.
  boulder(params, random) {
    const { radius = 0.8 } = params;
    return [{ geometry: boulderGeometry(radius, random), position: [0, 0, 0] }];
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
    const mesh = new THREE.Mesh(piece.geometry, materials.stone);
    mesh.position.fromArray(piece.position);
    mesh.rotation.y = piece.rotationY ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  });

  group.scale.setScalar(scale);
  group.rotation.y = rotationY;
  group.position.set(entry.x, lowestGroundUnder(group, entry, terrain) - CONFIG.structures.sink * scale, entry.z);
  group.updateMatrixWorld(true);

  const colliders = pieces.map((mesh) => createBoxCollider(mesh, group));
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

// --- Geometrías -------------------------------------------------------------

function pillarGeometry(width, height, depth, random) {
  return stoneBoxGeometry(width, height, depth, random, CONFIG.structures.taper, true);
}

// Caja subdividida con UVs de densidad constante y deformación por ruido.
// Si `fromBase`, el origen queda en la base (y = 0); si no, en el centro de la cara inferior.
function stoneBoxGeometry(width, height, depth, random, taper, fromBase = true) {
  const segX = Math.max(1, Math.round(width * 1.5));
  const segY = Math.max(1, Math.round(height * 1.5));
  const segZ = Math.max(1, Math.round(depth * 1.5));
  const geometry = new THREE.BoxGeometry(width, height, depth, segX, segY, segZ);
  geometry.translate(0, fromBase ? height / 2 : 0, 0);
  applyBoxUVs(geometry);
  deform(geometry, random, (x, y, z) => {
    const s = 1 - taper * THREE.MathUtils.clamp(y / height, 0, 1);
    return [x * s, y, z * s];
  });
  return geometry;
}

function boulderGeometry(radius, random) {
  const geometry = new THREE.IcosahedronGeometry(radius, 1);
  const ox = random() * 100;
  const oz = random() * 100;
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const n = noise.noise(v.x * 1.7 + ox, (v.y + v.z) * 1.7 + oz);
    v.multiplyScalar(1 + (n - 0.5) * 0.45);
    v.y = v.y * 0.7 + radius * 0.35;
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
