import { CONFIG } from '../config.js';
import { TORCH_ICON } from './torch.js';
import { SHOTGUN_ICON, SHELLS_ICON } from './shotgun.js';
import { LANTERN_ICON } from './lantern.js';

// Catálogo de objetos. `icon`: filas de caracteres + paleta (ver ui/hotbar.js).
//   stackable: se apila en una sola ranura hasta `maxStack`.
//   limit: máximo total entre las pilas y lo que haya fuera del inventario (`external`,
//          p. ej. los cartuchos cargados en la escopeta); `limitText`: aviso al llegar a él.
//   equippable: false → al seleccionarlo se ve la mano vacía.
//   pickupSound: efecto de sfx.js al recogerlo ('metal' | 'rattle' | 'lantern').
export const ITEMS = {
  torch: { id: 'torch', name: 'Antorcha', icon: TORCH_ICON },
  shotgun: { id: 'shotgun', name: 'Escopeta', icon: SHOTGUN_ICON, pickupSound: 'metal' },
  shells: {
    id: 'shells', name: 'Cartuchos', icon: SHELLS_ICON, pickupSound: 'rattle',
    stackable: true, maxStack: CONFIG.ammo.maxStack, limit: CONFIG.ammo.max, limitText: CONFIG.pickup.ammoFullText,
    equippable: false,
  },
  lantern: { id: 'lantern', name: 'Farol', icon: LANTERN_ICON, pickupSound: 'lantern' },
};

// Inventario de ranuras: cada ranura es null o una pila { item, count }.
// activeSlot = -1 significa mano vacía; una ranura vacía seleccionada también.
export class Inventory {
  constructor() {
    const { slots, startItems, startSlot } = CONFIG.inventory;
    this.slots = Array.from({ length: slots }, (_, i) => (ITEMS[startItems[i]] ? { item: ITEMS[startItems[i]], count: 1 } : null));
    this.activeSlot = startSlot;
    this.external = {};    // id → cantidad fuera del inventario que cuenta para `limit`
    this.listeners = [];
    this.contentListeners = [];
  }

  get activeStack() {
    return this.activeSlot >= 0 ? this.slots[this.activeSlot] : null;
  }

  get activeItem() {
    return this.activeStack?.item ?? null;
  }

  // Objeto que se lleva en la mano (null si no se equipa, p. ej. los cartuchos).
  get equippedItem() {
    const item = this.activeItem;
    return item && item.equippable !== false ? item : null;
  }

  // callback(activeSlot, activeItem) al cambiar de ranura.
  onChange(callback) {
    this.listeners.push(callback);
  }

  // callback(slotIndex) al cambiar el contenido de una ranura.
  onContentsChange(callback) {
    this.contentListeners.push(callback);
  }

  select(slot) {
    if (slot === this.activeSlot) return;
    this.activeSlot = slot;
    for (const callback of this.listeners) callback(this.activeSlot, this.activeItem);
  }

  count(id) {
    return this.slots.reduce((sum, stack) => sum + (stack?.item.id === id ? stack.count : 0), 0);
  }

  setExternal(id, count) {
    this.external[id] = count;
  }

  // Cuántas unidades de `id` caben (por ranuras libres, pilas y límite total).
  room(id) {
    const item = ITEMS[id];
    if (!item) return 0;
    let room = 0;
    for (const stack of this.slots) {
      if (!stack) room += item.stackable ? item.maxStack : 1;
      else if (item.stackable && stack.item === item) room += item.maxStack - stack.count;
    }
    if (item.limit !== undefined) room = Math.min(room, item.limit - this.count(id) - (this.external[id] ?? 0));
    return Math.max(0, room);
  }

  // Añade hasta `count` unidades: primero a las pilas existentes y después a la primera
  // ranura libre. Devuelve cuántas se han añadido (0 si no cabe ninguna).
  addItem(id, count = 1) {
    const item = ITEMS[id];
    if (!item) throw new Error(`Objeto desconocido: "${id}"`);
    let left = Math.min(count, this.room(id));
    const added = left;
    if (item.stackable) {
      this.slots.forEach((stack, i) => {
        if (left <= 0 || stack?.item !== item || stack.count >= item.maxStack) return;
        const n = Math.min(left, item.maxStack - stack.count);
        stack.count += n;
        left -= n;
        this.emitContents(i);
      });
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (this.slots[i]) continue;
      const n = item.stackable ? Math.min(left, item.maxStack) : 1;
      this.slots[i] = { item, count: n };
      left -= n;
      this.emitContents(i);
    }
    return added;
  }

  // Gasta hasta `count` unidades (de la última pila hacia atrás); la ranura que se queda
  // a 0 se libera. Devuelve cuántas se han gastado.
  remove(id, count = 1) {
    let left = count;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const stack = this.slots[i];
      if (stack?.item.id !== id) continue;
      const n = Math.min(left, stack.count);
      stack.count -= n;
      left -= n;
      if (stack.count <= 0) this.slots[i] = null;
      this.emitContents(i);
    }
    return count - left;
  }

  emitContents(slot) {
    for (const callback of this.contentListeners) callback(slot);
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
