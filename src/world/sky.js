import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Cúpula de cielo centrada en la cámara: degradado, nubes animadas por capas y sol.

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
  uniform vec3 uCloudColor;
  uniform vec3 uCloudShade;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform sampler2D uNoise;
  uniform float uTime;
  uniform float uCloudScale;
  uniform float uCloudStretch;
  uniform float uCloudCoverage;
  uniform float uCloudSteps;
  uniform vec2 uCloudWind;
  uniform float uSunSize;
  uniform float uSunGlowSize;

  varying vec3 vDirection;

  void main() {
    vec3 dir = normalize(vDirection);
    float up = max(dir.y, 0.0);
    vec3 color = mix(uHorizon, uZenith, pow(up, 0.6));

    // Nubes proyectadas sobre un plano horizontal.
    if (dir.y > 0.0) {
      vec2 uv = dir.xz / (dir.y + 0.15) * uCloudScale;
      uv.x *= uCloudStretch;
      uv += uCloudWind * uTime;
      float n = texture2D(uNoise, uv).r * 0.6
              + texture2D(uNoise, uv * 2.3 + 0.17).r * 0.3
              + texture2D(uNoise, uv * 5.7 + 0.61).r * 0.1;
      float density = smoothstep(uCloudCoverage, uCloudCoverage + 0.18, n);
      density = floor(density * uCloudSteps + 0.5) / uCloudSteps;
      density *= smoothstep(0.0, 0.2, dir.y);
      vec3 cloud = mix(uCloudShade, uCloudColor, smoothstep(0.4, 1.0, density));
      color = mix(color, cloud, density * 0.9);
    }

    // Sol: disco + halo en bandas.
    float sunDot = dot(dir, normalize(uSunDirection));
    float glow = smoothstep(cos(uSunGlowSize), 1.0, sunDot);
    color += uSunColor * floor(glow * 4.0) / 4.0 * 0.25;
    if (sunDot > cos(uSunSize)) color = uSunColor;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Sky {
  constructor(noiseTexture) {
    const s = CONFIG.sky;
    const sunDirection = CONFIG.lighting.sunDirection;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color(s.zenithColor) },
        uHorizon: { value: new THREE.Color(s.horizonColor) },
        uCloudColor: { value: new THREE.Color(s.cloudColor) },
        uCloudShade: { value: new THREE.Color(s.cloudShadeColor) },
        uSunColor: { value: new THREE.Color(s.sunColor) },
        uSunDirection: { value: new THREE.Vector3(sunDirection.x, sunDirection.y, sunDirection.z) },
        uNoise: { value: noiseTexture },
        uTime: { value: 0 },
        uCloudScale: { value: s.cloudScale },
        uCloudStretch: { value: s.cloudStretch },
        uCloudCoverage: { value: s.cloudCoverage },
        uCloudSteps: { value: s.cloudSteps },
        uCloudWind: { value: new THREE.Vector2(s.cloudWind.x, s.cloudWind.z) },
        uSunSize: { value: s.sunSize },
        uSunGlowSize: { value: s.sunGlowSize },
      },
    });

    const radius = CONFIG.camera.far * 0.9;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  update(dt, camera) {
    this.mesh.position.copy(camera.position);
    this.material.uniforms.uTime.value += dt;
  }
}
