import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createRandom, deriveSeed } from '../core/noise.js';
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

// Escopeta de doble cañón recortada en primera persona (spec v3, 4.11 y 4.12): cañones de
// metal gris con brillos y empuñadura de madera. Los cañones cuelgan de `barrels`, que gira
// sobre la bisagra al abrirla y deja ver las recámaras (culotes de latón o vacías).
//
// Estados: idle → (disparo, `fireCooldown`) → idle y
//          idle → reloading (bajar → abrir → expulsar → insertar ×n → cerrar → subir) → idle.
// Cada cañón (0 derecho, 1 izquierdo) está `loaded`, `spent` o `empty`; el estado se
// conserva al guardarla. Se coge descargada. Los efectos en el mundo (perdigones, humo,
// vainas, sonidos) los hace main.js con `hooks`: { fire(barrel), eject(barrels), sound(name) }.

const RIGHT = 0;
const LEFT = 1;
const BARREL_X = [0.017, -0.017];  // derecho, izquierdo (x del modelo)
const BARREL_Y = 0.03;             // eje de los cañones respecto a la bisagra
const BREECH_Z = 0.05;             // recámaras, detrás de la bisagra
const BARREL_LENGTH = 0.34;
const MUZZLE_Z = BREECH_Z - BARREL_LENGTH;

export class Shotgun extends ViewModel {
  constructor() {
    const s = CONFIG.shotgun;
    super(s);
    this.barrelState = ['empty', 'empty'];
    this.hooks = {};
    this.random = createRandom(deriveSeed(CONFIG.seed, 'shotgun'));

    this.keyLight = new THREE.DirectionalLight(0xffffff, 0);
    this.keyLight.position.set(-0.6, 1, 0.4);
    this.scene.add(this.keyLight);

    const metal = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#5a5e66', '#5a5e66', '#62666e', '#4e525a']) });
    const bright = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#8a9098', '#8a9098', '#9aa0a8', '#7a8088']) });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2c30 });
    const wood = new THREE.MeshLambertMaterial({ map: createStripeTexture(['#8a5a32', '#7a4e2c', '#6b4424', '#8a5a32']) });
    this.chamberMaterials = {
      loaded: new THREE.MeshLambertMaterial({ color: 0xe0b040 }),
      spent: new THREE.MeshLambertMaterial({ color: 0x8a6a28 }),
      empty: new THREE.MeshBasicMaterial({ color: 0x0c0c0e }),
    };
    // Piezas fijas y piezas de los cañones (giran sobre la bisagra), fusionadas por material.
    const body = [];
    const hinged = [];
    const box = (parts, material, [w, h, d], [x, y, z], rotationX = 0) => {
      const geometry = new THREE.BoxGeometry(w, h, d).rotateX(rotationX).translate(x, y, z);
      parts.push({ material, geometry });
    };

    // Báscula (cajón de mecanismos), palanca de apertura y guardamonte con gatillos.
    box(body, bright, [0.07, 0.055, 0.09], [0, 0, 0.045]);
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

    // Cañones sobre la bisagra (parte delantera e inferior de la báscula); las recámaras
    // quedan dentro de la báscula al cerrar.
    for (const x of BARREL_X) {
      hinged.push({ material: metal, geometry: new THREE.CylinderGeometry(0.016, 0.016, BARREL_LENGTH, 8, 1).rotateX(Math.PI / 2).translate(x, BARREL_Y, (BREECH_Z + MUZZLE_Z) / 2) });
      hinged.push({ material: dark, geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.012, 8, 1).rotateX(Math.PI / 2).translate(x, BARREL_Y, MUZZLE_Z + 0.006) });
    }
    box(hinged, bright, [0.01, 0.006, BARREL_LENGTH], [0, BARREL_Y + 0.019, (BREECH_Z + MUZZLE_Z) / 2]);
    box(hinged, wood, [0.046, 0.028, 0.13], [0, 0.002, -0.08]);

    this.model.add(...mergeByMaterial(body));
    this.barrels = new THREE.Group();
    this.barrels.position.set(0, -0.02, 0);
    this.barrels.add(...mergeByMaterial(hinged));
    this.model.add(this.barrels);

    // Recámaras: culote de latón (cargado), latón oscuro (disparado) o hueco negro.
    const discGeometry = new THREE.CylinderGeometry(0.013, 0.013, 0.004, 8, 1).rotateX(Math.PI / 2);
    this.chambers = BARREL_X.map((x) => {
      const disc = new THREE.Mesh(discGeometry, this.chamberMaterials.empty);
      disc.position.set(x, BARREL_Y, BREECH_Z + 0.001);
      this.barrels.add(disc);
      return disc;
    });

    // Cartucho que se introduce al recargar (tubo rojo y culote de latón a lo largo de Z).
    this.shell = new THREE.Group();
    const shellBody = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.06, 8, 1).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xb02a20 }));
    const shellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 8, 1).rotateX(Math.PI / 2), this.chamberMaterials.loaded);
    shellBase.position.z = 0.035;
    this.shell.add(shellBody, shellBase);
    this.shell.visible = false;
    this.model.add(this.shell);

    // Fogonazo: plano pixel art por fotogramas en la boca del cañón, sin niebla ni luz.
    this.flashFrames = createFlashFrames(s.flash.frames, this.random);
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(s.flash.size, s.flash.size),
      new THREE.MeshBasicMaterial({ map: this.flashFrames[0], transparent: true, alphaTest: 0.5, depthWrite: false, fog: false, toneMapped: false }),
    );
    this.flash.visible = false;
    this.barrels.add(this.flash);
    // Luces del fogonazo: una en la vista (ilumina el arma) y otra en el mundo (main.js la
    // añade a la escena). Siempre presentes, con intensidad 0 en reposo.
    const f = s.flash.light;
    this.viewFlash = new THREE.PointLight(f.color, 0, 1.2, 1);
    this.scene.add(this.viewFlash);
    this.flashLight = new THREE.PointLight(f.color, 0, f.distance, f.decay);
    this.flashLight.name = 'muzzle-flash';

    this.cooldown = 0;
    this.recoil = 0;
    this.flashTime = Infinity;
    this.firedBarrel = RIGHT;
    this.reload = null;    // { time, inserts: [cañón…], done: Set, inventory }
    this.hinge = 0;        // 0 cerrada … 1 abierta
    this.pose = 0;         // 0 en posición … 1 bajada para recargar
    this.hint = null;
    this.hintTimer = 0;
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  // Cartuchos en los cañones (cuentan para el límite de munición).
  get loadedCount() {
    return this.barrelState.filter((state) => state === 'loaded').length;
  }

  get reloading() {
    return this.reload !== null;
  }

  // Aviso para la mira (`[R] Recargar` o `Sin munición`) o null.
  get prompt() {
    return this.hintTimer > 0 ? this.hint : null;
  }

  // Controles con la escopeta en la mano (solo jugando). No se dispara ni se recarga
  // durante la recarga, al sacarla o guardarla, ni sentado.
  control(dt, input, { player, inventory }) {
    const s = CONFIG.shotgun;
    if (this.equip < 1 || this.reloading || this.cooldown > 0 || player.seat) return;
    if (input.wasPressed(s.fireButton)) this.trigger(inventory);
    else if (input.wasPressed(s.reloadKey)) this.startReload(inventory);
  }

  // Dispara el primer cañón cargado (derecho y luego izquierdo) o hace clic en seco.
  trigger(inventory) {
    const s = CONFIG.shotgun;
    const barrel = this.barrelState.indexOf('loaded');
    if (barrel < 0) {
      this.hooks.sound?.('dry');
      this.showHint(inventory);
      return;
    }
    this.barrelState[barrel] = 'spent';
    this.firedBarrel = barrel;
    this.cooldown = s.fireCooldown;
    this.recoil = 1;
    this.flashTime = 0;
    this.flash.rotation.z = this.random() * Math.PI * 2;
    this.hooks.fire?.(barrel);
  }

  showHint(inventory) {
    const s = CONFIG.shotgun;
    this.hint = inventory.count(CONFIG.ammo.item) > 0 ? { text: s.reloadText, key: 'R' } : { text: s.noAmmoText, notice: true };
    this.hintTimer = s.hintTime;
  }

  // Recarga los cañones vacíos o disparados con los cartuchos que haya (1 o 2).
  startReload(inventory) {
    const needs = [RIGHT, LEFT].filter((i) => this.barrelState[i] !== 'loaded');
    if (!needs.length) return;
    const available = inventory.count(CONFIG.ammo.item);
    if (!available) {
      this.showHint(inventory);
      return;
    }
    this.hintTimer = 0;
    this.reload = { time: 0, inserts: needs.slice(0, available), done: new Set(), inventory };
  }

  // Al cambiar de ranura: se cancela; los cartuchos ya introducidos quedan dentro.
  cancelReload() {
    this.reload = null;
    this.shell.visible = false;
  }

  // Avanza la recarga y lanza sus eventos una sola vez. Devuelve la pose y la apertura.
  advanceReload(dt) {
    const r = this.reload;
    const d = CONFIG.shotgun.reload;
    r.time += dt;
    const t = r.time;
    const n = r.inserts.length;
    const tOpen = d.lower;
    const tEject = tOpen + d.open;
    const tInsert = tEject + d.eject;
    const tClose = tInsert + n * d.insert;
    const tRaise = tClose + d.close;
    const tEnd = tRaise + d.raise;
    const once = (name, at, action) => {
      if (t >= at && !r.done.has(name)) {
        r.done.add(name);
        action();
      }
    };

    once('open', tOpen, () => this.hooks.sound?.('open'));
    once('eject', tEject, () => {
      const spent = [RIGHT, LEFT].filter((i) => this.barrelState[i] === 'spent');
      for (const i of spent) this.barrelState[i] = 'empty';
      if (spent.length) {
        this.hooks.sound?.('eject');
        this.hooks.eject?.(spent);
      }
    });
    r.inserts.forEach((barrel, k) => once(`insert${k}`, tInsert + (k + 1) * d.insert, () => {
      if (r.inventory.remove(CONFIG.ammo.item, 1) > 0) this.barrelState[barrel] = 'loaded';
      this.hooks.sound?.('insert');
    }));
    once('close', tRaise, () => this.hooks.sound?.('close'));

    // Cartucho en la mano camino de la recámara.
    const k = Math.floor((t - tInsert) / d.insert);
    const progress = (t - tInsert) / d.insert - k;
    this.insertBarrel = k >= 0 && k < n && progress < 0.85 ? r.inserts[k] : null;
    this.insertProgress = progress / 0.85;

    if (t >= tEnd) this.reload = null;
    const pose = t < d.lower ? t / d.lower : t > tRaise ? 1 - (t - tRaise) / d.raise : 1;
    const hinge = t < tOpen ? 0 : t < tEject ? (t - tOpen) / d.open : t < tClose ? 1 : t < tRaise ? 1 - (t - tClose) / d.close : 0;
    return { pose: THREE.MathUtils.clamp(pose, 0, 1), hinge: THREE.MathUtils.clamp(hinge, 0, 1) };
  }

  // context: { active, player, day, camera }.
  update(dt, context) {
    const s = CONFIG.shotgun;
    if (!context.active && this.reloading) this.cancelReload();
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hintTimer = context.active ? this.hintTimer - dt : 0;
    this.recoil *= Math.exp(-dt * s.recoil.recover);
    this.flashTime += dt;
    this.insertBarrel = null;
    if (this.reloading) {
      const { pose, hinge } = this.advanceReload(dt);
      this.pose = pose;
      this.hinge = hinge;
    } else {
      // Fuera de la recarga (o cancelada) vuelve a su sitio.
      this.pose = Math.max(0, this.pose - dt * 4);
      this.hinge = Math.max(0, this.hinge - dt * 5);
    }

    const visible = super.update(dt, context);
    this.updateFlash(context.camera, visible);
    if (!visible) return;
    const { day } = context;
    this.keyLight.color.copy(day.lightColor);
    this.keyLight.intensity = day.lightIntensity * s.keyLight;

    // Retroceso (atrás y arriba) y pose de recarga (baja, se acerca y se inclina).
    const rc = s.recoil;
    const rp = s.reloadPose;
    const pose = smooth(this.pose);
    this.model.position.x -= rp.left * pose;
    this.model.position.z += rc.back * this.recoil + rp.back * pose;
    this.model.position.y += rc.lift * this.recoil - rp.down * pose;
    this.model.rotation.x += rc.up * this.recoil + rp.pitch * pose;
    this.model.rotation.z += rp.roll * pose;
    this.barrels.rotation.x = -s.hingeAngle * smooth(this.hinge);
    this.chambers.forEach((disc, i) => { disc.material = this.chamberMaterials[this.barrelState[i]]; });
    this.updateShell();
  }

  // Cartucho de la mano: sube hasta detrás de la recámara y entra a lo largo del cañón.
  updateShell() {
    const barrel = this.insertBarrel;
    this.shell.visible = barrel !== null;
    if (barrel === null) return;
    this.barrels.updateMatrix();
    const chamber = this.tmp.set(BARREL_X[barrel], BARREL_Y, BREECH_Z).applyMatrix4(this.barrels.matrix);
    const axis = this.tmp2.set(0, 0, 1).applyEuler(this.barrels.rotation);
    const p = this.insertProgress;
    if (p < 0.6) {
      const e = smooth(p / 0.6);
      this.shell.position.set(0.03, -0.12, 0.16).lerp(chamber.clone().addScaledVector(axis, 0.07), e);
    } else {
      this.shell.position.copy(chamber).addScaledVector(axis, 0.07 * (1 - smooth((p - 0.6) / 0.4)) + 0.025);
    }
    this.shell.rotation.set(this.barrels.rotation.x, 0, 0);
  }

  // Fogonazo por fotogramas y luces del fogonazo (vista y mundo).
  updateFlash(camera, visible) {
    const f = CONFIG.shotgun.flash;
    const frame = Math.floor(this.flashTime / f.frameTime);
    const showing = visible && frame < f.frames;
    this.flash.visible = showing;
    const level = Math.max(0, 1 - this.flashTime / f.light.duration);
    this.flashLight.intensity = f.light.intensity * level;
    this.viewFlash.intensity = f.light.intensity * 0.15 * level;
    if (level <= 0) return;
    if (showing) this.flash.material.map = this.flashFrames[frame];
    this.flash.position.set(BARREL_X[this.firedBarrel], BARREL_Y, MUZZLE_Z - f.size * 0.35);
    this.model.updateMatrixWorld(true);
    this.viewFlash.position.copy(this.flash.getWorldPosition(this.tmp));
    this.muzzleWorld(this.firedBarrel, camera, this.flashLight.position);
  }

  // Boca del cañón `barrel` en coordenadas del mundo.
  muzzleWorld(barrel, camera, target) {
    this.model.updateMatrixWorld(true);
    return this.viewToWorld(this.barrels, this.tmp2.set(BARREL_X[barrel], BARREL_Y, MUZZLE_Z), camera, target);
  }

  // Recámara del cañón `barrel` en coordenadas del mundo (salida de las vainas).
  chamberWorld(barrel, camera, target) {
    this.model.updateMatrixWorld(true);
    return this.viewToWorld(this.barrels, this.tmp2.set(BARREL_X[barrel], BARREL_Y, BREECH_Z), camera, target);
  }
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Fotogramas del fogonazo (16x16): estrella de rayos irregulares, núcleo blanco y borde naranja.
function createFlashFrames(count, random) {
  const size = 16;
  const palette = ['#fff8e0', '#ffe070', '#ffa030', '#e05a18'];
  return Array.from({ length: count }, (_, frame) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rays = 5 + Math.floor(random() * 3);
    const reach = Array.from({ length: rays }, () => 0.5 + random() * 0.5);
    const scale = 1 - frame / (count + 1);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x + 0.5 - size / 2;
        const dy = y + 0.5 - size / 2;
        const d = Math.hypot(dx, dy) / (size / 2);
        const angle = ((Math.atan2(dy, dx) / (Math.PI * 2)) + 1) % 1 * rays;
        const i = Math.floor(angle);
        const within = 1 - Math.abs(angle - i - 0.5) * 2;
        const limit = scale * (0.35 + reach[i] * Math.pow(within, 2) * 0.65);
        const v = 1 - d / limit;
        if (v <= 0) continue;
        ctx.fillStyle = palette[v > 0.65 ? 0 : v > 0.4 ? 1 : v > 0.2 ? 2 : 3];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  });
}
