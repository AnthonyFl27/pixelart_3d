import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
  renderer.setClearColor(CONFIG.render.clearColor);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  // Un shader que no compila en esta GPU se muestra en pantalla (ver index.html).
  renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    const log = [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader)]
      .filter(Boolean).join('\n').replace(/\0/g, '').trim();
    console.error(`Shader error:\n${log}`);
    window.__bootError?.(`shader: ${log.slice(0, 400)}`);
  };
  return renderer;
}

export function createCamera() {
  const { fov, near, far } = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
  camera.rotation.order = 'YXZ';
  return camera;
}

// Llama callback(width, height) ahora y en cada cambio de tamaño de la ventana.
export function onResize(callback) {
  const handle = () => callback(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', handle);
  handle();
  return () => window.removeEventListener('resize', handle);
}
