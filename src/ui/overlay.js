// Pantalla de inicio y de pausa. Un clic en cualquier parte llama a `onStart`.

const CONTROLS = [
  ['Ratón', 'Mirar'],
  ['WASD / Flechas', 'Moverse'],
  ['Shift', 'Correr'],
  ['Espacio', 'Saltar / subir'],
  ['C / Ctrl', 'Bajar (vuelo)'],
  ['F', 'Modo vuelo'],
  ['M', 'Silenciar audio'],
  ['T (mantener)', 'Acelerar el tiempo'],
  ['F3', 'Depuración'],
  ['Esc', 'Pausa'],
];

export class Overlay {
  constructor(root, { title, onStart }) {
    this.element = document.createElement('div');
    this.element.className = 'overlay';
    this.element.innerHTML = `
      <div class="overlay__panel">
        <h1 class="overlay__title">${title}</h1>
        <p class="overlay__status"></p>
        <p class="overlay__action">Clic para jugar</p>
        <table class="overlay__controls">
          ${CONTROLS.map(([key, action]) => `<tr><td>${key}</td><td>${action}</td></tr>`).join('')}
        </table>
      </div>
    `;
    this.status = this.element.querySelector('.overlay__status');
    this.action = this.element.querySelector('.overlay__action');
    this.element.addEventListener('click', () => onStart());
    root.appendChild(this.element);
  }

  showStart() {
    this.status.textContent = '';
    this.action.textContent = 'Clic para jugar';
    this.element.hidden = false;
  }

  showPaused() {
    this.status.textContent = 'Pausa';
    this.action.textContent = 'Clic para continuar';
    this.element.hidden = false;
  }

  showRetry() {
    this.status.textContent = 'No se pudo capturar el ratón';
    this.action.textContent = 'Clic para reintentar';
    this.element.hidden = false;
  }

  hide() {
    this.element.hidden = true;
  }
}
