import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ViewModel, createStripeTexture, mergeByMaterial } from './viewModel.js';

// Icono 16x16 para la barra de inventario (ver ui/hotbar.js).
export const LANTERN_ICON = {
  palette: {
    K: '#1e1a18', I: '#5a5a5e', i: '#8a8a90', G: '#c8a860',
    Y: '#ffd890', O: '#ffa030', W: '#fff4c0', R: '#8a2a1e', r: '#b8402c',
  },
  rows: [
    '.....KKKKKK.....',
    '....K......K....',
    '....K......K....',
    '.....KiiiiK.....',
    '....KIiiiiIK....',
    '....KIGGGGIK....',
    '...K.GYYYYG.K...',
    '...K.GYWOYG.K...',
    '...K.GYOOYG.K...',
    '...K.GYYYYG.K...',
    '....KIGGGGIK....',
    '...KRrrrrrrRK...',
    '...KRrRRRRrRK...',
    '...KRRRRRRRRK...',
    '....KKKKKKKK....',
    '................',
  ],
};

// Farol de aceite en primera persona (spec v3, RF-403): cuelga del asa y se balancea al
// girar y al caminar. Su luz en el mundo es la luz de mano (handLight.js) con el perfil
// `CONFIG.lantern.light`, más cálida, estable y amplia que la de la antorcha.
export class Lantern extends ViewModel {
  constructor() {
    const l = CONFIG.lantern;
    super(l);
    this.lightConfig = l.light;

    const iron = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#4a4a4e', '#5a5a5e', '#3a3a3e', '#6a6a70']) });
    const tin = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#8a2a1e', '#7a2418', '#9a3424', '#6a1e14']) });
    const globe = new THREE.MeshBasicMaterial({ color: l.globeColor, transparent: true, opacity: l.globeOpacity, depthWrite: false, fog: false });

    // El cuerpo cuelga del asa: el origen del grupo es el punto de agarre. Las piezas se
    // fusionan por material.
    this.body = new THREE.Group();
    this.model.add(this.body);
    const parts = [];
    const add = (material, geometry, y, x = 0, z = 0) => parts.push({ material, geometry: geometry.translate(x, y, z) });
    add(iron, new THREE.BoxGeometry(0.07, 0.006, 0.006), 0);
    for (const x of [-0.035, 0.035]) add(iron, new THREE.BoxGeometry(0.006, 0.06, 0.006), -0.03, x);
    add(iron, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8, 1), -0.052);
    add(iron, new THREE.CylinderGeometry(0.035, 0.05, 0.035, 8, 1), -0.078);
    add(globe, new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8, 1), -0.145);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      add(iron, new THREE.BoxGeometry(0.006, 0.1, 0.006), -0.145, Math.cos(angle) * 0.047, Math.sin(angle) * 0.047);
    }
    add(iron, new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8, 1), -0.2);
    add(tin, new THREE.CylinderGeometry(0.058, 0.058, 0.045, 8, 1), -0.23);
    add(iron, new THREE.CylinderGeometry(0.06, 0.06, 0.008, 8, 1), -0.256);
    this.body.add(...mergeByMaterial(parts));

    // Llama: dos cajas sin niebla ni luz que laten despacio.
    this.flame = new THREE.Group();
    this.flame.add(new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.032, 0.014), new THREE.MeshBasicMaterial({ color: l.flameColor, fog: false })));
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.016, 0.007), new THREE.MeshBasicMaterial({ color: l.coreColor, fog: false }));
    core.position.y = -0.006;
    this.flame.add(core);
    this.flame.position.y = -0.165;
    this.body.add(this.flame);

    // Luz de la vista: ilumina el propio farol desde la llama.
    this.handLight = new THREE.PointLight(l.light.color, 0, 0.6, 1);
    this.handLight.position.y = -0.15;
    this.body.add(this.handLight);

    this.elapsed = 0;
    this.swing = 0;
    this.swingVelocity = 0;
  }

  get lightLevel() {
    return this.eased;
  }

  // context: { active, player, day }.
  update(dt, context) {
    const l = CONFIG.lantern;
    this.elapsed += dt;
    if (!super.update(dt, context)) return;

    // Péndulo amortiguado empujado por el giro y por los pasos.
    const push = -this.sway * l.swing * 8 + Math.sin(this.bobPhase) * this.moving * l.swing * 0.08;
    this.swingVelocity += (push - this.swing * 30 - this.swingVelocity * 4) * dt;
    this.swing += this.swingVelocity * dt;
    this.body.rotation.z = this.swing - this.sway * 2;

    const e = this.elapsed;
    const flicker = 1 + l.light.flicker * (0.6 * Math.sin(e * 7.3) + 0.4 * Math.sin(e * 17.9 + 0.7));
    this.flame.scale.set(1, flicker, 1);
    this.handLight.intensity = l.handLightIntensity * flicker * this.eased;
  }
}
