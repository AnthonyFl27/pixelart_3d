import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createCamera, onResize } from './core/renderer.js';
import { GameLoop } from './core/loop.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = new THREE.Scene();

const { lighting } = CONFIG;
scene.add(new THREE.HemisphereLight(lighting.skyColor, lighting.groundColor, lighting.hemiIntensity));

const sun = new THREE.DirectionalLight(lighting.sunColor, lighting.sunIntensity);
sun.position.set(lighting.sunDirection.x, lighting.sunDirection.y, lighting.sunDirection.z).multiplyScalar(20);
scene.add(sun);

let testCube = null;
if (CONFIG.debug.testCube) {
  testCube = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshLambertMaterial({ color: 0x9a948a }),
  );
  testCube.position.set(0, 1.5, 0);
  scene.add(testCube);
}

onResize(renderer, camera);

const loop = new GameLoop(renderer, {
  update(dt) {
    if (testCube) {
      testCube.rotation.x += dt * 0.5;
      testCube.rotation.y += dt * 0.8;
    }
  },
  render() {
    renderer.render(scene, camera);
  },
});

loop.start();
