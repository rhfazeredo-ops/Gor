// Controles: teclado + mouse no PC; joystick e botões no celular.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();          // ações apertadas neste quadro
    this.mouse = { x: 0, y: 0, inside: false };
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.touch);

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) {
        if (k === 'q') this.pressed.add('q');
        if (k === 'e') this.pressed.add('e');
        if (k === ' ') this.pressed.add('dash');
        if (k === 'j') this.pressed.add('atk');
      }
      this.keys.add(k);
      if (k === ' ') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouseDown = true; this.pressed.add('atk'); } });
    addEventListener('mouseup', () => (this.mouseDown = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // joystick: aparece onde o dedo encosta na metade esquerda
    const zone = document.getElementById('joy-zone'), base = document.getElementById('joy-base'), knob = document.getElementById('joy-knob');
    zone.addEventListener('pointerdown', (e) => {
      this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY;
      base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.classList.add('on');
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx *= max / d; dy *= max / d; }
      this.joy.x = dx / max; this.joy.y = dy / max;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = (e) => {
      if (e.pointerId !== this.joy.id) return;
      this.joy.id = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

    for (const [id, act] of [['btn-attack', 'atk'], ['btn-q', 'q'], ['btn-e', 'e'], ['btn-dash', 'dash']]) {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); this.pressed.add(act); if (act === 'atk') this.atkHeld = true; });
      el.addEventListener('pointerup', () => { if (act === 'atk') this.atkHeld = false; });
      el.addEventListener('pointerleave', () => { if (act === 'atk') this.atkHeld = false; });
    }
  }

  // direção na tela (x para a direita, y para baixo), comprimento até 1
  screenMove() {
    let x = this.joy.x, y = this.joy.y;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  holdingAttack() { return this.mouseDown || this.atkHeld || this.keys.has('j'); }
  consume() { this.pressed.clear(); }
}
