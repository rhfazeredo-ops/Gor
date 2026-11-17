// A lighthouse on a sea rock: turning beam, keeper's hut, pier and rowboat.

import { sphere, ellipsoid, cone, displace, box, cyl } from "../sdf.js";
import { vnoise3 } from "../../noise.js";
import { makeCtx, rgb, mul, mix, sstep, TAU } from "../island.js";
import { makeFree } from "../scene-kit.js";

export const label = "Lighthouse";

export function build(rnd) {
  const c = makeCtx(2.3, 0.3, () => 0.4, rnd), { s } = c, free = makeFree(c);
  const M = { rock: 0, sea: 1, tower: 2, glow: 3, dark: 4, roof: 5, wall: 6, wood: 7, stone: 8, rail: 9, buoy: 10 };
  const lights = [], L = [-0.26, -0.1], H = [0.44, 0.22];
  const rough = (x, y, z) => -0.11 * (vnoise3(x * 4, y * 4, z * 4) - 0.5) - 0.035 * vnoise3(x * 11, y * 11, z * 11);
  const main = displace(ellipsoid(0, -0.42, 0, 1.14, 0.66, 1.0), rough);
  s.add((x, y, z) => Math.max(main(x, y, z), y), M.rock);
  s.add(cyl(0, -0.74, 0, 2.3, 0.27, 0.05), M.sea);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, r = 1.2 + rnd() * 0.85, x = Math.cos(a) * r, z = Math.sin(a) * r, q = 0.07 + rnd() * 0.14;
    s.bound(x, -0.45, z, q * 2);
    s.add(displace(ellipsoid(x, -0.47 + q * 0.2, z, q * 1.2, q * (0.7 + rnd()), q), rough), M.rock, 0.03);
  }
  s.bound();

  // tower
  { const [x, z] = L, rAt = (y) => 0.27 - 0.065 * y;
    s.bound(x, 1.0, z, 1.35);
    s.add(cyl(x, 0.035, z, 0.33, 0.035, 0.01), M.stone);
    s.add(cone([x, 0.05, z], [x, 1.5, z], rAt(0.05), rAt(1.5)), M.tower);
    for (const [a, y] of [[0.6, 0.55], [2.3, 0.85], [4.2, 1.15]]) s.sub(sphere(x + Math.cos(a) * rAt(y), y, z + Math.sin(a) * rAt(y), 0.05), M.glow);
    const da = Math.atan2(H[1] - z, H[0] - x);
    s.sub(ellipsoid(x + Math.cos(da) * rAt(0.15), 0.16, z + Math.sin(da) * rAt(0.15), 0.07, 0.13, 0.07), M.dark);
    s.add(cyl(x, 1.52, z, 0.26, 0.022, 0.006), M.stone);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, b = ((k + 1) / 12) * TAU, p = [x + Math.cos(a) * 0.245, 1.62, z + Math.sin(a) * 0.245];
      s.add(cyl(p[0], 1.58, p[2], 0.008, 0.045, 0.002), M.rail).add(cone(p, [x + Math.cos(b) * 0.245, 1.62, z + Math.sin(b) * 0.245], 0.007, 0.007), M.rail);
    }
    s.add(cyl(x, 1.67, z, 0.13, 0.11, 0.006), M.glow);
    s.add(cone([x, 1.79, z], [x, 2.02, z], 0.19, 0.012), M.roof).add(sphere(x, 2.03, z, 0.03), M.roof);
    s.bound();
    lights.push({ pos: [x, 1.7, z], color: [1.0, 0.85, 0.45], power: 1.5 });
    free.glow(x, 1.67, z, 0.4, rgb("#ffd76a"));
    c.grow(2.15); }

  // keeper's hut with a stepped roof, lit window and chimney
  { const [x, z] = H;
    s.bound(x, 0.25, z, 0.55);
    s.add(box(x, 0.14, z, 0.2, 0.14, 0.16, 0.01), M.wall);
    for (let k = 0; k < 5; k++) s.add(box(x, 0.3 + k * 0.036, z, 0.25 - k * 0.05, 0.02, 0.2, 0.006), M.roof);
    s.sub(box(x, 0.16, z + 0.165, 0.05, 0.05, 0.03, 0.004), M.glow).sub(box(x - 0.2, 0.1, z, 0.03, 0.1, 0.045, 0.004), M.dark);
    s.add(box(x + 0.1, 0.44, z - 0.06, 0.035, 0.08, 0.035, 0.006), M.stone);
    s.bound();
    lights.push({ pos: [x, 0.18, z + 0.32], color: [1.0, 0.7, 0.3], power: 0.75 });
    free.glow(x, 0.16, z + 0.2, 0.2, rgb("#ffd76a")); }

  // pier with posts, and a rowboat tied alongside
  s.bound(1.45, -0.4, 0.38, 0.85);
  for (let k = 0; k < 10; k++) s.add(box(0.92 + k * 0.112, -0.34, 0.38, 0.05, 0.013, 0.14, 0.004), M.wood);
  for (const k of [0, 3, 6, 9]) for (const sd of [-1, 1]) s.add(cyl(0.92 + k * 0.112, -0.4, 0.38 + sd * 0.13, 0.02, 0.13, 0.004), M.dark);
  s.bound(1.62, -0.44, 0.7, 0.4);
  s.add(ellipsoid(1.62, -0.44, 0.7, 0.24, 0.075, 0.105), M.wood).sub(ellipsoid(1.62, -0.4, 0.7, 0.2, 0.065, 0.078), M.dark).add(box(1.62, -0.43, 0.7, 0.03, 0.01, 0.08, 0.003), M.wood);
  // cliff fence and a stepping-stone path
  const posts = [0.2, 0.8, 1.4, 2.0, 2.6].map((a) => [Math.cos(a + 2.2) * 0.78, Math.sin(a + 2.2) * 0.66]);
  posts.forEach((p, i) => {
    s.bound(p[0], 0.1, p[1], 0.5);
    s.add(cyl(p[0], 0.08, p[1], 0.014, 0.09, 0.003), M.wood);
    if (i) s.add(cone([p[0], 0.13, p[1]], [posts[i - 1][0], 0.13, posts[i - 1][1]], 0.008, 0.008), M.wood);
  });
  for (let k = 1; k <= 4; k++) { const t = k / 5, x = L[0] + 0.3 + (H[0] - 0.25 - L[0] - 0.3) * t, z = L[1] + (H[1] - L[1]) * t + 0.05 * Math.sin(k * 2); s.bound(x, 0, z, 0.1); s.add(cyl(x, 0.005, z, 0.045, 0.008, 0.004), M.stone); }
  s.bound();
  // rock-cut stairs down to the pier
  s.bound(0.85, -0.17, 0.38, 0.4);
  for (let k = 0; k < 5; k++) s.add(box(0.7 + k * 0.055, -0.03 - k * 0.066, 0.38, 0.045, 0.036, 0.12, 0.006), M.stone);
  // a warning buoy with a red lamp
  { const x = -1.5, z = 1.05;
    s.bound(x, -0.3, z, 0.4);
    s.add(cone([x, -0.52, z], [x, -0.32, z], 0.1, 0.055), M.roof).add(cyl(x, -0.2, z, 0.012, 0.12, 0.003), M.dark).add(sphere(x, -0.07, z, 0.035), M.buoy);
    s.bound();
    lights.push({ pos: [x, -0.02, z], color: [1.0, 0.3, 0.22], power: 0.7 });
    free.glow(x, -0.07, z, 0.2, rgb("#c23c36")); }
  // the wreck: a leaning mast, a yard with a scrap of sail, ribs in the water
  { const x = 1.45, z = -1.25;
    s.bound(x + 0.15, -0.1, z, 0.8);
    s.add(cone([x, -0.55, z], [x + 0.28, 0.42, z - 0.12], 0.035, 0.02), M.wood).add(cone([x - 0.05, 0.12, z - 0.02], [x + 0.42, 0.24, z - 0.12], 0.016, 0.012), M.wood);
    s.add(box(x + 0.2, 0.06, z - 0.07, 0.12, 0.11, 0.008, 0.005), M.wall);
    for (let k = 0; k < 4; k++) s.add(cone([x - 0.35 + k * 0.13, -0.52, z + 0.22], [x - 0.33 + k * 0.13, -0.3 + 0.03 * k, z + 0.1], 0.02, 0.008), M.wood);
    s.bound(); }
  c.height = () => 0;

  const onTop = (x, z) => Math.hypot(x / 0.8, z / 0.7) < 1;
  free.grass(3200, onTop, { h: [0.07, 0.18], colors: [[rgb("#3f8f4a"), rgb("#a6dc62")], [rgb("#232438"), rgb("#3f8f4a")]], r: 0.85 });
  free.dots(110, onTop, { colors: [rgb("#f3f1e6"), rgb("#ffd76a"), rgb("#c23c36")], r: 0.85, y: [0.1, 0.2] });

  const paint = (m, x, y, z, n) => {
    if (m === M.glow) return { c: y > 1.5 ? (Math.abs(Math.sin(Math.atan2(z - L[1], x - L[0]) * 4)) < 0.16 ? rgb("#ff9a3a") : rgb("#ffd76a")) : rgb("#ffd76a"), emissive: true };
    if (m === M.buoy) return { c: rgb("#ff9a3a"), emissive: true };
    if (m === M.tower) return { c: (Math.floor((y - 0.05) / 0.29) & 1) ? rgb("#c23c36") : rgb("#f3f1e6") };
    if (m === M.roof) return { c: rgb("#c23c36") };
    if (m === M.wall) return { c: mul(rgb("#f3f1e6"), Math.abs(Math.sin(y * 45)) < 0.12 ? 0.82 : 1) };
    if (m === M.dark) return { c: rgb("#232438") };
    if (m === M.rail) return { c: rgb("#232438") };
    if (m === M.wood) return { c: mul(rgb("#6b4732"), 0.85 + 0.3 * vnoise3(x * 30, y * 30, z * 6)) };
    if (m === M.stone) return { c: rgb("#8583a0") };
    if (m === M.sea) {
      if (n[1] < 0.6) return { c: mix(rgb("#173a66"), rgb("#0e1a36"), sstep(-0.5, -0.95, y)) };
      const r = Math.hypot(x, z), near = Math.min(...[[0, 0, 1.12]].map(([cx, cz, rr]) => Math.abs(r - rr)));
      const w = Math.sin(r * 17 - 5 * vnoise3(x * 2.2, 3, z * 2.2));
      if (near < 0.07 + 0.05 * vnoise3(x * 9, 1, z * 9)) return { c: rgb("#9fdcec") };
      return { c: w > 0.93 ? rgb("#9fdcec") : w > 0.2 ? rgb("#2a6a9a") : rgb("#173a66") };
    }
    if (n[1] > 0.7 && y > -0.04) return { c: vnoise3(x * 5, 2, z * 5) > 0.5 ? rgb("#3f8f4a") : mul(rgb("#3f8f4a"), 0.8) };
    const band = Math.floor(y * 10 + 2.5 * vnoise3(x * 3, 0, z * 3)) & 1;
    return { c: y < -0.4 ? rgb("#232438") : mul(band ? rgb("#4a4862") : rgb("#8583a0"), 0.85 + 0.3 * vnoise3(x * 10, y * 10, z * 10)) };
  };
  const ring = (n, r0, r1, y) => Array.from({ length: n }, () => { const a = rnd() * TAU, r = r0 + rnd() * (r1 - r0); return [Math.cos(a) * r, y, Math.sin(a) * r]; });
  return { c, paint, lights, free: free.list, noDepthShade: true, bottom: -1.1,
    palette: ["#070b1c", "#0e1a36", "#173a66", "#2a6a9a", "#9fdcec", "#232438", "#4a4862", "#8583a0", "#f3f1e6", "#c23c36", "#6e2230", "#3f8f4a", "#a6dc62", "#ffd76a", "#ff9a3a", "#6b4732"],
    background: "#070b1c", light: 1.0, elev: 0.3,
    particles: [
      { mode: "beam", colors: ["#ffd76a"], center: [L[0], 1.67, L[1]], splats: [[0.85, 0, 0, 0.7, 0.05, 0.05, 0.34], [-0.85, 0, 0, 0.7, 0.05, 0.05, 0.34], [1.25, 0, 0, 1.0, 0.11, 0.11, 0.16], [-1.25, 0, 0, 1.0, 0.11, 0.11, 0.16]] },
      { mode: "float", colors: ["#f3f1e6", "#9fdcec"], points: ring(60, 1.08, 1.22, -0.45) },
      { mode: "blink", colors: ["#9fdcec", "#f3f1e6"], points: ring(70, 1.3, 2.2, -0.455), still: true },
      { mode: "smoke", origins: [[H[0] + 0.1, 0.55, H[1] - 0.06]], n: 10, colors: ["#8583a0", "#4a4862"], height: 1.0 },
    ] };
}
