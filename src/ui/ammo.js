// Munición junto a la barra (spec v3, RF-452): con la escopeta en la mano, dos iconos de
// cartucho (derecho e izquierdo: cargado, disparado o vacío) y la reserva del inventario.

const ICON = { width: 5, height: 12 };
// Colores por estado del cañón: [tubo, brillo del tubo, culote, borde].
const STYLES = {
  loaded: ['#c0302a', '#ee6a5a', '#e8b848', '#1e1414'],
  spent: ['#5a1a16', '#7a2a22', '#8a6a28', '#1e1414'],
  empty: [null, null, null, '#8a94a4'],
};

export class Ammo {
  constructor(root) {
    this.element = document.createElement('div');
    this.element.className = 'ammo';
    this.element.hidden = true;
    this.icons = [0, 1].map(() => {
      const canvas = document.createElement('canvas');
      canvas.width = ICON.width;
      canvas.height = ICON.height;
      canvas.className = 'ammo__shell';
      this.element.appendChild(canvas);
      return canvas;
    });
    this.reserve = document.createElement('span');
    this.reserve.className = 'ammo__reserve';
    this.element.appendChild(this.reserve);
    root.appendChild(this.element);
    this.key = '';
  }

  // visible: escopeta equipada; barrels: estado de los cañones; reserve: cartuchos del inventario.
  update(visible, barrels, reserve) {
    const key = visible ? `${barrels.join()}|${reserve}` : '';
    if (key === this.key) return;
    this.key = key;
    this.element.hidden = !visible;
    if (!visible) return;
    // Orden en pantalla: izquierdo y derecho, como se ven los cañones.
    [barrels[1], barrels[0]].forEach((state, i) => drawShell(this.icons[i], STYLES[state]));
    this.reserve.textContent = `×${reserve}`;
  }

  setVisible(visible) {
    if (!visible) this.element.hidden = true;
    else this.element.hidden = this.key === '';
  }
}

function drawShell(canvas, [tube, shine, brass, edge]) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = ICON;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
  if (tube) {
    ctx.fillStyle = tube;
    ctx.fillRect(1, 1, w - 2, h - 5);
    ctx.fillStyle = shine;
    ctx.fillRect(1, 1, 1, h - 5);
    ctx.fillStyle = brass;
    ctx.fillRect(1, h - 4, w - 2, 3);
  } else {
    ctx.clearRect(1, 1, w - 2, h - 2);
  }
}
