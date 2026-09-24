import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Bucle principal: llama update(dt, elapsed) y render() en cada frame.
export class GameLoop {
  constructor(renderer, { update, render }) {
    this.renderer = renderer;
    this.update = update;
    this.render = render;
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer.reset();
    this.renderer.setAnimationLoop((timestamp) => this.tick(timestamp));
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  tick(timestamp) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), CONFIG.loop.maxDelta);
    this.update(dt, this.timer.getElapsed());
    this.render();
  }
}
