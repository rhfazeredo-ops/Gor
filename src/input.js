import * as THREE from 'three';

// Guarda o estado do teclado e do mouse.
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

    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space') { this.dashPressed = true; e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    dom.addEventListener('pointermove', (e) => {
      this.mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
    dom.addEventListener('pointerdown', (e) => { if (e.button === 0) this.attackPressed = true; });
  }

  // Direção de movimento (x, z) normalizada a partir do WASD.
  moveDir() {
    const d = new THREE.Vector3();
    if (this.keys.has('KeyW')) d.z -= 1;
    if (this.keys.has('KeyS')) d.z += 1;
    if (this.keys.has('KeyA')) d.x -= 1;
    if (this.keys.has('KeyD')) d.x += 1;
    return d.lengthSq() ? d.normalize() : d;
  }

  // Ponto do chão embaixo do cursor.
  updateAim() {
    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);
    return this.aimPoint;
  }

  consume() { this.attackPressed = false; this.dashPressed = false; }
}
