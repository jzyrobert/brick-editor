script({title:'Imperial Star Destroyer — Devastator',description:'A monumental armored dagger with layered sloping hull panels, mechanical trenches, eight heavy turbolaser batteries, a terraced command citadel, twin shield globes and seven recessed blue ion engines. Two small cradles expose the ventral docking well.',palette:{hull:'light bluish grey',shadow:'dark bluish grey',void:'black',glow:'trans light blue'}});
const P=(part,at,colour='hull',turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour='hull',extra={})=>box({at,size,colour,...extra});
const F=(at,size,colour='hull',layers=1)=>floor({at,size,colour,layers});
section('Two display cradles',[...[48,108].map(z=>[B([-12,0,z],[24,3,8],'void',{top:'tile'}),B([-3,3,z+2],[6,19,4],'void'),...[-12,8].map(x=>P('3037',[x,3,z+2],'void',x<0?90:270))])]);
const core=[F([-1,22,0],[2,24],'hull',2)],skin=[],edge=[];
for(let b=0;b<12;b++){
 const z=b*12,w=b*4;
 core.push(F([-w-2,22,z+6],[2*w+4,6],'hull',2));
 if(w){core.push(F([-w,22,z],[2*w,12],'hull',2));
 for(let j=0;j<b;j++)for(const s of [-1,1]){
  const x=s<0?-4*j-4:4*j,h=32+3*(b-1-j),courses=2+b-1-j;
  core.push(P('3029',[x,h-1,z],'hull',90));
  for(let c=0;c<courses;c++)core.push(P('3003',[x+1,24+3*c,z+5],'shadow'));
  core.push(P('3022',[x+1,24+3*courses,z+5],'shadow'));
  for(let dz=0;dz<12;dz+=2)skin.push(P('30363',[x,h,z+dz],(j===2&&dz===6&&b%4===0)?'shadow':'hull',s<0?90:270));
 }
 }
 for(let a=0;a<2;a++)for(const s of [-1,1]){
  const x=s<0?-w-2*a-2:w+2*a,zz=z+6*a;
  edge.push(P(s<0?'41765':'41764',[x,24,zz]),P(s<0?'41748':'41747',[x,30,zz]));
  core.push(F([s<0?x+1:x-1,23,zz],[2,6],'hull'),B([s<0?x+1:x,27,zz+2],[1,3,4],'shadow',{interior:'solid'}));
  for(const q of [1,3]){
   const xx=s<0?x+1:x;
   edge.push(P('3024',[xx,27,zz+q],'shadow'),P('4070',[xx,28,zz+q],'shadow',s<0?90:270));
  }
 }
}
section('Interlocked keel and transverse frames',core);
section('Sloped dorsal armor',skin);
section('Knife edges and exposed equatorial systems',edge);
section('Ventral docking well',[B([-7,16,66],[14,6,24],'shadow',{open:['top'],interior:'empty'}),B([-5,16,69],[10,1,18],'void'),...[-7,6].map(x=>B([x,16,66],[1,6,24],'hull')),F([-7,16,66],[14,2],'hull'),F([-7,16,88],[14,2],'hull')]);
const island=[];
island.push(B([-6,43,62],[12,12,18],'hull',{top:'tile'}),B([-11,46,74],[22,15,16],'hull',{top:'tile'}),B([-16,47,86],[32,19,46],'hull',{top:'tile'}),B([-12,66,94],[24,9,34],'hull',{top:'tile'}),B([-9,75,102],[18,8,25],'hull',{top:'tile'}));
function sideMachines(x,y,z,n){return [F([x<0?x:x-1,y-1,z],[2,n*2],'hull'),range(Math.ceil(n/2)).map(i=>[P('2877',[x,y,z+4*i],'shadow',90),P('3023b',[x,y+3,z+4*i],'hull',90),P('2412b',[x,y+4,z+4*i],i%4===0?'void':'hull',90)])];}
island.push(sideMachines(-17,55,88,21),sideMachines(16,55,88,21),sideMachines(-13,68,96,15),sideMachines(12,68,96,15),sideMachines(-10,76,104,10),sideMachines(9,76,104,10));
for(const [w,y,z,d] of [[12,55,62,18],[22,61,74,16],[32,66,86,46],[24,75,94,34],[18,83,102,25]]){
 for(let i=0;i<w;i+=2)island.push(P('3039',[-w/2+i,y,z]));
 for(const s of [-1,1])for(let k=4;k<d;k+=4)island.push(P('3069b',[s<0?-w/2:w/2-2,y,z+k],'hull'));
}
section('Terraced command citadel',island);
const bridge=[];
bridge.push(B([-5,83,113],[10,19,11],'hull'),B([-17,99,111],[34,9,14],'hull',{top:'tile'}),B([-20,101,113],[3,6,10],'hull',{top:'tile'}),B([17,101,113],[3,6,10],'hull',{top:'tile'}));
for(let x=-16;x<16;x+=2)bridge.push(P('3660b',[x,96,111],'hull'),P('3004',[x,103,110],'void'),P('3023b',[x,106,110],'hull'),P('30363',[x,108,110],'hull'),P('30363',[x,108,122],'hull',180));
for(let x=-4;x<5;x+=2)bridge.push(P('2877',[x,88,112],'shadow'),P('3004',[x,91,112]),P('2877',[x,94,112],'shadow'));
for(const x of [-15,7])bridge.push(B([x+2,108,115],[4,7,4],'hull'),P('3660b',[x+1,115,115],'hull'),P('3660b',[x+5,115,115],'hull'),cylinder({at:[x,118,113],diameter:8,height:3,colour:'hull'}),dome({at:[x,121,113],diameter:8,colour:'hull'}));
bridge.push(B([-2,108,116],[4,7,4],'shadow'),P('3039',[-2,115,116]),P('3039',[0,115,116]),P('3957a',[0,118,117],'hull'));
section('T bridge and paired deflector globes',bridge);
function gun(x,z){const y=35+3*(Math.floor((z+4)/12)-1-Math.floor((Math.abs(x)-3)/4));return [B([x-3,23,z-3],[6,y-20,8],'hull',{top:'tile'}),P('60474',[x-2,y+3,z-2],'shadow'),P('3941',[x-1,y+4,z-1],'hull'),P('3039',[x-2,y+7,z-2],'hull'),P('3039',[x,y+7,z-2],'hull'),P('3020',[x-2,y+7,z],'hull'),...[-1,1].map(dx=>[B([x+dx,y+5,z-7],[1,2,7],'shadow',{interior:'solid'}),P('2431',[x+dx,y+7,z-7],'hull',90)])];}
const guns=[];for(const s of [-1,1])for(let i=0;i<4;i++)guns.push(gun(s*(20+i*2),94+i*10));
section('Eight heavy twin turbolaser batteries',guns);
function engine(cx,y,z,small){
 const widths=small?[2,4,6,6,4,2]:[4,8,10,10,10,10,8,4],ops=[];
 for(let r=0;r<widths.length;r++){
  const rw=widths[r],left=cx-rw/2,yy=y+r*3;
  if(r===0||r===widths.length-1)ops.push(B([left,yy,z],[rw,3,8],'shadow',{interior:'solid'}));
  else ops.push(B([left,yy,z],[1,3,8],'shadow',{interior:'solid'}),B([left+rw-1,yy,z],[1,3,8],'shadow',{interior:'solid'}),B([left+1,yy,z],[rw-2,3,1],'glow',{interior:'solid'}));
  for(let x=left;x<left+rw;x++)if(r===0||r===widths.length-1||x===left||x===left+rw-1)ops.push(P('3004',[x,yy,z+6],'hull',90));
 }
 return ops;
}
section('Seven recessed ion engines',[B([-39,27,140],[78,21,4],'shadow'),...[-21,0,21].map(x=>engine(x,24,144,false)),...[-32,-11,11,32].map(x=>engine(x,48,140,true))]);
const systems=[];
for(let s of [-1,1])for(let k=0;k<17;k++){
 const z=39+k*6,b=Math.floor(z/12),w=b*4,x=s<0?-w+3:w-5;
 systems.push(P('3020',[x,35,z],'shadow'),P('2412b',[x,36,z],'hull'),P('3069b',[x+2,36,z],'hull'),P('6141',[x,36,z+1],'shadow'),P('6141',[x+3,36,z+1],'hull'));
}
for(let x=-38;x<38;x+=4)systems.push(B([x,36,138],[2,10,2],'hull',{interior:'solid'}),P('2412b',[x,46,138],'shadow'),P('3069b',[x,47,138],'hull'));
section('Reactor cooling and service machinery',systems);
