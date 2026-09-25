import * as THREE from 'three';

// Zonas: volúmenes con nombre (caja orientada en XZ + rango vertical) que declaran las
// estructuras, p. ej. el interior de la cabaña. Acústica, pájaros, iluminación y el
// ocultado del interior consultan en qué zona está el jugador.

const center = new THREE.Vector3();

// Zona en coordenadas de mundo a partir de una caja { name, min, max } local al grupo
// de la estructura (rotación solo en Y y escala uniforme).
export function createZone({ name, min, max }, group) {
  const scale = group.scale.x;
  center.set((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2).applyMatrix4(group.matrixWorld);
  const rotation = group.rotation.y;
  return {
    name,
    cx: center.x,
    cz: center.z,
    hx: ((max[0] - min[0]) / 2) * scale,
    hz: ((max[2] - min[2]) / 2) * scale,
    cos: Math.cos(rotation),
    sin: Math.sin(rotation),
    minY: center.y - ((max[1] - min[1]) / 2) * scale,
    maxY: center.y + ((max[1] - min[1]) / 2) * scale,
  };
}

export function containsPoint(zone, { x, y, z }) {
  if (y < zone.minY || y > zone.maxY) return false;
  const dx = x - zone.cx;
  const dz = z - zone.cz;
  const lx = dx * zone.cos - dz * zone.sin;
  const lz = dx * zone.sin + dz * zone.cos;
  return Math.abs(lx) <= zone.hx && Math.abs(lz) <= zone.hz;
}

// Primera zona que contiene el punto, o null (exterior).
export function zoneAt(zones, point) {
  return zones.find((zone) => containsPoint(zone, point)) ?? null;
}
