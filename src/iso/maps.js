// =====================================================================
// Mapas em texto. Cada caractere é um tile:
//   .  chão de pedra     ,  grama     :  terra     =  piso de madeira
//   #  parede de pedra   H  parede de madeira
//   P  pilar             T  tocha           B  barril      C  caixa
//   A  árvore            a  árvore 2        D  boneco de treino
//   E  estandarte        S  início do herói
//   O  pedra grande      o  pedra      m  moita
//   g  gosma verde       r  gosma roxa (maior)
//   (espaço) vazio
// Objetos ficam em cima de grama (A, a) ou pedra (o resto).
// =====================================================================
export const MAPS = {
  treino: {
    nome: 'Ruínas do Campo de Treino',
    objetivo: { tipo: 'cacar', alvo: 12, texto: 'Derrote 12 gosmas' },
    tiles: [
      '  ,,a,,A,,,a,,,A,,a,,,,A,,a,,,A,,a,,  ',
      ' ,A,,,,m,,,,,,,,,,,,,,,,,,,m,,,,,,,a, ',
      ',a,,,,,,,,,o,,,,,,,,,,,,,,,,,,o,,,,,A,',
      ',,,m,,g,,,,,,,,,,,,,,,,,,,,,,g,,,,m,,,',
      ',A,,,,,,,,,,,,,########:#######,,,,,,a,',
      ',,,,,,,,,,,,,,#P.....T.:..T..P#,,O,,,,,',
      ',a,,O,,,,,,,,,#.......:.......#,,,,,,A,',
      ',,,,,,,,,m,,,,#..D....:...D...#,,,,,,,,',
      ',,,,,,,,,,,,,,#.......:.......#,,,m,,,a,',
      ',A,,,,,,,,,,,,#E......:......E#,,,,,,,,',
      ',,,,,,,,,,,,,,::::::::S::::::::,,,,,,,,',
      ',,,m,,g,,,,,,,#E..............E#,,g,,A,',
      ',a,,,,,,,,,,,,#.....B...C.....#,,,,,,,,',
      ',,,,,,,,,,,,,,#..D.........D..#,,,,m,,,',
      ',,,,,,o,,,,,,,#P.....T.T.....P#,,,,,,a,',
      ',A,,,,,,,,,,,,####,,,:,,,####,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,,,,,:,,,,,,,,,,,o,,,,,',
      ',,,a,,,,,m,,,,,,,,,,,:,,,,,,,,,,,,,,A,,',
      ',,,,,,,,,,,r,,,,,,,,,::,,,,,,,r,,,,,,,,',
      ',A,,,O,,,,,,,,,,,,,,,,:,,,,,,,,,,,m,,,,',
      ',,,,,,,,,,,,,,,,m,,,,,::,,,,,,,,,,,,,a,',
      ',,,,,,,,g,,,,,,,,,,,,,,:,,,,,,,g,,,,,,,',
      ',a,,,,,,,,,,,,,,,,,,,,,::,,,,,,,,,,,,,,',
      ',,,,,m,,,,,,,o,,,,,,,,,,:,,,,,,,,O,,,A,',
      ',,A,,,,,,,,,,,,,,,,g,,,,::,,,,,,,,,,,,,',
      ',,,,,,,,,,,,,,,,,,,,,,,,,:,,,,,,m,,,,,,',
      ',a,,,,,A,,,,,a,,,,,,A,,,,::,,,,A,,,,,a,',
      '  ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,  ',
    ],
  },
};

const SOLID = new Set(['#', 'H', 'P', 'B', 'C', 'A', 'a', 'D', 'T', 'E', 'O', 'o']);
const PROP = { P: 'pilar', T: 'tocha', B: 'barril', C: 'caixa', A: 'arvore', a: 'arvore2', D: 'boneco', E: 'estandarte', O: 'pedra2', o: 'pedra', m: 'moita' };

export function parseMap(def) {
  const rows = def.tiles;
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const floor = [], solid = [], walls = [], props = [], spawns = [];
  let start = { x: w / 2, y: h / 2 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i] || ' ';
    const k = j * w + i;
    solid[k] = ch === ' ' || SOLID.has(ch);
    floor[k] = ch === ' ' ? null : ',Aagr Oom'.includes(ch) && ch !== ' ' ? 'grama' : ch === ':' || ch === 'S' ? 'terra' : ch === '=' ? 'madeira' : 'pedra';
    if (ch === '#' || ch === 'H') walls.push({ i, j, wood: ch === 'H' });
    if (PROP[ch]) props.push({ i, j, kind: PROP[ch] });
    if (ch === 'S') start = { x: i + 0.5, y: j + 0.5 };
    if (ch === 'g' || ch === 'r') spawns.push({ x: i + 0.5, y: j + 0.5, kind: ch === 'g' ? 'verde' : 'roxa' });
  }
  return { ...def, w, h, floor, solid, walls, props, spawns, start };
}
