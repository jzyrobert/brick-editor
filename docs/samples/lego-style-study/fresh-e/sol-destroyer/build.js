script({title:'Imperial Star Destroyer — Tractor Beam Interception',description:'A broad dagger hull with a recessed machinery belt, three tapering command decks, twin shield spheres and seven recessed ion engines. A removable miniature blockade runner waits beneath the illuminated ventral docking bay. Two compact black cradles support the destroyer.',palette:{hull:'light bluish grey',machinery:'dark bluish grey',shadow:'black',ion:'trans light blue'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
const wing=(x,y,z,left)=>P(left?'3544':'3545',x,y,z);
const bands=16,run=8,half=i=>2+3*i;
section('Compact display cradles',[
 floor({at:[-8,0,15],size:[16,14],layers:2,colour:'black',top:'tile'}),box({at:[-3,2,19],size:[6,22,6],colour:'black',interior:'solid'}),
 floor({at:[-13,0,92],size:[26,18],layers:2,colour:'black',top:'tile'}),box({at:[-4,2,97],size:[8,22,8],colour:'black',interior:'solid'})
]);
const structure=[],armour=[],belt=[];
for(let i=0;i<bands;i++){
 const h=half(i),z=i*run,w=2*h;
 const open=i===0?['back']:i===bands-1?['front']:['front','back'];
 structure.push(floor({at:[-h,23,z],size:[w,run],layers:3,colour:'hull'}),box({at:[-h,26,z],size:[w,10,run],colour:'machinery',open,supports:8}));
 for(let y=24;y<26;y++)armour.push(wing(-h-2,y,z,true),wing(h-1,y,z,false));
 armour.push(wing(-h-2,39,z,true),wing(h-1,39,z,false),floor({at:[-h,36,z],size:[w,run],layers:4,colour:'hull',top:'tile'}));
 if(w>=20){
  for(let j=0;j<4;j++)armour.push(P('42918',-h,40,z+2*j,'hull',90),P('42918',h-8,40,z+2*j,'hull',270));
  armour.push(floor({at:[-h+8,40,z],size:[w-16,run],layers:3,colour:'hull',top:'tile'}));
 }
 for(let j=0;j<4;j++){
  armour.push(P('3069b',-h,40,z+2*j,'hull',90),P('3069b',h-1,40,z+2*j,'hull',90));
  for(const side of [-1,1]){
   const x=side<0?-h:h-1,t=side<0?90:270;
   belt.push(P('2877',x,26,z+2*j,'machinery',t),P(j%2?'3004':'2877',x,29,z+2*j,j%2?'hull':'machinery',t));
  }
 }
}
section('Connected triangular hull frame',structure);
section('Dagger armour and curved deck shoulders',armour);
section('Recessed equatorial machinery trench',belt);
function terrace(z0,n,h0,y){
 const a=[];
 for(let i=0;i<n;i++){
  const h=h0+3*i,z=z0+8*i,w=2*h;
  a.push(box({at:[-h,y,z],size:[w,6,8],colour:'hull',top:'tile'}));
  for(let k=0;k<6;k++)a.push(wing(-h-2,y+k,z,true),wing(h-1,y+k,z,false));
  for(let j=0;j<4;j++)a.push(P('3069b',-h,y+6,z+2*j,'hull',90),P('3069b',h-1,y+6,z+2*j,'hull',90));
  if(w>=10){
   for(let j=0;j<4;j++)a.push(P('30363',-h,y+6,z+2*j,'hull',90),P('30363',h-4,y+6,z+2*j,'hull',270));
   a.push(floor({at:[-h+4,y+6,z],size:[w-8,8],layers:3,colour:'hull',top:'tile'}));
  }
  for(const s of [-1,1])for(let j=0;j<4;j++)a.push(P('2877',s<0?-h:h-1,y+2,z+2*j,'machinery',s<0?90:270));
 }
 return a;
}
section('Three tapering command terraces',[
 terrace(64,7,3,43),terrace(80,5,2,52),terrace(96,3,1,61),
 box({at:[-3,43,30],size:[6,3,28],colour:'hull',top:'tile'}),
 ...range(3).map(i=>P('30363',-3+2*i,46,30)),
 ...range(8).map(i=>P('2412b',-1,46,36+2*i,'machinery'))
]);
function turret(cx,z){
 return [floor({at:[cx-2,43,z],size:[4,4],colour:'machinery'}),P('3960',cx-2,44,z),box({at:[cx-2,46,z+1],size:[4,3,3],colour:'machinery',interior:'solid'}),...range(4).map(j=>P('30359b',cx-2+j,49,z-5))];
}
section('Eight heavy turbolaser batteries',[-1,1].map(s=>[76,88,100,112].map((z,i)=>turret(s*[17,21,26,30][i],z))));
function machinery(x,y,z,turn=0){
 return group({at:[x,y,z],turn,ops:[P('3032',0,0,0),P('3004',0,1,0,'machinery'),P('3004',4,1,0,'machinery'),P('2412b',0,4,0,'machinery'),P('2412b',4,4,0,'machinery'),P('3020',1,1,2),P('15068',1,2,2),P('15068',3,2,2),P('6141',2,5,3,'machinery'),P('98138',2,6,3,'hull'),P('3069b',2,1,0,'machinery'),P('3070b',0,1,2),P('3070b',5,1,2)]});
}
const detail=[];
for(const s of [-1,1]){
 for(const [z,x] of [[52,7],[64,12],[84,26],[100,34],[116,39]])detail.push(machinery(s<0?-x-6:x,43,z,s<0?0:180));
 for(let j=0;j<6;j++)detail.push(P('2412b',s<0?-29:27,43,94+4*j,'machinery',90));
 for(let j=0;j<6;j++)detail.push(P('2431',s<0?-33:29,43,112+2*j));
}
for(let z=16;z<56;z+=8)detail.push(P('3068b',-2,40,z,'machinery'),P('3068b',0,40,z));
section('Concentrated surface engineering',detail);
const bridge=[
 box({at:[-5,66,109],size:[10,18,9],colour:'hull',texture:'grille'}),
 box({at:[-18,84,104],size:[36,12,14],colour:'hull',top:'tile'}),
 box({at:[-16,84,102],size:[32,8,2],colour:'hull'}),
 wall({from:[-15,102],to:[14,102],y:89,height:2,colour:'black'}),
 floor({at:[-16,91,102],size:[32,2],colour:'hull'}),
 floor({at:[-16,95,104],size:[32,12],colour:'hull',top:'tile'})
];
for(let x=-16;x<16;x+=2)bridge.push(P('30363',x,92,100,'hull',180),P('3660b',x,81,102));
for(let x=-15;x<15;x+=3)bridge.push(P('3024',x,89,102));
for(const cx of [-11,10])bridge.push(column({at:[cx-1,96,109],height:3,diameter:2,colour:'hull'}),P('30342',cx-2,99,108),P('30208',cx-2,105,108));
bridge.push(box({at:[-2,96,109],size:[4,6,5],colour:'machinery',top:'tile'}),P('3957a',-1,102,111),P('3957a',1,102,111),P('2431',-2,102,109),P('2431',-2,102,113));
for(const s of [-1,1])for(let j=0;j<4;j++)bridge.push(P('2877',s<0?-18:17,87,106+2*j,'machinery',s<0?90:270));
section('T shaped bridge and paired shield generators',bridge);
const engines=[box({at:[-46,24,125],size:[92,12,3],colour:'machinery',texture:'grille',open:['front']})];
function ionBell(cx){
 const a=[],widths=[4,8,10,12,12,12,12,10,8,4];
 for(let k=0;k<widths.length;k++){
  const w=widths[k],x=cx-Math.round(w/2),y=15+3*k;
  if(k===0||k===9)a.push(box({at:[x,y,126],size:[w,3,13],colour:'hull',interior:'solid'}));
  else{
   a.push(box({at:[x,y,126],size:[2,3,13],colour:'hull',interior:'solid'}),box({at:[x+w-2,y,126],size:[2,3,13],colour:'hull',interior:'solid'}),box({at:[x+2,y,133],size:[w-4,3,2],colour:'shadow',interior:'solid'}));
   a.push(box({at:[x+2,y,135],size:[w-4,3,1],colour:'ion',interior:'solid'}));
  }
 }
 a.push(P('3034',cx-4,41,129));
 for(let j=0;j<4;j++)a.push(P('15068',cx-4+2*j,42,129));
 return a;
}
engines.push(...[-25,0,25].map(ionBell));
for(const x of [-40,-15,11,36])engines.push(P('30360',x,28,128),box({at:[x,28,134],size:[4,10,1],colour:'machinery',interior:'solid'}),box({at:[x+1,30,135],size:[2,6,1],colour:'ion',interior:'solid'}));
for(let x=-43;x<43;x+=4)engines.push(P('2412b',x,36,126,'machinery'));
section('Three large and four auxiliary ion engines',engines);
section('Ventral docking well',[
 carve({at:[-8,23,33],size:[16,12,28]}),
 floor({at:[-10,23,31],size:[20,32],colour:'hull',holes:[{at:[-8,33],size:[16,28]}]}),
 floor({at:[-8,35,33],size:[16,28],colour:'black'}),
 box({at:[-4,18,7],size:[8,6,23],colour:'hull',top:'tile'}),
 ...[-8,7].map(x=>[35,57].map(z=>column({at:[x,24,z],height:11,colour:'machinery'}))),
 ...[-7,5].map(x=>range(6).map(i=>P('3004',x,32,34+i*4,'trans light blue')))
]);
const corvette=[
 floor({at:[-2,0,48],size:[4,4],colour:'black',top:'tile'}),column({at:[0,1,50],height:13,colour:'trans-clear'}),
 box({at:[-1,14,40],size:[2,5,18],colour:'white',interior:'solid',top:'tile'}),
 box({at:[-3,14,38],size:[6,4,4],colour:'white',interior:'solid'}),
 P('15068',-3,18,38,'white'),P('15068',-1,18,38,'white'),P('15068',1,18,38,'white'),
 P('3004',-1,18,42,'dark red'),P('3069b',-1,21,42,'dark red'),P('3069b',-1,19,44,'dark red'),
 floor({at:[-4,19,55],size:[8,3],colour:'white'}),
 ...[-4,-2,0,2].map(x=>P('4868b',x,13,56,'white')),
 ...[-3,-1,1].map(x=>P('4868b',x,20,56,'white'))
];
section('Removable captured blockade runner',corvette);