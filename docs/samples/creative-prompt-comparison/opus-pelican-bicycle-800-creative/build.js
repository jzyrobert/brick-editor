script({title:'Pelican Express: the fish courier of Pier 7',description:'A white pelican pedals a blue Dutch delivery bike down the harbour boardwalk: basket and crate full of fish, pouch bulging, pennant flying, while a seagull pinches the fish that bounced off the back.',palette:{bike:'medium azure',chrome:'light bluish grey',tyre:'black',feather:'white',tip:'black',bill:'bright light orange',pouch:'orange',leg:'orange',crest:'yellow',saddle:'reddish brown',flag:'red',plankA:'reddish brown',plankB:'dark tan'}});
const G=2;
function vox(){const V={};return {V,set:(x,y,z,c)=>{V[x+','+y+','+z]=c;}};}
// cells -> x runs -> stacked in y -> merged in z, so the compiler can use bricks
function emit(M){const V=M.V,rows={},runs=[];for(const k in V){const p=k.split(',').map(Number);const r=p[1]+','+p[2];(rows[r]=rows[r]||[]).push(p[0]);}
 for(const r in rows){const [y,z]=r.split(',').map(Number);const xs=rows[r].sort((a,b)=>a-b);let s=xs[0],p=s,c=V[s+','+y+','+z];
  for(let i=1;i<=xs.length;i++){const x=xs[i];const cc=i<xs.length?V[x+','+y+','+z]:null;if(i<xs.length&&x===p+1&&cc===c){p=x;continue;}runs.push([s,p,y,z,c]);if(i<xs.length){s=x;p=x;c=cc;}}}
 const g={};for(const [x0,x1,y,z,c] of runs){const k=[x0,x1,z,c].join('|');(g[k]=g[k]||[]).push(y);}
 const cols=[];for(const k in g){const q=k.split('|');const ys=g[k].sort((a,b)=>a-b);let y0=ys[0],yl=y0;for(let i=1;i<=ys.length;i++){if(i<ys.length&&ys[i]===yl+1){yl=ys[i];continue;}cols.push([+q[0],+q[1],y0,yl-y0+1,+q[2],q[3]]);if(i<ys.length){y0=yl=ys[i];}}}
 const g2={};for(const [x0,x1,y0,h,z,c] of cols){const k=[x0,x1,y0,h,c].join('|');(g2[k]=g2[k]||[]).push(z);}
 const ops=[];for(const k in g2){const q=k.split('|');const x0=+q[0],x1=+q[1],y0=+q[2],h=+q[3],c=q[4];const zs=g2[k].sort((a,b)=>a-b);let z0=zs[0],zl=z0;
  for(let i=1;i<=zs.length;i++){if(i<zs.length&&zs[i]===zl+1){zl=zs[i];continue;}
   ops.push(h===1?floor({at:[x0,y0,z0],size:[x1-x0+1,zl-z0+1],colour:c}):box({at:[x0,y0,z0],size:[x1-x0+1,h,zl-z0+1],colour:c,interior:'solid'}));if(i<zs.length){z0=zl=zs[i];}}}
 return ops;}
// a tube drawn in whole brick courses (3 plates) so it packs into bricks
function segB(M,a,b,zs,col,w){const r=w/2,ax=a[0],ay=a[1]/2.5,bx=b[0],by=b[1]/2.5,dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;
 const k0=Math.floor((Math.min(a[1],b[1])-r*2.5)/3),k1=Math.floor((Math.max(a[1],b[1])+r*2.5)/3);
 for(let k=k0;k<=k1;k++){const py=(3*k+1.5)/2.5;for(let x=Math.floor(Math.min(ax,bx)-r)-1;x<=Math.ceil(Math.max(ax,bx)+r)+1;x++){
  const px=x+0.5;let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=Math.max(0,Math.min(1,t));const ex=px-ax-t*dx,ey=py-ay-t*dy;
  if(ex*ex+ey*ey<=r*r)for(let d=0;d<3;d++)for(const z of zs)M.set(x,3*k+d,z,typeof col==='function'?col(t):col);}}}
function blk(M,x0,x1,y0,y1,z0,z1,c){for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)M.set(x,y,z,c);}
function disk(M,cx,cy,R,z,f){for(let x=Math.floor(cx-R)-1;x<=cx+R+1;x++)for(let y=Math.floor(cy-R*2.5)-1;y<=cy+R*2.5+1;y++){const r=Math.hypot(x+0.5-cx,(y+0.5-cy)/2.5);if(r<=R)M.set(x,y,z,f(r));}}

// Bicycle: Dutch step-through frame, wheels in the z=15..16 plane, stays and fork either side
const B=vox();const yc=G+17.5;
function wheel(cx){for(let x=cx-9;x<=cx+9;x++)for(let y=G;y<=G+40;y++){const dx=x+0.5-cx,dy=(y+0.5-yc)/2.5,r=Math.hypot(dx,dy);let c=null;
 if(r<=7&&r>5.7)c='tyre';else if(r<=5.7&&(Math.abs(dx)<=0.5||Math.abs(dy)<=0.5))c='chrome';else if(r>7&&r<=7.9&&dy>4.5)c='bike';
 if(c){B.set(x,y,15,c);B.set(x,y,16,c);}}}
wheel(11);wheel(32);
segB(B,[29.2,42],[20.5,16.5],[15,16],'bike',1.4);
segB(B,[20.5,16.5],[17.5,40],[15,16],'bike',1.3);
segB(B,[29.6,39],[28.6,51],[15,16],'bike',1.6);
segB(B,[20.5,16.5],[11,19.5],[14,17],'bike',1.3);
segB(B,[17,39],[11,19.5],[14,17],'bike',1.3);
segB(B,[29.8,39],[32,19.5],[14,17],'bike',1.3);
blk(B,29,30,36,38,14,17,'bike');
blk(B,10,11,G+16,G+18,14,17,'chrome');blk(B,31,32,G+16,G+18,14,17,'chrome');
blk(B,17,17,40,42,15,16,'chrome');
blk(B,15,19,43,44,14,17,'saddle');blk(B,20,21,44,44,15,16,'saddle');blk(B,15,15,42,42,14,14,'tyre');blk(B,15,15,42,42,17,17,'tyre');
disk(B,20.5,16.5,2.3,13,r=>r>1.2?'chrome':'tyre');disk(B,11,19.5,1.1,13,()=>'chrome');
blk(B,12,21,21,23,13,13,'bike');
blk(B,20,20,16,16,12,18,'chrome');
blk(B,20,24,16,17,12,12,'chrome');blk(B,23,25,16,17,10,11,'tyre');
blk(B,17,20,16,17,18,18,'chrome');blk(B,16,18,16,17,19,21,'tyre');
blk(B,3,16,40,40,14,17,'chrome');
blk(B,3,3,41,58,16,16,'chrome');blk(B,2,2,52,57,16,16,'flag');blk(B,1,1,53,56,16,16,'flag');blk(B,0,0,54,55,16,16,'flag');
segB(B,[28.6,50],[27.5,55],[15,16],'chrome',1.3);
blk(B,27,27,54,55,12,19,'chrome');blk(B,25,27,54,55,11,11,'tyre');blk(B,25,27,54,55,20,20,'tyre');
blk(B,30,30,41,43,15,16,'bike');

// Pelican: tilted egg body, S neck, long bill over a bulging pouch, wings on the bars, legs on the pedals
const P=vox();
const th=25*Math.PI/180,cs=Math.cos(th),sn=Math.sin(th);
segB(P,[20.5,47],[24.5,33],[12,13],'feather',2.2);segB(P,[24.5,33],[23.5,20],[12],'leg',1.3);
segB(P,[18.5,47],[22,35],[18,19],'feather',2.2);segB(P,[22,35],[17,20],[19],'leg',1.3);
const bodyIn=(x,k,z)=>{const ym=45+3*k+1.5,dx=x+0.5-17.5,dy=(ym-57)/2.5,u=dx*cs+dy*sn,v=-dx*sn+dy*cs,w=(z+0.5-16)/4.5;return (u/6.5)**2+(v/4.8)**2+w*w<=1;};
for(let k=0;k<10;k++)for(let x=8;x<=27;x++)for(let z=10;z<=21;z++){if(!bodyIn(x,k,z))continue;
 const ym=45+3*k+1.5,dx=x+0.5-17.5,dy=(ym-57)/2.5,u=dx*cs+dy*sn,v=-dx*sn+dy*cs;
 const c=(z<=12||z>=19)&&u<-1.5&&v>-3&&v<3.5?'tip':'feather';
 for(let d=0;d<3;d++)P.set(x,45+3*k+d,z,c);}
blk(P,10,11,51,53,14,17,'feather');
[21,21,21,21,20,20,21].forEach((x0,k)=>{for(let x=x0;x<x0+4;x++)for(let z=14;z<=17;z++){if((x===x0||x===x0+3)&&(z===14||z===17))continue;for(let d=0;d<3;d++)P.set(x,63+3*k+d,z,'feather');}});
for(let k=0;k<4;k++)for(let x=18;x<=28;x++)for(let z=11;z<=20;z++){const ym=84+3*k+1.5;if(((x+0.5-23.5)/3.6)**2+((z+0.5-16)/3)**2+((ym-89.5)/6.5)**2<=1)for(let d=0;d<3;d++)P.set(x,84+3*k+d,z,'feather');}
blk(P,20,22,96,97,15,16,'crest');
blk(P,24,24,87,89,13,13,'tip');blk(P,24,24,87,89,18,18,'tip');
const top=x=>x<=36?87:86;
for(let x=27;x<=40;x++)for(let y=70;y<=top(x);y++)for(let z=12;z<=19;z++){const u=(x+0.5-33)/6.5,w=(z+0.5-16)/2.7,v=(top(x)+1-(y+0.5))/12;if(u*u+w*w+v*v<=1)P.set(x,y,z,'pouch');}
blk(P,25,26,78,87,15,16,'pouch');
blk(P,26,36,88,89,15,16,'bill');blk(P,37,41,87,88,15,16,'bill');blk(P,41,41,85,86,15,16,'pouch');
const wingC=t=>t<0.22||t>0.72?'tip':'feather';
segB(P,[13,61],[26.5,56.5],[11],wingC,2.6);segB(P,[13,61],[26.5,56.5],[20],wingC,2.6);

section('Pier',[
 baseplate({at:[0,0],size:[48,32],colour:'blue'}),
 floor({at:[0,0,0],size:[48,6],colour:'trans light blue',top:'tile'}),
 floor({at:[0,0,6],size:[48,26],colour:'dark brown'}),
 ...range(13).map(i=>floor({at:[0,1,6+2*i],size:[48,2],colour:i%2?'plankB':'plankA'})),
 ...[[2,'2b'],[15,'3b'],[29,'2b'],[43,'4b']].map(([x,h])=>column({at:[x,0,4],height:h,diameter:2,colour:'dark brown'})),
 fence({path:[[0,31],[47,31]],y:2,colour:'reddish brown',style:'spindle'}),
 column({at:[44,2,8],height:'1b',diameter:2,colour:'black',cap:'plate'}),
 place({part:'2039',at:[44,2,27],colour:'dark bluish grey'}),
 place({part:'3941',at:[44,23,27],colour:'trans yellow'}),
 place({part:'3942c',at:[44,26,27],colour:'dark bluish grey'}),
 place({part:'4237',at:[0,2,23],colour:'yellow'}),
 place({part:'35700',at:[0,10,23],colour:'medium azure'}),
 place({part:'64648',at:[2,10,24],colour:'orange'}),
 place({part:'61780',at:[4,2,27],colour:'blue'}),
 place({part:'64648',at:[0,2,8],turn:90,colour:'sand green'}),
 place({part:'12891',at:[1,2,10],colour:'white'}),
 place({part:'12891',at:[42,12,3],colour:'white'})
]);
section('Bicycle',[...emit(B),place({part:'3062b',at:[27,56,13],colour:'yellow'})]);
section('Cargo',[
 box({at:[31,40,12],size:[7,6,8],colour:'tan',texture:'grille',interior:'empty'}),
 place({part:'64648',at:[32,46,14],turn:90,colour:'medium azure'}),
 place({part:'64648',at:[34,46,16],turn:90,colour:'sand green'}),
 place({part:'64648',at:[36,46,13],colour:'orange'}),
 place({part:'64648',at:[33,46,17],turn:90,colour:'medium azure'}),
 place({part:'4237',at:[4,41,14],turn:90,colour:'reddish brown'}),
 place({part:'64648',at:[5,49,14],colour:'sand green'}),
 place({part:'64648',at:[7,49,15],colour:'medium azure'})
]);
section('Pelican',[...emit(P),place({part:'2450',at:[22,18,10],colour:'orange'}),place({part:'2450',at:[15,18,19],colour:'orange'})]);