import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ViewModel, createStripeTexture, mergeByMaterial } from './viewModel.js';

// Iconos 16x16 para la barra de inventario (ver ui/hotbar.js).
export const SHOTGUN_ICON = {
  palette: {
    K: '#1e2024', G: '#6e737c', g: '#4a4e56', H: '#c0c8d0',
    L: '#b07840', W: '#8a5a32', w: '#5a3a1e',
  },
  rows: [
    '................',
    '..............KK',
    '.............KHG',
    '............KHGg',
    '...........KHGgK',
    '..........KHGgK.',
    '.........KHGgK..',
    '........KHGgK...',
    '.......KGGgK....',
    '......KLWgKK....',
    '.....KLWWwKgK...',
    '....KLWWwK.K....',
    '...KLWWwK.......',
    '..KLWWwK........',
    '..KwwwK.........',
    '...KKK..........',
  ],
};

export const SHELLS_ICON = {
  palette: {
    K: '#1e1414', R: '#c0302a', r: '#ee6a5a', d: '#7a1a16',
    Y: '#e8b848', y: '#8a6a20', h: '#fff0a0',
  },
  rows: [
    '................',
    '...KKKK.........',
    '..KdRRdK........',
    '..KRrRdK..KKKK..',
    '..KRrRdK.KdRRdK.',
    '..KRrRdK.KRrRdK.',
    '..KRrRdK.KRrRdK.',
    '..KRrRdK.KRrRdK.',
    '..KRrRdK.KRrRdK.',
    '..KhYYyK.KRrRdK.',
    '.KhYYYYyKKRrRdK.',
    '.KyyyyyyKKhYYyK.',
    '..KKKKKKKhYYYYyK',
    '........KyyyyyyK',
    '.........KKKKKK.',
    '................',
  ],
};

// Escopeta de doble cañón recortada en primera persona (spec v3, 4.11): cañones de metal
// gris con brillos y empuñadura de madera. Los cañones cuelgan de `barrels`, que gira
// sobre la bisagra al abrirla. Se coge descargada: los dos cañones vacíos.
export class Shotgun extends ViewModel {
  constructor() {
    const s = CONFIG.shotgun;
    super(s);
    this.barrelState = ['empty', 'empty']; // derecho, izquierdo: loaded | spent | empty

    this.keyLight = new THREE.DirectionalLight(0xffffff, 0);
    this.keyLight.position.set(-0.6, 1, 0.4);
    this.scene.add(this.keyLight);

    const metal = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#5a5e66', '#5a5e66', '#62666e', '#4e525a']) });
    const bright = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#8a9098', '#8a9098', '#9aa0a8', '#7a8088']) });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
    const wood = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#8a5a32', '#7a4e2c', '#6b4424', '#8a5a32']) });
    // Piezas fijas y piezas de los cañones (giran sobre la bisagra), fusionadas por material.
    const body = [];
    const hinged = [];
    const box = (parts, material, [w, h, d], [x, y, z], rotationX = 0) => {
      const geometry = new THREE.BoxGeometry(w, h, d).rotateX(rotationX).translate(x, y, z);
      parts.push({ material, geometry });
    };

    // Báscula (cajón de mecanismos), palanca de apertura y guardamonte con gatillos.
    box(body, bright, [0.058, 0.055, 0.09], [0, 0, 0.045]);
    box(body, bright, [0.012, 0.008, 0.035], [0.008, 0.031, 0.075]);
    box(body, dark, [0.008, 0.006, 0.05], [0, -0.034, 0.06]);
    box(body, dark, [0.008, 0.024, 0.006], [0, -0.046, 0.083]);
    box(body, dark, [0.006, 0.018, 0.006], [0, -0.038, 0.055]);
    // Empuñadura de pistola inclinada hacia atrás, culata recortada y cantonera.
    box(body, wood, [0.042, 0.045, 0.08], [0, -0.01, 0.13]);
    const tilt = -0.45;
    const gripAt = (y) => [0, -0.02 + y * Math.cos(tilt), 0.165 + y * Math.sin(tilt)];
    box(body, wood, [0.04, 0.11, 0.05], gripAt(-0.05), tilt);
    box(body, dark, [0.042, 0.012, 0.054], gripAt(-0.108), tilt);

    // Cañones sobre la bisagra (parte delantera e inferior de la báscula).
    const length = 0.34;
    for (const x of [-0.017, 0.017]) {
      hinged.push({ material: metal, geometry: new THREE.CylinderGeometry(0.016, 0.016, length, 8, 1).rotateX(Math.PI / 2).translate(x, 0.03, -length / 2) });
      hinged.push({ material: dark, geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.012, 8, 1).rotateX(Math.PI / 2).translate(x, 0.03, -length + 0.006) });
    }
    box(hinged, bright, [0.01, 0.006, length], [0, 0.049, -length / 2]);
    box(hinged, wood, [0.046, 0.028, 0.13], [0, 0.002, -0.08]);

    this.model.add(...mergeByMaterial(body));
    this.barrels = new THREE.Group();
    this.barrels.position.set(0, -0.02, 0);
    this.barrels.add(...mergeByMaterial(hinged));
    this.model.add(this.barrels);
  }

  // Cartuchos en los cañones (cuentan para el límite de munición).
  get loadedCount() {
    return this.barrelState.filter((state) => state === 'loaded').length;
  }

  // context: { active, player, day }.
  update(dt, context) {
    if (!super.update(dt, context)) return;
    const { day } = context;
    this.keyLight.color.copy(day.lightColor);
    this.keyLight.intensity = day.lightIntensity * CONFIG.shotgun.keyLight;
  }
}
