import * as THREE from 'three';

// Boneco de treino: recebe dano, mostra barra de vida e renasce.
export class Dummy {
  constructor(scene, x, z) {
    this.home = new THREE.Vector3(x, 0, z);
    this.maxHp = 300; this.hp = this.maxHp;
    this.flash = 0; this.respawn = 0;
    this.mat = new THREE.MeshStandardMaterial({ color: 0xb08a52, roughness: 0.95, flatShading: true });
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.6, 10), this.mat);
    this.mesh.position.set(x, 0.8, z);
    this.mesh.castShadow = true;
    // boneco de palha: poste, braços de madeira, cabeça de saco e amarras
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.9, flatShading: true });
    const rope = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    const add = (geo, m, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; this.mesh.add(o); return o; };
    add(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), wood, 0, -0.1, 0);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), wood, 0, 0.35, 0, Math.PI / 2);
    add(new THREE.SphereGeometry(0.3, 8, 6), this.mat, 0, 1.05, 0);
    for (const y of [-0.45, 0.1, 0.55]) add(new THREE.TorusGeometry(0.47, 0.03, 4, 12), rope, 0, y, 0).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.5, 0.6, 0.15, 10), wood, 0, -0.85, 0);
    // barra de vida
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0x220a0a, depthTest: false }));
    this.fill = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.08), new THREE.MeshBasicMaterial({ color: 0xd8382e, depthTest: false }));
    this.fill.position.z = 0.001; bg.renderOrder = 10; this.fill.renderOrder = 11;
    this.bar.add(bg, this.fill);
    scene.add(this.mesh, this.bar);
    this.alive = true;
  }

  hit(dmg, fromPos) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (fromPos) {
      const push = this.mesh.position.clone().sub(fromPos).setY(0);
      if (push.lengthSq() > 0.001) this.mesh.position.add(push.normalize().multiplyScalar(0.25));
    }
    if (this.hp <= 0) { this.alive = false; this.mesh.visible = this.bar.visible = false; this.respawn = 3; }
    return true;
  }

  update(dt, camera) {
    this.flash -= dt;
    this.mat.emissive.setHex(this.flash > 0 ? 0xffe6a0 : 0x000000);
    if (!this.alive) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        this.alive = true; this.hp = this.maxHp;
        this.mesh.position.set(this.home.x, 0.8, this.home.z);
        this.mesh.visible = this.bar.visible = true;
      }
    }
    // volta devagar para o lugar
    this.mesh.position.x += (this.home.x - this.mesh.position.x) * dt * 0.8;
    this.mesh.position.z += (this.home.z - this.mesh.position.z) * dt * 0.8;
    this.bar.position.set(this.mesh.position.x, 2.5, this.mesh.position.z);
    this.mesh.rotation.z = this.flash > 0 ? 0.12 : this.mesh.rotation.z * 0.9;
    this.bar.quaternion.copy(camera.quaternion);
    const f = Math.max(0, this.hp / this.maxHp);
    this.fill.scale.x = f; this.fill.position.x = -(1 - f) * 0.5;
  }
}
