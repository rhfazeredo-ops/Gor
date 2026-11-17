import numpy as np
from collections import deque
g=np.load('grid.npy'); H,W=g.shape
# 0 sand, 1 rock, 2 water
# ponte: no plano fica em (~420,490)px -> célula
bx,by=int(420/735*W), int(490/624*H)
for x in range(bx-3,bx+3): g[by-1:by+1,x]=0
def regions(mask):
  lab=-np.ones(mask.shape,int); out=[]
  for y in range(H):
    for x in range(W):
      if mask[y,x] and lab[y,x]<0:
        q=deque([(y,x)]); lab[y,x]=len(out); cells=[]
        while q:
          cy,cx=q.popleft(); cells.append((cy,cx))
          for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny,nx=cy+dy,cx+dx
            if 0<=ny<H and 0<=nx<W and mask[ny,nx] and lab[ny,nx]<0:
              lab[ny,nx]=lab[cy,cx]; q.append((ny,nx))
        out.append(cells)
  return out
regs=sorted(regions(g==0),key=len,reverse=True)
ch=np.full((H,W),'#')
ch[g==2]='~'
for c in regs[0]: ch[c]='.'
for r in regs[1:]:
  for c in r: ch[c]='^'   # platôs altos (não alcançáveis)
for x in range(bx-3,bx+3):
  for y in (by-1,by): ch[y,x]='='
# spawn: célula de areia mais perto do centro-baixo
cy,cx=int(H*0.75),int(W*0.3)
best=min(regs[0],key=lambda c:(c[0]-cy)**2+(c[1]-cx)**2); ch[best]='P'
print(len(regs[0]),[len(r) for r in regs[1:6]])
open('desfiladeiro.txt','w').write('\n'.join(''.join(r) for r in ch)+'\n')
# estende a ponte até o platô da direita e torna esse platô alcançável
rows=[list(l) for l in open('desfiladeiro.txt').read().split('\n') if l]
for y in (by-1,by):
  x=bx+3
  while rows[y][x]=='#': rows[y][x]='='; x+=1
q=deque([(by,x)]); seen=set()
while q:
  cy,cx=q.popleft()
  if (cy,cx) in seen or not(0<=cy<H and 0<=cx<W) or rows[cy][cx]!='^': continue
  seen.add((cy,cx)); rows[cy][cx]='.'
  q.extend([(cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)])
print('platô ligado:',len(seen))
open('desfiladeiro.txt','w').write('\n'.join(''.join(r) for r in rows)+'\n')
