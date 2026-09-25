import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Cúpula de cielo centrada en la cámara: degradado según la hora, resplandor del
// horizonte del lado del sol, nubes teñidas, sol, luna con cráteres y estrellas.

const vertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunDisc;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform vec3 uMoonColor;
  uniform vec3 uMoonCraterColor;
  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform mat3 uStarRotation;
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uStars;
  uniform float uCloudScale;
  uniform float uCloudStretch;
  uniform float uCloudCoverage;
  uniform float uCloudSteps;
  uniform vec2 uCloudWind;
  uniform float uSunSize;
  uniform float uSunGlowSize;
  uniform float uMoonSize;
  uniform float uGlowPower;
  uniform float uStarDensity;
  uniform float uStarProbability;
  uniform float uStarSize;

  varying vec3 vDirection;

  vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }

  float starField(vec3 dir) {
    vec3 p = uStarRotation * dir * uStarDensity;
    vec3 cell = floor(p);
    vec3 h = hash33(cell);
    if (h.x > uStarProbability) return 0.0;
    vec3 center = cell + 0.5 + (h - 0.5) * 0.5;
    if (length(p - center) > uStarSize) return 0.0;
    float twinkle = 0.7 + 0.3 * sin(uTime * (1.5 + h.z * 3.0) + h.y * 40.0);
    return (0.35 + 0.65 * h.y) * twinkle;
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float up = max(dir.y, 0.0);
    vec3 color = mix(uHorizon, uZenith, pow(up, 0.6));

    // Resplandor del horizonte hacia el lado del sol (amanecer/atardecer).
    vec2 sunFlat = normalize(uSunDirection.xz + vec2(1e-4));
    vec2 dirFlat = normalize(dir.xz + vec2(1e-4));
    float toward = pow(max(dot(dirFlat, sunFlat), 0.0), uGlowPower);
    float glow = toward * (1.0 - smoothstep(0.0, 0.45, up));
    color = mix(color, uGlow, glow);

    // Estrellas (tapadas por las nubes y el horizonte).
    float stars = uStars * starField(dir) * smoothstep(0.02, 0.15, dir.y);

    // Nubes proyectadas sobre un plano horizontal.
    float density = 0.0;
    if (dir.y > 0.0) {
      vec2 uv = dir.xz / (dir.y + 0.15) * uCloudScale;
      uv.x *= uCloudStretch;
      uv += uCloudWind * uTime;
      float n = texture2D(uNoise, uv).r * 0.6
              + texture2D(uNoise, uv * 2.3 + 0.17).r * 0.3
              + texture2D(uNoise, uv * 5.7 + 0.61).r * 0.1;
      density = smoothstep(uCloudCoverage, uCloudCoverage + 0.18, n);
      density = floor(density * uCloudSteps + 0.5) / uCloudSteps;
      density *= smoothstep(0.0, 0.2, dir.y);
    }
    color += vec3(0.9, 0.95, 1.0) * stars * (1.0 - density);

    // Luna: disco con cráteres + halo tenue.
    float moonDot = dot(dir, uMoonDirection);
    if (dir.y > -0.01) {
      float moonGlow = smoothstep(cos(uMoonSize * 5.0), 1.0, moonDot);
      color += uMoonColor * floor(moonGlow * 3.0) / 3.0 * 0.12 * (1.0 - density);
      if (moonDot > cos(uMoonSize)) {
        vec3 t1 = normalize(cross(uMoonDirection, vec3(0.0, 1.0, 0.0)));
        vec3 t2 = cross(t1, uMoonDirection);
        vec2 local = vec2(dot(dir, t1), dot(dir, t2)) / sin(uMoonSize);
        float crater = texture2D(uNoise, local * 0.35 + 0.5).r;
        vec3 moon = crater > 0.53 ? uMoonCraterColor : uMoonColor;
        color = mix(color, moon, 1.0 - density * 0.7);
      }
    }

    // Sol: halo en bandas + disco.
    float sunDot = dot(dir, uSunDirection);
    if (dir.y > -0.01) {
      float sunGlow = smoothstep(cos(uSunGlowSize), 1.0, sunDot);
      color += uSunDisc * floor(sunGlow * 4.0) / 4.0 * 0.25;
      if (sunDot > cos(uSunSize)) color = mix(color, uSunDisc, 1.0 - density * 0.5);
    }

    // Nubes encima, teñidas por la luz del momento.
    vec3 cloud = mix(uCloudShade, uCloudLit, smoothstep(0.4, 1.0, density));
    color = mix(color, cloud, density * 0.9);

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Sky {
  constructor(noiseTexture) {
    const s = CONFIG.sky;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uGlow: { value: new THREE.Color() },
        uSunDisc: { value: new THREE.Color() },
        uCloudLit: { value: new THREE.Color() },
        uCloudShade: { value: new THREE.Color() },
        uMoonColor: { value: new THREE.Color(s.moonColor) },
        uMoonCraterColor: { value: new THREE.Color(s.moonCraterColor) },
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uMoonDirection: { value: new THREE.Vector3(0, -1, 0) },
        uStarRotation: { value: new THREE.Matrix3() },
        uNoise: { value: noiseTexture },
        uTime: { value: 0 },
        uStars: { value: 0 },
        uCloudScale: { value: s.cloudScale },
        uCloudStretch: { value: s.cloudStretch },
        uCloudCoverage: { value: s.cloudCoverage },
        uCloudSteps: { value: s.cloudSteps },
        uCloudWind: { value: new THREE.Vector2(s.cloudWind.x, s.cloudWind.z) },
        uSunSize: { value: s.sunSize },
        uSunGlowSize: { value: s.sunGlowSize },
        uMoonSize: { value: s.moonSize },
        uGlowPower: { value: s.horizonGlowPower },
        uStarDensity: { value: s.starDensity },
        uStarProbability: { value: s.starProbability },
        uStarSize: { value: s.starSize },
      },
    });

    const radius = CONFIG.camera.far * 0.9;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(dt, camera, day) {
    const u = this.material.uniforms;
    this.mesh.position.copy(camera.position);
    u.uTime.value += dt;
    u.uZenith.value.copy(day.zenith);
    u.uHorizon.value.copy(day.horizon);
    u.uGlow.value.copy(day.glow);
    u.uSunDisc.value.copy(day.sunDisc);
    u.uCloudLit.value.copy(day.cloudLit);
    u.uCloudShade.value.copy(day.cloudShade);
    u.uSunDirection.value.copy(day.sunDirection);
    u.uMoonDirection.value.copy(day.moonDirection);
    u.uStarRotation.value.copy(day.starRotation);
    u.uStars.value = day.stars;
  }
}
