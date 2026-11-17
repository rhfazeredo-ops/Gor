import * as THREE from 'three';

// =====================================================================
// FX Kit: efeitos feitos por código (shaders + partículas).
// Cada efeito é um objeto com update(dt) que devolve false quando acaba.
// Cores da Luz Sagrada do Dalárian.
// =====================================================================
export const GOLD = new THREE.Color(1.0, 0.72, 0.22);
export const LIGHT = new THREE.Color(1.0, 0.93, 0.6);

const additive = (o) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...o,
});

// ---------------- Partículas (faíscas, poeira de luz) ----------------
class Particles {
  constructor(scene, max = 800) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3); this.size = new Float32Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.baseSize = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo = g;
    const m = additive({
      vertexShader: `
        attribute float size; attribute vec3 color; varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          float a = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.18, 0.0, d);
          gl_FragColor = vec4(vColor * a + vec3(core), a);
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p, v, { color = GOLD, size = 0.25, life = 0.8, gravity = 0 } = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.baseSize[i] = size; this.size[i] = size;
    this.life[i] = life; this.maxLife[i] = life; this.grav[i] = gravity;
  }

  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.swap(i, --this.n); i--; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt; this.vel[i * 3 + k] *= 0.985; }
      this.size[i] = this.baseSize[i] * Math.min(1, this.life[i] / this.maxLife[i] * 2);
    }
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'color', 'size']) this.geo.attributes[a].needsUpdate = true;
  }

  swap(a, b) {
    for (const [arr, s] of [[this.pos, 3], [this.vel, 3], [this.col, 3]]) for (let k = 0; k < s; k++) arr[a * s + k] = arr[b * s + k];
    for (const arr of [this.size, this.life, this.maxLife, this.grav, this.baseSize]) arr[a] = arr[b];
  }
}

// ----------------------------- O Kit -----------------------------
export class FxKit {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.effects = [];
    this.particles = new Particles(scene);
    this.shake = 0;
  }

  add(e) { this.effects.push(e); return e; }

  update(dt) {
    // Percorre de trás para frente: efeitos criados durante o update (ex.: impacto do martelo)
    // entram no fim da lista e não se perdem.
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      if (!e.update(dt)) { e.dispose?.(); this.effects.splice(this.effects.indexOf(e), 1); }
    }
    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt);
  }

  // Remove um objeto da cena e libera memória.
  _kill(obj) {
    this.scene.remove(obj);
    obj.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }

  // ===== Faíscas em explosão =====
  sparks(pos, { count = 24, speed = 6, color = GOLD, up = 3, size = 0.3, life = 0.6, gravity = 9 } = {}) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize()
        .multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      v.y += up * Math.random();
      this.particles.emit(pos, v, { color: Math.random() < 0.3 ? LIGHT : color, size: size * (0.5 + Math.random()), life: life * (0.6 + Math.random() * 0.7), gravity });
    }
  }

  // ===== Clarão em estrela (sempre virado para a câmera) =====
  starburst(pos, { scale = 2.2, duration = 0.28 } = {}) {
    const mat = additive({
      uniforms: { t: { value: 0 }, seed: { value: Math.random() * 6.28 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float t, seed; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
          float rays = pow(abs(sin(a * 5.0 + seed)), 24.0) + 0.6 * pow(abs(sin(a * 8.0 - seed)), 40.0);
          float fade = 1.0 - t;
          float glow = exp(-r * 5.0) * 1.6 + rays * (1.0 - r) * 1.4;
          vec3 c = mix(vec3(1.0, 0.68, 0.18), vec3(1.0, 0.98, 0.85), exp(-r * 6.0));
          gl_FragColor = vec4(c * glow * fade, 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale), mat);
    m.position.copy(pos); this.scene.add(m);
    let age = 0;
    return this.add({
      update: (dt) => {
        age += dt; const t = age / duration;
        mat.uniforms.t.value = t; m.quaternion.copy(this.camera.quaternion);
        m.scale.setScalar(0.6 + t * 0.8);
        return t < 1;
      },
      dispose: () => this._kill(m),
    });
  }

  // ===== Rastro do golpe (arco de luz que segue o martelo) =====
  swingTrail(origin, yaw, { radius = 1.7, arc = 2.4, duration = 0.32, tilt = 0.5, height = 1.1 } = {}) {
    const N = 32, geo = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = -arc / 2 + u * arc;
      for (const [r, v] of [[radius * 0.55, 0], [radius, 1]]) { pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); uv.push(u, v); }
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = additive({
      side: THREE.DoubleSide,
      uniforms: { head: { value: 0 }, fade: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float head, fade; varying vec2 vUv;
        void main(){
          float behind = head - vUv.x;
          if (behind < 0.0) discard;
          float tail = exp(-behind * 4.0);
          float edge = pow(vUv.y, 3.0);
          vec3 c = mix(vec3(1.0, 0.62, 0.15), vec3(1.0, 0.97, 0.8), edge * tail);
          gl_FragColor = vec4(c * (edge * 1.6 + 0.15) * tail * fade, 1.0);
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(origin); m.position.y = height;
    m.rotation.set(0, yaw, 0); m.rotateX(tilt);
    this.scene.add(m);
    let age = 0;
    return this.add({
      update: (dt) => {
        age += dt; const t = age / duration;
        mat.uniforms.head.value = Math.min(1.0, t * 1.6);
        mat.uniforms.fade.value = 1 - Math.max(0, (t - 0.55) / 0.45);
        return t < 1;
      },
      dispose: () => this._kill(m),
    });
  }

  // ===== Onda de choque no chão =====
  shockwave(pos, { radius = 4, duration = 0.5, width = 0.12 } = {}) {
    const mat = additive({
      uniforms: { t: { value: 0 }, w: { value: width } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float t, w; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(w, 0.0, abs(r - t)) * (1.0 - t);
          gl_FragColor = vec4(vec3(1.0, 0.8, 0.35) * ring * 1.5, 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.06, pos.z);
    this.scene.add(m);
    let age = 0;
    return this.add({
      update: (dt) => { age += dt; const t = age / duration; mat.uniforms.t.value = Math.min(t, 1); return t < 1; },
      dispose: () => this._kill(m),
    });
  }

  // ===== Coluna de luz vertical =====
  pillar(pos, { radius = 1.2, height = 9, duration = 0.9, color = GOLD } = {}) {
    const mat = additive({
      side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, fade: { value: 1 }, col: { value: color } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time, fade; uniform vec3 col; varying vec2 vUv;
        void main(){
          float h = 1.0 - vUv.y;
          float streak = 0.55 + 0.45 * sin(vUv.x * 50.0 + sin(vUv.x * 13.0) * 3.0) * sin(vUv.y * 6.0 - time * 8.0);
          float a = pow(h, 1.6) * streak * fade;
          gl_FragColor = vec4(mix(col, vec3(1.0, 0.95, 0.8), h * h) * a * 0.75, 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.1, height, 24, 1, true), mat);
    m.position.set(pos.x, height / 2, pos.z);
    this.scene.add(m);
    let age = 0;
    return this.add({
      update: (dt) => {
        age += dt; const t = age / duration;
        mat.uniforms.time.value = age;
        mat.uniforms.fade.value = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        m.scale.set(1 - t * 0.5, 1, 1 - t * 0.5);
        return t < 1;
      },
      dispose: () => this._kill(m),
    });
  }

  // ===== Martelo de luz gigante que cai do céu =====
  lightHammer(pos, { onImpact } = {}) {
    const g = new THREE.Group();
    const glow = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const outer = glow(0xffa828, 0.32), inner = glow(0xffd877, 0.42);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.1), outer);
    const headIn = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.8), inner);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.2, 10), outer);
    const handleIn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), inner);
    head.position.y = headIn.position.y = 0;
    handle.position.y = handleIn.position.y = 2.1;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), glow(0xfff0c0, 0.7));
    star.position.z = 0.6;
    g.add(head, headIn, handle, handleIn, star);
    g.position.set(pos.x, 12, pos.z);
    g.rotation.z = 0.25;
    this.scene.add(g);
    let age = 0, hit = false;
    const FALL = 0.32, HOLD = 1.6;
    return this.add({
      update: (dt) => {
        age += dt;
        if (age < FALL) {
          const t = age / FALL;
          g.position.y = THREE.MathUtils.lerp(12, 0.7, t * t);
          g.rotation.z = 0.25 * (1 - t);
          if (Math.random() < 0.8) this.particles.emit(g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 1, 0)), new THREE.Vector3(0, 3, 0), { size: 0.4, life: 0.4 });
        } else if (!hit) {
          hit = true; g.position.y = 0.7; g.rotation.z = 0;
          onImpact?.();
        } else {
          const t = (age - FALL) / HOLD;
          outer.opacity = 0.32 * (1 - t); inner.opacity = 0.42 * (1 - t);
          g.position.y = 0.7 + t * 0.6;
          if (Math.random() < 0.4) this.particles.emit(g.position.clone().add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 3, (Math.random() - 0.5))), new THREE.Vector3(0, 1.5, 0), { size: 0.25, life: 0.7, color: LIGHT });
        }
        return age < FALL + HOLD;
      },
      dispose: () => this._kill(g),
    });
  }

  // ===== Círculo de consagração com runas =====
  consecration(pos, { radius = 3, duration = 6 } = {}) {
    const mat = additive({
      uniforms: { time: { value: 0 }, fade: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float time, fade; varying vec2 vUv;
        #define PI 3.14159265
        float line(float x, float w){ return smoothstep(w, 0.0, abs(x)); }
        void main(){
          vec2 p = (vUv - 0.5) * 2.0; float r = length(p); float a = atan(p.y, p.x);
          if (r > 1.0) discard;
          float v = 0.0;
          // anéis
          v += line(r - 0.97, 0.025) * 1.4;
          v += line(r - 0.90, 0.012);
          v += line(r - 0.62, 0.015) * 1.1;
          v += line(r - 0.55, 0.008) * 0.8;
          // runas girando entre os anéis
          float n = 12.0;
          float ar = a + time * 0.25;
          float cell = fract(ar / (2.0 * PI) * n) - 0.5;
          float ry = (r - 0.76) / 0.1;
          vec2 g = vec2(cell * 2.2, ry);
          float diamond = line(abs(g.x) + abs(g.y) - 0.55, 0.09);
          float bar = line(g.x, 0.06) * step(abs(g.y), 0.8);
          float idv = floor(ar / (2.0 * PI) * n);
          float rune = (mod(idv, 2.0) < 1.0 ? diamond : bar + line(g.y, 0.08) * step(abs(g.x), 0.45));
          v += rune * step(abs(ry), 1.0) * 1.2;
          // estrela de 8 pontas no centro
          float ac = a - time * 0.15;
          float star = line(sin(ac * 4.0) * r, 0.02) * step(r, 0.55) * (1.0 - r / 0.55);
          v += star * 0.9;
          // preenchimento
          v += 0.22 * (1.0 - r) + 0.18 * smoothstep(0.6, 1.0, r);
          float pulse = 0.85 + 0.15 * sin(time * 4.0);
          vec3 c = mix(vec3(1.0, 0.6, 0.12), vec3(1.0, 0.95, 0.75), clamp(v - 0.6, 0.0, 1.0));
          gl_FragColor = vec4(c * v * pulse * fade, 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.05, pos.z);
    this.scene.add(m);
    // pequenas colunas de luz em volta
    const shafts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, rr = radius * (0.65 + Math.random() * 0.3);
      shafts.push(this.pillar(new THREE.Vector3(pos.x + Math.cos(a) * rr, 0, pos.z + Math.sin(a) * rr),
        { radius: 0.08 + Math.random() * 0.06, height: 1.5 + Math.random() * 2, duration: duration }));
    }
    let age = 0;
    return this.add({
      pos: pos.clone(), radius,
      update: (dt) => {
        age += dt;
        mat.uniforms.time.value = age;
        mat.uniforms.fade.value = Math.min(1, age / 0.25) * Math.min(1, (duration - age) / 0.6);
        // poeira de luz subindo
        if (Math.random() < 0.7) {
          const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * radius;
          this.particles.emit(new THREE.Vector3(pos.x + Math.cos(a) * rr, 0.1, pos.z + Math.sin(a) * rr),
            new THREE.Vector3(0, 1 + Math.random() * 1.5, 0), { size: 0.18, life: 1.2, color: Math.random() < 0.5 ? GOLD : LIGHT });
        }
        return age < duration;
      },
      dispose: () => this._kill(m),
    });
  }

  // ===== Bolha de proteção (presa a um objeto que se move) =====
  bubble(target, { radius = 1.6, duration = 3 } = {}) {
    const mat = additive({
      uniforms: { time: { value: 0 }, fade: { value: 0 } },
      vertexShader: `
        varying vec3 vN, vV, vP;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); vP = position;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform float time, fade; varying vec3 vN, vV, vP;
        void main(){
          float fres = pow(1.0 - abs(dot(vN, vV)), 2.2);
          // raios de luz percorrendo a superfície
          float l1 = smoothstep(0.06, 0.0, abs(sin(vP.y * 5.0 + sin(vP.x * 4.0 + time * 3.0) * 1.2 + time * 2.0)) - 0.0) ;
          float l2 = smoothstep(0.05, 0.0, abs(sin(vP.x * 6.0 - sin(vP.z * 5.0 - time * 2.5) + time)) );
          float lines = (l1 * 0.5 + l2 * 0.35) * (0.4 + fres);
          float a = (fres * 1.3 + lines + 0.06) * fade;
          vec3 c = mix(vec3(1.0, 0.65, 0.15), vec3(1.0, 0.96, 0.8), fres);
          gl_FragColor = vec4(c * a, 1.0);
        }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 40, 24), mat);
    this.scene.add(m);
    // anéis girando que "fecham" a bolha no início
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc85a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const rings = [0, 1].map((i) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.05, 0.035, 6, 64), ringMat);
      r.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4); this.scene.add(r); return r;
    });
    let age = 0;
    return this.add({
      update: (dt) => {
        age += dt;
        const c = target.position;
        m.position.set(c.x, 1.0, c.z);
        mat.uniforms.time.value = age;
        const open = Math.min(1, age / 0.35);
        mat.uniforms.fade.value = open * Math.min(1, (duration - age) / 0.35);
        m.scale.setScalar(0.6 + 0.4 * open + 0.02 * Math.sin(age * 6));
        rings.forEach((r, i) => {
          r.position.copy(m.position);
          r.rotation.z += dt * (i ? 3 : -2.5);
          r.scale.setScalar(1.5 - 0.5 * open);
          ringMat.opacity = Math.max(0, 1 - age / 0.8);
        });
        if (Math.random() < 0.35) {
          const d = new THREE.Vector3().randomDirection().multiplyScalar(radius);
          this.particles.emit(m.position.clone().add(d), d.clone().multiplyScalar(0.15), { size: 0.15, life: 0.5, color: LIGHT });
        }
        return age < duration;
      },
      dispose: () => { this._kill(m); rings.forEach((r) => this._kill(r)); },
    });
  }
}
