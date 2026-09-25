// Punto de mira pixel art y aviso de interacción (`[E] Abrir puerta`) bajo él.
// La mira se resalta cuando apunta a un objeto interactivo. Un aviso sin acción
// (`{ text, notice: true }`, p. ej. `Inventario lleno`) se muestra sin la tecla.

export class Prompt {
  constructor(root, key = 'E') {
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'crosshair';
    this.crosshair.hidden = true;
    root.appendChild(this.crosshair);

    this.element = document.createElement('div');
    this.element.className = 'prompt';
    this.element.hidden = true;
    this.element.innerHTML = `<span class="prompt__key">${key}</span><span class="prompt__text"></span>`;
    this.text = this.element.querySelector('.prompt__text');
    root.appendChild(this.element);

    this.playing = false;
    this.current = null;
    this.notice = false;
  }

  setPlaying(playing) {
    this.playing = playing;
    this.crosshair.hidden = !playing;
    this.render();
  }

  // prompt: texto de la acción, { text, notice } o null para ocultar el aviso.
  show(prompt) {
    const text = typeof prompt === 'string' ? prompt : prompt?.text ?? null;
    const notice = Boolean(prompt?.notice);
    if (text === this.current && notice === this.notice) return;
    this.current = text;
    this.notice = notice;
    this.render();
  }

  render() {
    const visible = this.playing && Boolean(this.current);
    this.crosshair.classList.toggle('crosshair--active', visible);
    this.element.classList.toggle('prompt--notice', this.notice);
    this.element.hidden = !visible;
    this.text.textContent = this.current ?? '';
  }
}
