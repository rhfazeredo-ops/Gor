import * as THREE from 'three';

// Arena de treino: piso de pedra com variações, muro baixo, colunas com
// tochas (luz que tremula), estandartes e pedrinhas/grama espalhadas.
export function buildArena(scene) {
  const rand = mulberry(7);
  const torches = [];

  // ---- piso: lajotas instanciadas com leve variação de altura e cor ----
  const N = 22, size = 2;
  const tiles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(size * 0.96, 0.24, size * 0.96),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, flatShading: true }),
    N * N,
  );
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  let i = 0;
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) {
    const px = (x - N / 2) * size + 1, pz = (z - N / 2) * size + 1;
    const d = Math.hypot(px, pz);
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.02, (rand() - 0.5) * 0.03));
    m4.compose(new THREE.Vector3(px, -0.12 + (rand() - 0.5) * 0.04, pz), q, new THREE.Vector3(1, 1, 1));
    tiles.setMatrixAt(i, m4);
    // centro mais claro (pedra gasta), bordas mais escuras e musgosas
    const v = 0.16 + rand() * 0.04 - Math.min(0.05, d * 0.002);
    col.setRGB(v * 1.02, v * 0.96, v * 1.0);
    if (d > 14 && rand() < 0.35) col.lerp(new THREE.Color(0x26301a), 0.4);
    tiles.setColorAt(i++, col);
  }
  tiles.receiveShadow = true;
  scene.add(tiles);
  // terra embaixo (aparece nas frestas)
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 1 }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.y = -0.2; dirt.receiveShadow = true;
  scene.add(dirt);

  // ---- círculo dourado de treino no centro ----
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.6, 5.85, 64), new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.6, roughness: 0.4 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; ring.receiveShadow = true;
  scene.add(ring);

  // ---- muro baixo em volta ----
  const stone = new THREE.MeshStandardMaterial({ color: 0x6a6270, roughness: 0.9, flatShading: true });
  const stoneDark = new THREE.MeshStandardMaterial({ color: 0x4e4854, roughness: 0.95, flatShading: true });
  const R = 22;
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1 + rand() * 0.3, 1.1), rand() < 0.5 ? stone : stoneDark);
    b.position.set(Math.cos(a) * R, 0.5, Math.sin(a) * R);
    b.rotation.y = -a + Math.PI / 2;
    b.castShadow = b.receiveShadow = true;
    scene.add(b);
  }

  // ---- colunas com tochas e estandartes ----
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.8, roughness: 0.3 });
  const banner = new THREE.MeshStandardMaterial({ color: 0x2c3f8f, roughness: 0.9, side: THREE.DoubleSide });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.13;
    const x = Math.cos(a) * (R - 1.6), z = Math.sin(a) * (R - 1.6);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a - Math.PI / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), stoneDark); base.position.y = 0.25;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 4.6, 8), stone); col.position.y = 2.8;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.5), stoneDark); cap.position.y = 5.2;
    g.add(base, col, cap);
    if (k % 2 === 0) {
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.4, 1, 3), banner); bn.position.set(0, 3.4, 0.62);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.02), gold); cross.position.set(0, 3.6, 0.64);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.02), gold); cross2.position.set(0, 3.8, 0.64);
      g.add(bn, cross, cross2);
    } else {
      // tocha
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), gold); arm.position.set(0, 3.2, 0.75);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.25, 8), gold); bowl.position.set(0, 3.35, 1.05);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 8), flameMat); flame.position.set(0, 3.7, 1.05);
      const light = new THREE.PointLight(0xff9a40, 18, 11, 1.6); light.position.set(0, 3.9, 1.3);
      g.add(arm, bowl, flame, light);
      torches.push({ flame, light, seed: rand() * 10 });
    }
    g.traverse((o) => { if (o.isMesh && o.material !== flameMat) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
  }

  // ---- pedrinhas e tufos de grama ----
  const pebble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.18, 0), stoneDark, 80);
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.08, 0.4, 3), new THREE.MeshStandardMaterial({ color: 0x5a7a34, roughness: 1, flatShading: true }), 260);
  for (let k = 0; k < 80; k++) {
    const a = rand() * Math.PI * 2, r = 9 + rand() * 11;
    m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.02, Math.sin(a) * r), q.setFromEuler(new THREE.Euler(rand(), rand() * 3, rand())), new THREE.Vector3(1, 0.6, 1).multiplyScalar(0.5 + rand()));
    pebble.setMatrixAt(k, m4);
  }
  for (let k = 0; k < 260; k++) {
    const a = rand() * Math.PI * 2, r = 15 + rand() * 5.5;
    m4.compose(new THREE.Vector3(Math.cos(a) * r + (rand() - 0.5), 0.15, Math.sin(a) * r + (rand() - 0.5)), q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.5, rand() * 3, (rand() - 0.5) * 0.5)), new THREE.Vector3(1, 0.6 + rand(), 1));
    grass.setMatrixAt(k, m4);
  }
  pebble.castShadow = true;
  scene.add(pebble, grass);

  return {
    update(time) {
      for (const t of torches) {
        const f = 0.8 + Math.sin(time * 11 + t.seed) * 0.12 + Math.sin(time * 23 + t.seed * 2) * 0.08;
        t.light.intensity = 18 * f;
        t.flame.scale.set(1, f * 1.1, 1);
      }
    },
  };
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
