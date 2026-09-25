import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRenderer, createCamera, onResize } from './core/renderer.js';
import { GameLoop } from './core/loop.js';
import { Input } from './core/input.js';
import { PixelPipeline } from './render/pixelPipeline.js';
import { createTextures } from './world/textures.js';
import { createMaterials } from './world/materials.js';
import { InteriorLighting } from './world/interiorLighting.js';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { Lighting } from './world/lighting.js';
import { DayCycle } from './world/dayCycle.js';
import { loadLevel } from './world/levelLoader.js';
import { zoneAt } from './world/zones.js';
import { Interiors } from './world/interiors.js';
import { Vegetation } from './world/vegetation.js';
import { StreamWater } from './world/stream.js';
import { PlayerController } from './player/controller.js';
import { Overlay } from './ui/overlay.js';
import { Hud } from './ui/hud.js';
import { Hotbar } from './ui/hotbar.js';
import { Prompt } from './ui/prompt.js';
import { Interaction } from './interaction/interaction.js';
import { Inventory } from './items/inventory.js';
import { Torch } from './items/torch.js';
import { Shotgun } from './items/shotgun.js';
import { Lantern } from './items/lantern.js';
import { HandLight } from './items/handLight.js';
import { AmbientAudio } from './audio/ambient.js';
import { Birds } from './fauna/birds.js';
import { MEADOW } from './levels/meadow.js';

const level = MEADOW;

// --- Motor -------------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const camera = createCamera();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, CONFIG.fog.near, CONFIG.fog.far);
const pipeline = new PixelPipeline(renderer, scene, camera);
onResize((width, height) => pipeline.resize(width, height));

// --- Mundo -------------------------------------------------------------------
const textures = createTextures();
const interiorLighting = new InteriorLighting();
const materials = createMaterials(textures, interiorLighting);

const terrain = new Terrain(level, materials, textures);
scene.add(terrain.mesh);

const sky = new Sky(textures.noise);
scene.add(sky.mesh);

const lighting = new Lighting(scene);

// Parámetros de URL para probar: `?hora=19.5` y `?pos=x,z,yaw` (posición inicial).
const params = new URLSearchParams(window.location.search);
const dayCycle = new DayCycle();
const startHour = parseFloat(params.get('hora'));
if (Number.isFinite(startHour)) {
  dayCycle.time = (((startHour / 24) % 1) + 1) % 1;
  dayCycle.update(0);
}
// Las rocas del cauce se añaden como estructuras del nivel.
const streamRocks = terrain.stream ? terrain.stream.rockEntries() : [];
const { colliders, zones, interactables, interiors: interiorGroups } = loadLevel({ ...level, structures: [...level.structures, ...streamRocks] }, { scene, terrain, materials });
const streamWater = terrain.stream ? new StreamWater(terrain.stream, textures.noise) : null;
if (streamWater) scene.add(streamWater.mesh);
const vegetation = new Vegetation(level, terrain, colliders, materials.gradientMap);
scene.add(...vegetation.meshes);

// --- Jugador, audio y UI -----------------------------------------------------
const input = new Input(canvas);
const audio = new AmbientAudio();
const [spawnX, spawnZ, spawnYaw] = (params.get('pos') ?? '').split(',').map(parseFloat);
const spawn = Number.isFinite(spawnX) && Number.isFinite(spawnZ)
  ? { x: spawnX, z: spawnZ, yaw: Number.isFinite(spawnYaw) ? spawnYaw : 0 }
  : level.spawn;
const player = new PlayerController(camera, terrain, colliders, spawn, {
  onStep: (surface) => audio.step(surface),
});

const birds = new Birds(level, terrain, colliders, {
  onChirp: (pan, volume) => audio.chirp(pan, volume),
});
scene.add(birds.mesh);

// Objetos interactivos (puertas…): sus colisionadores se suman a los del jugador.
const interaction = new Interaction({ scene, camera, colliders });
const cabinZone = zones.find((zone) => zone.name === 'cabin');
if (cabinZone) interiorLighting.setZone(cabinZone);
interaction.load(interactables, { materials, interiorLighting });
const interiors = new Interiors(interiorGroups);
interiors.track(interaction.items);
let indoor = 0;

const inventory = new Inventory();
// Objetos en primera persona por id de ITEMS; la antorcha y el farol comparten la luz de mano.
const torch = new Torch();
const shotgun = new Shotgun();
const lantern = new Lantern();
const viewModels = { torch, shotgun, lantern };
for (const viewModel of Object.values(viewModels)) pipeline.addOverlay(viewModel);
const handLight = new HandLight();
scene.add(handLight.light);

const ui = document.getElementById('ui');
const hud = new Hud(ui, CONFIG.debug.showHud);
const hotbar = new Hotbar(ui, inventory);
const prompt = new Prompt(ui, CONFIG.interaction.key.replace('Key', ''));
const overlay = new Overlay(ui, { title: level.name, onStart: start });

// Estados: 'start' -> 'playing' <-> 'paused'.
let state = 'start';

function setState(next) {
  if (state === next) return;
  state = next;
  const playing = state === 'playing';
  prompt.setPlaying(playing);
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
      inventory.update(input);
      prompt.show(interaction.update(dt, input, { player, audio, inventory }));
      dayCycle.update(dt * (input.isDown('KeyT') ? CONFIG.dayCycle.fastForward : 1));
    } else {
      input.consumeMouse();
    }
    if (input.wasPressed('F3')) hud.toggle();
    if (input.wasPressed('KeyM')) audio.toggleMute();

    const day = dayCycle.state;
    sky.update(dt, camera, day);
    vegetation.update(dt);
    const zone = zoneAt(zones, player.position);
    indoor += ((zone ? 1 : 0) - indoor) * Math.min(1, dt * 3);
    lighting.update(player.position, camera, day, indoor);
    interiorLighting.update(day);
    interiors.update(player.position);
    scene.fog.color.copy(day.horizon);
    // El objeto seleccionado sale cuando el anterior ya se ha guardado.
    inventory.setExternal('shells', shotgun.loadedCount);
    const equipped = inventory.equippedItem?.id;
    const holstering = Object.entries(viewModels).some(([id, viewModel]) => id !== equipped && viewModel.visible);
    for (const [id, viewModel] of Object.entries(viewModels)) {
      viewModel.update(dt, { active: id === equipped && !holstering, player, day });
    }
    handLight.update(dt, camera, [torch, lantern]);
    streamWater?.update(dt, day);
    audio.updateListener(camera);
    audio.updateWater(dt, player.position, terrain.stream);
    birds.update(state === 'playing' ? dt : 0, { day, player, camera });
    hud.update(dt, {
      position: player.position,
      mode: player.mode,
      internal: pipeline.internalSize,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      muted: audio.muted,
      clock: `${dayCycle.clock} ${day.phase}`,
      birds: `${birds.visibleCount} (${birds.perchedCount} posados)`,
      surface: player.surface,
      zone: zone?.name ?? 'exterior',
      target: interaction.target ? `${interaction.target.name} (${interaction.promptText})` : '-',
      water: audio.water ? `${audio.water.distance.toFixed(1)} m vol ${audio.water.volume.toFixed(2)}` : '-',
    });
    input.endFrame();
  },
  render() {
    pipeline.render();
  },
});

overlay.showStart();
loop.start();
document.getElementById('boot')?.remove();
