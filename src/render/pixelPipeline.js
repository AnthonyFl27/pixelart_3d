import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { MAX_PALETTE_SIZE, postfxVertexShader, postfxFragmentShader } from './shaders/postfx.js';

// Renderiza la escena a un render target de baja resolución y lo escala a
// pantalla con un factor entero, de modo que todos los píxeles miden lo mismo.
export class PixelPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.scale = 1;
    renderer.info.autoReset = false;

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(1, 1),
    });

    this.material = new THREE.ShaderMaterial({
      vertexShader: postfxVertexShader,
      fragmentShader: postfxFragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uScale: { value: 1 },
        uCameraNear: { value: camera.near },
        uCameraFar: { value: camera.far },
        uOutline: { value: false },
        uOutlineThreshold: { value: 0 },
        uOutlineStrength: { value: 0 },
        uPaletteQuantize: { value: false },
        uPalette: { value: createPaletteUniform(CONFIG.postfx.palette) },
        uPaletteSize: { value: Math.min(CONFIG.postfx.palette.length, MAX_PALETTE_SIZE) },
        uDithering: { value: false },
        uDitherStrength: { value: 0 },
        uColorLevels: { value: 2 },
      },
    });

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
  }

  // width/height: tamaño del canvas en píxeles CSS.
  resize(width, height) {
    const { pixelHeight } = CONFIG.render;
    this.renderer.setSize(width, height, false);

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.scale = Math.max(1, Math.round(size.y / pixelHeight));
    const internalWidth = Math.ceil(size.x / this.scale);
    const internalHeight = Math.ceil(size.y / this.scale);

    this.target.setSize(internalWidth, internalHeight);
    this.material.uniforms.uResolution.value.set(internalWidth, internalHeight);
    this.material.uniforms.uScale.value = this.scale;

    this.camera.aspect = internalWidth / internalHeight;
    this.camera.updateProjectionMatrix();
  }

  get internalSize() {
    return { width: this.target.width, height: this.target.height, scale: this.scale };
  }

  syncUniforms() {
    const u = this.material.uniforms;
    const fx = CONFIG.postfx;
    u.uCameraNear.value = this.camera.near;
    u.uCameraFar.value = this.camera.far;
    u.uOutline.value = fx.outline;
    u.uOutlineThreshold.value = fx.outlineThreshold;
    u.uOutlineStrength.value = fx.outlineStrength;
    u.uPaletteQuantize.value = fx.paletteQuantize;
    u.uDithering.value = fx.dithering;
    u.uDitherStrength.value = fx.ditherStrength;
    u.uColorLevels.value = fx.colorLevels;
  }

  render() {
    // Las estadísticas (draw calls) cubren el frame completo: sombras, escena y post-proceso.
    this.renderer.info.reset();
    this.syncUniforms();
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
}

// Colores hex en sRGB -> vec3 en sRGB (sin conversión a lineal).
function createPaletteUniform(hexColors) {
  const palette = [];
  for (let i = 0; i < MAX_PALETTE_SIZE; i++) {
    const hex = hexColors[Math.min(i, hexColors.length - 1)];
    palette.push(new THREE.Vector3(
      ((hex >> 16) & 255) / 255,
      ((hex >> 8) & 255) / 255,
      (hex & 255) / 255,
    ));
  }
  return palette;
}
