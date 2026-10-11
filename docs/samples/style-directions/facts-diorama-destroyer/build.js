script({title:'Devastator: The Capture Above Tatooine',description:'A vast Imperial wedge hangs above a desert planetary limb. Beneath its illuminated ventral hangar, a tiny red-and-white Tantive IV is being hauled aboard. Layered armored decks, a panoramic command bridge, twin shield generators, eight heavy turbolasers and three main plus four auxiliary engines complete the silhouette.',palette:{hull:'light bluish grey',seam:'dark bluish grey',void:'black',glow:'trans light blue'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour='hull',extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
const F=(x,y,z,w,d,colour='hull',layers=1,tile=false)=>floor({at:[x,y,z],size:[w,d],colour,layers,...(tile?{top:'tile'}:{})});
const site=[];
for(let i=0;i<23;i++){const r=Math.min(48,12+2*i);site.push(F(-r,0,6*i,2*r,6,'void',2));for(const x of [-r,r-1])site.push(P('2431',x,2,6*i,'void',90),P('3069b',x,2,6*i+4,'void',90));}
for(let x=-10;x<10;x+=4)site.push(P('2431',x,2,0,'void'));
for(let x=-44;x<44;x+=4)site.push(P('2431',x,2,137,'void'));
site.push(dome({at:[-7,2,2],diameter:14,colour:'tan'}));
site.push(B(-5,2,72,10,34,8,'void'),B(-9,2,111,18,34,10,'void'));
site.push(column({at:[-7,2,46],height:34,diameter:1,colour:'glow'}),column({at:[7,2,46],height:34,diameter:1,colour:'glow'}),B(-1,2,35,2,15,3,'glow'));
section('Connected orbital display, planetary limb and concealed cradles',site);
const hull=[F(-2,35,4,4,12),P('43713',-2,36,4),P('43712',-2,39,4)];
for(let i=0;i<20;i++){
 const z=10+6*i,r=2+2*i,n=Math.floor((r-2)/6),q=r-6*n;
 hull.push(F(-r-2,35,z,2*r+4,6),F(-r,36,z,2*r,6,'hull',2),F(-r,41,z,2*r,6));
 hull.push(P('41765',-r-2,36,z),P('41764',r,36,z),P('78443',-r-2,39,z,'seam'),P('78444',r,39,z,'seam'),P('41748',-r-2,40,z),P('41747',r,40,z));
 for(let j=0;j<n;j++){
  const yy=42+3*j,l=-r+6*j,rr=r-6*j-6;
  if(j>0)hull.push(B(l+2,42,z+2,2,3*j-1,2),B(rr+2,42,z+2,2,3*j-1,2),F(l,yy-1,z,6,6),F(rr,yy-1,z,6,6));
  for(let k=0;k<6;k++)hull.push(P('4569',l,yy,z+k,'hull',90),P('4569',rr,yy,z+k,'hull',270));
 }
 hull.push(B(-2,38,z,4,4+3*n,6,'hull'),F(-q,42+3*n,z,2*q,6,'hull',1,true));
 for(let k=0;k<3;k++){
  const zz=z+2*k;
  hull.push(P('87087',-r+1,38,zz,'seam',90),P('87087',r-2,38,zz,'seam',270));
  hull.push(P('2412b',-r+1,41,zz,'hull',90),P('2412b',r-2,41,zz,'hull',90));
 }
}
hull.push(B(-36,36,124,72,7,6,'seam',{texture:'grille'}),B(-4,42,64,8,13,18));
section('Interlocked triangular keel, beveled rim and shallow armored facets',hull);
function deck(z0,segments,r0,cap,y,h){const a=[];for(let j=0;j<segments;j++){const r=Math.min(cap,r0+3*j),z=z0+6*j,extra=r<cap?1:0;a.push(B(-r-extra,y,z,2*r+2*extra,h,6,'hull',{top:'tile'}));if(r<cap)a.push(P('54384',-r-3,y+h,z),P('54383',r,y+h,z));for(let k=0;k<3;k++)a.push(P('30363',-r,y+h,z+2*k,'hull',90),P('30363',r-4,y+h,z+2*k,'hull',270));}return a;}
section('Arrowhead dorsal terraces',[
 ...deck(64,10,4,19,55,9),
 ...deck(82,7,4,13,67,7),
 B(-10,77,100,20,7,26,'hull',{top:'tile'}),
 ...range(13).flatMap(k=>[P('15068',-10,84,100+2*k,'hull',90),P('15068',8,84,100+2*k,'hull',270)]),
 B(-5,84,109,10,18,12,'hull',{texture:'grille'}),
 F(-17,102,106,34,12,'hull',2),
 ...range(17).map(k=>P('3660b',-17+2*k,99,106,'hull')),
 B(-17,104,108,34,6,10,'hull',{top:'tile'}),
 F(-17,106,104,34,9,'hull'),
 ...range(16).map(k=>P('3023b',-16+2*k,106,104,'void')),
 ...range(16).map(k=>P('30363',-16+2*k,107,104)),
 F(-17,110,108,34,10,'hull',1,true),
 ...range(17).map(k=>P('11477',-17+2*k,111,116,'hull',180)),
 B(-2,111,108,4,3,4,'seam',{top:'tile'}),
 P('3957a',-1,114,109,'hull'),
 ...[-13,9].flatMap(x=>[P('60474',x,111,112,'seam'),P('87081',x,112,112,'seam'),P('86500',x,115,112,'hull')])
]);
function battery(){return [F(0,0,0,6,6,'seam',1),P('60474',1,1,1,'hull'),P('87081',1,2,1,'seam'),P('15068',1,5,2),P('15068',3,5,2),P('3020',1,5,4,'seam'),...range(3).flatMap(k=>[P('3023b',1,5+k,0,'hull',90),P('3023b',4,5+k,0,'hull',90)]),P('2412b',2,6,4,'void')];}
component('Heavy twin turbolaser',{size:[6,6],ops:battery()});
const guns=[];
for(let i=0;i<4;i++){const z=88+9*i;guns.push(B(-27,38,z,6,14,6,'hull',{top:'tile'}),B(21,38,z,6,14,6,'hull',{top:'tile'}),instance({component:'Heavy twin turbolaser',at:[-27,52,z],turn:0}),instance({component:'Heavy twin turbolaser',at:[21,52,z],turn:0}));}
section('Eight shoulder-mounted heavy turbolaser batteries',guns);
const machinery=[];
function gallery(x,y,z,d){const a=[B(x,y,z,2,2,d,'seam',{top:'tile'})];for(let k=0;k<d;k+=2)a.push(P('2412b',x,y+2,z+k,'hull'));return a;}
for(const x of [-15,13])machinery.push(...gallery(x,64,105,16));
for(const x of [-8,6])machinery.push(...gallery(x,84,110,12));
for(let i=1;i<3;i++){const z=67+5*i;machinery.push(P('3069b',-2,64,z,'seam'),P('2412b',0,64,z,'hull'),P('3070b',2,64,z,'hull'));}
for(let i=0;i<2;i++){const z=96+2*i;machinery.push(P('3022',-3,74,z,'seam'),P('11477',-3,75,z,'hull'),P('11477',-2,75,z,'hull'),P('2412b',1,74,z,'void'));}
section('Recessed service galleries, cooling combs and dorsal conduits',machinery);
const engines=[];
for(const x of [-19,-3,13]){
 engines.push(B(x+1,36,126,4,3,10,'seam'),F(x,38,130,6,5,'seam'),P('43121',x,39,130,'hull',180),B(x+1,39,135,4,2,1,'seam'),B(x+1,41,135,4,5,1,'glow',{interior:'solid'}),P('3039',x+1,46,135,'hull',180),P('3039',x+3,46,135,'hull',180));
}
for(const x of [-25,-9,7,23])engines.push(B(x,43,126,2,7,11,'seam'),P('4868b',x,50,131,'hull',180),P('3023b',x,50,136,'glow'),P('3004',x,51,136,'glow'),P('3023b',x,54,136,'glow'));
for(let k=0;k<12;k++)engines.push(P('2412b',-34+6*k,43,127,'hull'));
section('Three main drives and four auxiliary thrusters',engines);
const corvette=[F(0,1,21,12,4,'white',1),B(4,2,4,4,4,17,'white',{top:'tile'}),B(2,2,0,8,4,4,'dark red',{top:'tile'}),F(2,6,2,8,2,'white',1,true)];
for(let i=0;i<4;i++)corvette.push(P('15068',2+2*i,6,0,'white'));
for(let j=0;j<8;j++)for(const x of [4,6])corvette.push(P('15068',x,6,4+2*j,j===3||j===4?'dark red':'white'));
for(let j=0;j<8;j++)for(const x of [4,6])corvette.push(P('3660b',x,0,4+2*j,'white'));
for(let j=0;j<6;j++)corvette.push(P('4868b',2*j,2,21,'white',180));
corvette.push(F(0,8,21,12,3,'dark red',1));
for(let j=0;j<5;j++)corvette.push(P('4868b',1+2*j,9,21,'white',180));
corvette.push(P('4032b',5,9,10,'seam'),P('4740',5,10,10,'white'),P('3023b',2,4,0,'void'),P('3023b',8,4,0,'void'));
component('Tantive IV with eleven engines',{size:[12,26],ops:corvette});
section('The captured blockade runner',[instance({component:'Tantive IV with eleven engines',at:[-6,17,23],turn:0})]);
section('Ventral docking aperture and tractor emitters',[
 carve({at:[-6,36,42],size:[12,5,14]}),
 F(-6,41,42,12,14,'void',1),
 B(-7,33,42,1,3,14,'seam',{texture:'grille'}),B(6,33,42,1,3,14,'seam',{texture:'grille'}),
 ...[43,48,53].flatMap(z=>[P('6141',-7,32,z,'glow'),P('6141',6,32,z,'glow')]),
 P('2412b',-4,42,43,'hull'),P('2412b',2,42,43,'hull')
]);