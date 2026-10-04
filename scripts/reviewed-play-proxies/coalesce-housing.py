"""Accepted identical-halfspace cell coalescing; no rounded identity or interval cutoff."""
import json,collections,math,sys
cells=json.load(open(sys.argv[1]))
def pkey(p):return tuple(p['n'])+(p['d'],)
def linekey(l):return tuple(l)
def key(c,axis):
 if axis=='x':return (c['lo'],c['hi'],pkey(c['lower']),pkey(c['upper']))
 return (linekey(c['left']),linekey(c['right']),pkey(c['lower']),pkey(c['upper']))
for trial in range(6):
 before=len(cells)
 for axis in ['x','z']:
  groups=collections.defaultdict(list)
  for c in cells:groups[key(c,axis)].append(c)
  new=[]
  for cs in groups.values():
   cs.sort(key=lambda c:c['left'][0]+c['left'][1]*(c['lo']+c['hi'])/2 if axis=='x' else c['lo'])
   cur=None
   for c in cs:
    if cur and (linekey(cur['right'])==linekey(c['left']) if axis=='x' else cur['hi']==c['lo']):
     if axis=='x':cur['right']=c['right']
     else:cur['hi']=c['hi']
    else:
     if cur:new.append(cur)
     cur={**c}
   if cur:new.append(cur)
  cells=new
 print(trial,before,len(cells))
 if len(cells)==before:break
pieces=[]
for c in cells:
 piece=[]
 for cut,plane in [(c['left'],c['lower']),(c['right'],c['lower']),(c['right'],c['upper']),(c['left'],c['upper'])]:
  for z in [c['lo'],c['hi']]:
   x=cut[0]+cut[1]*z;nx,ny,nz=plane['n'];y=(plane['d']-nx*x-nz*z)/ny;piece.append([x,y,z])
 pieces.append(piece)
json.dump(pieces,open(sys.argv[2],'w'),separators=(',',':'))
