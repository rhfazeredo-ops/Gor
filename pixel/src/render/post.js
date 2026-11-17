// The pixel pass: turns a small render of hard-edged splats into pixel art.
//
//   1. Supersample (ss = 2): the splats are drawn at twice the art resolution,
//      so every art pixel has four samples.
//   2. Coverage: a sample is solid when an opaque splat covers it. An art pixel
//      with at least half of its samples solid belongs to the object; the rest
//      are background, plus whatever translucent light lies over it.
//   3. Palette by vote: each solid sample snaps to its nearest palette colour
//      and the art pixel takes the colour most of them chose. A pixel never gets
//      a colour that is the average of two materials.
//   4. Outline: a solid pixel next to the background takes a darker "ink" of
//      its own colour, kept bright enough to stay visible on a dark background.
//   5. Translucent light (beams, halos, smoke) is blended over the background
//      and the result snapped to the palette, so a light beam becomes a flat
//      band of a muted colour rather than a scatter of dots.
//
// With dither above 0, colours are instead averaged and dithered between the
// two nearest palette colours with an ordered (Bayer) pattern. crisp off draws
// classic soft Gaussians, blended.

import * as THREE from "three";
import { hexToRgb } from "../noise.js";

const MAX_COLOURS = 64;

export function createPost() {
  const uniforms = {
    source: { value: null },
    lowRes: { value: new THREE.Vector2(1, 1) }, // art pixels
    ss: { value: 1 }, // source texels per art pixel, per side (1 or 2)
    outline: { value: 0 },
    pixelSize: { value: 1 }, // device pixels per art pixel
    palette: { value: Array.from({ length: MAX_COLOURS }, () => new THREE.Vector3()) },
    paletteSize: { value: 0 },
    surfaceSize: { value: 0 }, // entries before this may colour surfaces; the rest only translucent light
    background: { value: new THREE.Vector3() },
    quantise: { value: 1 },
    dither: { value: 0 },
    crisp: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D source;
      uniform vec2 lowRes;
      uniform float pixelSize, quantise, dither, crisp, ss, outline;
      uniform vec3 palette[${MAX_COLOURS}];
      uniform int paletteSize, surfaceSize;
      uniform vec3 background;

      // 4×4 ordered dither threshold in (0, 1)
      float bayer(vec2 p) {
        int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
        float m[16];
        m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
        m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        float v = 0.0;
        for (int k = 0; k < 16; k++) if (k == i) v = m[k];
        return (v + 0.5) / 16.0;
      }

      // one source texel, premultiplied, back in display space.
      // Spark linearises splat colours when it draws into a render target;
      // undo that so palette colours arrive exactly as authored.
      vec4 texel(vec2 t) {
        vec4 s = texture2D(source, (t + 0.5) / (lowRes * ss));
        if (s.a > 0.0) s.rgb = pow(max(s.rgb / s.a, 0.0), vec3(1.0 / 2.2)) * s.a;
        return s;
      }
      const float SOLID_ALPHA = 0.95;

      // share of an art pixel's samples covered by something opaque
      float coverage(vec2 cell) {
        if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= lowRes.x || cell.y >= lowRes.y) return 1.0; // the screen edge is not an outline
        if (ss < 1.5) return step(SOLID_ALPHA, texel(cell).a);
        vec2 t = cell * 2.0;
        return 0.25 * (step(SOLID_ALPHA, texel(t).a) + step(SOLID_ALPHA, texel(t + vec2(1.0, 0.0)).a)
                     + step(SOLID_ALPHA, texel(t + vec2(0.0, 1.0)).a) + step(SOLID_ALPHA, texel(t + vec2(1.0, 1.0)).a));
      }

      // nearest palette entry; solid pixels never take the background colour
      int nearest(vec3 c, bool solid) {
        int best = 0; float bd = 1e9;
        for (int i = 0; i < ${MAX_COLOURS}; i++) {
          if (i >= surfaceSize) break;
          if (solid && paletteSize > 1 && distance(palette[i], background) < 0.004) continue;
          vec3 e = c - palette[i];
          vec3 w = e * vec3(0.30, 0.59, 0.11); // weigh by how bright each channel looks
          float d = dot(w, w) + 0.25 * dot(e, e);
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      }
      // translucent light over the background: the palette colour nearest the
      // blend in OKLab, kept in the light's own hue (a faint gold beam becomes
      // a muted gold, not a green or grey-purple that happens to be close)
      vec3 oklab(vec3 c) {
        c = pow(max(c, 0.0), vec3(2.2));
        vec3 lms = pow(vec3(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
                            0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
                            0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b) + 1e-9, vec3(1.0 / 3.0));
        return vec3(0.2104542553 * lms.x + 0.793617785 * lms.y - 0.0040720468 * lms.z,
                    1.9779984951 * lms.x - 2.428592205 * lms.y + 0.4505937099 * lms.z,
                    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.808675766 * lms.z);
      }
      vec2 hueDir(vec3 lab) { return lab.yz / (length(lab.yz) + 0.035); }
      vec3 haze(vec3 light, float a) {
        if (a < 0.3) return background;
        vec3 t = oklab(mix(background, light, min(1.0, a * 1.6)));
        vec2 h = hueDir(oklab(light));
        vec3 best = background; float bd = 1e9;
        for (int i = 0; i < ${MAX_COLOURS}; i++) {
          if (i >= paletteSize) break;
          vec3 p = oklab(palette[i]), e = t - p;
          vec2 dh = hueDir(p) - h;
          bool bg = distance(palette[i], background) < 0.004;
          float d = 1.4 * e.x * e.x + dot(e.yz, e.yz) + (bg ? 0.0 : 0.12 * dot(dh, dh));
          if (d < bd) { bd = d; best = palette[i]; }
        }
        return best;
      }
      vec3 snapDither(vec3 col, vec2 cell, bool solid) {
        vec3 c1 = col, c2 = col; float d1 = 1e9, d2 = 1e9;
        for (int i = 0; i < ${MAX_COLOURS}; i++) {
          if (i >= surfaceSize) break;
          if (solid && paletteSize > 1 && distance(palette[i], background) < 0.004) continue;
          vec3 e = col - palette[i];
          vec3 w = e * vec3(0.30, 0.59, 0.11);
          float d = dot(w, w) + 0.25 * dot(e, e);
          if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = palette[i]; }
          else if (d < d2) { d2 = d; c2 = palette[i]; }
        }
        vec3 axis = c2 - c1;
        float t = clamp(dot(col - c1, axis) / max(dot(axis, axis), 1e-5), 0.0, 0.5);
        return bayer(cell) < t * dither ? c2 : c1;
      }
      // a darker shade of a colour, never so dark that it vanishes into the background
      vec3 ink(vec3 body) {
        vec3 tone = body * 0.64;
        tone = min(vec3(1.0), tone * max(1.0, 0.12 / max(dot(tone, vec3(0.30, 0.55, 0.15)), 0.001)));
        return mix(body, tone, 0.65);
      }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy / pixelSize); // which art pixel
        int N = ss < 1.5 ? 1 : 4;
        vec4 smp[4];
        vec4 sum = vec4(0.0), solidSum = vec4(0.0);
        for (int i = 0; i < 4; i++) {
          if (i >= N) break;
          smp[i] = texel(N == 1 ? cell : cell * 2.0 + vec2(float(i - (i / 2) * 2), float(i / 2)));
          sum += smp[i];
          if (smp[i].a > SOLID_ALPHA) solidSum += vec4(smp[i].rgb / smp[i].a, 1.0);
        }
        sum /= float(N);
        float cov = solidSum.a / float(N);
        vec3 col;

        if (crisp < 0.5) {
          // soft Gaussians: plain blending over the background
          col = sum.rgb + background * (1.0 - clamp(sum.a, 0.0, 1.0));
          if (quantise > 0.5) col = dither > 0.0 ? snapDither(col, cell, false) : palette[nearest(col, false)];
        } else if (cov >= 0.5) {
          // the object. Its colour: the palette colour most samples snap to
          col = solidSum.rgb / solidSum.a;
          bool edge = false;
          if (outline > 0.5) {
            int n = int(coverage(cell + vec2(1.0, 0.0)) >= 0.5) + int(coverage(cell - vec2(1.0, 0.0)) >= 0.5)
                  + int(coverage(cell + vec2(0.0, 1.0)) >= 0.5) + int(coverage(cell - vec2(0.0, 1.0)) >= 0.5);
            edge = n > 0 && n < 4; // isolated dots (embers, fireflies) keep their colour
          }
          if (quantise > 0.5 && dither <= 0.0) {
            int lab[4];
            for (int i = 0; i < 4; i++) { lab[i] = -1; if (i < N && smp[i].a > SOLID_ALPHA) lab[i] = nearest(smp[i].rgb / smp[i].a, true); }
            int best = -1, score = 0;
            for (int i = 0; i < 4; i++) {
              if (lab[i] < 0) continue;
              int n = 0;
              for (int j = 0; j < 4; j++) if (lab[j] == lab[i]) n++;
              if (n > score) { score = n; best = lab[i]; }
            }
            col = palette[best];
            if (edge) col = palette[nearest(ink(col), true)];
          } else {
            if (edge) col = ink(col);
            if (quantise > 0.5) col = edge ? palette[nearest(col, true)] : snapDither(col, cell, true);
          }
        } else {
          // background, with whatever translucent light lies over it
          float a = clamp(sum.a, 0.0, 1.0);
          col = background * (1.0 - a) + sum.rgb;
          if (quantise > 0.5) col = dither > 0.0 ? snapDither(col, cell, false) : haze(sum.rgb / max(a, 1e-4), a);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();

  return {
    // hex colours; the background colour should be one of them.
    // glow: extra colours only translucent light may take (beams, halos)
    setPalette(colours, glow = []) {
      const surface = [...new Set(colours)].slice(0, MAX_COLOURS);
      const list = [...surface, ...glow.filter((c) => !surface.includes(c))].slice(0, MAX_COLOURS);
      list.forEach((hex, i) => uniforms.palette.value[i].set(...hexToRgb(hex)));
      uniforms.paletteSize.value = list.length;
      uniforms.surfaceSize.value = surface.length;
    },
    setBackground(hex) { uniforms.background.value.set(...hexToRgb(hex)); },
    // width, height: art pixels; the source texture is ss times larger
    setSizes(width, height, pixelSize, ss = 1) {
      uniforms.lowRes.value.set(width, height);
      uniforms.pixelSize.value = pixelSize;
      uniforms.ss.value = ss;
    },
    setOutline(on) { uniforms.outline.value = on ? 1 : 0; },
    setCrisp(on) { uniforms.crisp.value = on ? 1 : 0; },
    render(renderer, texture, quantise, dither) {
      uniforms.source.value = texture;
      uniforms.quantise.value = quantise ? 1 : 0;
      uniforms.dither.value = dither;
      renderer.render(scene, camera);
    },
  };
}
