import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Mapa de suelo: textura de datos que cubre todo el terreno con el peso de cada
// capa de suelo desnudo (R = tierra, G = barro, B = grava). Donde ninguna capa
// supera 0,5 hay césped. El shader del terreno la muestrea en la rejilla de texels
// y le suma ruido para que los bordes queden irregulares y pixelados.

export const GROUND_LAYERS = ['dirt', 'mud', 'gravel'];

export class GroundMap {
  constructor(size, features) {
    const resolution = CONFIG.groundMap.resolution;
    this.size = size;
    this.half = size / 2;
    this.resolution = resolution;
    this.width = Math.round(size * resolution);
    this.data = new Uint8Array(this.width * this.width * 4);
    for (const feature of features) {
      const grounds = Array.isArray(feature.ground) ? feature.ground : [feature.ground];
      for (const ground of grounds) if (ground) this.paint(feature, ground);
    }
    this.texture = new THREE.DataTexture(this.data, this.width, this.width, THREE.RGBAFormat);
    this.texture.name = 'groundMap';
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  // Pinta una capa dentro del rectángulo de la feature (se queda con el máximo).
  paint(bounds, { layer, weight }) {
    const channel = GROUND_LAYERS.indexOf(layer);
    if (channel < 0) throw new Error(`Capa de suelo desconocida: "${layer}"`);
    const pad = CONFIG.groundMap.range;
    const x0 = this.toPixel(bounds.minX - pad);
    const x1 = this.toPixel(bounds.maxX + pad);
    const z0 = this.toPixel(bounds.minZ - pad);
    const z1 = this.toPixel(bounds.maxZ + pad);
    for (let pz = z0; pz <= z1; pz++) {
      const z = (pz + 0.5) / this.resolution - this.half;
      for (let px = x0; px <= x1; px++) {
        const x = (px + 0.5) / this.resolution - this.half;
        const value = Math.round(weight(x, z) * 255);
        const index = (pz * this.width + px) * 4 + channel;
        if (value > this.data[index]) this.data[index] = value;
      }
    }
  }

  toPixel(v) {
    return THREE.MathUtils.clamp(Math.floor((v + this.half) * this.resolution), 0, this.width - 1);
  }

  // Pesos interpolados [dirt, mud, gravel] en (x, z).
  weights(x, z) {
    const fx = THREE.MathUtils.clamp((x + this.half) * this.resolution - 0.5, 0, this.width - 1.001);
    const fz = THREE.MathUtils.clamp((z + this.half) * this.resolution - 0.5, 0, this.width - 1.001);
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const result = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const at = (dx, dz) => this.data[((iz + dz) * this.width + ix + dx) * 4 + c];
      const top = at(0, 0) + (at(1, 0) - at(0, 0)) * tx;
      const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * tx;
      result[c] = (top + (bottom - top) * tz) / 255;
    }
    return result;
  }

  // Capa dominante en (x, z): 'grass' | 'dirt' | 'mud' | 'gravel'.
  surfaceAt(x, z) {
    const w = this.weights(x, z);
    let best = 'grass';
    let max = 0.5;
    for (let c = 0; c < 3; c++) {
      if (w[c] > max) {
        max = w[c];
        best = GROUND_LAYERS[c];
      }
    }
    return best;
  }

  // Peso máximo de suelo desnudo (0,5 = borde).
  bareWeight(x, z) {
    return Math.max(...this.weights(x, z));
  }
}
