script({title:'Imperial Star Destroyer — The Capture',description:'A double-wedge Imperial warship with an armoured dorsal spine, eight twin turbolasers, the unmistakable T-shaped command bridge and twin spherical shield generators. Three large and four auxiliary engines finish the stern. A white and dark-red blockade runner flies beneath the port bow beside the recessed docking bay; both ships lift on compact display supports.',palette:{hull:'light bluish grey',machinery:'dark bluish grey',glass:'black'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour='hull')=>box({at:[x,y,z],size:[w,h,d],colour,top:'tile'});
const D=30,N=8,L=6;
section('Quiet display cradle',[
 floor({at:[-6,0,29],size:[12,16],layers:2,colour:'black',top:'tile'}),
 B(-2,2,31,4,15,3,'black'),B(-2,2,41,4,15,3,'black'),
 ...[-6,4].flatMap(x=>[P('3039',x,2,29,'black'),P('3039',x,2,43,'black',180)])
]);
function hullStation(k){
 const z=k*L,a=2*k,ops=[
 floor({at:[-a-1,17,z],size:[2*a+2,L],layers:2,colour:'hull'}),
 k>0&&B(-a,19,z,2*a,8,L),
 P('41765',-a-2,19,z,'machinery'),P('41764',a,19,z,'machinery'),
 P('3666',-a-1,22,z,'machinery',90),P('3666',a,22,z,'machinery',90),
 P('41748',-a-2,23,z),P('41747',a,23,z),
 P('3710',-a-2,26,z+5),k>0&&P('3710',a-2,26,z+5)
 ];
 if(k===0)ops.push(P('30363',-1,27,2));
 else if(k===1)for(let dz=0;dz<L;dz+=2)ops.push(P('3039',-a,27,z+dz,'hull',90),P('3039',a-2,27,z+dz,'hull',270));
 else{
  for(let dz=0;dz<L;dz+=2)if(!(k===N-1&&dz>=2))ops.push(P('30363',-a,27,z+dz,'hull',90),P('30363',a-4,27,z+dz,'hull',270));
  if(a>4)ops.push(B(-a+4,27,z,2*a-8,3,L));
 }
 return ops;
}
section('Connected keel and shaped armour',[
 range(N).map(hullStation),
 B(-1,D,6,2,1,10),
 carve({at:[-3,17,18],size:[6,7,10]})
]);
section('Ventral docking bay',[
 floor({at:[-3,24,18],size:[6,10],colour:'black'}),
 B(-4,17,18,1,1,10,'machinery'),B(3,17,18,1,1,10,'machinery'),
 B(-3,17,17,6,1,1,'machinery'),B(-3,17,28,6,1,1,'machinery')
]);
function tier(x,y,z,w,d,sidePart,sideWidth,frontPart,frontDepth){
 const ops=[floor({at:[x,y,z-frontDepth+2],size:[w,d+frontDepth-2],colour:'hull',top:'tile'}),B(x,y+1,z,w,3,d)];
 for(let dz=0;dz<d-1;dz+=2)ops.push(P(sidePart,x,y+1,z+dz,'hull',90),P(sidePart,x+w-sideWidth,y+1,z+dz,'hull',270));
 for(let dx=0;dx<w;dx+=2)ops.push(P(frontPart,x+dx,y+1,z-frontDepth));
 return ops;
}
section('Layered dorsal superstructure',[
 tier(-6,D,20,12,23,'30363',4,'30363',4),
 tier(-5,D+4,28,10,15,'3298',3,'3298',3),
 tier(-4,D+8,34,8,9,'3039',2,'3039',2),
 P('2412b',-2,D+4,20,'machinery'),P('2412b',0,D+4,20,'machinery'),
 P('3068b',-1,D+4,22,'machinery'),
 P('2412b',-2,D+8,29,'machinery'),P('2412b',0,D+8,30,'machinery'),
 B(-2,D,44,4,2,2),P('2412b',-2,D+2,44,'machinery'),P('2412b',0,D+2,45,'machinery')
]);
function battery(x,z){return [P('4032b',x,D,z,'machinery'),P('3941',x,D+1,z,'machinery'),P('30162',x,D+4,z,'hull')];}
section('Eight twin turbolaser batteries',[
 [30,34,38,42].flatMap(z=>[battery(-8,z),battery(6,z)])
]);
const neck=D+12,beam=neck+9,head=beam+1,top=head+6;
function windows(z){return range(7).map(i=>P('3004',-7+2*i,head+3,z,'glass'));}
section('Command tower and shield generators',[
 B(-2,neck,37,4,9,4),
 range(4).map(i=>P('4460b',-2+i,neck,35)),
 P('3660b',-4,neck+6,37,'hull',90),P('3660b',2,neck+6,37,'hull',270),
 P('3004',-2,neck+3,40,'machinery'),P('3004',0,neck+3,40,'machinery'),
 floor({at:[-8,beam,34],size:[16,8],colour:'hull',top:'tile'}),
 B(-8,head,36,16,6,6),
 range(8).map(i=>P('30363',-8+2*i,head,32)),
 windows(36),windows(41),
 [37,39].flatMap(z=>[P('3039',-8,head+3,z,'hull',90),P('3039',6,head+3,z,'hull',270)]),
 range(8).flatMap(i=>[P('15068',-8+2*i,top,35),P('15068',-8+2*i,top,41,'hull',180)]),
 [-6,4].flatMap(x=>[P('3941',x,top,38),P('20953',x,top+3,38)]),
 P('4740',-1,top,38,'machinery'),P('2412b',-3,top,38,'machinery'),P('2412b',1,top,38,'machinery'),
 P('3957a',0,top,40,'hull')
]);
function auxiliary(x){const outer=Math.abs(x)>10,sy=outer?27:D;return [
 B(x,sy,45,2,32-sy,1,'machinery'),
 P('4229',x,27,46,'hull',180),
 floor({at:[x,32,45],size:[2,5],colour:'hull',top:'tile'}),
 P('2412b',x,33,45,'machinery')
];}
section('Seven-engine stern',[
 [-11,-3,5].map(x=>P('43121',x,17,44,'hull',180)),
 [-14,-5,3,12].map(auxiliary),
 P('2877',-5,19,47,'machinery'),P('2877',3,19,47,'machinery')
]);
const cx=-10;
section('Blockade runner — beneath the port bow',[
 floor({at:[cx-1,0,15],size:[4,6],layers:2,colour:'black',top:'tile'}),
 column({at:[cx,2,18],height:8,diameter:1,colour:'trans-clear'}),
 floor({at:[cx,9,12],size:[2,12],colour:'white'}),
 B(cx,10,14,2,3,9,'white'),
 [0,1].map(dx=>P('11477',cx+dx,10,12,'white')),
 [0,1].map(dx=>P('61678',cx+dx,13,13,'white')),
 floor({at:[cx,13,17],size:[2,2],colour:'dark red',top:'tile'}),
 P('15068',cx,13,19,'white'),P('3069b',cx,13,21,'machinery'),P('3069b',cx,13,22,'white'),
 box({at:[cx-1,7,23],size:[4,9,3],colour:'light bluish grey',interior:'solid',top:'tile'}),
 [4,3,4].flatMap((n,row)=>range(n).map(i=>P('4070',cx-1+(n===3?1:0)+i,7+row*3,25,'light bluish grey',180))),
 range(4).map(i=>P('3070b',cx-1+i,16,25,'white'))
]);