script({title:'Devastator — The Capture of the Tantive IV',description:'A vast blade-shaped Imperial flagship with layered armour, a recessed machinery trench, seven circular ion engines, twin shield globes, and a tiny captured blockade runner beneath its open ventral hangar.',palette:{hull:'light bluish grey',machinery:'dark bluish grey',shadow:'black',glow:'trans light blue'},defaults:{interior:'empty'}});
const N=22,D=6;
const p=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour='hull',extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
section('Compact display cradle',[floor({at:[-13,0,80],size:[26,32],layers:3,colour:'black',top:'tile'}),B(-6,3,85,12,24,20,'black',{interior:'solid'}),...[-13,9].map(x=>B(x,3,86,4,9,22,'black',{top:'tile'})),...range(6).map(i=>p('2431',-12+i*4,3,81,'dark bluish grey'))]);
const hull=[];
for(let r=0;r<N;r++){
 const z=r*D,w=4+4*r,a=-w/2,b=22+Math.floor(r/4),t=b+8;
 hull.push(B(a,b,z,w,8,D,'hull',{supports:8}),floor({at:[a,b-1,z],size:[w,D],layers:1,colour:'hull',top:'tile'}),p('41765',a-2,b,z),p('41764',w/2,b,z),B(a-2,b+3,z,2,2,D,'machinery'),B(w/2,b+3,z,2,2,D,'machinery'),p('41748',a-2,b+5,z),p('41747',w/2,b+5,z));
 if(w>=16){
  for(let q=0;q<3;q++) hull.push(p('30363',a,t,z+q*2,'hull',90),p('30363',w/2-4,t,z+q*2,'hull',270));
  hull.push(floor({at:[a+4,t,z],size:[w-8,D],layers:3,colour:'hull'}));
  for(let xx=a+4;xx<w/2-4;xx+=4) for(let zz=z;zz<z+D;zz+=2) hull.push(p('87079',xx,t+3,zz,((xx+zz)%47===0)?'dark bluish grey':'hull'));
 }else hull.push(floor({at:[a,t,z],size:[w,D],layers:1,colour:'hull',top:'tile'}));
}
hull.push(p('41748',-2,27,-6),p('41747',0,27,-6),p('41765',-2,24,-6),p('41764',0,24,-6),p('3031',-2,30,-2),p('87079',-2,31,-2),p('87079',-2,31,0),carve({at:[-9,20,54],size:[18,14,24]}));
section('Armoured triangular hull',hull);
const trench=[];
for(let r=2;r<N;r++){
 const w=4+4*r,z=r*6,b=22+Math.floor(r/4);
 for(const side of [-1,1]) for(let j=0;j<3;j++){
  const x=side<0?-w/2-2:w/2;
  trench.push(p('3023b',x,b+3,z+j*2,'dark bluish grey'),p('2412b',x,b+4,z+j*2,j===1?'black':'light bluish grey'));
 }
}
section('Recessed perimeter machinery trench',trench);
const superOps=[];
const terraces=[{z:54,w:12,h:7},{z:66,w:20,h:9},{z:78,w:28,h:12},{z:90,w:36,h:15},{z:102,w:40,h:15},{z:114,w:40,h:15}];
for(const q of terraces){
 superOps.push(B(-q.w/2,36,q.z,q.w,q.h,12,'hull',{top:'tile'}));
 for(let x=-q.w/2;x<q.w/2;x+=2) superOps.push(p('30363',x,36+q.h-3,q.z));
 for(const s of [-1,1]) for(let j=0;j<3;j++){
  const x=s<0?-q.w/2:q.w/2-1;
  superOps.push(p('2877',x,39,q.z+5+j*2,'dark bluish grey',90),p('3069b',x,42,q.z+5+j*2,'hull',90));
 }
}
superOps.push(B(-12,51,90,24,9,30,'hull',{top:'tile'}),B(-8,60,102,16,7,21,'hull',{texture:'grille',top:'tile'}));
for(let x=-12;x<12;x+=2) superOps.push(p('3298',x,57,90));
for(let x=-8;x<8;x+=2) superOps.push(p('30363',x,64,102));
for(const side of [-1,1]) for(let i=0;i<7;i++) superOps.push(p('2412b',side<0?-12:10,60,98+i*3,'dark bluish grey'));
for(let i=0;i<8;i++){
 const x=-6+(i%4)*4,z=111+Math.floor(i/4)*5;
 superOps.push(B(x,67,z,2,3,3,'machinery',{top:'tile'}),p('2412b',x,70,z));
}
section('Stepped dorsal command citadel',superOps);
const tower=[B(-4,67,108,8,25,10,'hull',{texture:'grille'}),B(-19,89,104,38,9,14,'hull',{top:'tile'}),floor({at:[-18,98,105],size:[36,12],layers:1,colour:'hull',top:'tile'})];
for(let x=-16;x<16;x+=2) tower.push(p('3004',x,91,103,'black'),p('3039',x,94,103));
for(const s of [-1,1]) for(let z=105;z<117;z+=2) tower.push(p('3040b',s<0?-19:17,95,z,'hull',s<0?90:270));
for(const x of [-15,10]) tower.push(column({at:[x+1,99,108],height:3,diameter:2,colour:'light bluish grey'}),p('30208',x,102,107));
tower.push(p('3957a',0,99,112),p('3062b',-2,99,113,'dark bluish grey'),p('4589',-2,102,113,'light bluish grey'));
for(let i=0;i<6;i++) tower.push(p('2412b',-6+i*2,98,117,'dark bluish grey'));
section('T bridge and twin shield generators',tower);
function turret(x,z,y){
 const ops=[p('4032b',x,y,z,'dark bluish grey'),p('3941',x,y+1,z),p('15068',x,y+4,z)];
 for(const dx of [0,1]) ops.push(p('3005',x+dx,y+1,z-1,'dark bluish grey'),p('3710',x+dx,y+4,z-4,'light bluish grey',90),p('3070b',x+dx,y+5,z-4,'black'));
 ops.push(p('6141',x,y+7,z+1,'dark bluish grey'));
 return ops;
}
const guns=[];
for(const s of [-1,1]) for(let i=0;i<4;i++){
 const z=86+i*10,y=22+Math.floor(Math.floor(z/6)/4)+12;
 guns.push(...turret(s<0?-27:25,z,y));
}
section('Eight heavy turbolaser batteries',guns);
const machinery=[];
for(const s of [-1,1]){
 for(let i=0;i<10;i++){
  const z=61+i*6,r=Math.floor(z/6),w=4+4*r,t=22+Math.floor(r/4)+11,x=s<0?-w/2+7:w/2-11,gx=s<0?-27:25;
  if([86,96,106,116].some(gz=>z<gz+2&&z+3>gz-4&&x<gx+2&&x+4>gx)) continue;
  machinery.push(B(x,t+1,z,4,3,3,'dark bluish grey',{top:'tile'}),p('2412b',x,t+4,z),p('2412b',x+2,t+4,z));
 }
 for(let i=0;i<7;i++){
  const z=30+i*6,r=Math.floor(z/6),w=4+4*r,t=22+Math.floor(r/4)+12,x=s<0?-w/2+6:w/2-8;
  machinery.push(p('3068b',x,t,z,'dark bluish grey'),p('2412b',x,t,z+2));
 }
}
section('Deck vents and service panels',machinery);
const stern=[];
function engine(x,y,z,big){
 const w=big?8:4,depth=big?4:2;
 const ops=[B(x,y-2,128,w,2,depth+6,'machinery',{interior:'solid'}),B(x,y,128,w,big?10:3,3,'machinery'),p(big?'44772':'60208',x,y,z,'light bluish grey')];
 const widths=big?[4,6,8,8,6,4]:[2,4,2];
 widths.forEach((ww,i)=>ops.push(B(x+(w-ww)/2,y+1+i*3,z+depth,ww,3,1,'glow',{interior:'solid'})));
 return ops;
}
for(const x of [-24,-4,16]) stern.push(...engine(x,18,133,true));
for(const x of [-34,-12,8,30]) stern.push(...engine(x,30,133,false));
for(let x=-42;x<42;x+=4) stern.push(B(x,28,130,4,9,2,'machinery',{texture:'grille',top:'tile'}));
for(const x of [-38,-28,-16,6,26,36]) stern.push(p('3039',x,37,130));
section('Seven circular ion engines',stern);
const hangar=[B(-10,24,53,1,10,26,'machinery'),B(9,24,53,1,10,26,'machinery'),B(-9,31,53,18,3,1,'machinery'),B(-9,31,78,18,3,1,'machinery')];
for(const x of [-10,9]) for(let z=56;z<78;z+=4) hangar.push(p('3005',x,27,z,'trans light blue'));
section('Open ventral capture hangar',hangar);
const runner=[B(-1,0,59,2,7,8,'black',{interior:'solid'}),B(-2,7,48,4,5,24,'white',{top:'tile'}),B(-3,6,67,6,9,6,'white',{top:'tile'}),B(-3,9,48,6,3,7,'dark red',{top:'tile'}),B(-4,7,45,8,4,4,'white',{top:'tile'}),p('3039',-4,11,45,'white'),p('3039',-2,11,45,'white'),p('3039',0,11,45,'white'),p('3039',2,11,45,'white')];
for(const y of [6,12]) for(const x of [-3,-1,1,3]) runner.push(p('4624',x,y,73,'white'));
for(const x of [-2,0,2]) runner.push(p('4624',x,9,73,'white'));
runner.push(p('15068',-1,12,56,'white'),p('3068b',-1,12,61,'dark red'));
section('Captured Tantive IV microbuild',runner);