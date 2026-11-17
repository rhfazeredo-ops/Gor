import * as THREE from 'three';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

// Monta um herói provisório (formas simples) com a paleta do concept art.
// Depois trocamos por um modelo .glb animado.
export function buildHeroModel(def) {
  const c = def.cores;
  const root = new THREE.Group();
  const skin = mat(c.pele, { roughness: 0.7 });
  const armor = mat(c.armadura, { metalness: 0.5, roughness: 0.4 });
  const trim = mat(c.detalhe, { metalness: 0.7, roughness: 0.3 });
  const cloth = mat(c.tecido, { roughness: 0.85, side: THREE.DoubleSide });
  const hairM = mat(c.cabelo, { roughness: 0.8 });
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; root.add(m); return m; };

  // pernas
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 4, 8), armor), -0.18, 0.4, 0);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 4, 8), armor), 0.18, 0.4, 0);
  // tronco
  const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.5, 6, 12), armor), 0, 1.05, 0);
  torso.scale.set(1, 1, 0.75);
  // tabardo (frente)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.04), cloth), 0, 0.85, 0.3);
  // cinto
  add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 16), trim), 0, 0.82, 0).rotation.x = Math.PI / 2;
  // ombreiras
  add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim), -0.48, 1.38, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim), 0.48, 1.38, 0);
  // braços
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), armor), -0.55, 1.0, 0);
  // cabeça + cabelo
  add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin), 0, 1.75, 0.02);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM), 0, 1.79, -0.04);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.1), hairM), 0, 1.55, -0.22);
  // orelhas pontudas (Vaeltharianos e Vark)
  if (def.faccao !== 'humanos') {
    for (const s of [-1, 1]) {
      const ear = add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 6), skin), s * 0.27, 1.8, 0);
      ear.rotation.z = -s * 1.2;
    }
  }
  // capa
  const cape = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 1, 4), cloth), 0, 0.85, -0.34);
  cape.rotation.x = 0.12;

  // arma num pivô (para animar o golpe)
  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.55, 1.15, 0.05);
  weaponPivot.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.35, 4, 8), armor)); // braço direito
  weaponPivot.children[0].position.y = -0.2;
  const w = buildWeapon(def.arma, { armor, trim, cloth, skin });
  w.position.set(0, -0.4, 0.15);
  weaponPivot.add(w);
  weaponPivot.traverse((o) => (o.castShadow = true));
  root.add(weaponPivot);

  return { root, weaponPivot, cape };
}

function buildWeapon(tipo, m) {
  const g = new THREE.Group();
  const wood = mat(0x5a3a24, { roughness: 0.9 });
  if (tipo === 'martelo') {
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), wood);
    cabo.rotation.x = Math.PI / 2; cabo.position.z = 0.5;
    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.32), mat(0x9a96a0, { metalness: 0.6, roughness: 0.35 }));
    cabeca.position.z = 1.15;
    const estrela = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), mat(0xffd86b, { emissive: 0xffb020, emissiveIntensity: 0.9 }));
    estrela.position.set(0, 0.18, 1.15);
    g.add(cabo, cabeca, estrela);
  } else {
    // genérico (lâmina) para os outros heróis por enquanto
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 1.0), m.trim);
    lamina.position.z = 0.6;
    g.add(lamina);
  }
  return g;
}

// Herói controlado pelo jogador.
export class Hero {
  constructor(scene, def) {
    this.def = def;
    this.speed = 6;
    this.hp = 100; this.maxHp = 100;
    this.attackCooldown = 0; this.dashCooldown = 0; this.dashTime = 0;
    this.dashDir = new THREE.Vector3();
    this.swingTime = 0; this.SWING = 0.32;
    this.impactPending = false;
    const m = buildHeroModel(def);
    this.root = m.root; this.weaponPivot = m.weaponPivot; this.cape = m.cape;
    scene.add(this.root);
  }

  get position() { return this.root.position; }
  forward() { return new THREE.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y)); }

  // Retorna 'impact' no quadro em que o martelo bate no chão.
  update(dt, input, aim) {
    this.attackCooldown -= dt; this.dashCooldown -= dt;

    const dx = aim.x - this.position.x, dz = aim.z - this.position.z;
    if (dx * dx + dz * dz > 0.01) this.root.rotation.y = Math.atan2(dx, dz);

    const move = input.moveDir();
    if (input.dashPressed && this.dashCooldown <= 0) {
      this.dashDir.copy(move.lengthSq() ? move.clone().normalize() : this.forward());
      this.dashTime = 0.18; this.dashCooldown = 0.8;
    }
    if (this.dashTime > 0) { this.dashTime -= dt; this.position.addScaledVector(this.dashDir, 22 * dt); }
    else this.position.addScaledVector(move, this.speed * (this.swingTime > 0 ? 0.45 : 1) * dt);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -20, 20);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -20, 20);

    let event = null;
    if (input.attackPressed && this.attackCooldown <= 0) {
      this.attackCooldown = 0.55; this.swingTime = this.SWING; this.impactPending = true;
    }
    // Golpe de cima para baixo: ergue (-2.2) e desce (+0.6).
    if (this.swingTime > 0) {
      this.swingTime -= dt;
      const t = 1 - this.swingTime / this.SWING;
      this.weaponPivot.rotation.x = t < 0.45
        ? THREE.MathUtils.lerp(0, -2.4, t / 0.45)
        : THREE.MathUtils.lerp(-2.4, 0.7, Math.min(1, (t - 0.45) / 0.25));
      if (this.impactPending && t > 0.7) { this.impactPending = false; event = 'impact'; }
    } else {
      this.weaponPivot.rotation.x = THREE.MathUtils.lerp(this.weaponPivot.rotation.x, 0, 0.2);
    }

    // balanço ao andar + capa
    const moving = move.lengthSq() > 0.01;
    const bob = moving ? Math.abs(Math.sin(performance.now() / 110)) * 0.05 : 0;
    this.cape.rotation.x = THREE.MathUtils.lerp(this.cape.rotation.x, moving ? 0.5 : 0.12, 0.1);
    this.root.position.y = bob;
    return event;
  }
}
