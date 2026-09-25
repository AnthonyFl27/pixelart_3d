// Estado de teclado y ratón. Las teclas se identifican por `KeyboardEvent.code`
// (independiente de la distribución del teclado: 'KeyW', 'Space', 'ShiftLeft'...) y los
// botones del ratón sobre el canvas como 'Mouse0' (izquierdo), 'Mouse1', 'Mouse2'.

const PREVENT_DEFAULT = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F3', 'ControlLeft', 'ControlRight',
]);

const MAX_MOUSE_DELTA = 250;

export class Input {
  constructor(element) {
    this.element = element;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.wheel = 0;
    this.dragging = false;
    this.listeners = { lockchange: [], keydown: [] };

    window.addEventListener('keydown', (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      this.emit('keydown', e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());

    // Sin Pointer Lock (no soportado o denegado) se puede mirar arrastrando.
    element.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.pressed.add(`Mouse${e.button}`);
      this.down.add(`Mouse${e.button}`);
    });
    window.addEventListener('mouseup', (e) => {
      this.dragging = false;
      this.down.delete(`Mouse${e.button}`);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked && !this.dragging) return;
      // Algunos navegadores envían picos enormes de movementX/Y al capturar el ratón.
      if (Math.abs(e.movementX) > MAX_MOUSE_DELTA || Math.abs(e.movementY) > MAX_MOUSE_DELTA) return;
      this.mouseX += e.movementX;
      this.mouseY += e.movementY;
    });

    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.consumeMouse();
      this.emit('lockchange', this.locked);
    });
    document.addEventListener('pointerlockerror', () => this.emit('lockchange', false));
  }

  get locked() {
    return document.pointerLockElement === this.element;
  }

  // Devuelve una promesa que se resuelve a true si se consiguió capturar el ratón.
  async requestLock() {
    if (!this.element.requestPointerLock) return false;
    try {
      await this.element.requestPointerLock();
      return true;
    } catch {
      return false;
    }
  }

  exitLock() {
    if (this.locked) document.exitPointerLock();
  }

  on(event, callback) {
    this.listeners[event].push(callback);
  }

  emit(event, value) {
    for (const callback of this.listeners[event]) callback(value);
  }

  isDown(...codes) {
    return codes.some((code) => this.down.has(code));
  }

  // true solo en el frame en que se pulsó la tecla.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  consumeMouse() {
    const delta = { x: this.mouseX, y: this.mouseY };
    this.mouseX = 0;
    this.mouseY = 0;
    return delta;
  }

  // Pasos de rueda acumulados desde la última llamada (+ abajo, - arriba).
  consumeWheel() {
    const steps = this.wheel;
    this.wheel = 0;
    return steps;
  }

  // Llamar al final de cada frame.
  endFrame() {
    this.pressed.clear();
  }
}
