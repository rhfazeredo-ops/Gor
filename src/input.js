import * as THREE from 'three';

// Controles: teclado/mouse no PC, joystick virtual + botões no celular.
export class Input {
  constructor(camera, dom) {
    this.keys = new Set();
    this.mouseNdc = new THREE.Vector2();
    this.attackPressed = false;
    this.dashPressed = false;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.aimPoint = new THREE.Vector3();
    this.joy = new THREE.Vector3();      // direção do joystick (x, z)
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    // Teclado e mouse
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') { this.dashPressed = true; e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) this.attackPressed = true;
    });

    if (this.isTouch) this.setupTouch();
  }

  setupTouch() {
    document.body.classList.add('touch');
    const zone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const R = 55;
    let id = null, cx = 0, cy = 0;

    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId; cx = e.clientX; cy = e.clientY;
      try { zone.setPointerCapture(id); } catch (_) {}
      base.style.left = cx + 'px'; base.style.top = cy + 'px';
      base.classList.add('on');
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(len / R, 1);
      this.joy.set(dx, 0, dy).normalize().multiplyScalar(mag < 0.15 ? 0 : mag);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; this.joy.set(0, 0, 0);
      knob.style.transform = '';
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const bind = (elId, fn) => document.getElementById(elId)
      .addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
    bind('btn-attack', () => (this.attackPressed = true));
    bind('btn-dash', () => (this.dashPressed = true));
  }

  // Direção de movimento (x, z).
  moveDir() {
    const d = new THREE.Vector3();
    if (this.keys.has('KeyW')) d.z -= 1;
    if (this.keys.has('KeyS')) d.z += 1;
    if (this.keys.has('KeyA')) d.x -= 1;
    if (this.keys.has('KeyD')) d.x += 1;
    if (d.lengthSq()) return d.normalize();
    return this.joy.clone();
  }

  // PC: ponto do chão embaixo do cursor. Celular: mira automática (feita no main).
  updateAim() {
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);
    return this.aimPoint;
  }

  consume() { this.attackPressed = false; this.dashPressed = false; }
}
