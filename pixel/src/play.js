import * as THREE from "three";

// =====================================================================
// Modo jogar (Terra de Gor): controla o herói em pixel art na ilha.
// PC: WASD/setas andam, clique ataca, Q Consagração, E Proteção, Espaço esquiva.
// Celular: joystick na metade esquerda e botões à direita.
// =====================================================================
const CLIP_LEN = { ataque: 0.42, ataque2: 0.42, consagracao: 0.9, protecao: 0.55, esquiva: 0.22, dano: 0.25 };
const COOLDOWN = { ataque: 0.5, consagracao: 6, protecao: 8, esquiva: 0.8 };

export function setupPlay({ model, rig, world, camera, controls, state }) {
  const mesh = model.mesh;
  const h = model.size[1];
  const limit = world ? world.meta.R * 0.42 : 2;
  const speed = h * 1.1;               // alturas por segundo
  const keys = new Set();
  const cd = { ataque: 0, consagracao: 0, protecao: 0, esquiva: 0 };
  let action = null, combo = 0, dash = 0;
  const dashDir = new THREE.Vector3();
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

  state.idle = false;
  controls.enabled = false;
  controls.enableDamping = false;

  // ---------------- interface ----------------
  const css = document.createElement("style");
  css.textContent = `
    .tg-ui { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: system-ui, sans-serif; }
    .tg-joy { position: absolute; left: 0; top: 0; width: 50%; height: 100%; pointer-events: auto; touch-action: none; }
    .tg-base { position: absolute; width: 110px; height: 110px; margin: -55px 0 0 -55px; border-radius: 50%;
      border: 2px solid rgba(220,170,70,.7); background: rgba(255,255,255,.06); display: none; }
    .tg-knob { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
      background: radial-gradient(#f3e6c8, #c9a24a); }
    .tg-btns { position: absolute; right: 18px; bottom: 18px; width: 230px; height: 200px; pointer-events: none; }
    .tg-b { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; border: 3px solid #c9a24a;
      background: radial-gradient(#5a3a2a, #241612); color: #f3e6c8; font: 700 13px system-ui; display: flex;
      align-items: center; justify-content: center; text-align: center; user-select: none; -webkit-user-select: none; }
    .tg-b:active { filter: brightness(1.4); transform: scale(.94); }
    .tg-b[data-cd]:not([data-cd=""])::after { content: attr(data-cd); position: absolute; inset: 0; border-radius: 50%;
      background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; font-size: 18px; }
    .tg-help { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); color: #f3e6c8; font-size: 12px;
      background: rgba(0,0,0,.45); padding: 4px 10px; border-radius: 6px; white-space: nowrap; }
    @media (pointer: coarse) { .tg-help { display: none; } }
  `;
  document.head.append(css);
  const ui = document.createElement("div");
  ui.className = "tg-ui";
  ui.innerHTML = `
    <div class="tg-joy"><div class="tg-base"><div class="tg-knob"></div></div></div>
    <div class="tg-help">WASD andar · clique atacar · Q Consagração · E Proteção · Espaço esquivar</div>
    <div class="tg-btns">
      <div class="tg-b" data-a="ataque" style="right:0;bottom:0;width:92px;height:92px;font-size:15px">Atacar</div>
      <div class="tg-b" data-a="consagracao" style="right:104px;bottom:6px;width:62px;height:62px">Q</div>
      <div class="tg-b" data-a="protecao" style="right:84px;bottom:84px;width:62px;height:62px">E</div>
      <div class="tg-b" data-a="esquiva" style="right:8px;bottom:106px;width:56px;height:56px">⇄</div>
    </div>`;
  document.body.append(ui);
  const btn = Object.fromEntries([...ui.querySelectorAll(".tg-b")].map((b) => [b.dataset.a, b]));
  for (const [a, b] of Object.entries(btn)) b.addEventListener("pointerdown", (e) => { e.preventDefault(); e.stopPropagation(); press(a); });

  const joyZone = ui.querySelector(".tg-joy"), base = ui.querySelector(".tg-base"), knob = ui.querySelector(".tg-knob");
  joyZone.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") { press("ataque"); return; }
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    base.style.display = "block"; base.style.left = e.clientX + "px"; base.style.top = e.clientY + "px";
    knob.style.transform = "";
  });
  addEventListener("pointermove", (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy), max = 45;
    if (d > max) { dx *= max / d; dy *= max / d; }
    joy.x = dx / max; joy.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; base.style.display = "none"; } };
  addEventListener("pointerup", endJoy); addEventListener("pointercancel", endJoy);
  // no PC, clique na metade direita também ataca
  addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse" && e.target.tagName === "CANVAS") press("ataque"); });

  addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === "q") press("consagracao");
    if (k === "e") press("protecao");
    if (k === " ") { e.preventDefault(); press("esquiva"); }
    if (k === "j" || k === "enter") press("ataque");
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  // ---------------- ações ----------------
  function press(a) {
    if (cd[a] > 0) return;
    if (action && a !== "esquiva") return;
    cd[a] = COOLDOWN[a];
    let clip = a;
    if (a === "ataque") { combo ^= 1; clip = combo ? "ataque" : "ataque2"; }
    if (a === "esquiva") {
      const m = moveDir();
      dashDir.copy(m.lengthSq() ? m.normalize() : new THREE.Vector3(Math.sin(mesh.rotation.y), 0, Math.cos(mesh.rotation.y)));
      dash = 0.2;
    }
    action = { clip, t: 0, len: CLIP_LEN[clip] };
    rig.play(clip);
  }

  const mv = new THREE.Vector3();
  function moveDir() {
    let x = joy.x, z = joy.y;
    if (keys.has("a") || keys.has("arrowleft")) x -= 1;
    if (keys.has("d") || keys.has("arrowright")) x += 1;
    if (keys.has("w") || keys.has("arrowup")) z -= 1;
    if (keys.has("s") || keys.has("arrowdown")) z += 1;
    mv.set(x, 0, z);
    if (mv.lengthSq() > 1) mv.normalize();
    return mv;
  }

  // câmera 3/4 que segue o herói
  const camOff = new THREE.Vector3(0, h * 2.6, h * 2.9);
  const look = new THREE.Vector3();
  let lastT = null;

  return {
    update(t) {
      const dt = lastT === null ? 0 : Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      for (const k in cd) cd[k] = Math.max(0, cd[k] - dt);
      for (const [a, b] of Object.entries(btn)) b.dataset.cd = cd[a] > 0 && a !== "ataque" ? Math.ceil(cd[a]) : "";

      const m = moveDir();
      const moving = m.lengthSq() > 0.02;
      if (dash > 0) {
        dash -= dt;
        mesh.position.addScaledVector(dashDir, speed * 3.2 * dt);
      } else if (moving) {
        const slow = action ? 0.35 : 1;
        mesh.position.addScaledVector(m, speed * slow * dt);
        const want = Math.atan2(m.x, m.z);
        let d = want - mesh.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
        mesh.rotation.y += d * Math.min(1, dt * 14);
      }
      // fica dentro da parte plana da ilha
      const r = Math.hypot(mesh.position.x, mesh.position.z);
      if (r > limit) { mesh.position.x *= limit / r; mesh.position.z *= limit / r; }

      if (action) {
        action.t += dt;
        if (action.t >= action.len) action = null;
      }
      if (!action) rig.play(moving ? "walk" : "idle");

      look.set(mesh.position.x, mesh.position.y + h * 0.15, mesh.position.z);
      camera.position.lerp(look.clone().add(camOff), lastT < 0.1 ? 1 : 1 - Math.pow(0.002, dt));
      camera.lookAt(look);
      controls.target.copy(look);
    },
  };
}
