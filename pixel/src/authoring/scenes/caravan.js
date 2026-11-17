// A caravan resting at an oasis: striped tent, cooking fire, palms, a pond.

import { sphere, ellipsoid, cone, displace, box } from "../sdf.js";
import { vnoise3, hash3 } from "../../noise.js";
import { makeCtx, island, rocks, urn, banner, rgb, mul, mix, sstep, TAU } from "../island.js";
import { makeFree, campfire, quatFromTo, norm, KIND, UP } from "../scene-kit.js";

export const label = "Caravan camp";

export function build(rnd) {
  const c = makeCtx(1.9, 0.3, () => 0.95, rnd), { s } = c, free = makeFree(c);
  const M = { sand: 0, under: 1, water: 2, tent: 3, glow: 4, wood: 5, rock: 6, flame: 7, dark: 8, metal: 9, palm: 10, carpet: 11, clay: 12, cloth: 13, lily: 14, trunk: 15, nut: 16 };
  island(c, M.sand, M.under, { bump: 0.02, rise: 0.3, ripple: 0.005 });
  const lights = [], embers = [];
  const P = { pond: [0.9, -0.72], tent: [-0.78, 0.42], fire: [0.12, 0.08] };

  // pond
  { const [x, z] = P.pond, y = c.height(x, z);
    s.bound(x, y, z, 0.65);
    s.sub(ellipsoid(x, y + 0.045, z, 0.52, 0.11, 0.4), M.water);
    for (let k = 0; k < 5; k++) { const lx = x + (rnd() - 0.5) * 0.6, lz = z + (rnd() - 0.5) * 0.45, r = 0.045 + rnd() * 0.03; s.add(ellipsoid(lx, y - 0.058, lz, r, 0.006, r), M.lily); }
    s.bound(); }

  // tent: a pleated cone with a lit doorway facing the fire
  { const [x, z] = P.tent, y = c.height(x, z), d = norm([P.fire[0] - x, 0, P.fire[1] - z]);
    s.bound(x, y + 0.55, z, 1.15);
    s.add(displace(cone([x, y - 0.03, z], [x, y + 1.0, z], 0.62, 0.035), (px, py, pz) => 0.016 * Math.cos(Math.atan2(pz - z, px - x) * 12) * sstep(y + 0.95, y + 0.2, py)), M.tent);
    s.sub(ellipsoid(x + d[0] * 0.5, y + 0.14, z + d[2] * 0.5, 0.21, 0.33, 0.21), M.glow);
    s.add(cone([x, y + 0.98, z], [x, y + 1.25, z], 0.014, 0.01), M.wood).add(sphere(x, y + 1.02, z, 0.04), M.wood).add(box(x + 0.085, y + 1.19, z, 0.08, 0.04, 0.008, 0.004), M.cloth);
    for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3; if (Math.cos(a) * d[0] + Math.sin(a) * d[2] > 0.75) continue; s.add(cone([x + Math.cos(a) * 0.3, y + 0.52, z + Math.sin(a) * 0.3], [x + Math.cos(a) * 0.9, y + 0.0, z + Math.sin(a) * 0.9], 0.006, 0.006), M.wood).add(cone([x + Math.cos(a) * 0.9, y - 0.02, z + Math.sin(a) * 0.9], [x + Math.cos(a) * 0.93, y + 0.07, z + Math.sin(a) * 0.93], 0.012, 0.008), M.wood); }
    s.bound();
    lights.push({ pos: [x + d[0] * 0.45, y + 0.3, z + d[2] * 0.45], color: [1.0, 0.7, 0.3], power: 0.8 });
    free.glow(x + d[0] * 0.6, y + 0.2, z + d[2] * 0.6, 0.2, rgb("#ff8a2a"));
    c.grow(y + 1.3); }

  // cooking fire with a pot on a tripod
  { const [x, z] = P.fire, y = c.height(x, z);
    campfire(c, M, x, z, lights, embers, 1.6);
    s.bound(x, y + 0.3, z, 0.5);
    for (let k = 0; k < 3; k++) s.add(cone([x + Math.cos(k * 2.09 + 0.5) * 0.26, y - 0.01, z + Math.sin(k * 2.09 + 0.5) * 0.26], [x, y + 0.62, z], 0.013, 0.011), M.wood);
    s.add(cone([x, y + 0.6, z], [x, y + 0.44, z], 0.005, 0.005), M.metal).add(ellipsoid(x, y + 0.4, z, 0.075, 0.06, 0.075), M.metal);
    s.bound();
    free.glow(x, y + 0.2, z, 0.3, rgb("#ff8a2a")); }

  // palms: SDF trunk and frond spines, free splats for the leaflets
  const palm = (x, z, h, lean) => {
    const y = c.height(x, z), pts = [[x, y - 0.06, z]];
    s.bound(x + lean[0] * 0.2, y + h / 2, z + lean[1] * 0.2, h * 0.7 + 0.7);
    for (let k = 1; k <= 5; k++) {
      const t = k / 5, q = [x + lean[0] * t * t * 0.4, y + h * t, z + lean[1] * t * t * 0.4];
      s.add(displace(cone(pts[k - 1], q, 0.075 - 0.007 * k, 0.068 - 0.007 * k), (px, py) => 0.006 * Math.sin(py * 55)), M.trunk, 0.01);
      pts.push(q);
    }
    const top = pts[5];
    s.add(sphere(top[0], top[1], top[2], 0.07), M.palm);
    for (let k = 0; k < 3; k++) s.add(sphere(top[0] + Math.cos(k * 2.1) * 0.06, top[1] - 0.06, top[2] + Math.sin(k * 2.1) * 0.06, 0.034), M.nut);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rnd() * 0.3, len = 0.5 + rnd() * 0.2, ca = Math.cos(a), sa = Math.sin(a);
      const mid = [top[0] + ca * len * 0.5, top[1] + 0.14, top[2] + sa * len * 0.5], end = [top[0] + ca * len, top[1] - 0.2 - rnd() * 0.12, top[2] + sa * len];
      s.add(cone(top, mid, 0.022, 0.015), M.palm).add(cone(mid, end, 0.015, 0.006), M.palm, 0.01);
      for (let j = 1; j <= 11; j++) {
        const t = j / 11, a0 = t < 0.5 ? top : mid, a1 = t < 0.5 ? mid : end, u = t < 0.5 ? t * 2 : t * 2 - 1;
        const p = [a0[0] + (a1[0] - a0[0]) * u, a0[1] + (a1[1] - a0[1]) * u, a0[2] + (a1[2] - a0[2]) * u];
        for (const sd of [-1, 1]) {
          const d = norm([-sa * sd * 0.8 + ca * 0.25, -0.75, ca * sd * 0.8 + sa * 0.25]), l = 0.08 * (1 - 0.5 * Math.abs(t - 0.45));
          free.push([p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l], [0.013, l, 0.013], quatFromTo(UP, d), (i + j) % 3 ? rgb("#3f8a4c") : rgb("#9ad15e"), KIND.sway);
        }
      }
    }
    s.bound();
    c.grow(top[1] + 0.3);
  };
  palm(-1.25, -0.62, 1.55, [0.6, -0.4]);
  palm(1.32, 0.42, 1.25, [-0.2, 0.7]);
  palm(0.55, -1.3, 1.75, [-0.5, 0.3]);
  palm(-0.25, 1.38, 1.1, [0.5, 0.5]);

  // carpets, crates, jars, a lantern post by the water
  for (const [x, z] of [[0.52, 0.42], [-0.12, -0.38]]) { const y = c.height(x, z); s.bound(x, y, z, 0.4); s.add(box(x, y + 0.01, z, 0.27, 0.012, 0.17, 0.006), M.carpet); }
  { const x = -1.25, z = 0.95, y = c.height(x, z);
    s.bound(x, y + 0.2, z, 0.55);
    s.add(box(x, y + 0.11, z, 0.12, 0.12, 0.12, 0.01), M.wood).add(box(x + 0.26, y + 0.09, z - 0.04, 0.1, 0.1, 0.1, 0.01), M.wood).add(box(x + 0.03, y + 0.31, z, 0.085, 0.085, 0.085, 0.01), M.wood);
    s.bound(); }
  for (const [x, z, k] of [[-0.3, 0.95, 1.25], [-0.12, 1.02, 0.9], [-0.4, 1.12, 1.0], [0.62, 0.8, 0.85]]) urn(c, M.clay, x, z, k);
  { const x = 0.28, z = -0.98, y = c.height(x, z);
    s.bound(x, y + 0.4, z, 0.6);
    s.add(cone([x, y - 0.03, z], [x, y + 0.78, z], 0.02, 0.015), M.wood).add(cone([x, y + 0.76, z], [x + 0.16, y + 0.8, z], 0.012, 0.01), M.wood);
    s.add(box(x + 0.16, y + 0.67, z, 0.04, 0.05, 0.04, 0.008), M.glow).add(box(x + 0.16, y + 0.73, z, 0.05, 0.012, 0.05, 0.004), M.metal);
    s.bound();
    lights.push({ pos: [x + 0.16, y + 0.62, z], color: [1.0, 0.75, 0.35], power: 0.85 });
    free.glow(x + 0.16, y + 0.67, z, 0.24, rgb("#f2cf86")); }
  banner(c, M.wood, M.cloth, 1.28, 1.0, 1.45);
  rocks(c, M.rock, 10, 0.1);

  // vegetation: lush around the water, dry and sparse elsewhere
  const nearPond = (x, z) => Math.hypot((x - P.pond[0]) / 0.82, (z - P.pond[1]) / 0.7);
  const inPond = (x, z) => Math.hypot((x - P.pond[0]) / 0.5, (z - P.pond[1]) / 0.38) < 1;
  const camp = (x, z) => Math.hypot(x - 0.1, z - 0.1) < 0.62 || Math.hypot(x - P.tent[0], z - P.tent[1]) < 0.68;
  free.grass(2600, (x, z) => nearPond(x, z) < 1 && !inPond(x, z), { h: [0.1, 0.24], colors: [[rgb("#1d4a40"), rgb("#3f8a4c")], [rgb("#3f8a4c"), rgb("#9ad15e")]], r: 1.85 });
  free.grass(260, (x, z) => { const d = nearPond(x, z); return d > 0.55 && d < 0.75; }, { h: [0.28, 0.5], w: 0.012, colors: [[rgb("#1d4a40"), rgb("#2f8f9c")], [rgb("#3f8a4c"), rgb("#9ad15e")]], r: 1.85 });
  free.grass(900, (x, z) => nearPond(x, z) >= 1 && !camp(x, z) && hash3(Math.floor(x * 3), 2, Math.floor(z * 3)) > 0.45, { h: [0.06, 0.16], colors: [[rgb("#8f5e44"), rgb("#c9935a")], [rgb("#3f8a4c"), rgb("#f2cf86")]], r: 1.8 });
  free.dots(90, (x, z) => nearPond(x, z) < 0.95 && !inPond(x, z), { colors: [rgb("#fff3c8"), rgb("#a8332e"), rgb("#8fe6e0")], r: 1.85, y: [0.12, 0.24] });

  const sand = rgb("#c9935a"), sandL = rgb("#f2cf86"), sandD = rgb("#8f5e44");
  const paint = (m, x, y, z, n) => {
    if (m === M.flame) return { c: mix(rgb("#ff8a2a"), rgb("#fff3c8"), sstep(0.1, 0.32, y)), emissive: true };
    if (m === M.glow) return { c: mix(rgb("#ff8a2a"), rgb("#fff3c8"), sstep(0.0, 0.5, y)), emissive: true };
    if (m === M.water) { const r = Math.hypot(x - P.pond[0], z - P.pond[1]); return { c: Math.sin(r * 34 + 3 * vnoise3(x * 6, 0, z * 6)) > 0.72 ? rgb("#8fe6e0") : rgb("#2f8f9c") }; }
    if (m === M.lily) return { c: rgb("#9ad15e") };
    if (m === M.tent) { const a = Math.atan2(z - P.tent[1], x - P.tent[0]), stripe = Math.floor(((a + TAU) / TAU) * 12) & 1; return { c: y > 0.84 ? rgb("#5e1f33") : stripe ? rgb("#a8332e") : rgb("#fff3c8") }; }
    if (m === M.carpet) { const u = Math.floor(x * 22), v = Math.floor(z * 22); return { c: (u + v) % 4 === 0 ? rgb("#f2cf86") : (u & 1) ? rgb("#a8332e") : (v % 3 === 0 ? rgb("#2f8f9c") : rgb("#5e1f33")) }; }
    if (m === M.cloth) return { c: rgb("#a8332e") };
    if (m === M.clay) return { c: mul(rgb("#a8332e"), Math.sin(y * 70) > 0.6 ? 0.7 : 1.05) };
    if (m === M.wood) return { c: mul(rgb("#8f5e44"), Math.sin(y * 55) > 0.75 ? 0.7 : 0.9 + 0.2 * vnoise3(x * 25, y * 4, z * 25)) };
    if (m === M.trunk) return { c: mul(rgb("#8f5e44"), 0.75 + 0.3 * vnoise3(x * 20, y * 8, z * 20)) };
    if (m === M.nut) return { c: rgb("#5a3a3c") };
    if (m === M.palm) return { c: rgb("#3f8a4c") };
    if (m === M.dark) return { c: rgb("#2a2444") };
    if (m === M.metal) return { c: rgb("#2a2444") };
    if (m === M.rock) return { c: mul(rgb("#8f5e44"), 0.8 + 0.4 * vnoise3(x * 9, y * 12, z * 9)) };
    if (m === M.under) { const band = Math.floor(y * 9 + 2 * vnoise3(x * 3, 0, z * 3)) & 1; return { c: mul(rgb("#5a3a3c"), band ? 0.8 : 1.1) }; }
    return { c: n[1] < 0.55 ? sandD : mix(sand, sandL, sstep(0.35, 0.7, vnoise3(x * 3.5, 5, z * 3.5))) };
  };
  return { c, paint, lights, free: free.list,
    palette: ["#090c1f", "#161a38", "#2a2444", "#5a3a3c", "#8f5e44", "#c9935a", "#f2cf86", "#fff3c8", "#a8332e", "#5e1f33", "#1d4a40", "#3f8a4c", "#9ad15e", "#2f8f9c", "#8fe6e0", "#ff8a2a"],
    background: "#090c1f", light: 1.0, elev: 0.3,
    particles: [
      { mode: "rise", origins: embers, n: 16, colors: ["#ff8a2a", "#f2cf86"], height: 1.1 },
      { mode: "smoke", origins: embers.map((e) => [e[0], e[1] + 0.25, e[2]]), n: 12, colors: ["#5a3a3c", "#2a2444"], height: 1.5 },
      { mode: "blink", n: 26, halo: true, colors: ["#f2cf86", "#9ad15e"], center: [P.pond[0], 0.35, P.pond[1]], spread: [0.8, 0.3, 0.7] },
      { mode: "drift", n: 40, colors: ["#c9935a", "#f2cf86"] },
    ] };
}
