// Mede uma ferramenta/arma comprida (GLB): eixo principal (PCA), qual ponta é a "cabeça" (lado mais largo) ou a
// "ponta" (lado mais fino), a direção da parte larga perto de uma ponta (guarda/lâmina) e o comprimento.
// Uso: node tools/eixo-ferramenta.mjs arquivo.glb
import { NodeIO } from '@gltf-transform/core';
const d = await new NodeIO().read(process.argv[2]); const p = d.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION');
const v=[0,0,0], pts=[]; for(let i=0;i<p.getCount();i++){p.getElement(i,v);pts.push(v.slice());}
const m=[0,0,0]; pts.forEach(q=>{for(let k=0;k<3;k++)m[k]+=q[k]/pts.length});
const C=[[0,0,0],[0,0,0],[0,0,0]]; pts.forEach(q=>{for(let a=0;a<3;a++)for(let b=0;b<3;b++)C[a][b]+=(q[a]-m[a])*(q[b]-m[b])});
let e=[1,0.3,0.2]; for(let it=0;it<100;it++){const n=[0,1,2].map(a=>C[a][0]*e[0]+C[a][1]*e[1]+C[a][2]*e[2]);const l=Math.hypot(...n);e=n.map(x=>x/l);}
const t=pts.map(q=>(q[0]-m[0])*e[0]+(q[1]-m[1])*e[1]+(q[2]-m[2])*e[2]); const tmin=Math.min(...t),tmax=Math.max(...t);
const B=12, larg=new Array(B).fill(0), lar_dir=new Array(B).fill(null);
pts.forEach((q,i)=>{const b=Math.min(B-1,Math.floor((t[i]-tmin)/(tmax-tmin)*B));const r=[q[0]-m[0]-t[i]*e[0],q[1]-m[1]-t[i]*e[1],q[2]-m[2]-t[i]*e[2]];const dd=Math.hypot(...r);if(dd>larg[b]){larg[b]=dd;lar_dir[b]=r.map(x=>x/dd);}});
const P=(tt)=>m.map((x,k)=>+(x+e[k]*tt).toFixed(4));
console.log(JSON.stringify({centro:m.map(x=>+x.toFixed(4)), eixo:e.map(x=>+x.toFixed(4)), tmin:+tmin.toFixed(4), tmax:+tmax.toFixed(4), comp:+(tmax-tmin).toFixed(4)}));
console.log('largura por trecho (de tmin a tmax):', larg.map(x=>x.toFixed(3)).join(' '));
const imax=larg.indexOf(Math.max(...larg)); console.log('trecho mais largo', imax, 'direção', lar_dir[imax].map(x=>x.toFixed(3)).join(','), 'ponto no eixo', P(tmin+(imax+0.5)/B*(tmax-tmin)));
console.log('ponto tmin', P(tmin), 'ponto tmax', P(tmax));
