// Punto de mira pixel art y aviso de interacción (`[E] Abrir puerta`) bajo él.
// La mira se resalta cuando apunta a un objeto interactivo.

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
  }

  setPlaying(playing) {
    this.playing = playing;
    this.crosshair.hidden = !playing;
    this.render();
  }

  // text: acción a mostrar o null para ocultar el aviso.
  show(text) {
    if (text === this.current) return;
    this.current = text;
    this.render();
  }

  render() {
    const visible = this.playing && Boolean(this.current);
    this.crosshair.classList.toggle('crosshair--active', visible);
    this.element.hidden = !visible;
    this.text.textContent = this.current ?? '';
  }
}
