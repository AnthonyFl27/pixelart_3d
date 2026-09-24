import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
  renderer.setClearColor(CONFIG.render.clearColor);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  return renderer;
}

export function createCamera() {
  const { fov, near, far, startPosition, lookAt } = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
  camera.position.set(startPosition.x, startPosition.y, startPosition.z);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
  return camera;
}

// Llama callback(width, height) ahora y en cada cambio de tamaño de la ventana.
export function onResize(callback) {
  const handle = () => callback(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', handle);
  handle();
  return () => window.removeEventListener('resize', handle);
}
