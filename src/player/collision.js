import * as THREE from 'three';

// Colisionadores: cajas orientadas en el plano XZ con rango vertical [minY, maxY].
// Una caja puede tener la cara superior inclinada a lo largo de su eje X local (rampas):
// techo(lx) = top + slope * lx. `surface` indica el sonido de los pasos encima.
// El jugador es un cilindro vertical (círculo de radio r en XZ + altura).

const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();
const tmpSize = new THREE.Vector3();

// Caja a partir de la geometría de una pieza (bounding box local) y su transformación.
// Soporta rotación solo en Y y escala uniforme (como generan las estructuras).
// `box` (opcional): caja explícita en el espacio local de la pieza en lugar del bounding box.
// `rise`: la cara superior sube `rise` de -X a +X (local); el bounding box es la parte alta.
export function createBoxCollider(mesh, group, { box, rise = 0, surface = 'stone' } = {}) {
  if (box) {
    tmpBox.min.fromArray(box.min);
    tmpBox.max.fromArray(box.max);
  } else {
    mesh.geometry.computeBoundingBox();
    tmpBox.copy(mesh.geometry.boundingBox);
  }
  tmpBox.getCenter(tmpCenter);
  tmpBox.getSize(tmpSize);

  const scale = group.scale.x;
  const rotation = group.rotation.y + mesh.rotation.y;
  // Centro de la caja en espacio de mundo.
  tmpCenter.applyMatrix4(mesh.matrixWorld);
  const hx = (tmpSize.x / 2) * scale;
  const maxY = tmpCenter.y + (tmpSize.y / 2) * scale;
  const slope = hx > 0 ? (rise * scale) / (2 * hx) : 0;

  return {
    cx: tmpCenter.x,
    cz: tmpCenter.z,
    hx,
    hz: (tmpSize.z / 2) * scale,
    cos: Math.cos(rotation),
    sin: Math.sin(rotation),
    minY: tmpCenter.y - (tmpSize.y / 2) * scale,
    maxY,
    top: maxY - Math.abs(slope) * hx, // altura de la cara superior en el centro
    slope,
    surface,
  };
}

// Altura de la cara superior en la coordenada local lx (limitada a la caja).
function topAt(c, lx) {
  if (!c.slope) return c.maxY;
  return c.top + c.slope * THREE.MathUtils.clamp(lx, -c.hx, c.hx);
}

// Mundo -> espacio local de la caja (rotación Y de three.js invertida).
function toLocal(c, x, z) {
  const dx = x - c.cx;
  const dz = z - c.cz;
  return [dx * c.cos - dz * c.sin, dx * c.sin + dz * c.cos];
}

function toWorld(c, lx, lz) {
  return [c.cx + lx * c.cos + lz * c.sin, c.cz - lx * c.sin + lz * c.cos];
}

// Distancia² del círculo (centro x, z) al rectángulo de la caja.
function distanceSq(c, x, z) {
  const [lx, lz] = toLocal(c, x, z);
  const dx = lx - THREE.MathUtils.clamp(lx, -c.hx, c.hx);
  const dz = lz - THREE.MathUtils.clamp(lz, -c.hz, c.hz);
  return dx * dx + dz * dz;
}

// Empuja la posición fuera de las cajas que se solapan en altura con el jugador.
// Las cajas con techo por debajo de feetY + stepHeight se ignoran (se pueden pisar).
export function resolveHorizontal(position, { radius, height, stepHeight }, colliders) {
  const feet = position.y;
  for (let iteration = 0; iteration < 3; iteration++) {
    let moved = false;
    for (const c of colliders) {
      if (c.maxY <= feet + stepHeight || c.minY >= feet + height) continue;
      let [lx, lz] = toLocal(c, position.x, position.z);
      if (c.slope && topAt(c, lx) <= feet + stepHeight) continue;
      const qx = THREE.MathUtils.clamp(lx, -c.hx, c.hx);
      const qz = THREE.MathUtils.clamp(lz, -c.hz, c.hz);
      const dx = lx - qx;
      const dz = lz - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;

      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        lx += (dx / d) * (radius - d);
        lz += (dz / d) * (radius - d);
      } else {
        // Centro dentro de la caja: salir por el eje de menor penetración.
        const px = c.hx - Math.abs(lx);
        const pz = c.hz - Math.abs(lz);
        if (px < pz) lx = Math.sign(lx || 1) * (c.hx + radius);
        else lz = Math.sign(lz || 1) * (c.hz + radius);
      }
      [position.x, position.z] = toWorld(c, lx, lz);
      moved = true;
    }
    if (!moved) break;
  }
}

// Suelo bajo el jugador: terreno o parte superior de una caja alcanzable
// (techo por debajo de feetY + stepHeight). `surface` es la de la caja pisada (o null).
export function groundInfo(position, { radius, stepHeight }, colliders, terrain) {
  let height = terrain.getHeight(position.x, position.z);
  let surface = null;
  const footRadiusSq = (radius * 0.6) ** 2;
  for (const c of colliders) {
    if (c.minY > position.y + stepHeight) continue;
    const top = c.slope ? topAt(c, toLocal(c, position.x, position.z)[0]) : c.maxY;
    if (top > position.y + stepHeight || top <= height) continue;
    if (distanceSq(c, position.x, position.z) < footRadiusSq) {
      height = top;
      surface = c.surface ?? 'stone';
    }
  }
  return { height, onStructure: surface !== null, surface };
}

// Altura del techo más bajo por encima de la cabeza (Infinity si no hay).
export function ceilingHeight(position, { radius, height }, colliders) {
  let ceiling = Infinity;
  const head = position.y + height;
  const footRadiusSq = (radius * 0.6) ** 2;
  for (const c of colliders) {
    if (c.minY < head - 0.2 || c.minY >= ceiling) continue;
    if (distanceSq(c, position.x, position.z) < footRadiusSq) ceiling = c.minY;
  }
  return ceiling;
}
