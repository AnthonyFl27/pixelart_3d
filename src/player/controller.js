import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { resolveHorizontal, groundInfo, ceilingHeight } from './collision.js';

// Controlador en primera persona: cámara con ratón, andar/correr/saltar y modo vuelo.
// `position` es la posición de los pies.
export class PlayerController {
  // onStep(surface, intensity): paso o aterrizaje sobre 'grass' | 'dirt' | 'stone'.
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

    this.body = {
      radius: CONFIG.player.radius,
      height: CONFIG.player.height,
      stepHeight: CONFIG.player.stepHeight,
    };
    this.wish = new THREE.Vector3();
    this.updateCamera();
  }

  get mode() {
    return this.flying ? 'vuelo' : 'andar';
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocity.y = 0;
  }

  update(dt, input) {
    const p = CONFIG.player;

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

    this.running = input.isDown('ShiftLeft', 'ShiftRight');
    if (this.flying) this.updateFlying(dt, input);
    else this.updateWalking(dt, input);

    this.keepInBounds();
    this.updateCamera();
  }

  updateWalking(dt, input) {
    const p = CONFIG.player;
    const speed = this.running ? p.runSpeed : p.walkSpeed;
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
    return this.onStructure ? 'stone' : this.terrain.getSurface(this.position.x, this.position.z);
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
  }

  resolveVertical(wasOnGround) {
    const ceiling = ceilingHeight(this.position, this.body, this.colliders);
    if (this.velocity.y > 0 && this.position.y + this.body.height > ceiling) {
      this.position.y = ceiling - this.body.height;
      this.velocity.y = 0;
    }

    const { height: ground, onStructure } = groundInfo(this.position, this.body, this.colliders, this.terrain);
    this.onStructure = onStructure;
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
    this.camera.position.set(
      snap(this.position.x),
      snap(this.position.y + eyeHeight),
      snap(this.position.z),
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
