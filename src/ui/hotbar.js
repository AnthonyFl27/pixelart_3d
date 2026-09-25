// Barra de inventario pixel art: ranuras numeradas con icono y la activa resaltada.
// El nombre del objeto aparece unos instantes al cambiar de ranura.

const ICON_SIZE = 16;

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
    this.slotElements = inventory.slots.map((item, i) => {
      const slot = document.createElement('div');
      slot.className = 'hotbar__slot';
      slot.innerHTML = `<span class="hotbar__key">${i + 1}</span>`;
      if (item) slot.appendChild(drawIcon(item.icon));
      row.appendChild(slot);
      return slot;
    });
    this.element.appendChild(row);
    root.appendChild(this.element);

    this.labelTimer = null;
    inventory.onChange((slot, item) => this.refresh(slot, item));
    this.refresh(inventory.activeSlot, inventory.activeItem, false);
  }

  refresh(activeSlot, item, showLabel = true) {
    this.slotElements.forEach((el, i) => el.classList.toggle('hotbar__slot--active', i === activeSlot));
    if (!showLabel) return;
    this.label.textContent = item ? item.name : 'Mano vacía';
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
