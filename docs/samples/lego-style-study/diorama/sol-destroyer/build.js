script({title:'Devastator — Capture above Tatooine',description:'The Imperial-class destroyer overtakes the eleven-engine Tantive IV above the desert planet. A huge armored wedge, twin shield generators, recessed docking bay, seven aft drives and two departing TIE fighters recreate the opening chase.',palette:{hull:'light bluish grey',seam:'dark bluish grey',space:'black'},defaults:{interior:'empty'}});
const N=16,L=6,Y=32;
const P=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
section('Connected starfield display',[
 box({at:[-20,0,-52],size:[40,6,60],colour:'space',top:'tile',supports:8}),box({at:[-36,0,8],size:[72,6,52],colour:'space',top:'tile',supports:8}),
 box({at:[-3,6,-17],size:[6,26,6],colour:'space'}),box({at:[-4,6,31],size:[8,26,10],colour:'space'}),
 ...[[-17,-49],[15,-30],[-15,-15],[16,0],[-30,13],[30,12],[-31,39],[31,50],[-18,54],[15,56],[-9,-50],[18,-41]].map(([x,z],i)=>P('98138',x,6,z,i%3?'white':'trans light blue')),
 cylinder({at:[-18,6,-47],diameter:16,height:1,colour:'dark tan'}),dome({at:[-18,7,-47],diameter:16,colour:'tan'}),P('3960',10,6,-47,'yellow'),P('4740',16,6,-43,'white'),
 floor({at:[-9,6,53],size:[18,5],colour:'seam',top:'tile'}),...range(8).map(i=>P('3069b',-8+i*2,7,54,i%2?'hull':'space'))
]);
const body=[];
for(let i=0;i<N;i++){
 const z=-48+i*L,h=2*(i+1),w=2*h-4;
 if(w>0){body.push(floor({at:[-h+2,30,z],size:[w,L],layers:2,colour:'hull'}),box({at:[-h+2,Y,z],size:[w,10,L],colour:'hull',supports:8}));}
 body.push(P('41765',-h,32,z),P('41764',h-2,32,z),P('78443',-h,35,z),P('78444',h-2,35,z),P('41748',-h,39,z),P('41747',h-2,39,z));
 for(let j=0;j<L;j++)for(const s of [-1,1]){const e=2*i+1+Math.floor(j/3),x=s<0?-e:e-1;body.push(P(j%3===1?'4070':'3005',x,36,z+j,j%3===1?'space':'seam',s<0?90:270));}
}
section('Connected wedge keel and recessed equatorial trench',body);
const skin=[];
for(let i=0;i<N;i++){
 const z=-48+i*L,h=2*(i+1),K=Math.floor((h-2)/4),rem=h-2-4*K;
 for(let row=0;row<3;row++){
  const zz=z+2*row;
  for(let k=0;k<K;k++)for(const s of [-1,1]){
   const x=s<0?-4*(k+1):4*k,yy=42+3*(K-1-k);
   if(zz>=4&&zz<44&&x>=-16&&x+4<=16)continue;
   if(yy>42)skin.push(box({at:[x,42,zz],size:[4,yy-42,2],colour:'hull',interior:'solid'}));
   skin.push(P('30363',x,yy,zz,'hull',s<0?90:270));
  }
  if(rem)for(const s of [-1,1]){const x=s<0?-h+2:4*K;skin.push(floor({at:[x,42,zz],size:[rem,2],colour:'hull',top:'tile'}));}
 }
}
section('Shallow sloping armored hull panels',skin);
function tier(x,y,z,w,h,d){return [box({at:[x,y,z],size:[w,h,d],colour:'hull',texture:'grille',top:'tile'}),floor({at:[x-1,y+h,z-1],size:[w+2,d+2],layers:1,colour:'hull',top:'tile'})];}
const command=[
 box({at:[-16,42,4],size:[32,21,40],colour:'hull',texture:'grille',top:'tile'}),floor({at:[-17,63,3],size:[34,42],colour:'hull',top:'tile'}),box({at:[-6,42,0],size:[12,21,4],colour:'hull'}),
 ...tier(-12,64,15,24,8,28),...tier(-9,73,23,18,7,20),box({at:[-4,81,30],size:[8,10,8],colour:'hull',texture:'grille'}),
 floor({at:[-14,89,27],size:[28,10],layers:2,colour:'hull'}),box({at:[-14,91,28],size:[28,8,8],colour:'hull',texture:'grille',top:'tile'}),
 ...range(14).map(i=>P('3660b',-14+2*i,91,26)),...range(12).map(i=>P('3004',-12+2*i,94,27,i%3===0?'seam':'space')),...range(14).map(i=>P('2431',-14+2*i,97,27,'hull',90)),
 ...range(14).map(i=>P('15068',-14+2*i,99,28)),floor({at:[-14,99,30],size:[28,6],layers:3,colour:'hull',top:'tile'}),
 ...[-10,8].flatMap(x=>[column({at:[x,102,31],height:6,diameter:2,colour:'hull'}),P('3960',x-1,108,30),P('86500',x-1,110,30)]),
 column({at:[-1,102,33],height:9,diameter:2,colour:'seam'}),P('4740',-1,111,33),P('3957a',0,112,33),...range(4).map(i=>P('2412b',-3+2*i,102,35,'seam'))
];
for(const [x,y,z,w,d] of [[-16,63,4,32,40],[-12,72,15,24,28],[-9,80,23,18,20]]){
 for(let j=2;j<d-2;j+=4)for(const s of [-1,1]){const xx=s<0?x:x+w-2;command.push(P('3022',xx,y+1,z+j,'seam'),P('2412b',xx,y+2,z+j,'seam'),P('3069b',xx,y+2,z+j+1));}
 for(let j=2;j<w-2;j+=4)command.push(P('2412b',x+j,y+1,z+1,'seam'));
}
for(let i=0;i<6;i++)command.push(P('3039',-6+2*i,63,0),P('3022',-6+2*i,63,2),P('3068b',-6+2*i,64,2));
for(let z=6;z<44;z+=2)command.push(P('3684a',-17,51,z,'hull',90),P('3039',-16,60,z,'hull',90),P('3684a',15,51,z,'hull',270),P('3039',14,60,z,'hull',270));
for(let x=-16;x<16;x+=2)command.push(P('3684a',x,54,3));
section('Terraced dorsal city and signature command bridge',command);
const aft=[floor({at:[-28,31,47],size:[56,7],colour:'seam'})];
for(const x of [-17,-3,11])aft.push(P('43121',x,32,47,'hull',180));
for(const x of [-27,-21,19,25])aft.push(P('4868b',x,33,47,'hull',180));
for(let x=-28;x<28;x+=2)aft.push(P('2412b',x,32,53,'seam'));
section('Three main drives and four auxiliary engines',aft);
function turret(x,z){return [box({at:[x,42,z],size:[4,9,4],colour:'hull',top:'tile'}),floor({at:[x,53,z-1],size:[4,5],layers:2,colour:'hull',top:'tile'}),...range(2).flatMap(i=>[P('3039',x+2*i,51,z),P('3039',x+2*i,51,z+2,'hull',180)]),P('4032b',x+1,55,z+1,'seam'),P('15068',x+1,56,z+1),P('2921',x+1,55,z-1,'seam'),P('2921',x+2,55,z-1,'seam')];}
section('Eight heavy turbolaser batteries',[-1,1].flatMap(s=>range(4).flatMap(i=>turret(s<0?-22:18,14+i*6))));
const greeble=[];
for(let i=3;i<N;i++){
 const z=-48+i*6,h=2*(i+1),rem=(h-2)%4;
 for(const s of [-1,1])for(let j=0;j<3;j++){
  if(rem){const x=s<0?-h+2:h-4;greeble.push(P('3022',x,43,z+2*j),P('2412b',x,44,z+2*j,'seam'),P('3069b',x,44,z+2*j+1));}
  else{const x=s<0?-h+5:h-6;greeble.push(P('3023b',x,45,z+2*j,'hull',90),P('2412b',x,46,z+2*j,'seam',90));}
 }
}
section('Hull access plates and machinery seams',greeble);
section('Ventral docking bay',[
 box({at:[-6,25,-6],size:[12,7,14],colour:'seam',open:['front','top'],texture:'grille'}),...[-6,5].flatMap(x=>range(6).map(i=>P('3005',x,25,-5+i*2))),floor({at:[-5,29,-5],size:[10,12],layers:3,colour:'space'}),...[-4,3].flatMap(x=>[-4,5].map(z=>P('6141',x,28,z,'trans light blue')))
]);
section('The captured eleven-engine Tantive IV',[
 column({at:[-1,6,-10],diameter:2,height:8,colour:'trans-clear'}),box({at:[-2,14,-26],size:[4,9,22],colour:'white',top:'tile'}),box({at:[-4,16,-29],size:[8,5,5],colour:'white',top:'tile'}),...range(4).map(i=>P('15068',-4+2*i,21,-29,'white')),
 floor({at:[-1,23,-25],size:[2,15],colour:'dark red',top:'tile'}),floor({at:[-4,7,-5],size:[8,5],colour:'white'}),floor({at:[-4,13,-5],size:[8,5],colour:'white'}),floor({at:[-3,19,-5],size:[6,5],colour:'white'}),
 ...[-4,-2,0,2].flatMap(x=>[P('4868b',x,8,-5,'white',180),P('4868b',x,14,-5,'white',180)]),...[-3,-1,1].map(x=>P('4868b',x,20,-5,'white',180)),...[-3,2].flatMap(x=>[-23,-13].map(z=>P('11477',x,19,z,'dark red',x<0?90:270))),P('3004',-2,18,-29,'space'),P('3004',0,18,-29,'space')
]);
component('tie',{size:[8,6],ops:[box({at:[0,0,0],size:[1,15,6],colour:'space',texture:'grille'}),box({at:[7,0,0],size:[1,15,6],colour:'space',texture:'grille'}),floor({at:[0,15,0],size:[1,6],colour:'seam',top:'tile'}),floor({at:[7,15,0],size:[1,6],colour:'seam',top:'tile'}),floor({at:[0,5,2],size:[8,2],colour:'seam'}),P('3941',3,6,2,'seam'),P('44359',3,9,2),...[0,7].flatMap(x=>[column({at:[x,0,0],height:15,colour:'seam'}),column({at:[x,0,5],height:15,colour:'seam'})])]});
section('TIE patrol emerging below the destroyer',[column({at:[-26,6,6],height:10,diameter:2,colour:'trans-clear'}),instance({component:'tie',at:[-29,16,4]}),column({at:[27,6,24],height:6,diameter:2,colour:'trans-clear'}),instance({component:'tie',at:[24,12,22],turn:180})]);