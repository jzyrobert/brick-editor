script({title:'Emberwing — Keeper of the Last Egg',description:'A crimson dragon shelters its ivory egg beneath a raised, horned head. Swept bat wings, an armoured breast, four clawed feet and a curling tail form a freestanding guardian.',palette:{hide:'dark red',membrane:'tan',bone:'tan',ridge:'pearl gold',claw:'black'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour='hide')=>box({at,size,colour});
const body=[];const tops=[28,31,34,37,37,37,37,37,34,31];
for(let i=0;i<tops.length;i++){const z=i*2,t=tops[i];body.push(B([-5,13,z],[10,t-13,2]));if(i<8)body.push(P('44126',[-10,t-3,z],'hide',90),P('44126',[4,t-3,z],'hide',270));for(let x=-4;x<4;x+=2)body.push(P('15068',[x,t,z],'hide'));for(let k=0;k<2;k++)body.push(P('13547',[-8,13,z+k],'hide',90),P('13547',[4,13,z+k],'hide',270));if(i%2===0)body.push(P('4589',[-1,t+3,z+1],'ridge'));}
section('Cambered torso and plated belly',body);
function leg(fx,fz,hx,hz){const a=[floor({at:[fx,0,fz],size:[6,10],layers:2,colour:'hide'}),floor({at:[fx,2,fz+4],size:[6,6],layers:1,colour:'hide'}),B([fx+1,3,fz+5],[4,13,4]),B([hx+1,10,hz+1],[4,12,6])];for(let k=0;k<3;k++)a.push(P('61678',[fx+2*k,2,fz],'claw'),P('50950',[fx+2*k,6,fz+7],'hide'),P('44126',[hx+2*k,22,hz],'hide'));for(let k=0;k<2;k++)a.push(P('61678',[hx-1,13,hz+4*k],'hide',90),P('61678',[hx+3,13,hz+4*k],'hide',270));for(let k=0;k<3;k++)a.push(P('24309',[hx+2*k,19,hz-1],'hide'));return a;}
section('Four planted talons and muscular haunches',[...leg(-12,-3,-9,1),...leg(6,-1,3,3),...leg(-12,18,-9,16),...leg(6,20,3,18)]);
const neck=[B([-3,24,-7],[6,10,10]),B([-4,32,-12],[6,10,8]),B([-5,40,-16],[6,7,7])];
for(let i=0;i<5;i++){const z=-12+2*i,y=40-3*i;neck.push(P('44126',[-8,y,z],'hide',90),P('44126',[2,y,z],'hide',270));}
for(let i=0;i<4;i++){const z=-16+3*i,y=38-6*i;for(const x of [-2,0])neck.push(P('24309',[x,y,z],'tan'));}
for(let i=0;i<4;i++)neck.push(P('3040b',[-1,43-3*i,-9+3*i],'bone',180));
section('Arched neck and armoured throat',neck);
const head=[B([-7,45,-23],[10,3,12]),B([-6,52,-23],[8,3,10]),B([-7,50,-17],[10,8,8])];
for(let x=-6;x<2;x+=2)head.push(P('44126',[x,48,-24],'hide'),P('44126',[x,55,-24],'hide'));
for(const x of [-7,2]){for(const z of [-22,-19,-16])head.push(P('4589',[x,48,z],'bone'));head.push(P('3062b',[x,54,-18],'black'),P('6141',[x,57,-18],'yellow'),P('98138pz4',[x,58,-18],'yellow'),P('50950',[x,58,-17],'hide'),P('40379',[x,61,-14],'bone'));}
for(const x of [-5,-3,-1])head.push(P('24309',[x,58,-17],'hide'));
for(const x of [-7,-5,-3,-1,1])head.push(P('24309',[x,58,-14],'hide',180));
head.push(P('3942c',[-3,61,-14],'ridge'),P('6141',[-5,58,-23],'black'),P('6141',[0,58,-23],'black'));
section('Roaring face, bright eyes and swept horns',head);
const wing=[];const lengths=[4,6,5,4,2,1];
for(let j=0;j<lengths.length;j++){const x=6+4*j,z=-1+2*j,n=lengths[j];wing.push(floor({at:[x,32,z],size:[4,4],layers:2,colour:'hide'}));for(let k=0;k<n;k++){const y=34+3*k,zz=z+k;wing.push(P('3040b',[x,y,zz],'hide'),P('3038',[x+1,y,zz],'membrane'),P('3660b',[x,y,zz+2],'hide',180),P('3660b',[x+2,y,zz+2],'hide',180));}wing.push(floor({at:[x,34+3*n,z+n],size:[4,2],layers:1,colour:'hide',top:'tile'}));}
wing.push(B([4,28,1],[4,6,5]),P('3942c',[10,52,6],'bone'));
section('Swept ribbed bat wings',[mirror({axis:'x',about:0,ops:wing})]);
const tail=[];const widths=[8,8,6,6,4,4,2,2],xs=[-4,-3,-1,2,6,9,12,14];
for(let i=0;i<widths.length;i++){const w=widths[i],x=xs[i],z=22+4*i,t=26-2*i;tail.push(i===0?box({at:[x,t-6,z-2],size:[w,6,6],colour:'hide',top:'tile'}):B([x,t-6,z],[w,6,4]));for(let k=0;k<w;k++)tail.push(P('61678',[x+k,t,z],'hide'));if(i%2===0)tail.push(P('3040b',[x+Math.floor(w/2),t+3,z+2],'bone'));}
tail.push(B([15,3,50],[5,9,2]),B([18,3,47],[2,9,4]),P('61678',[16,12,50],'hide',90),P('61678',[19,12,46],'hide'),P('40379',[20,9,47],'hide',90));
section('Curling tapering tail',tail);
section('The last egg',[cylinder({at:[-3,0,-10],diameter:6,height:3,colour:'white'}),dome({at:[-3,3,-10],diameter:6,colour:'white'})]);