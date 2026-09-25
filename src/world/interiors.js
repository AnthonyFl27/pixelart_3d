import { CONFIG } from '../config.js';
import { containsPoint } from './zones.js';

// Oculta el interior de las estructuras (mallas fusionadas y objetos interactivos de
// su zona) cuando el jugador está fuera y a más de `interior.hideDistance`.
export class Interiors {
  // interiors: [{ group, zone }] de loadLevel.
  constructor(interiors) {
    this.list = interiors.map(({ group, zone }) => ({ group, zone, objects: [], visible: true }));
  }

  // Objetos interactivos con `zone` (nombre) que se ocultan junto a su interior.
  track(items) {
    for (const item of items) {
      const entry = this.list.find((e) => e.zone && e.zone.name === item.zone);
      if (entry && item.object) entry.objects.push(item.object);
    }
  }

  update(position) {
    const limit = CONFIG.interior.hideDistance;
    for (const entry of this.list) {
      const { zone } = entry;
      const visible = !zone || containsPoint(zone, position)
        || Math.hypot(position.x - zone.cx, position.z - zone.cz) < limit;
      if (visible === entry.visible) continue;
      entry.visible = visible;
      entry.group.visible = visible;
      for (const object of entry.objects) object.visible = visible;
    }
  }
}
