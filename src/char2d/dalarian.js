import { box, prism, gem, spike, place } from './lowpoly.js';

// =====================================================================
// Dalárian em low-poly desenhado por código (Canvas 2D), seguindo o
// concept (ficha + T-pose). Cada peça é presa a um osso do esqueleto.
// Paleta da ficha: azul #2d397e, ouro #f29c27, aço #bc9da8, couro #82492f,
// pele #da9162 / #ed996f.
// =====================================================================
const C = {
  blue: 0x2d397e, blueD: 0x232c66, gold: 0xf29c27, goldD: 0xc9771b, steel: 0xbc9da8, steelD: 0x8f7a8a,
  under: 0x6a5a6e, leather: 0x82492f, leatherD: 0x5e3420, skin: 0xe39a6a, hair: 0xf2b53a, hairD: 0xd9952a,
  beard: 0x9a5a2a, eye: 0x2a1c22, gemB: 0x3f86ff, wood: 0x6b3a26,
};
const metal = { tag: 'metal' };

export function dalarianParts(bones) {
  const P = (bone, ...solids) => ({ bone: bones[bone], solids });
  const parts = [];

  // ---------------- quadril ----------------
  parts.push(P('hips',
    place(box(0.5, 0.26, 0.34, { top: 1.05 }), C.under, { p: [0, -0.04, 0] }),
    // tassets (placas laterais) — duas camadas de cada lado
    ...[-1, 1].flatMap((s) => [
      place(box(0.22, 0.24, 0.06, { top: 0.9 }), C.steel, { p: [s * 0.27, -0.12, 0.04], r: [0.08, s * 0.5, s * 0.22], ...metal }),
      place(box(0.23, 0.04, 0.07), C.gold, { p: [s * 0.29, -0.24, 0.05], r: [0.08, s * 0.5, s * 0.22], ...metal }),
    ]),
    place(box(0.42, 0.26, 0.06, { top: 1.1 }), C.steel, { p: [0, -0.15, -0.19], r: [-0.12, 0, 0], ...metal }),
    // tabardo azul comprido com borda e cruz dourada, ponta embaixo
    place(box(0.27, 0.72, 0.03), C.blue, { p: [0, -0.43, 0.2], r: [0.05, 0, 0] }),
    place(box(0.035, 0.72, 0.035), C.gold, { p: [-0.145, -0.43, 0.205], r: [0.05, 0, 0] }),
    place(box(0.035, 0.72, 0.035), C.gold, { p: [0.145, -0.43, 0.205], r: [0.05, 0, 0] }),
    place(gem(0.15, 0.13, 0.02), C.blue, { p: [0, -0.8, 0.22], r: [0.05, 0, 0] }),
    place(gem(0.04, 0.07, 0.025), C.gold, { p: [0, -0.92, 0.225], ...metal }),
    place(box(0.035, 0.28, 0.02), C.gold, { p: [0, -0.5, 0.225], r: [0.05, 0, 0] }),
    place(box(0.16, 0.035, 0.02), C.gold, { p: [0, -0.44, 0.225], r: [0.05, 0, 0] }),
  ));

  // ---------------- barriga + cinto ----------------
  parts.push(P('spine',
    place(box(0.46, 0.32, 0.32, { top: 1.1 }), C.under, { p: [0, 0.12, 0] }),
    place(prism(8, 0.29, 0.29, 0.12, { rz: 0.66 }), C.leather, { p: [0, -0.02, 0] }),
    place(gem(0.085, 0.085, 0.03), C.gold, { p: [0, -0.02, 0.2], ...metal }),
    place(gem(0.035, 0.035, 0.02), C.gemB, { p: [0, -0.02, 0.225], tag: 'glow' }),
  ));

  // ---------------- peito ----------------
  parts.push(P('chest',
    place(box(0.56, 0.52, 0.38, { top: 1.38, topD: 1.15 }), C.steel, { p: [0, 0.1, 0], ...metal }),
    // tabardo do peito (azul) com moldura dourada e o leão
    place(box(0.36, 0.4, 0.03, { top: 1.15 }), C.blue, { p: [0, 0.12, 0.215], r: [-0.12, 0, 0] }),
    place(box(0.04, 0.42, 0.04), C.gold, { p: [-0.2, 0.12, 0.215], r: [-0.12, 0, 0.1], ...metal }),
    place(box(0.04, 0.42, 0.04), C.gold, { p: [0.2, 0.12, 0.215], r: [-0.12, 0, -0.1], ...metal }),
    place(box(0.46, 0.045, 0.045), C.gold, { p: [0, 0.33, 0.19], r: [-0.12, 0, 0], ...metal }),
    place(prism(8, 0.1, 0.1, 0.03), C.gold, { p: [0, 0.14, 0.245], r: [Math.PI / 2 - 0.12, 0, 0], ...metal }),
    place(gem(0.045, 0.05, 0.03), C.goldD, { p: [0, 0.13, 0.26], ...metal }),
    // gemas azuis nos cantos de cima
    place(gem(0.045, 0.045, 0.025), C.gemB, { p: [-0.27, 0.3, 0.17], tag: 'glow' }),
    place(gem(0.045, 0.045, 0.025), C.gemB, { p: [0.27, 0.3, 0.17], tag: 'glow' }),
    // gola
    place(prism(8, 0.19, 0.16, 0.1), C.steelD, { p: [0, 0.38, 0], ...metal }),
    place(prism(8, 0.2, 0.2, 0.035), C.gold, { p: [0, 0.34, 0], ...metal }),
  ));

  // ---------------- cabeça ----------------
  parts.push(P('neck', place(prism(6, 0.09, 0.1, 0.18), C.skin)));
  parts.push(P('head',
    // crânio octogonal afunilado + mandíbula quadrada (low-poly do concept)
    place(prism(8, 0.13, 0.15, 0.2, { rz: 1.0 }), C.skin, { p: [0, 0.2, 0.01] }),
    place(prism(8, 0.15, 0.12, 0.12), C.skin, { p: [0, 0.32, 0.0] }),
    place(box(0.22, 0.14, 0.2, { top: 1.25 }), C.skin, { p: [0, 0.04, 0.03] }),
    place(gem(0.03, 0.05, 0.045), C.skin, { p: [0, 0.15, 0.16] }),
    place(box(0.055, 0.022, 0.02), C.eye, { p: [-0.06, 0.2, 0.14] }),
    place(box(0.055, 0.022, 0.02), C.eye, { p: [0.06, 0.2, 0.14] }),
    place(box(0.07, 0.025, 0.02), C.hairD, { p: [-0.06, 0.235, 0.14], r: [0, 0, -0.2] }),
    place(box(0.07, 0.025, 0.02), C.hairD, { p: [0.06, 0.235, 0.14], r: [0, 0, 0.2] }),
    place(gem(0.04, 0.05, 0.035), C.beard, { p: [0, -0.02, 0.13] }),
    // cabelo: topo, franja jogada e mechas longas facetadas
    place(prism(8, 0.17, 0.12, 0.12), C.hair, { p: [0, 0.37, -0.01] }),
    place(gem(0.17, 0.05, 0.1), C.hair, { p: [0.04, 0.35, 0.11], r: [0.3, 0, -0.3] }),
    place(gem(0.07, 0.24, 0.1), C.hair, { p: [-0.17, 0.15, -0.02], r: [0, 0, 0.12] }),
    place(gem(0.07, 0.24, 0.1), C.hair, { p: [0.17, 0.15, -0.02], r: [0, 0, -0.12] }),
    place(box(0.36, 0.42, 0.14, { top: 1.12 }), C.hairD, { p: [0, 0.14, -0.13], r: [0.08, 0, 0] }),
    place(gem(0.2, 0.26, 0.08), C.hair, { p: [0, -0.12, -0.16], r: [0.15, 0, 0] }),
    place(gem(0.09, 0.22, 0.07), C.hairD, { p: [-0.13, -0.08, -0.12], r: [0.1, 0, 0.2] }),
    place(gem(0.09, 0.22, 0.07), C.hairD, { p: [0.13, -0.08, -0.12], r: [0.1, 0, -0.2] }),
  ));

  // ---------------- braços ----------------
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    parts.push(P('upperArm' + side,
      // ombreira grande, em camadas, com borda dourada e gema
      place(box(0.44, 0.22, 0.42, { top: 0.55 }), C.steel, { p: [s * 0.04, 0.06, 0], r: [0, 0, -s * 0.32], ...metal }),
      place(box(0.48, 0.06, 0.46), C.gold, { p: [s * 0.05, -0.05, 0], r: [0, 0, -s * 0.32], ...metal }),
      place(box(0.38, 0.09, 0.4, { top: 0.95 }), C.steel, { p: [s * 0.07, -0.12, 0], r: [0, 0, -s * 0.3], ...metal }),
      place(box(0.4, 0.04, 0.41), C.gold, { p: [s * 0.08, -0.17, 0], r: [0, 0, -s * 0.3], ...metal }),
      place(gem(0.05, 0.06, 0.03), C.gemB, { p: [s * 0.02, 0.0, 0.2], tag: 'glow' }),
      place(prism(6, 0.12, 0.13, 0.3), C.under, { p: [0, -0.2, 0] }),
      place(prism(6, 0.14, 0.13, 0.12), C.steel, { p: [0, -0.28, 0], ...metal }),
    ));
    parts.push(P('foreArm' + side,
      place(prism(6, 0.14, 0.12, 0.28), C.steel, { p: [0, -0.16, 0], ...metal }),
      place(prism(6, 0.13, 0.13, 0.05), C.gold, { p: [0, -0.04, 0], ...metal }),
      place(prism(6, 0.15, 0.15, 0.05), C.gold, { p: [0, -0.28, 0], ...metal }),
      place(gem(0.06, 0.07, 0.05), C.steel, { p: [0, 0, -0.08], ...metal }),          // cotovelo
    ));
    parts.push(P('hand' + side, place(box(0.13, 0.14, 0.14, { top: 1.1 }), C.leatherD, { p: [0, -0.05, 0] })));
  }

  // ---------------- pernas ----------------
  for (const side of ['L', 'R']) {
    parts.push(P('thigh' + side,
      place(prism(6, 0.14, 0.18, 0.44), C.under, { p: [0, -0.21, 0] }),
      place(box(0.26, 0.28, 0.12, { top: 1.08 }), C.steel, { p: [0, -0.24, 0.07], ...metal }),
    ));
    parts.push(P('shin' + side,
      place(gem(0.1, 0.12, 0.07), C.gold, { p: [0, 0.0, 0.1], ...metal }),             // joelheira
      place(prism(6, 0.12, 0.14, 0.38), C.steel, { p: [0, -0.21, 0.01], ...metal }),
      place(prism(6, 0.15, 0.15, 0.05), C.gold, { p: [0, -0.06, 0.01], ...metal }),
      place(prism(6, 0.13, 0.13, 0.05), C.gold, { p: [0, -0.38, 0.01], ...metal }),
    ));
    parts.push(P('foot' + side,
      place(box(0.2, 0.13, 0.34, { top: 0.9 }), C.steel, { p: [0, -0.03, 0.06], ...metal }),
      place(box(0.21, 0.05, 0.12), C.gold, { p: [0, 0.03, 0.12], ...metal }),
      place(box(0.21, 0.04, 0.35), C.leatherD, { p: [0, -0.09, 0.06] }),
    ));
  }

  // ---------------- capa (3 segmentos) ----------------
  parts.push(P('cape1', place(box(0.9, 0.52, 0.03, { top: 0.9 }), C.blue, { p: [0, -0.25, 0] })));
  parts.push(P('cape2',
    place(box(1.0, 0.52, 0.03, { top: 0.9 }), C.blue, { p: [0, -0.25, 0] }),
    place(box(0.06, 0.42, 0.02), C.gold, { p: [0, -0.22, -0.02] }),
    place(box(0.3, 0.06, 0.02), C.gold, { p: [0, -0.12, -0.02] }),
  ));
  parts.push(P('cape3',
    place(box(1.22, 0.44, 0.03, { top: 0.86 }), C.blue, { p: [0, -0.22, 0] }),
    place(box(1.24, 0.09, 0.04), C.gold, { p: [0, -0.44, 0] }),
    ...[-0.4, -0.13, 0.13, 0.4].map((x) => place(gem(0.06, 0.1, 0.02), C.gold, { p: [x, -0.34, 0] })),
  ));

  // ---------------- martelo (na mão direita; cabo ao longo do Z da mão) ----------------
  parts.push(P('handR',
    place(prism(6, 0.032, 0.032, 1.05), C.wood, { p: [0, -0.05, 0.36], r: [Math.PI / 2, 0, 0] }),
    ...[0.55, 0.72, 0.86].map((z) => place(prism(6, 0.05, 0.05, 0.05), C.gold, { p: [0, -0.05, z], r: [Math.PI / 2, 0, 0], ...metal })),
    place(spike(6, 0.06, 0.18), C.gold, { p: [0, -0.05, -0.24], r: [-Math.PI / 2, 0, 0], ...metal }),
    // cabeça: bloco chanfrado de aço com faixas e estrela douradas
    place(box(0.5, 0.29, 0.29), C.steel, { p: [0, -0.05, 1.02], ...metal }),
    place(box(0.53, 0.24, 0.24), C.steelD, { p: [0, -0.05, 1.02], ...metal }),
    ...[-1, 1].map((s) => place(box(0.06, 0.32, 0.32), C.gold, { p: [s * 0.18, -0.05, 1.02], ...metal })),
    ...[-1, 1].map((s) => place(gem(0.13, 0.13, 0.03), C.gold, { p: [0, -0.05 + s * 0.155, 1.02], r: [Math.PI / 2, 0, 0], ...metal })),
    place(spike(6, 0.05, 0.15), C.gold, { p: [0, -0.05, 1.17], r: [Math.PI / 2, 0, 0], ...metal }),
  ));
  return parts;
}
