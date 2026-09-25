import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Iluminación del interior de la cabaña como términos del shader del material por capas:
// dentro del volumen interior (zona) el ambiente exterior se atenúa, se suma un relleno
// que sigue a la luz del día y hasta `lights` luces puntuales sin sombra (lámpara,
// televisor…). Fuera de la zona no aporta nada, así que la luz no se "escapa" al
// terreno. Las luces existen siempre (intensidad 0 apagadas): no hay recompilaciones.
export class InteriorLighting {
  constructor() {
    const count = CONFIG.interior.lights;
    this.count = count;
    this.uniforms = {
      uInteriorCenter: { value: new THREE.Vector2() },
      uInteriorHalf: { value: new THREE.Vector2() },
      uInteriorRotation: { value: new THREE.Vector2(1, 0) },
      uInteriorHeight: { value: new THREE.Vector2(1, 0) }, // min > max: sin zona
      uInteriorAmbient: { value: 1 },
      uInteriorFill: { value: new THREE.Color(0, 0, 0) },
      uInteriorLightPosition: { value: Array.from({ length: count }, () => new THREE.Vector3()) },
      uInteriorLightColor: { value: Array.from({ length: count }, () => new THREE.Color(0, 0, 0)) },
      uInteriorLightRange: { value: new Array(count).fill(1) },
    };
    this.fillColor = new THREE.Color(CONFIG.interior.fillColor);
    this.color = new THREE.Color();
  }

  // Zona (ver zones.js) donde se aplica la iluminación interior.
  setZone(zone) {
    const u = this.uniforms;
    u.uInteriorCenter.value.set(zone.cx, zone.cz);
    u.uInteriorHalf.value.set(zone.hx, zone.hz);
    u.uInteriorRotation.value.set(zone.cos, zone.sin);
    u.uInteriorHeight.value.set(zone.minY, zone.maxY);
  }

  // Luz `index`: posición en mundo, color (hex o Color), intensidad y alcance (u).
  setLight(index, position, color, intensity, range) {
    const u = this.uniforms;
    u.uInteriorLightPosition.value[index].copy(position);
    u.uInteriorLightColor.value[index].set(color).multiplyScalar(intensity);
    u.uInteriorLightRange.value[index] = range;
  }

  update(day) {
    const i = CONFIG.interior;
    const u = this.uniforms;
    u.uInteriorAmbient.value = i.ambientScale;
    const strength = THREE.MathUtils.lerp(i.fillNight, i.fillDay, day.daylight);
    u.uInteriorFill.value.copy(this.fillColor).multiply(this.color.copy(day.ambientSky).lerp(day.lightColor, 0.3)).multiplyScalar(strength);
  }

  // Modifica un shader de MeshToonMaterial (llamar desde onBeforeCompile).
  patch(shader) {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vInteriorPosition;\nvarying vec3 vInteriorNormal;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vInteriorPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vInteriorNormal = normalize(mat3(modelMatrix) * objectNormal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        #define INTERIOR_LIGHTS ${this.count}
        varying vec3 vInteriorPosition;
        varying vec3 vInteriorNormal;
        uniform vec2 uInteriorCenter;
        uniform vec2 uInteriorHalf;
        uniform vec2 uInteriorRotation;
        uniform vec2 uInteriorHeight;
        uniform float uInteriorAmbient;
        uniform vec3 uInteriorFill;
        uniform vec3 uInteriorLightPosition[INTERIOR_LIGHTS];
        uniform vec3 uInteriorLightColor[INTERIOR_LIGHTS];
        uniform float uInteriorLightRange[INTERIOR_LIGHTS];`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          vec2 d = vInteriorPosition.xz - uInteriorCenter;
          vec2 local = vec2(d.x * uInteriorRotation.x - d.y * uInteriorRotation.y, d.x * uInteriorRotation.y + d.y * uInteriorRotation.x);
          bool inside = all(lessThanEqual(abs(local), uInteriorHalf))
            && vInteriorPosition.y >= uInteriorHeight.x && vInteriorPosition.y <= uInteriorHeight.y;
          if (inside) {
            reflectedLight.indirectDiffuse = reflectedLight.indirectDiffuse * uInteriorAmbient + diffuseColor.rgb * uInteriorFill;
            vec3 n = normalize(vInteriorNormal);
            for (int i = 0; i < INTERIOR_LIGHTS; i++) {
              vec3 toLight = uInteriorLightPosition[i] - vInteriorPosition;
              float distance = length(toLight);
              float falloff = clamp(1.0 - distance / uInteriorLightRange[i], 0.0, 1.0);
              float amount = max(dot(n, toLight / max(distance, 1e-4)), 0.0) * falloff * falloff;
              // Bandas como el resto de la luz (estética pixel).
              amount = floor(amount * ${CONFIG.interior.lightBands}.0) / ${CONFIG.interior.lightBands}.0;
              reflectedLight.directDiffuse += diffuseColor.rgb * uInteriorLightColor[i] * amount;
            }
          }
        }`);
  }
}
