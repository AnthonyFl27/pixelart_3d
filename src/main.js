import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createCamera, onResize } from './core/renderer.js';
import { GameLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { PixelPipeline } from './render/pixelPipeline.js';
import { createTextures } from './world/textures.js';
import { createMaterials } from './world/materials.js';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Lighting } from './world/lighting.js';
import { loadLevel } from './world/levelLoader.js';
import { PlayerController } from './player/controller.js';
import { Overlay } from './ui/overlay.js';
import { Hud } from './ui/hud.js';
import { AmbientAudio } from './audio/ambient.js';
import { MEADOW } from './levels/meadow.js';

const level = MEADOW;

// --- Motor -------------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CONFIG.fog.color, CONFIG.fog.near, CONFIG.fog.far);
const pipeline = new PixelPipeline(renderer, scene, camera);
onResize((width, height) => pipeline.resize(width, height));

// --- Mundo -------------------------------------------------------------------
const textures = createTextures();
const materials = createMaterials(textures);

const terrain = new Terrain(level, materials, textures);
scene.add(terrain.mesh);

const sky = new Sky(textures.noise);
scene.add(sky.mesh);

const lighting = new Lighting(scene);
const { colliders } = loadLevel(level, { scene, terrain, materials });

// --- Jugador, audio y UI -----------------------------------------------------
const input = new Input(canvas);
const audio = new AmbientAudio();
const player = new PlayerController(camera, terrain, colliders, level.spawn, {
  onStep: (surface) => audio.step(surface),
});

const ui = document.getElementById('ui');
const hud = new Hud(ui, CONFIG.debug.showHud);
const overlay = new Overlay(ui, { title: level.name, onStart: start });

// Estados: 'start' -> 'playing' <-> 'paused'.
let state = 'start';

function setState(next) {
  if (state === next) return;
  state = next;
  const playing = state === 'playing';
  hud.setPlaying(playing);
  if (playing) {
    overlay.hide();
    audio.start();
  } else {
    overlay.showPaused();
    audio.suspend();
  }
}

let lockFailures = 0;

async function start() {
  audio.start();
  if (await input.requestLock()) {
    lockFailures = 0;
    setState('playing');
  } else if (++lockFailures >= 2) {
    // Sin Pointer Lock (iframe, navegador sin soporte...) se juega mirando con arrastre.
    setState('playing');
  } else {
    // Chrome rechaza capturar el ratón justo después de liberarlo: pedir otro clic.
    overlay.showRetry();
  }
}

input.on('lockchange', (locked) => {
  if (!locked && state === 'playing') setState('paused');
});
input.on('keydown', (code) => {
  if (code !== 'Escape' || state !== 'playing') return;
  input.exitLock();
  setState('paused');
});

// --- Bucle -------------------------------------------------------------------
const loop = new GameLoop(renderer, {
  update(dt) {
    if (state === 'playing') {
      player.update(dt, input);
    } else {
      input.consumeMouse();
    }
    if (input.wasPressed('F3')) hud.toggle();
    if (input.wasPressed('KeyM')) audio.toggleMute();

    sky.update(dt, camera);
    lighting.update(player.position, camera);
    hud.update(dt, {
      position: player.position,
      mode: player.mode,
      internal: pipeline.internalSize,
      drawCalls: renderer.info.render.calls,
      muted: audio.muted,
    });
    input.endFrame();
  },
  render() {
    pipeline.render();
  },
});

overlay.showStart();
loop.start();
