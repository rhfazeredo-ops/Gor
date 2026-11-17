// Island themes for models: ruins, desert, swamp, crag, dais.
//
// A theme receives a context whose place() only returns spots the creature
// never reaches in any of its animations (see tools/build-island.mjs), so
// limbs and weapons do not pass through props.

import { sphere, ellipsoid, cone, displace, box, cyl } from "./sdf.js";
import { vnoise3, hash3, mulberry32 } from "../noise.js";
import { makeCtx, island, bake, tufts, rocks, bones, urn, fire, ribcage, banner, deadTree, rgb, mul, mix, sstep, TAU } from "./island.js";

const THEMES = {
  // flagstone court: an arch, broken pillars, a wall fragment, braziers
  ruins(c) {
    const { s, rnd, place } = c;
    const M = { floor: 0, under: 1, pillar: 2, rubble: 3, metal: 4, flame: 5, wall: 6, grass: 7, clay: 8, wax: 9 };
    island(c, M.floor, M.under, { bump: 0.012 });
    const lights = [], embers = [];
    const pillar = (x, z, hgt, broken) => {
      const y = c.height(x, z);
      s.bound(x, y + hgt / 2, z, hgt / 2 + 0.35);
      s.add(box(x, y + 0.04, z, 0.17, 0.05, 0.17, 0.014), M.pillar);
      s.add(displace(cyl(x, y + hgt / 2 + 0.08, z, 0.12, hgt / 2, 0.012), (px, py, pz) => 0.008 * Math.cos(Math.atan2(pz - z, px - x) * 12)), M.pillar);
      if (!broken) s.add(box(x, y + hgt + 0.12, z, 0.165, 0.045, 0.165, 0.012), M.pillar);
      else s.sub(sphere(x + 0.09, y + hgt + 0.14, z + 0.04, 0.16), M.rubble);
      s.bound();
      c.grow(y + hgt + 0.2);
      return y + hgt + 0.2;
    };
    const A = c.angles(10);
    // arch
    const [ax, az, ar] = place(A[0], 0.32), [bx, bz] = place(A[0] + 0.66 / ar, 0.32);
    const ty = Math.max(pillar(ax, az, 1.5), pillar(bx, bz, 1.5));
    s.bound((ax + bx) / 2, ty, (az + bz) / 2, 0.6);
    s.add(cone([ax, ty + 0.02, az], [bx, ty + 0.02, bz], 0.1, 0.1), M.pillar).add(box((ax + bx) / 2, ty + 0.13, (az + bz) / 2, 0.1, 0.05, 0.1, 0.02), M.pillar);
    s.bound();
    c.grow(ty + 0.25);
    for (const [i, h, br] of [[2, 1.15, false], [4, 0.62, true], [6, 0.3, true], [8, 0.9, true]]) { const [x, z] = place(A[i], 0.28 + rnd() * 0.15); pillar(x, z, h, br); }
    // stepped wall fragment
    const [wx, wz] = place(A[3], 0.4), wt = [-Math.sin(A[3]), Math.cos(A[3])], wy = c.height(wx, wz);
    s.bound(wx, wy + 0.3, wz, 0.75);
    [3, 5, 6, 4, 2].forEach((rows, col) => {
      for (let r = 0; r < rows; r++)
        s.add(box(wx + wt[0] * (col - 2) * 0.2, wy + 0.055 + r * 0.112, wz + wt[1] * (col - 2) * 0.2, 0.1, 0.054, 0.1, 0.012), M.wall);
    });
    s.bound();
    c.grow(wy + 0.75);
    for (const i of [1, 7]) { const [x, z] = place(A[i], 0.26); fire(c, M.metal, M.flame, x, z, 0.5, lights, embers); }
    for (const [i, k] of [[5, 1.2], [9, 0.9], [5.4, 0.8]]) { const [x, z] = place(A[Math.floor(i)] + (i % 1), 0.3 + rnd() * 0.2, false); urn(c, M.clay, x, z, k); }
    // fallen drums, rubble, floor candles
    for (const i of [9, 6]) {
      const [x, z] = place(A[i] + 0.25, 0.45, false), y = c.height(x, z), a = rnd() * TAU;
      s.bound(x, y, z, 0.45);
      s.add(cone([x, y + 0.11, z], [x + Math.cos(a) * 0.32, y + 0.11, z + Math.sin(a) * 0.32], 0.115, 0.115), M.pillar);
    }
    s.bound();
    for (let i = 0; i < 18; i++) {
      const [x, z] = place(rnd() * TAU, 0.1 + rnd() * 0.7, false), y = c.height(x, z);
      s.bound(x, y, z, 0.16);
      s.add(box(x, y + 0.025, z, 0.03 + rnd() * 0.06, 0.03 + rnd() * 0.035, 0.03 + rnd() * 0.05, 0.012), M.rubble);
    }
    for (let i = 0; i < 5; i++) {
      const [x, z] = place(rnd() * TAU, 0.06, false), h = 0.05 + rnd() * 0.06;
      s.bound(x, h, z, 0.15);
      s.add(cyl(x, h / 2, z, 0.02, h / 2, 0.004), M.wax).add(ellipsoid(x, h + 0.03, z, 0.014, 0.026, 0.014), M.flame);
    }
    s.bound();
    tufts(c, M.grass, 9, 0.16);
    const stone = rgb("#77706a"), moss = rgb("#56683f");
    const paint = (m, x, y, z, n) => {
      if (m === M.flame) return { c: mix(rgb("#ff8a2a"), rgb("#ffe08a"), sstep(0.5, 0.75, y)), emissive: true };
      if (m === M.metal) return { c: rgb("#3b3234") };
      if (m === M.wax) return { c: rgb("#e9dfc6") };
      if (m === M.grass) return { c: mix(rgb("#4f6a3c"), rgb("#8aa05a"), sstep(0, 0.15, y)) };
      if (m === M.clay) return { c: mul(rgb("#a85a3c"), Math.sin(y * 70) > 0.6 ? 0.7 : 1) };
      if (m === M.under) return { c: mul(rgb("#4a4543"), 0.8 + 0.4 * vnoise3(x * 6, y * 9, z * 6)) };
      let c0 = m === M.pillar ? rgb("#9b938c") : m === M.rubble ? rgb("#625d59") : m === M.wall ? rgb("#857c74") : stone;
      if (m === M.floor && n[1] > 0.75) {
        const sz = 0.3, row = Math.floor(z / sz), xo = (row & 1) * sz * 0.5;
        const u = (x + xo) / sz - Math.floor((x + xo) / sz), v = z / sz - row;
        c0 = mul(c0, 0.88 + 0.24 * hash3(Math.floor((x + xo) / sz), row, 7));
        if (u < 0.07 || v < 0.07) c0 = mul(c0, 0.55);
      } else c0 = mul(c0, 0.9 + 0.2 * vnoise3(x * 9, y * 14, z * 9));
      if (n[1] > 0.35 && vnoise3(x * 4.5, 3, z * 4.5) > 0.62) c0 = mix(c0, moss, 0.75);
      return { c: c0 };
    };
    return { paint, lights, particles: [
      { mode: "rise", origins: embers, n: 12, colors: ["#ffb648", "#ff7a2a"], height: 0.9 },
      { mode: "float", n: 60, colors: ["#b9b2a8"] },
      { mode: "fog", n: 9, colors: ["#8a8580"], alpha: 0.16 },
      { mode: "shaft", n: 4, colors: ["#c9b9a0"], alpha: 0.1 },
    ] };
  },

  // dunes, a giant ribcage, mesa rocks, a caravan's leftovers
  desert(c) {
    const { s, rnd, place } = c;
    const M = { sand: 0, under: 1, rock: 2, grass: 3, bone: 4, clay: 5, wood: 6, cloth: 7, metal: 8, flame: 9, dark: 10 };
    island(c, M.sand, M.under, { bump: 0.02, rise: 0.42, ripple: 0.006 });
    const A = c.angles(9), lights = [];
    ribcage(c, M.bone, M.dark, A[0], 1.15);
    for (const i of [3, 6]) {
      const [x, z] = place(A[i], 0.42), y = c.height(x, z);
      s.bound(x, y + 0.45, z, 0.75);
      for (const [dy, r, hh] of [[0.12, 0.36, 0.16], [0.42, 0.29, 0.15], [0.7, 0.22, 0.14], [0.93, 0.13, 0.09]])
        s.add(displace(box(x + (rnd() - 0.5) * 0.1, y + dy, z + (rnd() - 0.5) * 0.1, r * (0.9 + rnd() * 0.3), hh, r * (0.8 + rnd() * 0.3), 0.05), (px, py, pz) => -0.04 * vnoise3(px * 8, py * 8, pz * 8)), M.rock, 0.03);
      s.bound();
      c.grow(y + 1.05);
    }
    { const [x, z] = place(A[5], 0.3); banner(c, M.wood, M.cloth, x, z, 1.55); }
    // crates with a lantern on top
    { const [x, z] = place(A[8], 0.38), y = c.height(x, z);
      s.bound(x, y + 0.25, z, 0.5);
      s.add(box(x, y + 0.11, z, 0.12, 0.12, 0.12, 0.01), M.wood).add(box(x + 0.25, y + 0.09, z + 0.05, 0.1, 0.1, 0.1, 0.01), M.wood).add(box(x + 0.04, y + 0.31, z + 0.02, 0.085, 0.085, 0.085, 0.01), M.wood);
      s.add(box(x + 0.04, y + 0.43, z + 0.02, 0.035, 0.035, 0.035, 0.008), M.metal).add(sphere(x + 0.04, y + 0.45, z + 0.02, 0.03), M.flame);
      s.bound();
      lights.push({ pos: [x + 0.04, y + 0.55, z + 0.02], color: [1.0, 0.62, 0.25], power: 0.9 });
      c.grow(y + 0.6); }
    for (const [i, k] of [[1, 1.3], [1.35, 0.9], [1.7, 1.05], [4, 1]]) { const [x, z] = place(A[Math.floor(i)] + (i % 1) * 0.5, 0.3 + rnd() * 0.25, false); urn(c, M.clay, x, z, k); }
    // dead bushes
    for (const i of [2, 7, 4]) {
      const [x, z] = place(A[i] + 0.2, 0.32, false), y = c.height(x, z);
      s.bound(x, y + 0.15, z, 0.4);
      for (let k = 0; k < 8; k++) { const a = rnd() * TAU, l = 0.1 + rnd() * 0.16; s.add(cone([x, y - 0.02, z], [x + Math.cos(a) * l, y + 0.14 + rnd() * 0.22, z + Math.sin(a) * l], 0.012, 0.003), M.wood); }
    }
    s.bound();
    rocks(c, M.rock, 10, 0.1);
    tufts(c, M.grass, 14, 0.2);
    bones(c, M.bone, 4);
    const paint = (m, x, y, z, n) => {
      if (m === M.flame) return { c: rgb("#ffd27a"), emissive: true };
      if (m === M.metal) return { c: rgb("#3b3234") };
      if (m === M.dark) return { c: rgb("#3a2e26") };
      if (m === M.rock) { const band = Math.floor(y * 11 + 2 * vnoise3(x * 3, 0, z * 3)) & 1; return { c: mul(rgb("#8a6f58"), (band ? 0.84 : 1.05) * (0.9 + 0.2 * vnoise3(x * 10, y * 10, z * 10))) }; }
      if (m === M.under) return { c: mul(rgb("#6e5846"), 0.8 + 0.4 * vnoise3(x * 6, y * 9, z * 6)) };
      if (m === M.grass) return { c: mix(rgb("#8b7c3c"), rgb("#c8b662"), sstep(0, 0.16, y)) };
      if (m === M.bone) return { c: mul(rgb("#e8dfc4"), 0.92 + 0.12 * vnoise3(x * 20, y * 20, z * 20)) };
      if (m === M.clay) return { c: mul(rgb("#a85a3c"), Math.sin(y * 70) > 0.6 ? 0.7 : 1) };
      if (m === M.wood) return { c: mul(rgb("#6b4a32"), Math.sin(y * 55) > 0.75 ? 0.7 : 0.9 + 0.2 * vnoise3(x * 25, y * 4, z * 25)) };
      if (m === M.cloth) return { c: mul(rgb("#a8432e"), Math.sin(y * 40) > 0.5 ? 0.82 : 1) };
      return { c: mul(rgb("#d2ac6e"), 0.92 + 0.14 * vnoise3(x * 6, 5, z * 6)) };
    };
    return { paint, lights, particles: [
      { mode: "drift", n: 90, colors: ["#e6cf9a", "#cfa96c"] },
      { mode: "fog", n: 8, colors: ["#c9a877"], alpha: 0.14 },
      { mode: "shaft", n: 4, colors: ["#f0d8a0"], alpha: 0.1 },
    ] };
  },

  // mud bank, ponds, a gnarled tree with hanging moss, giant glowing mushrooms
  swamp(c) {
    const { s, rnd, place } = c;
    const M = { mud: 0, under: 1, water: 2, lily: 3, reed: 4, tail: 5, cap: 6, stem: 7, wood: 8, moss: 9, rock: 10, bloom: 11 };
    island(c, M.mud, M.under, { bump: 0.035, rise: 0.1 });
    const A = c.angles(9), lights = [];
    for (const i of [1, 4, 7]) {
      const [x, z] = place(A[i], 0.42, false), y = c.height(x, z);
      s.bound(x, y, z, 0.5);
      s.sub(ellipsoid(x, y + 0.035, z, 0.36, 0.08, 0.28), M.water);
      for (let k = 0; k < 4; k++) {
        const lx = x + (rnd() - 0.5) * 0.4, lz = z + (rnd() - 0.5) * 0.3, r = 0.05 + rnd() * 0.03;
        s.add(ellipsoid(lx, y - 0.033, lz, r, 0.006, r), M.lily);
        if (k === 0) s.add(sphere(lx, y - 0.01, lz, 0.022), M.bloom);
      }
    }
    s.bound();
    // the tree, its moss clumps and hanging vines
    { const [x, z] = place(A[0], 0.5), tips = deadTree(c, M.wood, x, z, 1.7, 0.28);
      for (const t of tips) {
        s.bound(t[0], t[1] - 0.2, t[2], 0.65);
        s.add(ellipsoid(t[0], t[1] + 0.03, t[2], 0.17, 0.08, 0.17), M.moss, 0.03);
        for (let k = 0; k < 3; k++) { const vx = t[0] + (rnd() - 0.5) * 0.24, vz = t[2] + (rnd() - 0.5) * 0.24; s.add(cone([vx, t[1], vz], [vx + 0.02, t[1] - 0.2 - rnd() * 0.4, vz], 0.009, 0.004), M.moss); }
      }
      s.bound(); }
    // giant mushrooms
    [[3, 0.85, 0.3], [6, 0.55, 0.22], [8, 0.4, 0.17]].forEach(([i, h, rc], k) => {
      const [x, z] = place(A[i], 0.36), y = c.height(x, z);
      s.bound(x, y + h / 2, z, h / 2 + rc + 0.1);
      s.add(cone([x, y - 0.03, z], [x + 0.03, y + h, z], 0.06, 0.04), M.stem);
      s.add(ellipsoid(x + 0.03, y + h + rc * 0.15, z, rc, rc * 0.5, rc), M.cap).sub(ellipsoid(x + 0.03, y + h - rc * 0.22, z, rc * 0.92, rc * 0.4, rc * 0.92), M.cap);
      s.bound();
      if (k < 2) lights.push({ pos: [x, y + h - 0.12, z], color: [0.25, 1.0, 0.7], power: 0.85 });
      c.grow(y + h + rc);
    });
    // fallen log
    { const [x, z] = place(A[5], 0.4, false), y = c.height(x, z), a = A[5] + 1.3, e = [x + Math.cos(a) * 0.7, y + 0.1, z + Math.sin(a) * 0.7];
      s.bound((x + e[0]) / 2, y + 0.1, (z + e[2]) / 2, 0.55);
      s.add(cone([x, y + 0.09, z], e, 0.11, 0.095), M.wood).sub(sphere(e[0], e[1], e[2], 0.07), M.under);
      for (let k = 1; k < 4; k++) { const t = k / 4, px = x + (e[0] - x) * t, pz = z + (e[2] - z) * t; s.add(cone([px, y + 0.17, pz], [px, y + 0.25, pz], 0.01, 0.008), M.stem).add(ellipsoid(px, y + 0.26, pz, 0.035, 0.02, 0.035), M.cap); }
      s.bound(); }
    for (let i = 0; i < 30; i++) {
      const [x, z] = place(rnd() * TAU, 0.22 + rnd() * 0.6), y = c.height(x, z), h = 0.3 + rnd() * 0.45, lx = (rnd() - 0.5) * 0.1, lz = (rnd() - 0.5) * 0.1;
      s.bound(x, y + h / 2, z, h / 2 + 0.1);
      s.add(cone([x, y - 0.03, z], [x + lx, y + h, z + lz], 0.01, 0.004), M.reed);
      if (rnd() < 0.55) s.add(cone([x + lx * 0.7, y + h * 0.7, z + lz * 0.7], [x + lx * 0.92, y + h * 0.92, z + lz * 0.92], 0.019, 0.016), M.tail);
    }
    for (let i = 0; i < 6; i++) {
      const [x, z] = place(rnd() * TAU, 0.1 + rnd() * 0.5, false), y = c.height(x, z);
      s.bound(x, y + 0.06, z, 0.2);
      for (let k = 0; k < 3; k++) { const px = x + (rnd() - 0.5) * 0.14, pz = z + (rnd() - 0.5) * 0.14, h = 0.05 + rnd() * 0.07, r = 0.03 + rnd() * 0.02; s.add(cone([px, y - 0.03, pz], [px, y + h, pz], 0.011, 0.008), M.stem).add(ellipsoid(px, y + h + r * 0.3, pz, r, r * 0.6, r), M.cap); }
    }
    s.bound();
    rocks(c, M.rock, 7, 0.11);
    const paint = (m, x, y, z, n) => {
      if (m === M.water) return { c: mul(rgb("#1d403c"), 0.9 + 0.2 * vnoise3(x * 8, 1, z * 8)) };
      if (m === M.lily) return { c: rgb("#5a9a44") };
      if (m === M.bloom) return { c: rgb("#ffb8d8"), emissive: true };
      if (m === M.reed) return { c: mix(rgb("#4d5a2c"), rgb("#8a9a4a"), sstep(0, 0.4, y)) };
      if (m === M.tail) return { c: rgb("#5c3b28") };
      if (m === M.cap) return n[1] < -0.1 || hash3(Math.floor(x * 18), Math.floor(y * 18), Math.floor(z * 18)) > 0.82 ? { c: rgb("#9dffd8"), emissive: true } : { c: mul(rgb("#2f8f7c"), 0.85 + 0.3 * vnoise3(x * 9, y * 9, z * 9)) };
      if (m === M.stem) return { c: rgb("#c9d2b6") };
      if (m === M.wood) return { c: mul(rgb("#4a3a2c"), 0.8 + 0.4 * vnoise3(x * 30, y * 5, z * 30)) };
      if (m === M.moss) return { c: mul(rgb("#5f7d3a"), 0.8 + 0.4 * vnoise3(x * 12, y * 12, z * 12)) };
      if (m === M.under) return { c: mul(rgb("#3d3a2c"), 0.8 + 0.4 * vnoise3(x * 6, y * 9, z * 6)) };
      let c0 = mul(m === M.rock ? rgb("#5c5f56") : rgb("#57533a"), 0.82 + 0.36 * vnoise3(x * 7, y * 7, z * 7));
      if (n[1] > 0.45 && vnoise3(x * 3.5, 9, z * 3.5) > 0.54) c0 = mix(c0, rgb("#4f6e34"), 0.8);
      return { c: c0 };
    };
    return { paint, lights, particles: [
      { mode: "blink", n: 70, colors: ["#e4ff8a", "#a8ffb0"] },
      { mode: "fog", n: 11, colors: ["#5f8a6a"], alpha: 0.17 },
      { mode: "shaft", n: 3, colors: ["#9fd8b0"], alpha: 0.08 },
    ] };
  },

  // jagged spires, a dead tree, a nest on a ledge, a campfire
  crag(c) {
    const { s, rnd, place } = c;
    const M = { rock: 0, under: 1, wood: 2, bone: 3, grass: 4, egg: 5, flame: 6, cloth: 7, dark: 8 };
    island(c, M.rock, M.under, { bump: 0.05, rise: 0.34, rough: 0.12 });
    const rough = (x, y, z) => -0.06 * (vnoise3(x * 6, y * 6, z * 6) - 0.5) - 0.02 * vnoise3(x * 17, y * 17, z * 17);
    const A = c.angles(10), lights = [], embers = [];
    [1.9, 0.8, 1.3, 0.6, 1.6, 0.9, 0.7, 1.1].forEach((h, k) => {
      const a = A[[0, 0, 2, 3, 5, 6, 8, 9][k]] + (k === 1 ? 0.22 : 0), [x, z] = place(a, 0.3 + rnd() * 0.25), y = c.height(x, z), r = 0.11 + h * 0.085, lean = 0.1 + rnd() * 0.25;
      s.bound(x, y + h / 2, z, h / 2 + r + 0.3);
      s.add(displace(cone([x, y - 0.1, z], [x + Math.cos(a) * lean, y + h, z + Math.sin(a) * lean], r, 0.018), rough), M.rock, 0.06);
      s.add(displace(cone([x + 0.12, y - 0.1, z + 0.08], [x + 0.16, y + h * 0.45, z + 0.1], r * 0.6, 0.02), rough), M.rock, 0.06);
      s.bound();
      c.grow(y + h + 0.1);
    });
    { const [x, z] = place(A[1], 0.36); deadTree(c, M.wood, x, z, 1.45, 0.3); }
    // ledge with a nest
    { const [x, z] = place(A[4], 0.36), y = c.height(x, z);
      s.bound(x, y + 0.3, z, 0.6);
      s.add(displace(cyl(x, y + 0.2, z, 0.3, 0.22, 0.07), rough), M.rock, 0.05);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU, b = a + 0.9; s.add(cone([x + Math.cos(a) * 0.17, y + 0.44 + (k % 3) * 0.015, z + Math.sin(a) * 0.17], [x + Math.cos(b) * 0.19, y + 0.47, z + Math.sin(b) * 0.19], 0.014, 0.008), M.wood); }
      for (let k = 0; k < 3; k++) s.add(ellipsoid(x + Math.cos(k * 2.1) * 0.06, y + 0.48, z + Math.sin(k * 2.1) * 0.06, 0.04, 0.052, 0.04), M.egg);
      s.bound();
      c.grow(y + 0.6); }
    // campfire ringed with stones
    { const [x, z] = place(A[7], 0.34, false), y = c.height(x, z);
      s.bound(x, y + 0.1, z, 0.35);
      for (let k = 0; k < 8; k++) s.add(sphere(x + Math.cos(k * 0.785) * 0.15, y + 0.02, z + Math.sin(k * 0.785) * 0.15, 0.04), M.rock);
      for (let k = 0; k < 4; k++) s.add(cone([x + Math.cos(k * 1.57) * 0.13, y + 0.02, z + Math.sin(k * 1.57) * 0.13], [x, y + 0.14, z], 0.025, 0.02), M.dark);
      s.add(sphere(x, y + 0.13, z, 0.06), M.flame).add(sphere(x + 0.01, y + 0.2, z, 0.042), M.flame, 0.02).add(sphere(x, y + 0.26, z + 0.01, 0.022), M.flame, 0.02);
      s.bound();
      lights.push({ pos: [x, y + 0.3, z], color: [1.0, 0.5, 0.16], power: 1.3 });
      embers.push([x, y + 0.2, z]); }
    { const [x, z] = place(A[9] + 0.3, 0.3); banner(c, M.wood, M.cloth, x, z, 1.4); }
    ribcage(c, M.bone, M.dark, A[6] + 0.25, 0.6);
    rocks(c, M.rock, 11, 0.1);
    bones(c, M.bone, 5);
    tufts(c, M.grass, 10, 0.14);
    const paint = (m, x, y, z, n) => {
      if (m === M.flame) return { c: mix(rgb("#ff8a2a"), rgb("#ffe08a"), sstep(0.1, 0.3, y)), emissive: true };
      if (m === M.wood) return { c: mul(rgb("#4d3d33"), 0.85 + 0.3 * vnoise3(x * 30, y * 5, z * 30)) };
      if (m === M.dark) return { c: rgb("#2c2422") };
      if (m === M.bone) return { c: rgb("#e2dac2") };
      if (m === M.egg) return { c: mul(rgb("#d9e0d2"), hash3(Math.floor(x * 60), Math.floor(y * 60), Math.floor(z * 60)) > 0.8 ? 0.7 : 1) };
      if (m === M.grass) return { c: mix(rgb("#6f6c3e"), rgb("#a8a060"), sstep(0, 0.12, y)) };
      if (m === M.cloth) return { c: mul(rgb("#3f5f8a"), Math.sin(y * 40) > 0.5 ? 0.82 : 1) };
      const band = Math.floor(y * 12 + 2.5 * vnoise3(x * 3, 0, z * 3)) & 1;
      return { c: mul(m === M.under ? rgb("#4c4852") : rgb("#676170"), (band ? 0.85 : 1.05) * (0.88 + 0.24 * vnoise3(x * 11, y * 11, z * 11))) };
    };
    return { paint, lights, particles: [
      { mode: "rise", origins: embers, n: 14, colors: ["#ffb648", "#ff7a2a"], height: 1.0 },
      { mode: "drift", n: 50, colors: ["#b8b2ba"] },
      { mode: "fog", n: 9, colors: ["#7c7888"], alpha: 0.16 },
      { mode: "shaft", n: 4, colors: ["#b8c0d8"], alpha: 0.09 },
    ] };
  },

  // stepped altar inside a ring of rune-carved standing stones
  dais(c) {
    const { s, rnd, place, rFlat } = c;
    const M = { ground: 0, under: 1, stone: 2, mono: 3, wax: 4, flame: 5, grass: 6, rubble: 7, rune: 8 };
    island(c, M.ground, M.under, { bump: 0.03, topY: -0.24 });
    [[0.14, -0.04], [0.32, -0.12], [0.5, -0.2]].forEach(([dr, y]) => s.add(cyl(0, y, 0, rFlat + dr, 0.04, 0.012), M.stone));
    const A = c.angles(6), lights = [], tops = [];
    A.forEach((a, k) => {
      const [x, z] = place(a, 0.75), y = c.height(x, z), h = 0.6 + rnd() * 0.6;
      s.bound(x, y + h / 2, z, h / 2 + 0.3);
      s.add(displace(box(x, y + h / 2 - 0.05, z, 0.14, h / 2, 0.11, 0.035), (px, py, pz) => -0.012 * vnoise3(px * 9, py * 9, pz * 9)), M.mono);
      s.bound();
      tops.push([x, y + h - 0.05, z, a]);
      c.grow(y + h + 0.2);
    });
    // lintels only across stones that stand next to each other
    const ringed = [...tops].sort((p, q) => p[3] - q[3]);
    let beams = 0;
    ringed.forEach((p, i) => {
      const q = ringed[(i + 1) % ringed.length], span = Math.hypot(p[0] - q[0], p[2] - q[2]);
      if (beams >= 2 || span > 1.3 || i % 2) return;
      const y = Math.min(p[1], q[1]);
      s.bound((p[0] + q[0]) / 2, y, (p[2] + q[2]) / 2, span / 2 + 0.3);
      s.add(cone([p[0], y, p[2]], [q[0], y, q[2]], 0.09, 0.09), M.mono);
      beams++;
    });
    s.bound();
    for (let k = 0; k < 8; k++) {
      const a = k * 0.785 + 0.3, r = rFlat + 0.23, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.06 + rnd() * 0.07;
      s.bound(x, -0.05, z, 0.2);
      s.add(cyl(x, -0.08 + h / 2, z, 0.022, h / 2, 0.004), M.wax).add(ellipsoid(x, -0.08 + h + 0.03, z, 0.015, 0.028, 0.015), M.flame);
      if (k % 4 === 0) lights.push({ pos: [x, h + 0.05, z], color: [1.0, 0.6, 0.25], power: 0.85 });
    }
    // rune stones hovering around the ring
    for (let k = 0; k < 5; k++) {
      const a = rnd() * TAU, [x, z] = place(a, 0.6 + rnd() * 0.4), y = 0.9 + rnd() * 0.9, q = 0.03 + rnd() * 0.025;
      s.bound(x, y, z, 0.2);
      s.add(box(x, y, z, q, q * 1.5, q * 0.8, 0.015), M.rune);
      c.grow(y + 0.2);
    }
    for (let i = 0; i < 10; i++) {
      const [x, z] = place(rnd() * TAU, 0.6 + rnd() * 0.5, false), y = c.height(x, z);
      s.bound(x, y, z, 0.16);
      s.add(box(x, y + 0.025, z, 0.03 + rnd() * 0.06, 0.03 + rnd() * 0.035, 0.03 + rnd() * 0.05, 0.012), M.rubble);
    }
    s.bound();
    tufts(c, M.grass, 10, 0.16);
    const runeAt = (x, y, z, k) => hash3(Math.floor(x * 16), Math.floor(y * 16), Math.floor(z * 16)) > k;
    const paint = (m, x, y, z, n) => {
      if (m === M.flame) return { c: rgb("#ffd27a"), emissive: true };
      if (m === M.wax) return { c: rgb("#e9dfc6") };
      if (m === M.grass) return { c: mix(rgb("#4a5e4a"), rgb("#84a078"), sstep(-0.24, -0.1, y)) };
      if (m === M.rune) return runeAt(x, y, z, 0.7) ? { c: rgb("#8fe8ff"), emissive: true } : { c: rgb("#5a5668") };
      if (m === M.mono) return y > -0.1 && Math.abs(n[1]) < 0.5 && hash3(Math.floor(x * 11), Math.floor(y * 11), Math.floor(z * 11)) > 0.93 ? { c: rgb("#8fe8ff"), emissive: true } : { c: mul(rgb("#6c6878"), 0.85 + 0.3 * vnoise3(x * 8, y * 8, z * 8)) };
      if (m === M.under) return { c: mul(rgb("#45404c"), 0.8 + 0.4 * vnoise3(x * 6, y * 9, z * 6)) };
      if (m === M.ground || m === M.rubble) {
        let c0 = mul(rgb("#5a5560"), 0.85 + 0.3 * vnoise3(x * 8, y * 8, z * 8));
        if (n[1] > 0.4 && vnoise3(x * 4, 3, z * 4) > 0.56) c0 = mix(c0, rgb("#4f6650"), 0.7);
        return { c: c0 };
      }
      let c0 = mul(rgb("#7b7584"), 0.93 + 0.14 * vnoise3(x * 10, y * 10, z * 10));
      const r = Math.hypot(x, z), a = Math.atan2(z, x);
      if (n[1] > 0.8 && y > -0.03) {
        if (Math.abs(r - 0.62 * rFlat) < 0.016 || Math.abs(r - 0.74 * rFlat) < 0.009) c0 = mul(c0, 0.55);
        if (r > 0.62 * rFlat && r < 0.74 * rFlat && Math.abs(Math.sin(a * 12)) < 0.12) c0 = mul(c0, 0.55);
        if (r > 0.78 * rFlat && Math.abs(Math.sin(a * 4 + 0.3)) < 0.03) c0 = mul(c0, 0.6);
      } else if (n[1] < 0.3 && Math.abs(Math.sin(a * 9)) < 0.05) c0 = mul(c0, 0.62);
      return { c: c0 };
    };
    return { paint, lights, particles: [
      { mode: "float", n: 80, colors: ["#d8cfc0", "#9fe0f0"] },
      { mode: "fog", n: 9, colors: ["#6a6680"], alpha: 0.15 },
      { mode: "shaft", n: 4, colors: ["#b0b8e0"], alpha: 0.09 },
    ] };
  },
};

export const THEME_NAMES = Object.keys(THEMES);

// tint: the model's average colour; the ground leans slightly towards it
export function buildIsland(theme, { R, rFlat, clear, seed, tint }) {
  const c = makeCtx(R, rFlat, clear, mulberry32(seed));
  return bake(c, THEMES[theme](c), { tint, shadowR: rFlat });
}
