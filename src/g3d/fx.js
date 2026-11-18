import * as THREE from 'three';

// Efeitos 3D da Luz Sagrada (aditivos, sem contorno).
const add = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

function runeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), m = 256;
  const gr = g.createRadialGradient(m, m, 40, m, m, 250);
  gr.addColorStop(0, 'rgba(255,200,90,0.15)'); gr.addColorStop(0.8, 'rgba(255,190,70,0.45)'); gr.addColorStop(1, 'rgba(255,240,170,0.95)');
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff2b0'; g.lineWidth = 8; g.beginPath(); g.arc(m, m, 240, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(m, m, 175, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff2b0'; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(m + Math.cos(a) * 208, m + Math.sin(a) * 208); g.rotate(a + Math.PI / 2); g.fillText(runes[i], 0, 0); g.restore(); }
  g.fillRect(m - 10, m - 90, 20, 180); g.fillRect(m - 55, m - 35, 110, 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Fx3D {
  constructor(scene) {
    this.scene = scene; this.list = []; this.shake = 0;
    this.runeTex = runeTexture();
    // partículas
    this.max = 600; this.n = 0;
    this.pos = new Float32Array(this.max * 3); this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3); this.life = new Float32Array(this.max); this.maxLife = new Float32Array(this.max); this.grav = new Float32Array(this.max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32; const dg = dot.getContext('2d');
    const rg = dg.createRadialGradient(16, 16, 0, 16, 16, 16); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    dg.fillStyle = rg; dg.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; scene.add(this.points);
    this.cols = new Float32Array(this.max * 3);
  }
  add(e) { this.list.push(e); return e; }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const cur = this.list; this.list = [];
    const keep = cur.filter((e) => { const ok = e.update(dt) !== false; if (!ok) e.dispose?.(); return ok; });
    this.list = keep.concat(this.list);
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt; if (this.life[i] <= 0) continue;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      const f = this.life[i] / this.maxLife[i];
      if (w !== i) { for (let k = 0; k < 3; k++) { this.pos[w * 3 + k] = this.pos[i * 3 + k]; this.vel[w * 3 + k] = this.vel[i * 3 + k]; this.cols[w * 3 + k] = this.cols[i * 3 + k]; } this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i]; this.grav[w] = this.grav[i]; }
      this.col[w * 3] = this.cols[w * 3] * f; this.col[w * 3 + 1] = this.cols[w * 3 + 1] * f; this.col[w * 3 + 2] = this.cols[w * 3 + 2] * f;
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, this.n);
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
  }
  baseCol(i, k) { return (this.cols?.[i * 3 + k]) ?? 1; }
  sparks(p, { n = 16, speed = 4, up = 4, color = 0xffd070, life = 0.6, g = 9 } = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n && this.n < this.max; k++) {
      const i = this.n++, a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      this.pos.set([p.x, p.y, p.z], i * 3);
      this.vel.set([Math.cos(a) * s, up * (0.3 + Math.random()), Math.sin(a) * s], i * 3);
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6); this.grav[i] = g;
      this.cols.set([c.r, c.g, c.b], i * 3);
    }
  }
  mesh(m) { m.userData.noOutline = true; this.scene.add(m); return m; }
  kill(m) { this.scene.remove(m); m.geometry.dispose(); }

  // arco dourado do golpe
  swing(origin, yaw, mirror) {
    // arco na frente do herói: anel no chão (ângulo 0 = +X) girado para a direção do golpe
    const geo = new THREE.RingGeometry(1.0, 2.4, 32, 1, -1.25, 2.5);
    const mat = add(0xffd070, 0.85);
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.userData.noOutline = true;
    const g = new THREE.Group(); g.add(m); g.position.set(origin.x, 1.0, origin.z); g.rotation.y = yaw - Math.PI / 2;
    if (mirror) g.scale.z = -1;
    this.scene.add(g);
    let t = 0;
    return this.add({ update: (dt) => { t += dt; mat.opacity = 0.85 * (1 - t / 0.22); m.rotation.z += dt * 5; return t < 0.22; }, dispose: () => { this.scene.remove(g); geo.dispose(); } });
  }
  burst(p, size = 1) {
    const m = this.mesh(new THREE.Mesh(new THREE.OctahedronGeometry(0.4 * size), add(0xfff2c0, 1)));
    m.position.copy(p); let t = 0;
    return this.add({ update: (dt) => { t += dt; const k = t / 0.2; m.scale.set(1 + k * 3, 0.3 + k * 0.5, 1 + k * 3); m.material.opacity = 1 - k; m.rotation.y += dt * 8; return t < 0.2; }, dispose: () => this.kill(m) });
  }
  ring(p, radius, dur = 0.5, color = 0xffc050) {
    const m = this.mesh(new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), add(color, 1)));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.08, p.z); let t = 0;
    return this.add({ update: (dt) => { t += dt; const k = t / dur; const s = radius * (0.2 + 0.8 * Math.sqrt(k)); m.scale.set(s, s, s); m.material.opacity = 1 - k; return t < dur; }, dispose: () => this.kill(m) });
  }
  consecration(p, radius, dur) {
    const m = this.mesh(new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ map: this.runeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.06, p.z);
    const light = new THREE.PointLight(0xffc060, 25, radius * 3.5, 1.4); light.position.set(p.x, 1.5, p.z); this.scene.add(light);
    let t = 0;
    return this.add({
      update: (dt) => {
        t += dt; const fade = Math.min(1, t * 4, (dur - t) * 2);
        m.material.opacity = fade * (0.85 + 0.15 * Math.sin(t * 7)); m.rotation.z += dt * 0.6; light.intensity = 25 * fade;
        if (Math.random() < 0.7) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * radius; this.sparks(new THREE.Vector3(p.x + Math.cos(a) * rr, 0.1, p.z + Math.sin(a) * rr), { n: 1, speed: 0.2, up: 2.5, g: 0, life: 0.9 }); }
        return t < dur;
      },
      dispose: () => { this.kill(m); this.scene.remove(light); },
    });
  }
  lightHammer(p, onImpact) {
    const g = new THREE.Group(); g.position.set(p.x, 14, p.z);
    const mat = add(0xffe090, 0.95);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.2), mat); head.userData.noOutline = true;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.4, 8), mat); handle.position.y = 2.2; handle.userData.noOutline = true;
    g.add(head, handle); this.scene.add(g);
    const beam = this.mesh(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 30, 16, 1, true), add(0xffe8a0, 0)));
    beam.position.set(p.x, 15, p.z);
    const light = new THREE.PointLight(0xfff0c0, 0, 16, 1.2); light.position.set(p.x, 2, p.z); this.scene.add(light);
    let t = 0, hit = false; const FALL = 0.3, HOLD = 0.7;
    return this.add({
      update: (dt) => {
        t += dt;
        if (t < FALL) { const k = t / FALL; g.position.y = 14 - 13 * k * k; light.intensity = 30 * k; }
        else { if (!hit) { hit = true; onImpact?.(); } const k = (t - FALL) / HOLD; mat.opacity = 0.95 * (1 - k); beam.material.opacity = 0.5 * (1 - k); light.intensity = 60 * (1 - k); g.position.y = 1 + k * 0.6; }
        return t < FALL + HOLD;
      },
      dispose: () => { this.scene.remove(g); this.kill(beam); this.scene.remove(light); },
    });
  }
  bubble(target, dur) {
    const m = this.mesh(new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
    const rim = this.mesh(new THREE.Mesh(new THREE.SphereGeometry(1.55, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff0b0, wireframe: true, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })));
    let t = 0;
    return this.add({
      update: (dt) => {
        t += dt; const f = Math.min(1, t * 6, (dur - t) * 3);
        for (const o of [m, rim]) { o.position.set(target.x, 1.2, target.z); }
        m.material.opacity = 0.22 * f; rim.material.opacity = 0.3 * f; rim.rotation.y += dt;
        if (dur - t < 0.8) m.visible = rim.visible = Math.floor(t * 12) % 2 === 0;
        return t < dur;
      },
      dispose: () => { this.kill(m); this.kill(rim); },
    });
  }
  summon(p) { this.ring(p, 1.4, 0.9, 0xb070ff); this.sparks(new THREE.Vector3(p.x, 0.2, p.z), { n: 14, color: 0xc080ff, up: 5, speed: 1.5 }); }
}
