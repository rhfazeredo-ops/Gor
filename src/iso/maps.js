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
// Salas-arena (estilo Hades): ilhas de pedra sobre o abismo, paredes no fundo,
// porta de saída (X) que abre quando a sala é limpa, ondas de inimigos.
//   ;  laje entalhada   X  porta   F  braseiro   R  entulho
import { buildBigDesert } from './bigdesert.js';
export const ROOMS = [
  { build: () => buildBigDesert('canion') },   // 0: Cânion (missão das plantas)
  { build: () => buildBigDesert('ninho') },    // 1: Ninho (missão dos escorpiões)
];
export const OLD_ROOMS = [
  {
    nome: 'Salão da Vigília', tema: 'castelo', ondas: [['g', 'g', 'g'], ['g', 'g', 'r', 'g']], recompensa: 'cura',
    tiles: [
      '##E####X####E##',
      '#L;;;;;;;;;;;F#',
      '#;;;;;;;;;;;;;;',
      '#;;P;;;;;;;P;;;',
      '#;;;;;;;;;;;;;;',
      '#;;;;;;;;;;;;;;',
      '#;;;;;;S;;;;;; ',
      '#;;;;;;;;;;;;; ',
      '#;;P;;;;;;;P;; ',
      '#;;;;;;;;;;;;  ',
      '#F;;;;;;;;;;;  ',
      ' ;;;;;;;;;;;   ',
      '   ;;;;;;;;    ',
      '     ;;;;      ',
    ],
  },
  {
    nome: 'Jardim das Ruínas', tema: 'jardim', ondas: [['g', 'g', 'g', 'g'], ['r', 'g', 'g'], ['r', 'r']], recompensa: 'poder',
    tiles: [
      '##E####X######E###',
      '#F,,;;;;;;;;,,ww,#',
      '#A,;;;;;;;;;;,ww,,',
      '#,,;;L;;;;;;;,,f,,',
      '#,;;;;;;;;;;;;;,,,',
      '#,;;;;;;;;;;;;;;,,',
      '#f;;;;;;S;;;;;;;,,',
      '#,;;;;;;;;;;;;;;, ',
      '#,,;;P;;;;;;P;;f, ',
      '#a,;;;;;;;;;;;;,  ',
      '#F,,;;;;;;;;;;,,  ',
      ' ,,f,,;;;;;;,,,   ',
      '   ,,,,,,,,,,     ',
    ],
  },
  {
    nome: 'Desfiladeiro do Sol', tema: 'deserto', ondas: [['g', 'g', 'g', 'g', 'g'], ['r', 'r', 'g', 'g'], ['r', 'r', 'r', 'g', 'g']], recompensa: 'fim',
    tiles: [
      '####E##X#########',
      '##P;Z;P:;;;;;;;f#',
      '#;;;;;;:;;;;;;;;#',
      '##;;;;;:::;;;;;##',
      '#a;;;;;;;::;;;;;#',
      '#;;www;;;;:;;;f;#',
      '#;;www;;;;S;;;;;#',
      '#;;;;;;;;;:;;;;##',
      '#f;;;;;;;:;;;;;;#',
      '##;;;;;;;:;;;b;;#',
      '##;;;;;;::;;;;;A#',
      '###;;;;;:;;;;;###',
      '  ####;;:;;#####  ',
    ],
  },
];

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

const SOLID = new Set(['#', 'H', 'P', 'B', 'C', 'A', 'a', 'D', 'T', 'E', 'O', 'o', 'X', 'F', 'R', 'L', 'w', 'Z']);
const PROP = { P: 'pilar', T: 'tocha', B: 'barril', C: 'caixa', A: 'arvore', a: 'arvore2', D: 'boneco', E: 'estandarte', O: 'pedra2', o: 'pedra', m: 'moita', F: 'braseiro', R: 'entulho', L: 'leao', f: 'flor', Z: 'escada' };

export function parseMap(def) {
  const rows = def.tiles;
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const floor = [], solid = [], walls = [], props = [], spawns = [];
  let start = { x: w / 2, y: h / 2 }, door = null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i] || ' ';
    const k = j * w + i;
    solid[k] = ch === ' ' || SOLID.has(ch);
    floor[k] = ch === ' ' ? null : def.ondas ? 'laje' : ',Aagr Oom'.includes(ch) && ch !== ' ' ? 'grama' : ch === ':' || ch === 'S' ? 'terra' : ch === '=' ? 'madeira' : ';SFRPgrX'.includes(ch) && def.ondas ? 'laje' : 'pedra';
    if (ch === '#' || ch === 'H' || ch === 'X' || (ch === 'E' && def.tema)) walls.push({ i, j, wood: ch === 'H', door: ch === 'X', banner: ch === 'E' });
    if (ch === 'X') door = { i, j };
    if (PROP[ch] && !(ch === 'E' && def.tema)) props.push({ i, j, kind: PROP[ch] });
    if (ch === 'S') start = { x: i + 0.5, y: j + 0.5 };
    if (ch === 'g' || ch === 'r') spawns.push({ x: i + 0.5, y: j + 0.5, kind: ch === 'g' ? 'verde' : 'roxa' });
  }
  // lago (tiles 'w') e ossos ('b')
  const water = [], ossos = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch === 'w') water.push([i + 0.5, j + 0.5]); if (ch === 'b') ossos.push({ x: i + 0.2, y: j + 0.5 }); }
  const lago = water.length ? { x: water.reduce((a, p) => a + p[0], 0) / water.length, y: water.reduce((a, p) => a + p[1], 0) / water.length } : null;
  // chão livre (para sortear onde nascem os inimigos)
  const open = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!solid[j * w + i]) open.push({ x: i + 0.5, y: j + 0.5 });
  return { ...def, w, h, floor, solid, walls, props, spawns, start, door, open, lago, ossos };
}
