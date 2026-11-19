import * as THREE from 'three';
// =====================================================================
// Estilo "pintado" para os personagens 3D combinarem com o mapa (arte 2D):
//  - toon: sombra em 3 faixas chapadas (sem degradê liso de render 3D)
//  - luz quente do deserto, de cima/esquerda, como nas peças do mapa
//  - contorno quase preto e grosso (~2 px no jogo, igual às rochas e árvores)
// Usado por tools/bake-tripo.js (herói) e tools/bake-escorpiao.js (monstros).
// =====================================================================
const grad = (() => {
  const d = new Uint8Array([70, 150, 255]);     // sombra / meio-tom / luz
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
// troca os materiais de um objeto por toon, mantendo textura ou cores por vértice
export function toonify(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      const t = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, vertexColors: !!m.vertexColors, gradientMap: grad });
      if (t.map) t.map.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}
export function luzes(scene) {
  scene.add(new THREE.AmbientLight(0xffe2c0, 1.25));                 // preenchimento quente
  const sol = new THREE.DirectionalLight(0xfff0d8, 2.6); sol.position.set(-4, 7, 3); scene.add(sol);
  const rim = new THREE.DirectionalLight(0xffb070, 0.6); rim.position.set(4, 2, -5); scene.add(rim);   // contraluz quente
}
// contorno grosso quase preto (px no quadro de render)
export function ink(src, px = 4.2, cor = 'rgba(18,9,4,0.97)') {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const sil = document.createElement('canvas'); sil.width = src.width; sil.height = src.height;
  const s = sil.getContext('2d'); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = cor; s.fillRect(0, 0, c.width, c.height);
  const g = c.getContext('2d');
  for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; g.drawImage(sil, Math.cos(t) * px, Math.sin(t) * px); }
  g.drawImage(src, 0, 0);
  // leve gradação para a paleta do deserto (quente, um pouco mais saturado)
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,170,90,0.07)'; g.fillRect(0, 0, c.width, c.height);
  return c;
}
