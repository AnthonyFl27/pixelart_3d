import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createCamera, onResize } from './core/renderer.js';
import { GameLoop } from './core/loop.js';
import { PixelPipeline } from './render/pixelPipeline.js';
import { createTextures } from './world/textures.js';
import { createMaterials } from './world/materials.js';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Lighting } from './world/lighting.js';
import { loadLevel } from './world/levelLoader.js';
import { MEADOW } from './levels/meadow.js';

const level = MEADOW;

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);

const textures = createTextures();
const materials = createMaterials(textures);

const terrain = new Terrain(level, materials, textures);
scene.add(terrain.mesh);

const sky = new Sky(textures.noise);
scene.add(sky.mesh);

const lighting = new Lighting(scene);

const { colliders } = loadLevel(level, { scene, terrain, materials });

const { spawn } = level;
camera.position.set(spawn.x, terrain.getHeight(spawn.x, spawn.z) + CONFIG.player.eyeHeight, spawn.z);
camera.rotation.set(0, spawn.yaw, 0);

const pipeline = new PixelPipeline(renderer, scene, camera);
onResize((width, height) => pipeline.resize(width, height));

const loop = new GameLoop(renderer, {
  update(dt) {
    sky.update(dt, camera);
    lighting.update(camera.position, camera);
  },
  render() {
    pipeline.render();
  },
});

loop.start();
