import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { resolveHorizontal, groundInfo, ceilingHeight } from './collision.js';

// Controlador en primera persona: cámara con ratón, andar/correr/saltar y modo vuelo.
// `position` es la posición de los pies.
export class PlayerController {
  // onStep(surface, intensity): paso o aterrizaje sobre 'grass' | 'dirt' | 'mud' | 'gravel' | 'stone' | 'water'.
  constructor(camera, terrain, colliders, spawn, { onStep } = {}) {
    this.camera = camera;
    this.terrain = terrain;
    this.colliders = colliders;
    this.onStep = onStep;

    this.position = new THREE.Vector3(spawn.x, terrain.getHeight(spawn.x, spawn.z), spawn.z);
    this.velocity = new THREE.Vector3();
    this.yaw = spawn.yaw ?? 0;
    this.pitch = 0;
    this.onGround = true;
    this.flying = false;
    this.running = false;
    this.stepDistance = 0;
    this.onStructure = false;
    this.inWater = false;
    // Asiento (interaction/seat.js): blend 0 de pie … 1 sentado.
    this.seat = null;
    this.seatBlend = 0;
    this.seatTarget = 0;
    this.seatYaw = 0;
    this.seatEye = new THREE.Vector3();
    // Sacudida de la cámara (disparo): sube rápido hacia `kickTarget` y se recupera suave.
    this.kickPitch = 0;
    this.kickTarget = 0;

    this.body = {
      radius: CONFIG.player.radius,
      height: CONFIG.player.height,
      stepHeight: CONFIG.player.stepHeight,
    };
    // Aparecer encima de un suelo elevado (p. ej. dentro de la cabaña) si lo hay.
    this.position.y = groundInfo(this.position, { ...this.body, stepHeight: CONFIG.player.spawnClimb }, colliders, terrain).height;
    this.wish = new THREE.Vector3();
    this.updateCamera();
  }

  get mode() {
    if (this.seat) return 'sentado';
    if (this.flying) return 'vuelo';
    return this.inWater ? 'vadear' : 'andar';
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocity.y = 0;
  }

  // Sentarse en `seat`: la cámara baja al asiento mirando a su frente (+Z local).
  sit(seat) {
    this.seat = seat;
    this.seatTarget = 1;
    this.seatYaw = seat.rotationY + Math.PI;
    const forward = new THREE.Vector3(Math.sin(seat.rotationY), 0, Math.cos(seat.rotationY));
    this.seatEye.copy(seat.position).addScaledVector(forward, -0.05);
    this.seatEye.y += CONFIG.player.seatedEyeHeight;
    this.velocity.set(0, 0, 0);
    this.flying = false;
  }

  standUp() {
    this.seatTarget = 0;
  }

  // Sacude la cámara hacia arriba `degrees` (retroceso del disparo).
  kick(degrees) {
    this.kickTarget += THREE.MathUtils.degToRad(degrees);
  }

  updateKick(dt) {
    const { kickRise, kickRecover } = CONFIG.player;
    this.kickPitch += (this.kickTarget - this.kickPitch) * Math.min(1, dt * kickRise);
    this.kickTarget *= Math.exp(-dt * kickRecover);
  }

  update(dt, input) {
    const p = CONFIG.player;
    this.updateKick(dt);
    if (this.seat) {
      this.updateSeated(dt, input);
      this.updateCamera();
      return;
    }

    // Mirar.
    const mouse = input.consumeMouse();
    const maxPitch = THREE.MathUtils.degToRad(p.maxPitch);
    this.yaw -= mouse.x * p.mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch - mouse.y * p.mouseSensitivity, -maxPitch, maxPitch);

    if (input.wasPressed('KeyF')) this.toggleFly();

    // Dirección deseada en el plano XZ relativa al yaw.
    const forward = (input.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (input.isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const strafe = (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe);
    if (this.wish.lengthSq() > 1) this.wish.normalize();

    this.running = input.isDown('ShiftLeft', 'ShiftRight') && !this.inWater;
    if (this.flying) this.updateFlying(dt, input);
    else this.updateWalking(dt, input);

    this.keepInBounds();
    this.updateCamera();
  }

  // Sentado: sin movimiento, giro limitado respecto al frente del asiento. Espacio o una
  // tecla de movimiento levantan al jugador (E sin objeto apuntado: ver interaction.js).
  updateSeated(dt, input) {
    const p = CONFIG.player;
    const mouse = input.consumeMouse();
    const maxPitch = THREE.MathUtils.degToRad(p.maxPitch);
    this.pitch = THREE.MathUtils.clamp(this.pitch - mouse.y * p.mouseSensitivity, -maxPitch, maxPitch);
    const limit = THREE.MathUtils.degToRad(p.seatYawLimit);
    const offset = Math.atan2(Math.sin(this.yaw - this.seatYaw), Math.cos(this.yaw - this.seatYaw)) - mouse.x * p.mouseSensitivity;
    const clamped = THREE.MathUtils.clamp(offset, -limit, limit);
    // Al sentarse la mirada gira con suavidad hasta quedar dentro del límite.
    const turn = Math.min(1, dt / p.seatTransition * 3);
    this.yaw = this.seatYaw + (this.seatBlend < 1 ? offset + (clamped - offset) * turn : clamped);

    const leave = ['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (this.seatTarget === 1 && this.seatBlend >= 1 && leave.some((code) => input.wasPressed(code))) this.standUp();
    const step = dt / p.seatTransition;
    this.seatBlend = THREE.MathUtils.clamp(this.seatBlend + (this.seatTarget ? step : -step), 0, 1);
    if (this.seatTarget === 0 && this.seatBlend === 0) this.seat = null;
  }

  updateWalking(dt, input) {
    const p = CONFIG.player;
    const speed = (this.running ? p.runSpeed : p.walkSpeed) * (this.inWater ? p.wadeSpeedFactor : 1);
    const accel = this.onGround ? p.groundAccel : p.airAccel;
    const blend = 1 - Math.exp(-accel * dt);
    this.velocity.x += (this.wish.x * speed - this.velocity.x) * blend;
    this.velocity.z += (this.wish.z * speed - this.velocity.z) * blend;

    if (this.onGround && input.isDown('Space')) {
      this.velocity.y = p.jumpSpeed;
      this.onGround = false;
    }
    this.velocity.y -= p.gravity * dt;

    const startX = this.position.x;
    const startZ = this.position.z;
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    resolveHorizontal(this.position, this.body, this.colliders);

    const wasOnGround = this.onGround;
    const fallSpeed = -this.velocity.y;
    this.position.y += this.velocity.y * dt;
    this.resolveVertical(wasOnGround);

    const f = CONFIG.footsteps;
    if (this.onGround && !wasOnGround && fallSpeed >= f.landMinSpeed) {
      this.stepDistance = 0;
      this.onStep?.(this.surface, f.landIntensity);
    } else if (this.onGround) {
      this.stepDistance += Math.hypot(this.position.x - startX, this.position.z - startZ);
      const stride = f.stepDistance * (this.running ? f.runStride : 1);
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        this.onStep?.(this.surface, this.running ? f.runIntensity : 1);
      }
    }
  }

  get surface() {
    if (this.onStructure) return this.structureSurface;
    if (this.inWater) return 'water';
    return this.terrain.getSurface(this.position.x, this.position.z);
  }

  // Profundidad del agua sobre los pies (0 fuera del agua).
  get waterDepth() {
    const level = this.terrain.waterLevelAt(this.position.x, this.position.z);
    return level === null ? 0 : Math.max(0, level - this.position.y);
  }

  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  updateFlying(dt, input) {
    const p = CONFIG.player;
    const speed = this.running ? p.flySpeed * 2 : p.flySpeed;
    const vertical = (input.isDown('Space') ? 1 : 0) - (input.isDown('KeyC', 'ControlLeft', 'ControlRight') ? 1 : 0);
    const blend = 1 - Math.exp(-p.groundAccel * dt);
    this.velocity.x += (this.wish.x * speed - this.velocity.x) * blend;
    this.velocity.z += (this.wish.z * speed - this.velocity.z) * blend;
    this.velocity.y += (vertical * speed - this.velocity.y) * blend;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    resolveHorizontal(this.position, this.body, this.colliders);
    this.position.y += this.velocity.y * dt;

    const ground = groundInfo(this.position, this.body, this.colliders, this.terrain).height;
    if (this.position.y < ground) {
      this.position.y = ground;
      this.velocity.y = Math.max(this.velocity.y, 0);
    }
    this.onGround = false;
    this.inWater = false;
  }

  resolveVertical(wasOnGround) {
    const ceiling = ceilingHeight(this.position, this.body, this.colliders);
    if (this.velocity.y > 0 && this.position.y + this.body.height > ceiling) {
      this.position.y = ceiling - this.body.height;
      this.velocity.y = 0;
    }

    const { height: ground, onStructure, surface } = groundInfo(this.position, this.body, this.colliders, this.terrain);
    this.onStructure = onStructure;
    this.structureSurface = surface;
    this.inWater = !onStructure && this.waterDepth > CONFIG.player.wadeMinDepth;
    // Pegarse al suelo al bajar pendientes o escalones en lugar de "despegar".
    const snap = wasOnGround && this.velocity.y <= 0 && this.position.y - ground < this.body.stepHeight;
    if (this.position.y <= ground || snap) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  keepInBounds() {
    const limit = this.terrain.size / 2 - CONFIG.player.boundsMargin;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);
  }

  updateCamera() {
    const { eyeHeight } = CONFIG.player;
    const { cameraSnap, cameraSnapUnit } = CONFIG.render;
    const snap = (v) => (cameraSnap ? Math.round(v / cameraSnapUnit) * cameraSnapUnit : v);
    let x = this.position.x;
    let y = this.position.y + eyeHeight;
    let z = this.position.z;
    if (this.seat) {
      const t = this.seatBlend * this.seatBlend * (3 - 2 * this.seatBlend);
      x += (this.seatEye.x - x) * t;
      y += (this.seatEye.y - y) * t;
      z += (this.seatEye.z - z) * t;
    }
    this.camera.position.set(snap(x), snap(y), snap(z));
    this.camera.rotation.set(this.pitch + this.kickPitch, this.yaw, 0);
  }
}
