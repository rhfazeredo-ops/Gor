// =====================================================================
// Mapas em texto. Cada caractere é um tile:
//   .  chão de pedra     ,  grama     :  terra     =  piso de madeira
//   #  parede de pedra   H  parede de madeira
//   P  pilar             T  tocha           B  barril      C  caixa
//   A  árvore            a  árvore 2        D  boneco de treino
//   E  estandarte        S  início do herói
//   g  gosma verde       r  gosma roxa (maior)
//   (espaço) vazio
// Objetos ficam em cima de grama (A, a) ou pedra (o resto).
// =====================================================================
export const MAPS = {
  treino: {
    nome: 'Ruínas do Campo de Treino',
    objetivo: { tipo: 'cacar', alvo: 12, texto: 'Derrote 12 gosmas' },
    tiles: [
      ' ,,,,,,,,,,,,,,,,,,,,,,,,,,,, ',
      ',,A,,,,a,,,,,A,,,,,,a,,,,A,,,,',
      ',a,,,,,,,,,,,,,,,,,,,,,,,,,,a,',
      ',,,,,g,,,,,,,,,,,,,,,,,,g,,,,,',
      ',,,,,,,,,########:#######,,,,,',
      ',A,,,,,,,#P.....T.:..T..P#,,a,',
      ',,,,,,,,,#.......:.......#,,,,',
      ',,,,,,,,,#..D....:...D...#,,,,',
      ',,a,,,,,,#.......:.......#,,,,',
      ',,,,,,,,,#E......:......E#,A,,',
      ',,,,,,,,,::::::::S::::::::,,,,',
      ',A,,,g,,,#E..............E#,,,',
      ',,,,,,,,,#.....B...C.....#,,,,',
      ',,,,,,,,,#..D.........D..#,,,,',
      ',,a,,,,,,#P.....T.T.....P#,,a,',
      ',,,,,,,,,####,,,,,,,,####,,,,,',
      ',,,,,,,,,,,,,,,,:,,,,,,,,,,,,,',
      ',A,,,,,,,,,,,,,,:,,,,,,,,,,,,,',
      ',,,,,,r,,,,,,,,,:,,,,,,,,r,,,,',
      ',,,,,,,,,,,,,,,,:,,,,,,,,,,,A,',
      ',,a,,,,,,,,,,,,,:,,,,,,,,,,,,,',
      ',,,,,,,,,,g,,,,,:,,,,,g,,,,,,,',
      ',A,,,,,,,,,,,,,,:,,,,,,,,,,,a,',
      ',,,,,a,,,,,,,,,,:,,,,,,,,,,,,,',
      ',,,,,,,,,,A,,,,,:,,,,,A,,,,,,,',
      ' ,,,,,,,,,,,,,,,,,,,,,,,,,,,, ',
    ],
  },
};

const SOLID = new Set(['#', 'H', 'P', 'B', 'C', 'A', 'a', 'D', 'T', 'E']);
const PROP = { P: 'pilar', T: 'tocha', B: 'barril', C: 'caixa', A: 'arvore', a: 'arvore2', D: 'boneco', E: 'estandarte' };

export function parseMap(def) {
  const rows = def.tiles;
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const floor = [], solid = [], walls = [], props = [], spawns = [];
  let start = { x: w / 2, y: h / 2 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i] || ' ';
    const k = j * w + i;
    solid[k] = ch === ' ' || SOLID.has(ch);
    floor[k] = ch === ' ' ? null : ch === ',' || ch === 'A' || ch === 'a' || ch === 'g' || ch === 'r' ? 'grama' : ch === ':' || ch === 'S' ? 'terra' : ch === '=' ? 'madeira' : 'pedra';
    if (ch === '#' || ch === 'H') walls.push({ i, j, wood: ch === 'H' });
    if (PROP[ch]) props.push({ i, j, kind: PROP[ch] });
    if (ch === 'S') start = { x: i + 0.5, y: j + 0.5 };
    if (ch === 'g' || ch === 'r') spawns.push({ x: i + 0.5, y: j + 0.5, kind: ch === 'g' ? 'verde' : 'roxa' });
  }
  return { ...def, w, h, floor, solid, walls, props, spawns, start };
}
