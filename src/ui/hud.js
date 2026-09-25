// HUD de depuración (F3): FPS, hora, posición, modo, resolución interna y draw calls.
// La mira está en ui/prompt.js.

export class Hud {
  constructor(root, visible) {
    this.element = document.createElement('pre');
    this.element.className = 'hud';
    this.element.hidden = !visible;
    root.appendChild(this.element);

    this.frames = 0;
    this.elapsed = 0;
    this.fps = 0;
  }

  toggle() {
    this.element.hidden = !this.element.hidden;
  }

  update(dt, info) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed >= 0.5) {
      this.fps = Math.round(this.frames / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
    }
    if (this.element.hidden) return;

    const { position: p, mode, internal, drawCalls, triangles, muted, clock, birds, surface, water, zone, target } = info;
    this.element.textContent = [
      `FPS   ${this.fps}`,
      `HORA  ${clock}`,
      `POS   ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`,
      `MODO  ${mode}`,
      `ZONA  ${zone}`,
      `APUNTA ${target}`,
      `SUELO ${surface}`,
      `AGUA  ${water}`,
      `RES   ${internal.width}x${internal.height} x${internal.scale}`,
      `DRAW  ${drawCalls} (${Math.round(triangles / 1000)}k tris)`,
      `AVES  ${birds}`,
      `AUDIO ${muted ? 'off' : 'on'}`,
    ].join('\n');
  }
}
