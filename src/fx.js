import * as THREE from 'three';

// Sistema de FX por spritesheet (tira horizontal de quadros), desenhados no FX Painter.
// Para adicionar um FX novo: salve o PNG em public/fx/ e registre abaixo.
export const FX_LIBRARY = {
  // 'dalarian-impacto': { url: './fx/dalarian-impacto_8f_14fps.png', frames: 8, fps: 14 },
};

export class FxManager {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.sheets = {}; this.live = [];
    const loader = new THREE.TextureLoader();
    for (const [name, d] of Object.entries(FX_LIBRARY)) {
      const tex = loader.load(d.url);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.sheets[name] = { tex, frames: d.frames, fps: d.fps };
    }
    // FX provisório gerado por código até o desenho à mão chegar.
    this.sheets['placeholder-impacto'] = makePlaceholderImpact();
  }

  // flat: deitado no chão (impactos). Senão: sempre virado para a câmera.
  play(name, pos, { scale = 3, flat = true } = {}) {
    const s = this.sheets[name] || this.sheets['placeholder-impacto'];
    const tex = s.tex.clone();
    tex.repeat.set(1 / s.frames, 1); tex.offset.x = 0; tex.needsUpdate = true;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(scale, scale),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    m.position.copy(pos);
    if (flat) { m.rotation.x = -Math.PI / 2; m.position.y = 0.05; }
    m.userData = { s, t: 0, flat };
    this.scene.add(m); this.live.push(m);
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const m = this.live[i], u = m.userData;
      u.t += dt;
      const f = Math.floor(u.t * u.s.fps);
      if (f >= u.s.frames) { this.scene.remove(m); m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); this.live.splice(i, 1); continue; }
      m.material.map.offset.x = f / u.s.frames;
      if (!u.flat) m.quaternion.copy(this.camera.quaternion);
    }
  }
}

function makePlaceholderImpact() {
  const S = 128, N = 8, c = document.createElement('canvas');
  c.width = S * N; c.height = S;
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), cx = i * S + S / 2, cy = S / 2, a = 1 - t;
    const r = 10 + t * 52;
    const grad = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,216,107,0)');
    grad.addColorStop(0.8, `rgba(255,216,107,${a})`);
    grad.addColorStop(1, 'rgba(255,216,107,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 30 * (1 - t * 0.7));
    core.addColorStop(0, `rgba(255,255,240,${a})`); core.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, frames: N, fps: 18 };
}
