// Punto de mira pixel art y aviso de interacción (`[E] Abrir puerta`) bajo él.
// La mira se resalta cuando apunta a un objeto interactivo. Un aviso sin acción
// (`{ text, notice: true }`, p. ej. `Inventario lleno`) se muestra sin la tecla, y
// `{ text, key }` muestra otra tecla (`[R] Recargar`). `alt: { key, text }` añade una
// segunda acción al lado (`[E] Apagar radio [N] Cambiar canción`).

export class Prompt {
  constructor(root, key = 'E') {
    this.crosshair = document.createElement('div');
    this.crosshair.className = 'crosshair';
    this.crosshair.hidden = true;
    root.appendChild(this.crosshair);

    this.element = document.createElement('div');
    this.element.className = 'prompt';
    this.element.hidden = true;
    this.element.innerHTML = `<span class="prompt__key">${key}</span><span class="prompt__text"></span>`
      + '<span class="prompt__key prompt__alt"></span><span class="prompt__text prompt__alt"></span>';
    [this.keyElement, this.altKeyElement] = this.element.querySelectorAll('.prompt__key');
    [this.text, this.altText] = this.element.querySelectorAll('.prompt__text');
    this.defaultKey = key;
    root.appendChild(this.element);

    this.playing = false;
    this.current = null;
    this.notice = false;
    this.alt = null;
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
    const alt = prompt?.alt ? `${prompt.alt.key}\n${prompt.alt.text}` : null;
    if (text === this.current && notice === this.notice && key === this.key && alt === this.alt) return;
    this.current = text;
    this.notice = notice;
    this.key = key;
    this.alt = alt;
    this.render();
  }

  render() {
    const visible = this.playing && Boolean(this.current);
    this.crosshair.classList.toggle('crosshair--active', visible);
    this.element.classList.toggle('prompt--notice', this.notice);
    this.element.hidden = !visible;
    this.text.textContent = this.current ?? '';
    this.keyElement.textContent = this.key ?? this.defaultKey;
    const [altKey, altText] = this.alt?.split('\n') ?? [];
    this.altKeyElement.hidden = this.altText.hidden = !this.alt;
    this.altKeyElement.textContent = altKey ?? '';
    this.altText.textContent = altText ?? '';
  }
}
