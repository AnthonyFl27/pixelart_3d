import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createCamera, onResize } from './core/renderer.js';
import { GameLoop } from './core/loop.js';
import { PixelPipeline } from './render/pixelPipeline.js';
import { createTextures } from './world/textures.js';
import { createMaterials } from './world/materials.js';
import { applyBoxUVs } from './world/geometryUtils.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = new THREE.Scene();

const { lighting } = CONFIG;
scene.add(new THREE.HemisphereLight(lighting.skyColor, lighting.groundColor, lighting.hemiIntensity));

const sun = new THREE.DirectionalLight(lighting.sunColor, lighting.sunIntensity);
sun.position.set(lighting.sunDirection.x, lighting.sunDirection.y, lighting.sunDirection.z).multiplyScalar(20);
scene.add(sun);

const materials = createMaterials(createTextures());

// Escena de prueba provisional (se sustituye por el mundo en la fase 3).
const testCubes = [];
if (CONFIG.debug.testCube) {
  const cubeGeometry = applyBoxUVs(new THREE.BoxGeometry(2, 2, 2));
  [materials.grass, materials.stone, materials.dirt].forEach((material, i) => {
    const cube = new THREE.Mesh(cubeGeometry, material);
    cube.position.set((i - 1) * 3.5, 1.5, 0);
    scene.add(cube);
    testCubes.push(cube);
  });

  const pillar = new THREE.Mesh(applyBoxUVs(new THREE.BoxGeometry(1.4, 4, 1)), materials.stone);
  pillar.position.set(0, 2, -6);
  scene.add(pillar);

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 16), materials.stone);
  sphere.position.set(7, 1.2, 2);
  scene.add(sphere);

  const groundGeometry = applyBoxUVs(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2));
  scene.add(new THREE.Mesh(groundGeometry, materials.grass));
}

const pipeline = new PixelPipeline(renderer, scene, camera);
onResize((width, height) => pipeline.resize(width, height));

const loop = new GameLoop(renderer, {
  update(dt) {
    for (const cube of testCubes) {
      cube.rotation.x += dt * 0.3;
      cube.rotation.y += dt * 0.5;
    }
  },
  render() {
    pipeline.render();
  },
});

loop.start();
