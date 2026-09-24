import * as THREE from 'three';
import { CONFIG } from '../config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
  renderer.setClearColor(CONFIG.render.clearColor);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  return renderer;
}

export function createCamera() {
  const { fov, near, far, startPosition, lookAt } = CONFIG.camera;
  const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, near, far);
  camera.position.set(startPosition.x, startPosition.y, startPosition.z);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
  return camera;
}

export function onResize(renderer, camera, callback) {
  const handle = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    callback?.(width, height);
  };
  window.addEventListener('resize', handle);
  return () => window.removeEventListener('resize', handle);
}
