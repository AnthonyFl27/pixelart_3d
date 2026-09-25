import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Proyección de UVs por caras (box mapping) en coordenadas de mundo/objeto,
// para que todas las superficies tengan la misma densidad de texels
// (`textures.texelsPerUnit`) sin importar el tamaño de la pieza.
export function applyBoxUVs(geometry) {
  const { size, texelsPerUnit } = CONFIG.textures;
  const scale = texelsPerUnit / size;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const nx = Math.abs(normal.getX(i));
    const ny = Math.abs(normal.getY(i));
    const nz = Math.abs(normal.getZ(i));

    if (ny >= nx && ny >= nz) uv.setXY(i, x * scale, z * scale);
    else if (nx >= nz) uv.setXY(i, z * scale, y * scale);
    else uv.setXY(i, x * scale, y * scale);
  }
  uv.needsUpdate = true;
  return geometry;
}

// Extruye un perfil (plano XY) a lo ancho del eje Z, centrado, con UVs de densidad constante.
export function extrudeAcross(shape, width) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0, -width / 2);
  geometry.computeVertexNormals();
  return applyBoxUVs(geometry);
}

// UVs de tabla: cada pieza muestra una sola fila de la textura `planks` con un
// desplazamiento aleatorio a lo largo. `vertical`: la veta sigue el eje Y.
// La geometría debe estar centrada en el eje transversal a la veta.
export function plankUVs(geometry, random, vertical = false) {
  applyBoxUVs(geometry);
  const { size, planks } = CONFIG.textures;
  const rows = size / planks.rowHeight;
  const du = Math.floor(random() * size) / size;
  const dv = 1 - (Math.floor(random() * rows) * planks.rowHeight + planks.rowHeight / 2) / size;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (vertical) uv.setXY(i, v + du, u + dv);
    else uv.setXY(i, u + du, v + dv);
  }
  return geometry;
}
