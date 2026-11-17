// The smallest complete scene: an island, a tree, a lantern, some grass.
// Copy this file to start your own (see docs/make-a-scene.md).

import { sphere, ellipsoid, cone, displace, box } from "../sdf.js";
import { vnoise3 } from "../../noise.js";
import { makeCtx, island, rocks, rgb, mul, mix, sstep } from "../island.js";
import { makeFree } from "../scene-kit.js";

export const label = "Hello island";

export function build(rnd) {
  // 1. A context: island radius 1.3, flat within 0.3 of the centre.
  //    The third argument keeps randomly placed props 0.7 away from the middle.
  const c = makeCtx(1.3, 0.3, () => 0.7, rnd), { s } = c, free = makeFree(c);

  // 2. Materials are just numbers; paint() below gives them colours.
  const M = { grass: 0, rock: 1, trunk: 2, leaves: 3, post: 4, lamp: 5 };
  island(c, M.grass, M.rock, { bump: 0.03 });

  // 3. Shapes. s.add(shape, material, blend) unions a signed-distance shape.
  //    A tree: a tapered trunk and three leafy blobs.
  s.add(cone([0, -0.05, 0], [0.05, 0.75, 0], 0.09, 0.05), M.trunk);
  for (const [x, y, z, r] of [[0.05, 1.0, 0, 0.38], [-0.22, 0.85, 0.12, 0.28], [0.28, 0.82, -0.1, 0.26]])
    s.add(displace(ellipsoid(x, y, z, r, r * 0.8, r), (px, py, pz) => -0.06 * (vnoise3(px * 9, py * 9, pz * 9) - 0.5)), M.leaves, 0.08);
  c.grow(1.45); // tell the context how tall the scene is

  //    A lantern on a post, with a point light and a soft halo.
  s.add(cone([0.6, -0.03, 0.35], [0.6, 0.5, 0.35], 0.022, 0.016), M.post);
  s.add(box(0.6, 0.56, 0.35, 0.05, 0.06, 0.05, 0.01), M.lamp);
  const lights = [{ pos: [0.6, 0.56, 0.35], color: [1.0, 0.72, 0.32], power: 1.0 }];
  free.glow(0.6, 0.56, 0.35, 0.28, rgb("#ffcf5a"));

  rocks(c, M.rock, 5, 0.1);

  // 4. Free splats: 1500 grass blades (dark base, light tip) and a few flowers.
  free.grass(1500, () => true, { colors: [[rgb("#1f4a38"), rgb("#4f9a4a")], [rgb("#4f9a4a"), rgb("#a8d860")]], r: 1.25 });
  free.dots(40, () => true, { colors: [rgb("#fff1c0"), rgb("#c8372d")], r: 1.2, y: [0.12, 0.22] });

  // 5. Colours. Called once per surfel with its material, position and normal.
  //    Use colours from the palette below; lighting and palette snapping do the rest.
  const paint = (m, x, y, z, n) => {
    if (m === M.lamp) return { c: rgb("#ffcf5a"), emissive: true };
    if (m === M.post) return { c: rgb("#2b2740") };
    if (m === M.trunk) return { c: mul(rgb("#4a2a26"), 0.85 + 0.3 * vnoise3(x * 30, y * 5, z * 30)) };
    if (m === M.leaves) return { c: vnoise3(x * 12, y * 12, z * 12) > 0.55 ? rgb("#a8d860") : rgb("#4f9a4a"), leaf: true };
    if (m === M.rock) return { c: mul(rgb("#807e92"), 0.8 + 0.4 * vnoise3(x * 8, y * 10, z * 8)) };
    return { c: n[1] < 0.5 ? rgb("#4a2a26") : mix(rgb("#1f4a38"), rgb("#4f9a4a"), sstep(0.3, 0.7, vnoise3(x * 4, 2, z * 4))) };
  };

  return {
    c, paint, lights, free: free.list,
    // the whole picture is drawn with these colours
    palette: ["#0a0a18", "#17152c", "#2b2740", "#4c4a60", "#807e92", "#4a2a26", "#1f4a38", "#4f9a4a", "#a8d860", "#c8372d", "#ffcf5a", "#fff1c0"],
    glowPalette: ["#4e3f3a", "#8a7356"], // muted warm light, only for beams and glows
    background: "#0a0a18",
    particles: [{ mode: "blink", n: 18, halo: true, colors: ["#ffcf5a", "#fff1c0"], center: [0, 0.3, 0], spread: [1.1, 0.5, 1.1] }],
  };
}
