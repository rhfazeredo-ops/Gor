import * as THREE from 'three';

// Boneco de treino: recebe dano e pisca.
export class Dummy {
  constructor(scene, x, z) {
    this.hp = 60;
    this.flash = 0;
    this.mat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 10), this.mat);
    this.mesh.position.set(x, 0.8, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.scene = scene;
    this.alive = true;
  }

  hit(dmg, fromPos) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 0.12;
    const push = this.mesh.position.clone().sub(fromPos).setY(0).normalize().multiplyScalar(0.4);
    this.mesh.position.add(push);
    if (this.hp <= 0) { this.alive = false; this.scene.remove(this.mesh); }
  }

  update(dt) {
    this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xffffff : 0x000000);
  }
}
