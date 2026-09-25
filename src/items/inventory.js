import { CONFIG } from '../config.js';
import { TORCH_ICON } from './torch.js';

// Catálogo de objetos. `icon`: filas de caracteres + paleta (ver ui/hotbar.js).
export const ITEMS = {
  torch: { id: 'torch', name: 'Antorcha', icon: TORCH_ICON },
};

// Inventario de ranuras. activeSlot = -1 significa mano vacía.
export class Inventory {
  constructor() {
    const { slots, startItems, startSlot } = CONFIG.inventory;
    this.slots = Array.from({ length: slots }, (_, i) => ITEMS[startItems[i]] ?? null);
    this.activeSlot = startSlot;
    this.listeners = [];
  }

  get activeItem() {
    return this.activeSlot >= 0 ? this.slots[this.activeSlot] : null;
  }

  onChange(callback) {
    this.listeners.push(callback);
  }

  select(slot) {
    if (slot === this.activeSlot) return;
    this.activeSlot = slot;
    for (const callback of this.listeners) callback(this.activeSlot, this.activeItem);
  }

  // Teclas 1..N seleccionan (repetir la misma guarda el objeto), rueda cambia, Q guarda.
  update(input) {
    const count = this.slots.length;
    for (let i = 0; i < count; i++) {
      if (input.wasPressed(`Digit${i + 1}`)) this.select(i === this.activeSlot ? -1 : i);
    }
    const wheel = input.consumeWheel();
    if (wheel !== 0) {
      const from = this.activeSlot < 0 ? (wheel > 0 ? -1 : 0) : this.activeSlot;
      this.select((((from + wheel) % count) + count) % count);
    }
    if (input.wasPressed('KeyQ')) this.select(-1);
  }
}
