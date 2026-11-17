// A red gate on stone steps under an autumn maple, guarded by stone foxes.

import { sphere, ellipsoid, cone, displace, box, cyl } from "../sdf.js";
import { vnoise3 } from "../../noise.js";
import { makeCtx, island, rocks, deadTree, rgb, mul, mix, sstep, TAU } from "../island.js";
import { makeFree, stoneLantern, shafts, quatFromTo, norm, KIND, UP } from "../scene-kit.js";

export const label = "Autumn shrine";

export function build(rnd) {
  const c = makeCtx(1.85, 0.3, () => 1.05, rnd), { s } = c, free = makeFree(c);
  const M = { ground: 0, under: 1, stone: 2, gate: 3, roof: 4, glow: 5, wood: 6, leafA: 7, leafB: 8, leafC: 9, rock: 10, bamboo: 11, metal: 12, dark: 13 };
  island(c, M.ground, M.under, { bump: 0.03, rise: 0.16 });
  const lights = [], smoke = [];
  // platform and steps
  s.add(cyl(0, 0.12, -0.15, 0.82, 0.12, 0.02), M.stone);
  for (let k = 0; k < 4; k++) s.add(box(0, (k + 1) * 0.03, 1.12 - k * 0.15, 0.42, (k + 1) * 0.03, 0.09, 0.008), M.stone);
  // gate
  { const y = 0.24, z = 0.42;
    s.bound(0, 0.95, z, 1.1);
    for (const sd of [-1, 1]) s.add(cyl(sd * 0.44, y + 0.04, z, 0.085, 0.04, 0.01), M.dark).add(cone([sd * 0.44, y + 0.06, z], [sd * 0.41, y + 1.25, z], 0.062, 0.052), M.gate);
    s.add(box(0, y + 0.98, z, 0.56, 0.036, 0.042, 0.008), M.gate).add(box(0, y + 1.2, z, 0.62, 0.036, 0.05, 0.008), M.gate);
    s.add(box(0, y + 1.28, z, 0.72, 0.045, 0.075, 0.02), M.roof).add(box(-0.7, y + 1.32, z, 0.05, 0.04, 0.075, 0.02), M.roof).add(box(0.7, y + 1.32, z, 0.05, 0.04, 0.075, 0.02), M.roof);
    s.add(box(0, y + 1.09, z, 0.055, 0.085, 0.03, 0.006), M.dark);
    s.bound();
    c.grow(y + 1.5); }
  stoneLantern(c, M, -0.72, 1.02, lights, free);
  stoneLantern(c, M, 0.72, 1.02, lights, free);
  // incense burner on the platform
  s.bound(0, 0.35, -0.2, 0.3);
  s.add(cyl(0, 0.27, -0.2, 0.05, 0.03, 0.006), M.metal).add(ellipsoid(0, 0.35, -0.2, 0.09, 0.055, 0.09), M.metal).sub(ellipsoid(0, 0.39, -0.2, 0.075, 0.04, 0.075), M.dark);
  s.bound();
  smoke.push([0, 0.42, -0.2]);
  // guardian foxes on pedestals
  const fox = (x, z, face) => {
    const y = c.height(x, z);
    s.bound(x, y + 0.35, z, 0.5);
    s.add(box(x, y + 0.1, z, 0.11, 0.11, 0.15, 0.012), M.stone);
    s.add(ellipsoid(x, y + 0.33, z - 0.02, 0.075, 0.12, 0.09), M.rock).add(sphere(x, y + 0.5, z + 0.05, 0.066), M.rock, 0.03);
    s.add(cone([x, y + 0.49, z + 0.08], [x + face * 0.01, y + 0.47, z + 0.17], 0.04, 0.012), M.rock);
    for (const sd of [-1, 1]) s.add(cone([x + sd * 0.04, y + 0.54, z + 0.03], [x + sd * 0.055, y + 0.65, z + 0.02], 0.026, 0.004), M.rock).add(cone([x + sd * 0.04, y + 0.34, z + 0.06], [x + sd * 0.04, y + 0.21, z + 0.09], 0.028, 0.022), M.rock);
    s.add(cone([x, y + 0.26, z - 0.1], [x, y + 0.42, z - 0.2], 0.04, 0.05), M.rock, 0.02).add(cone([x, y + 0.42, z - 0.2], [x, y + 0.6, z - 0.17], 0.05, 0.012), M.rock, 0.02);
    s.bound();
  };
  fox(-1.08, 0.5, 1);
  fox(1.08, 0.5, -1);
  // maple
  { const tips = deadTree(c, M.wood, 0.92, -0.62, 1.55, 0.32);
    tips.concat([[0.92, 1.75, -0.62], [0.7, 1.55, -0.4], [1.15, 1.6, -0.8]]).forEach((t, i) => {
      const r = 0.24 + rnd() * 0.14;
      s.bound(t[0], t[1], t[2], r * 1.6);
      s.add(displace(ellipsoid(t[0], t[1] + 0.05, t[2], r, r * 0.78, r), (px, py, pz) => -0.07 * (vnoise3(px * 9, py * 9, pz * 9) - 0.5)), [M.leafA, M.leafB, M.leafA, M.leafC][i % 4], 0.06);
      c.grow(t[1] + r + 0.1);
    });
    s.bound(); }
  // bamboo grove
  for (let i = 0; i < 11; i++) {
    const x = -1.0 + (rnd() - 0.5) * 0.5, z = -0.78 + (rnd() - 0.5) * 0.5, y = c.height(x, z), h = 1.2 + rnd() * 0.8, lx = (rnd() - 0.5) * 0.25;
    s.bound(x, y + h / 2, z, h / 2 + 0.3);
    s.add(cone([x, y - 0.03, z], [x + lx, y + h, z], 0.022, 0.012), M.bamboo);
    for (let k = 0; k < 14; k++) {
      const t = 0.45 + rnd() * 0.55, a = rnd() * TAU, d = norm([Math.cos(a), -0.35 - rnd() * 0.4, Math.sin(a)]), l = 0.07 + rnd() * 0.05, p = [x + lx * t, y + h * t, z];
      free.push([p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l], [0.012, l, 0.012], quatFromTo(UP, d), k % 3 ? rgb("#4f9a4a") : rgb("#a8d860"), KIND.sway);
    }
    c.grow(y + h);
  }
  s.bound();
  rocks(c, M.rock, 9, 0.13);

  const paved = (x, z) => Math.hypot(x, z + 0.15) < 0.86 || (Math.abs(x) < 0.46 && z > 0.5 && z < 1.25);
  free.grass(3000, (x, z) => !paved(x, z), { h: [0.08, 0.22], colors: [[rgb("#1f4a38"), rgb("#4f9a4a")], [rgb("#1f4a38"), rgb("#4f9a4a")], [rgb("#4f9a4a"), rgb("#a8d860")]], r: 1.8 });
  free.litter(520, (x, z) => Math.hypot(x - 0.9, z + 0.6) < 1.25, { colors: [rgb("#f08a2a"), rgb("#c8372d"), rgb("#ffcf5a")], r: 1.8 });
  free.dots(70, (x, z) => !paved(x, z) && x < 0.2, { colors: [rgb("#c8372d"), rgb("#fff1c0")], r: 1.8, y: [0.14, 0.26] });

  const paint = (m, x, y, z, n) => {
    if (m === M.glow) return { c: rgb("#ffcf5a"), emissive: true };
    if (m === M.gate) return { c: rgb("#c8372d") };
    if (m === M.roof) return { c: rgb("#2b2740") };
    if (m === M.dark || m === M.metal) return { c: rgb("#2b2740") };
    if (m === M.leafA) return { c: vnoise3(x * 14, y * 14, z * 14) > 0.6 ? rgb("#ffcf5a") : rgb("#f08a2a"), leaf: true };
    if (m === M.leafB) return { c: vnoise3(x * 14, y * 14, z * 14) > 0.55 ? rgb("#f08a2a") : rgb("#c8372d"), leaf: true };
    if (m === M.leafC) return { c: vnoise3(x * 14, y * 14, z * 14) > 0.5 ? rgb("#fff1c0") : rgb("#ffcf5a"), leaf: true };
    if (m === M.wood) return { c: mul(rgb("#4a2a26"), 0.85 + 0.35 * vnoise3(x * 30, y * 5, z * 30)) };
    if (m === M.bamboo) return { c: Math.abs(Math.sin(y * 14)) < 0.1 ? rgb("#1f4a38") : rgb("#4f9a4a") };
    if (m === M.under) { const band = Math.floor(y * 9 + 2 * vnoise3(x * 3, 0, z * 3)) & 1; return { c: mul(rgb("#2b2740"), band ? 0.85 : 1.25) }; }
    if (m === M.ground) return { c: n[1] < 0.5 ? rgb("#4a2a26") : mix(rgb("#1f4a38"), rgb("#4f9a4a"), sstep(0.3, 0.7, vnoise3(x * 4, 2, z * 4))) };
    // stone: joints on the paving, moss on anything facing up
    let k = m === M.rock ? rgb("#807e92") : rgb("#b9b6c0");
    if (m === M.stone && n[1] > 0.8) {
      const r = Math.hypot(x, z + 0.15), a = Math.atan2(z + 0.15, x);
      if (y > 0.2 && (Math.abs(r - 0.45) < 0.012 || (r > 0.45 && Math.abs(Math.sin(a * 5)) < 0.03))) k = rgb("#4c4a60");
    } else k = mul(k, 0.85 + 0.3 * vnoise3(x * 9, y * 9, z * 9));
    if (n[1] > 0.45 && vnoise3(x * 5, y * 3, z * 5) > 0.6) k = rgb("#4f9a4a");
    return { c: k };
  };
  return { c, paint, lights, free: free.list,
    palette: ["#0a0a18", "#17152c", "#2b2740", "#4c4a60", "#807e92", "#b9b6c0", "#c8372d", "#7a1f2c", "#f08a2a", "#ffcf5a", "#4a2a26", "#1f4a38", "#4f9a4a", "#a8d860", "#fff1c0"],
    glowPalette: ["#4e3f3a", "#8a7356"], // muted warm light, only for beams and glows
    background: "#0a0a18", light: 1.0, elev: 0.3,
    particles: [
      { mode: "leaf", n: 80, colors: ["#f08a2a", "#c8372d", "#ffcf5a"], center: [0.7, 0, -0.4], spread: [1.3, 2.0, 1.3] },
      { mode: "blink", n: 22, halo: true, colors: ["#ffcf5a", "#fff1c0"], center: [-0.3, 0.4, 0.6], spread: [1.3, 0.35, 1.0] },
      { mode: "smoke", origins: smoke, n: 9, colors: ["#b9b6c0", "#807e92"], height: 0.9 },
      shafts(rnd, [{ to: [-0.3, 0.25, -0.3], r: 0.12, len: 2.8 }, { to: [0.25, 0.25, -0.6], r: 0.09, len: 2.8 }, { to: [-0.6, 0.08, 0.35], r: 0.1, len: 2.6 }, { to: [0.55, 0.1, 0.5], r: 0.08, len: 2.6 }], { colors: ["#fff1c0", "#ffcf5a"], alpha: 0.32, n: 18 }),
    ] };
}
