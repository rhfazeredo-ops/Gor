import * as THREE from 'three';
import { buildCharacter, Animator } from '../src/rig.js';
import { HEROES } from '../src/data/heroes.js';

// =====================================================================
// Folhas de pose (esqueleto de palito) para uma IA de imagem desenhar o
// herói por cima, quadro a quadro, como no método do vídeo:
//   membros ESQUERDOS em vermelho, DIREITOS em azul, coluna/cabeça em
//   branco, arma em amarelo. Câmera isométrica do jogo, 8 direções.
// Uso: tools/pose-sheets.html?hero=dalarian
// =====================================================================
const CELL = 192;                 // tamanho de cada quadro
const PX_PER_UNIT = 58;
const FEET_Y = 168;               // pés dentro do quadro
const DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
const ANIMS = [
  ['idle', null, 2.86, 6, 0], ['walk', null, 0.66, 8, 1],
  ['ataque', 'ataque', 0.42, 6, 0], ['ataque2', 'ataque', 0.42, 6, 0],
  ['consagracao', 'consagracao', 0.9, 8, 0], ['protecao', 'protecao', 0.55, 6, 0],
  ['esquiva', 'esquiva', 0.22, 4, 0], ['dano', 'dano', 0.25, 3, 0],
];
const RED = '#e8322a', BLUE = '#2a6ae8', WHITE = '#f2f2f2', YELLOW = '#ffd21a';

export async function makeSheets(id, { bg = '#00b140', labels = true } = {}) {
  const def = HEROES.find((h) => h.id === id);
  const rig = buildCharacter(def, { outline: false });
  const B = rig.bones;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const half = CELL / PX_PER_UNIT / 2;
  const elev = THREE.MathUtils.degToRad(30);
  cam.position.set(0, Math.sin(elev) * 20, Math.cos(elev) * 20);
  cam.lookAt(0, 0, 0);
  const offY = (FEET_Y - CELL / 2) / PX_PER_UNIT;
  Object.assign(cam, { left: -half, right: half, top: half + offY, bottom: -half + offY });
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const v = new THREE.Vector3();
  const P = (obj, x = 0, y = 0, z = 0) => {
    obj.updateWorldMatrix(true, false);
    v.set(x, y, z).applyMatrix4(obj.matrixWorld).project(cam);
    return [(v.x + 1) / 2 * CELL, (1 - v.y) / 2 * CELL, v.z];
  };

  const sheets = {};
  for (const [name, action, dur, frames, speed] of ANIMS) {
    const c = document.createElement('canvas');
    c.width = CELL * frames; c.height = CELL * 8;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
    for (let d = 0; d < 8; d++) {
      rig.root.rotation.y = d * Math.PI / 4;
      for (let f = 0; f < frames; f++) {
        const anim = new Animator(rig, def.arma);
        anim.speed = speed;
        if (action) { anim.action = { name: action, n: Math.min(0.999, (f + 0.5) / frames), dur, variante: name === 'ataque2' ? 1 : 0 }; anim.update(0, speed); }
        else { anim.t = (f / frames) * dur; anim.update(0, speed); }
        rig.root.updateMatrixWorld(true);
        ctx.save(); ctx.translate(f * CELL, d * CELL);
        drawSkeleton(ctx, B, P, rig);
        if (labels) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.font = '12px monospace'; ctx.fillText(`${DIRS[d]} ${f + 1}`, 6, 16); }
        ctx.restore();
      }
    }
    sheets[name] = c.toDataURL('image/png');
  }
  return sheets;
}

function drawSkeleton(ctx, B, P, rig) {
  const pts = {
    pelvis: P(B.hips), chest: P(B.chest, 0, 0.2, 0), neck: P(B.neck), head: P(B.head, 0, 0.17, 0), headTop: P(B.head, 0, 0.4, 0),
    nose: P(B.head, 0, 0.15, 0.25),
  };
  for (const s of ['L', 'R']) {
    pts['sh' + s] = P(B['upperArm' + s]); pts['el' + s] = P(B['foreArm' + s]); pts['wr' + s] = P(B['hand' + s]);
    pts['hip' + s] = P(B['thigh' + s]); pts['kn' + s] = P(B['shin' + s]); pts['an' + s] = P(B['foot' + s]);
    pts['toe' + s] = P(B['foot' + s], 0, -0.06, 0.24);
  }
  // martelo: do punho até a cabeça do martelo (eixo z da mão)
  pts.wpnA = P(B.handR, 0, -0.05, -0.25); pts.wpnB = P(B.handR, 0, -0.05, 1.1);
  const seg = (a, b, col, w) => ({ a: pts[a], b: pts[b], col, w, z: (pts[a][2] + pts[b][2]) / 2 });
  const list = [
    seg('pelvis', 'chest', WHITE, 7), seg('chest', 'neck', WHITE, 6), seg('neck', 'head', WHITE, 5),
    seg('shL', 'shR', WHITE, 5), seg('hipL', 'hipR', WHITE, 5),
    seg('shL', 'elL', RED, 6), seg('elL', 'wrL', RED, 5), seg('hipL', 'knL', RED, 7), seg('knL', 'anL', RED, 6), seg('anL', 'toeL', RED, 4),
    seg('shR', 'elR', BLUE, 6), seg('elR', 'wrR', BLUE, 5), seg('hipR', 'knR', BLUE, 7), seg('knR', 'anR', BLUE, 6), seg('anR', 'toeR', BLUE, 4),
    seg('wpnA', 'wpnB', YELLOW, 4),
  ];
  // de trás para frente (z maior = mais longe)
  list.sort((a, b) => b.z - a.z);
  ctx.lineCap = 'round';
  for (const s of list) {
    ctx.strokeStyle = '#111'; ctx.lineWidth = s.w + 3;
    ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); ctx.stroke();
    ctx.strokeStyle = s.col; ctx.lineWidth = s.w;
    ctx.beginPath(); ctx.moveTo(s.a[0], s.a[1]); ctx.lineTo(s.b[0], s.b[1]); ctx.stroke();
  }
  // cabeça (círculo) e nariz (direção do rosto)
  const [hx, hy] = pts.head;
  ctx.fillStyle = WHITE; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.arc(pts.nose[0], pts.nose[1], 3.5, 0, Math.PI * 2); ctx.fill();
  // cabeça do martelo
  ctx.fillStyle = YELLOW; ctx.strokeStyle = '#111';
  ctx.beginPath(); ctx.rect(pts.wpnB[0] - 7, pts.wpnB[1] - 7, 14, 14); ctx.fill(); ctx.stroke();
  // juntas
  for (const k of ['shL', 'elL', 'wrL', 'hipL', 'knL', 'anL', 'shR', 'elR', 'wrR', 'hipR', 'knR', 'anR']) {
    ctx.fillStyle = k.endsWith('L') ? RED : BLUE;
    ctx.beginPath(); ctx.arc(pts[k][0], pts[k][1], 3.2, 0, Math.PI * 2); ctx.fill();
  }
}

const id = new URLSearchParams(location.search).get('hero') || 'dalarian';
makeSheets(id).then((s) => { window.__poses = s; document.body.append('pronto'); })
  .catch((e) => { window.__posesErr = String(e.stack); document.body.append('erro: ' + e.stack); });
