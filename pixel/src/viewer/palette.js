// A palette for a model that did not come with one: k-means over the model's
// surface colours at the brightness levels the lighting will produce.

import { AMBIENT_LOW, AMBIENT_HIGH, DIFFUSE } from "../render/shade.js";

// rgba: Uint8Array of surface colours, 4 bytes each
// lit:  colour of a point light in the scene, so lit tones get palette entries too
export function extractPalette(rgba, count, k, exposure = 1, lit = null) {
  const samples = [];
  const step = Math.max(1, Math.floor(count / 9000));
  for (let i = 0; i < count; i += step) {
    const c = [rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255];
    for (const level of [AMBIENT_LOW, 0.55, 0.85, AMBIENT_HIGH + DIFFUSE]) samples.push(c.map((v) => Math.min(1, v * level * exposure)));
    if (lit && i % (step * 3) === 0) samples.push(c.map((v, ch) => Math.min(1, v * 0.7 * exposure + (v * 0.85 + 0.1) * lit[ch] * 0.45)));
  }
  if (!samples.length) return [];
  samples.sort((a, b) => a[0] + a[1] * 2 + a[2] - (b[0] + b[1] * 2 + b[2]));
  let centres = Array.from({ length: k }, (_, i) => [...samples[Math.floor(((i + 0.5) / k) * samples.length)]]);
  for (let pass = 0; pass < 10; pass++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (const s of samples) {
      let best = 0, bestD = 1e9;
      for (let c = 0; c < k; c++) {
        const d = (s[0] - centres[c][0]) ** 2 + (s[1] - centres[c][1]) ** 2 + (s[2] - centres[c][2]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      sum[best][0] += s[0]; sum[best][1] += s[1]; sum[best][2] += s[2]; sum[best][3]++;
    }
    centres = centres.map((c, i) => (sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]] : c));
  }
  return centres.map((c) => "#" + c.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join(""));
}
