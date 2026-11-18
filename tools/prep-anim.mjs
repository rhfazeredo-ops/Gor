// Gera src/assets/anim/heroi.glb: esqueleto + boneco + só as animações usadas (CC0, Quaternius)
import { NodeIO } from '@gltf-transform/core';
import { prune } from '@gltf-transform/functions';
const KEEP = new Set(['Sword_Idle', 'Idle_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Sword_Attack', 'Spell_Simple_Shoot', 'Spell_Simple_Enter', 'Roll', 'Hit_Chest', 'Death01', 'Punch_Cross']);
const io = new NodeIO();
const doc = await io.read('tools/anim-lib/AnimationLibrary_Godot_Standard.gltf');
for (const a of doc.getRoot().listAnimations()) if (!KEEP.has(a.getName())) a.dispose();
await doc.transform(prune());
await io.write('src/assets/anim/heroi.glb', doc);
console.log('ok', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '));
import fs from 'node:fs';
fs.writeFileSync('src/assets/anim/heroi-glb.js', '// heroi.glb em base64 (gerado por tools/prep-anim.mjs) para embutir sem fetch\nexport default "' + fs.readFileSync('src/assets/anim/heroi.glb').toString('base64') + '";\n');
