from PIL import Image, ImageFilter; import numpy as np, sys
img=Image.open('plan.jpg').convert('RGB').filter(ImageFilter.GaussianBlur(3))
im=np.asarray(img).astype(float)
r,g,b=im[...,0],im[...,1],im[...,2]
lum=0.3*r+0.59*g+0.11*b
water=(b>r-15)|(g>r+0)
rock=(~water)&(lum<float(sys.argv[3]))
cls=np.zeros(r.shape,int); cls[rock]=1; cls[water]=2
W,H=int(sys.argv[1]),int(sys.argv[2])
cw,ch=im.shape[1]/W, im.shape[0]/H
grid=np.zeros((H,W),int)
for y in range(H):
  for x in range(W):
    blk=cls[int(y*ch):int((y+1)*ch), int(x*cw):int((x+1)*cw)]
    c=np.bincount(blk.ravel(),minlength=3)/blk.size
    grid[y,x]=2 if c[2]>0.5 else (1 if c[1]>0.5 else 0)
# majority smoothing
g2=grid.copy()
for y in range(H):
  for x in range(W):
    n=grid[max(0,y-1):y+2,max(0,x-1):x+2].ravel()
    c=np.bincount(n,minlength=3)
    if c.max()>=6: g2[y,x]=c.argmax()
np.save('grid.npy',g2)
pal=np.array([[220,190,120],[110,70,40],[40,140,170]],np.uint8)
Image.fromarray(pal[g2]).resize((W*10,H*10),Image.NEAREST).save('grid.png')
print(np.bincount(g2.ravel()))
