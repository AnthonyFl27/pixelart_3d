// Punto de mira pixel art y aviso de interacción (`[E] Abrir puerta`) bajo él.
// La mira se resalta cuando apunta a un objeto interactivo. Un aviso sin acción
// (`{ text, notice: true }`, p. ej. `Inventario lleno`) se muestra sin la tecla, y
// `{ text, key }` muestra otra tecla (`[R] Recargar`).

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
    this.keyElement = this.element.querySelector('.prompt__key');
    this.defaultKey = key;
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
    const key = prompt?.key ?? this.defaultKey;
    if (text === this.current && notice === this.notice && key === this.key) return;
    this.current = text;
    this.notice = notice;
    this.key = key;
    this.render();
  }

  render() {
    const visible = this.playing && Boolean(this.current);
    this.crosshair.classList.toggle('crosshair--active', visible);
    this.element.classList.toggle('prompt--notice', this.notice);
    this.element.hidden = !visible;
    this.text.textContent = this.current ?? '';
    this.keyElement.textContent = this.key ?? this.defaultKey;
  }
}
