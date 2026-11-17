// Animate a skinned model.
//
// <name>.rig.glb holds only the skeleton and its animation clips (the
// converter strips meshes and textures). three.js plays the clips; each frame
// the bone poses go to Spark's dual-quaternion splat skinning, which moves
// every splat on the GPU and rotates its normal with the bone, so the
// lighting follows the motion.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SplatSkinning } from "@sparkjsdev/spark";

import { fetchBin } from "./fetch-bin.js";
const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), T = new THREE.Vector3(), D = new THREE.Quaternion();

export async function loadRig(name, model) {
  const { mesh, count, skin, center, unit } = model;
  const gltf = await new GLTFLoader().parseAsync(await fetchBin(`./models/${name}.rig.glb`), './models/');
  const skeletons = await Promise.all((gltf.parser.json.skins || []).map((_, i) => gltf.parser.getDependency("skin", i)));
  const bones = skeletons.flatMap((s) => s.bones), inverses = skeletons.flatMap((s) => s.boneInverses);

  await mesh.initialized;
  const skinning = new SplatSkinning({ mesh, numSplats: count, numBones: bones.length });
  const idx = new THREE.Vector4(), w = new THREE.Vector4();
  for (let i = 0; i < count; i++) {
    idx.set(skin[i * 4], skin[i * 4 + 1], skin[i * 4 + 2], skin[i * 4 + 3]);
    w.set(skin[count * 4 + i * 4], skin[count * 4 + i * 4 + 1], skin[count * 4 + i * 4 + 2], skin[count * 4 + i * 4 + 3]).multiplyScalar(1 / 255);
    skinning.setSplatBones(i, idx, w);
  }
  skinning.skinTexture.needsUpdate = true;
  mesh.skinning = skinning;
  mesh.updateGenerator();

  // rest pose of each bone, in the same recentred space as the splats
  const M = new THREE.Matrix4();
  const rest = bones.map((_, i) => {
    M.copy(inverses[i]).invert().decompose(P, Q, S);
    return { invQuat: Q.clone().invert(), pos: P.clone().sub(center).multiplyScalar(unit) };
  });

  // A sparse sample of splats, skinned on the CPU each frame to find where the
  // pose touches the ground.
  const stride = Math.max(1, Math.ceil(count / 6000)), m = Math.ceil(count / stride);
  const sample = { n: m, pos: new Float32Array(m * 3), idx: new Uint8Array(m * 4), w: new Float32Array(m * 4), y: new Float32Array(m) };
  mesh.forEachSplat((i, c) => {
    if (i % stride) return;
    const k = i / stride;
    sample.pos.set([c.x, c.y, c.z], k * 3);
    for (let j = 0; j < 4; j++) { sample.idx[k * 4 + j] = skin[i * 4 + j]; sample.w[k * 4 + j] = skin[count * 4 + i * 4 + j] / 255; }
  });
  const pose = new Float32Array(bones.length * 7); // per bone: rotation quaternion, translation

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
  const rig = { clips: Object.keys(actions), current: null, groundY: null, lift: 0, lastT: 0 };

  rig.play = (clip) => {
    if (!actions[clip] || rig.current === clip) return;
    actions[clip].reset().fadeIn(0.25).play();
    actions[rig.current]?.fadeOut(0.25);
    rig.current = clip;
  };

  rig.update = (t) => {
    const dt = Math.max(0, t - rig.lastT);
    rig.lastT = t;
    mixer.update(dt);
    gltf.scene.updateMatrixWorld(true);
    // A bone moves a point as p' = R·p + t, with R = current · rest⁻¹ and
    // t = position − R · restPosition. As a dual quaternion: real = R,
    // dual = ½ · t · R. (Spark's own setBoneQuatPos assumes bones rest at the
    // origin, so the bone texture is written directly.)
    const data = skinning.boneData;
    for (let i = 0; i < bones.length; i++) {
      bones[i].matrixWorld.decompose(P, Q, S);
      Q.multiply(rest[i].invQuat);
      P.sub(center).multiplyScalar(unit).sub(T.copy(rest[i].pos).applyQuaternion(Q));
      D.set(P.x, P.y, P.z, 0).multiply(Q);
      const o = i * 16;
      data[o] = Q.x; data[o + 1] = Q.y; data[o + 2] = Q.z; data[o + 3] = Q.w;
      data[o + 4] = 0.5 * D.x; data[o + 5] = 0.5 * D.y; data[o + 6] = 0.5 * D.z; data[o + 7] = 0.5 * D.w;
      pose.set([Q.x, Q.y, Q.z, Q.w, P.x, P.y, P.z], i * 7);
    }
    skinning.updateBones();
    if (rig.groundY !== null) standOnGround(dt);
  };

  // Keep the feet on the ground. The standing height of a pose is the 2nd
  // percentile of its splat heights (not the minimum: a sword tip or tail
  // hanging below the feet must not hold the whole creature up). Lift at once
  // if the pose would sink, settle slowly when it leaves the ground, so a hop
  // still reads as a hop.
  function standOnGround(dt) {
    const { n, pos, idx, w, y } = sample;
    for (let k = 0; k < n; k++) {
      const px = pos[k * 3], py = pos[k * 3 + 1], pz = pos[k * 3 + 2];
      let h = 0;
      for (let j = 0; j < 4; j++) {
        const ww = w[k * 4 + j];
        if (!ww) continue;
        // only the y row of the rotation is needed
        const o = idx[k * 4 + j] * 7, qx = pose[o], qy = pose[o + 1], qz = pose[o + 2], qw = pose[o + 3];
        h += ww * (2 * (qx * qy + qw * qz) * px + (1 - 2 * (qx * qx + qz * qz)) * py + 2 * (qy * qz - qw * qx) * pz + pose[o + 5]);
      }
      y[k] = h;
    }
    y.sort();
    const want = rig.groundY - (y[Math.floor(n * 0.02)] - 0.012);
    rig.lift = want > rig.lift ? want : rig.lift + (want - rig.lift) * Math.min(1, dt * 2.5);
    mesh.position.y = rig.lift;
  }

  return rig;
}
