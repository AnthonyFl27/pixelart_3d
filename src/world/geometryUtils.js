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
