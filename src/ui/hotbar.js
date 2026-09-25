// Barra de inventario pixel art: ranuras numeradas con icono y la activa resaltada.
// Las pilas muestran la cantidad sobre el icono en cifras pixel. El nombre del objeto
// (con la cantidad si es una pila) aparece unos instantes al cambiar de ranura.

const ICON_SIZE = 16;

// Cifras pixel 3x5.
const DIGITS = [
  ['###', '#.#', '#.#', '#.#', '###'],
  ['.#.', '##.', '.#.', '.#.', '###'],
  ['###', '..#', '###', '#..', '###'],
  ['###', '..#', '.##', '..#', '###'],
  ['#.#', '#.#', '###', '..#', '..#'],
  ['###', '#..', '###', '..#', '###'],
  ['###', '#..', '###', '#.#', '###'],
  ['###', '..#', '.#.', '.#.', '.#.'],
  ['###', '#.#', '###', '#.#', '###'],
  ['###', '#.#', '###', '..#', '###'],
];
const DIGIT_COLOR = '#f4f8fb';
const DIGIT_SHADOW = '#141c26';

export class Hotbar {
  constructor(root, inventory) {
    this.inventory = inventory;
    this.element = document.createElement('div');
    this.element.className = 'hotbar';

    this.label = document.createElement('div');
    this.label.className = 'hotbar__label';
    this.element.appendChild(this.label);

    const row = document.createElement('div');
    row.className = 'hotbar__slots';
    this.slotElements = inventory.slots.map((_, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar__slot';
      slot.innerHTML = `<span class="hotbar__key">${i + 1}</span>`;
      row.appendChild(slot);
      return slot;
    });
    this.element.appendChild(row);
    root.appendChild(this.element);

    this.labelTimer = null;
    this.slotElements.forEach((_, i) => this.renderSlot(i));
    inventory.onChange((slot) => this.refresh(slot));
    inventory.onContentsChange((slot) => {
      this.renderSlot(slot);
      if (slot === inventory.activeSlot) this.showLabel();
    });
    this.refresh(inventory.activeSlot, false);
  }

  // Icono y cantidad de la ranura `index`.
  renderSlot(index) {
    const element = this.slotElements[index];
    element.querySelector('.hotbar__icon')?.remove();
    element.querySelector('.hotbar__count')?.remove();
    const stack = this.inventory.slots[index];
    if (!stack) return;
    element.appendChild(drawIcon(stack.item.icon));
    if (stack.item.stackable) element.appendChild(drawCount(stack.count));
  }

  refresh(activeSlot, showLabel = true) {
    this.slotElements.forEach((el, i) => el.classList.toggle('hotbar__slot--active', i === activeSlot));
    if (showLabel) this.showLabel();
  }

  showLabel() {
    const stack = this.inventory.activeStack;
    this.label.textContent = !stack ? 'Mano vacía' : stack.item.stackable ? `${stack.item.name} ×${stack.count}` : stack.item.name;
    this.label.classList.add('hotbar__label--visible');
    clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => this.label.classList.remove('hotbar__label--visible'), 1500);
  }

  setVisible(visible) {
    this.element.hidden = !visible;
  }
}

// icon = { palette: { char: '#rrggbb' }, rows: ['....', ...] } de 16x16.
function drawIcon(icon) {
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  canvas.className = 'hotbar__icon';
  const ctx = canvas.getContext('2d');
  icon.rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const color = icon.palette[char];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

// Cantidad en cifras pixel 3x5 con sombra de 1 píxel; se escala x2 como los iconos.
function drawCount(count) {
  const text = String(count);
  const canvas = document.createElement('canvas');
  canvas.width = text.length * 4 + 1;
  canvas.height = 6;
  canvas.className = 'hotbar__count';
  canvas.style.width = `${canvas.width * 2}px`;
  canvas.style.height = `${canvas.height * 2}px`;
  const ctx = canvas.getContext('2d');
  for (const [color, offset] of [[DIGIT_SHADOW, 1], [DIGIT_COLOR, 0]]) {
    ctx.fillStyle = color;
    [...text].forEach((char, i) => {
      DIGITS[Number(char)].forEach((row, y) => {
        [...row].forEach((pixel, x) => {
          if (pixel === '#') ctx.fillRect(i * 4 + x + offset, y + offset, 1, 1);
        });
      });
    });
  }
  return canvas;
}
