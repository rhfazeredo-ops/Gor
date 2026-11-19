import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildTripoHero } from './tripo-rig.js';
// Exporta o Dalarian do Tripo já com esqueleto, pele, martelo e animações (para o Godot).
const CLIPS = { idle: 'Sword_Idle', corrida: 'Jog_Fwd_Loop', ataque: 'Sword_Attack', consagracao: 'Spell_Simple_Shoot',
  protecao: 'Spell_Simple_Enter', esquiva: 'Roll', dano: 'Hit_Chest', morte: 'Death01' };
async function run() {
  const H = await buildTripoHero();
  if (H.weapon) H.weapon.name = 'martelo';
  const root = H.lib; root.updateMatrixWorld(true);
  const hips = H.bone('DEF-hips'), par = hips.parent;
  const rest = hips.position.clone();
  const toWorld = new THREE.Matrix3().setFromMatrix4(par.matrixWorld), toLocal = toWorld.clone().invert();
  const clips = [];
  for (const [nome, src] of Object.entries(CLIPS)) {
    const c = H.clips[src].clone(); c.name = nome;
    for (const t of c.tracks) {
      if (t.name !== 'DEF-hips.position') continue;
      // só o sobe-e-desce do quadril (no lugar), na escala do modelo
      const v = t.values, r0 = H.libHipsRest || rest;
      for (let i = 0; i < v.length; i += 3) {
        const d = new THREE.Vector3(v[i] - H.libRest.x, v[i + 1] - H.libRest.y, v[i + 2] - H.libRest.z).applyMatrix3(toWorld);
        d.x = 0; d.z = 0; d.y *= H.hipK;
        const l = d.applyMatrix3(toLocal).add(rest);
        v[i] = l.x; v[i + 1] = l.y; v[i + 2] = l.z;
      }
    }
    clips.push(c);
  }
  const ex = new GLTFExporter();
  const glb = await ex.parseAsync(root, { binary: true, animations: clips, onlyVisible: true, maxTextureSize: 2048 });
  const b = new Uint8Array(glb); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  window.__glb = btoa(s); window.done = 1;
}
run().catch((e) => { window.__err = String(e.stack); window.done = 1; });
