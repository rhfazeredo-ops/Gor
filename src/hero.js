import * as THREE from 'three';

// Herói provisório (cápsula) com a paleta do Drakhar.
// Depois trocamos por um modelo .glb animado.
export class Hero {
  constructor(scene) {
    this.speed = 6;
    this.hp = 100;
    this.maxHp = 100;
    this.attackCooldown = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.dashDir = new THREE.Vector3();
    this.swingTime = 0;

    this.root = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.7 });
    const armor = new THREE.MeshStandardMaterial({ color: 0x34406a, roughness: 0.5, metalness: 0.3 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.6, roughness: 0.35 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.8, 6, 12), armor);
    body.position.y = 0.85; body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), skin);
    head.position.y = 1.65; head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), bone);
    hair.position.y = 1.7; hair.rotation.x = 0.4;
    const pads = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.45), gold);
    pads.position.y = 1.35; pads.castShadow = true;

    // Arma (cutelo) presa a um pivô para animar o golpe.
    this.weaponPivot = new THREE.Group();
    this.weaponPivot.position.set(0.55, 1.0, 0);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 1.3), bone);
    blade.position.z = 0.75; blade.castShadow = true;
    this.weaponPivot.add(blade);

    this.root.add(body, head, hair, pads, this.weaponPivot);
    scene.add(this.root);
  }

  get position() { return this.root.position; }

  update(dt, input, aim) {
    this.attackCooldown -= dt;
    this.dashCooldown -= dt;

    // Virar para o cursor.
    const dx = aim.x - this.position.x, dz = aim.z - this.position.z;
    if (dx * dx + dz * dz > 0.01) this.root.rotation.y = Math.atan2(dx, dz);

    // Esquiva (dash).
    const move = input.moveDir();
    if (input.dashPressed && this.dashCooldown <= 0) {
      this.dashDir.copy(move.lengthSq() ? move : new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)));
      this.dashTime = 0.18;
      this.dashCooldown = 0.8;
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.position.addScaledVector(this.dashDir, 22 * dt);
    } else {
      this.position.addScaledVector(move, this.speed * dt);
    }
    this.position.x = THREE.MathUtils.clamp(this.position.x, -24, 24);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -24, 24);

    // Ataque básico.
    let attacked = false;
    if (input.attackPressed && this.attackCooldown <= 0) {
      this.attackCooldown = 0.45;
      this.swingTime = 0.25;
      attacked = true;
    }
    if (this.swingTime > 0) {
      this.swingTime -= dt;
      const t = 1 - this.swingTime / 0.25;
      this.weaponPivot.rotation.y = THREE.MathUtils.lerp(1.4, -1.4, t);
    } else {
      this.weaponPivot.rotation.y = 0.3;
    }

    // Pequeno balanço ao andar.
    this.root.children[0].position.y = 0.85 + (move.lengthSq() ? Math.abs(Math.sin(performance.now() / 110)) * 0.06 : 0);
    return attacked;
  }
}
