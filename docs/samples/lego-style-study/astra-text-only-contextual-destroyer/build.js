script({title:'Devastator — The Capture of Tantive IV',description:'A panel-armoured Imperial dagger with continuous wedge chines, bevelled hull shoulders, a recessed capture hangar, seven exhausts, eight batteries and the captured blockade runner. Two TIE escorts fly on independent compact stands.',palette:{hull:'light bluish grey',shadow:'dark bluish grey'},defaults:{interior:'empty'}});
const CX=48;
function foot(x,z,w,d){return [box({at:[x,0,z],size:[w,2,d],colour:'black',top:'tile'}),box({at:[x+2,2,z+2],size:[w-4,2,d-4],colour:'black',top:'tile'})];}
section('Compact exhibition cradles',[...foot(39,27,18,14),box({at:[46,4,32],size:[4,17,4],colour:'black'}),box({at:[43,21,30],size:[10,3,8],colour:'black'}),...foot(33,73,30,18),box({at:[44,4,78],size:[8,17,6],colour:'black'}),box({at:[36,21,76],size:[24,3,10],colour:'black'})]);
const hull=[],edges=[],armour=[],trench=[];
for(let k=0;k<11;k++){
 const h=4+3*k,x=CX-h,z=16+8*k,sw=k===0?3:4;
 for(const y of [27,32])edges.push(place({part:'3544',at:[x-2,y,z],colour:'hull'}),place({part:'3545',at:[CX+h-1,y,z],colour:'hull'}));
 for(let r=0;r<4;r++){
  const zz=z+2*r;
  hull.push(box({at:[x,24,zz],size:[2*h,5,2],colour:'hull',interior:'solid'}),box({at:[x,29,zz],size:[2*h,4,2],colour:'shadow',interior:'solid'}),box({at:[x+1,33,zz],size:[2*h-2,2,2],colour:'hull',interior:'solid'}));
  for(const right of [false,true]){
   trench.push(place({part:'2877',at:[right?CX+h-1:x,29,zz],turn:90,colour:(k+r)%7===0?'light bluish grey':'dark bluish grey'}));
   edges.push(place({part:sw===3?'3298':'30363',at:[right?CX+h-sw-1:x+1,33,zz],turn:right?270:90,colour:'hull'}),place({part:'3660b',at:[right?CX+h-2:x,24,zz],turn:right?270:90,colour:'hull'}));
  }
  for(let px=x+sw+1;px<CX+h-sw-1;px+=2)for(let dz=0;dz<2;dz++){
   const pz=zz+dz,inside=pz>=58&&pz<98&&Math.abs(px+1-CX)<=Math.floor((pz-54)/3)+4;
   if(inside)continue;
   const detail=pz>35&&((px*3+pz*7)%43===0),c=(px+pz*3)%59===0?'dark bluish grey':'light bluish grey';
   armour.push(place({part:'3023b',at:[px,35,pz],colour:'hull'}),place({part:detail?'2412b':'3069b',at:[px,36,pz],colour:c}));
  }
 }
}
hull.push(box({at:[46,24,12],size:[4,9,4],colour:'hull',interior:'solid'}),box({at:[47,24,10],size:[2,9,2],colour:'hull',interior:'solid'}));
edges.push(place({part:'3039',at:[47,33,10],colour:'hull'}),place({part:'30363',at:[46,33,12],colour:'hull'}),place({part:'30363',at:[48,33,12],colour:'hull'}));
section('Interlocking triangular keel and hull',hull);section('Wedge chines and sloping armour shoulders',edges);section('Recessed machinery trench',trench);section('Laminated individual armour panels',armour);
section('Ventral capture hangar',[carve({at:[44,24,48],size:[8,8,16]}),floor({at:[44,32,48],size:[8,16],colour:'dark bluish grey'}),box({at:[43,24,48],size:[1,7,16],colour:'dark bluish grey',texture:'grille'}),box({at:[52,24,48],size:[1,7,16],colour:'dark bluish grey',texture:'grille'}),range(8).map(i=>place({part:'3023b',at:[44,31,48+2*i],turn:90,colour:'trans light blue'})),range(8).map(i=>place({part:'3023b',at:[51,31,48+2*i],turn:90,colour:'trans light blue'})),box({at:[45,24,64],size:[6,6,1],colour:'dark bluish grey',texture:'grille'})]);
const citadel=[];
for(let z=58;z<98;z+=2){const w=2*(4+Math.floor((z-54)/3)),x=CX-w/2;citadel.push(box({at:[x,35,z],size:[w,10,2],colour:'hull',top:'tile'}),place({part:'3039',at:[x,42,z],turn:90,colour:'hull'}),place({part:'3039',at:[x+w-2,42,z],turn:270,colour:'hull'}));}
citadel.push(box({at:[36,45,70],size:[24,6,26],colour:'hull',top:'tile'}),box({at:[39,51,78],size:[18,6,16],colour:'hull',top:'tile'}),box({at:[42,57,83],size:[12,3,10],colour:'shadow',top:'tile'}),box({at:[43,60,86],size:[10,12,8],colour:'hull',texture:'grille'}),box({at:[32,72,84],size:[32,3,10],colour:'hull',top:'tile'}),box({at:[34,75,84],size:[28,2,10],colour:'black',interior:'solid'}),box({at:[34,77,85],size:[28,3,8],colour:'hull'}),floor({at:[34,80,85],size:[28,8],layers:3,colour:'hull',top:'tile'}));
for(let z=70;z<96;z+=2)citadel.push(place({part:'3039',at:[36,48,z],turn:90,colour:'hull'}),place({part:'3039',at:[58,48,z],turn:270,colour:'hull'}));
for(let z=78;z<94;z+=2)citadel.push(place({part:'3039',at:[39,54,z],turn:90,colour:'hull'}),place({part:'3039',at:[55,54,z],turn:270,colour:'hull'}));
for(let x=43;x<53;x++)citadel.push(place({part:'4460b',at:[x,60,84],colour:'hull'}),place({part:'3040b',at:[x,69,85],colour:'hull'}));
for(let x=34;x<62;x+=2)citadel.push(place({part:'3039',at:[x,77,83],colour:'hull'}),place({part:'3039',at:[x,77,93],turn:180,colour:'hull'}));
for(let x=35;x<62;x+=4)citadel.push(box({at:[x,75,84],size:[1,2,1],colour:'hull',interior:'solid'}),box({at:[x,75,93],size:[1,2,1],colour:'hull',interior:'solid'}));
section('Chamfered command citadel and panoramic bridge',citadel);
function rail(x,y,z){return [place({part:'3023b',at:[x,y,z],turn:90,colour:'hull'}),place({part:'2412b',at:[x,y+1,z],turn:90,colour:'shadow'})];}
const service=[];
for(let z=72;z<96;z+=3)service.push(...rail(37,51,z),...rail(58,51,z));
for(let z=79;z<94;z+=3)service.push(...rail(40,57,z),...rail(55,57,z));
for(let x=38;x<58;x+=3)service.push(place({part:'54200',at:[x,51,70],colour:'hull'}));
for(let x=40;x<56;x+=3)service.push(place({part:'54200',at:[x,57,78],colour:'hull'}));
for(let i=0;i<8;i++){const z=85+i%4*2,x=i<4?45:49;service.push(place({part:'3022',at:[x,83,z],colour:'hull'}),place({part:'3068b',at:[x,84,z],colour:i%3?'light bluish grey':'dark bluish grey'}));}
for(const x of [37,53])service.push(place({part:'3941',at:[x+1,83,89],colour:'dark bluish grey'}),cylinder({at:[x,86,88],diameter:4,height:3,colour:'hull'}),place({part:'30208',at:[x,89,88],colour:'hull'}));
service.push(box({at:[47,83,85],size:[2,4,2],colour:'hull'}),place({part:'3957a',at:[47,87,85],colour:'light bluish grey'}));
section('Shield globes and communications machinery',service);
function battery(x,y,z){const ops=[place({part:'3022',at:[x,y,z],colour:'dark bluish grey'}),place({part:'3941',at:[x,y+1,z],colour:'light bluish grey'}),place({part:'4032b',at:[x,y+4,z],colour:'dark bluish grey'})];for(let dx=0;dx<2;dx++)ops.push(place({part:'3005',at:[x+dx,y+5,z],colour:'light bluish grey'}),place({part:'3710',at:[x+dx,y+8,z-3],turn:90,colour:'dark bluish grey'}),place({part:'2431',at:[x+dx,y+9,z-3],turn:90,colour:'light bluish grey'}));return ops;}
const guns=[];for(const x of [27,67])for(let k=0;k<4;k++){const z=80+5*k;guns.push(box({at:[x-1,37,z-1],size:[4,4,4],colour:'hull',top:'tile'}),...battery(x,41,z));}section('Eight heavy turbolaser batteries',guns);
function nozzle(x,y,z,w,h){const large=w===8,a=large?2:1,b=large?3:2,ops=[box({at:[x+a,y,z],size:[w-2*a,b,8],colour:'dark bluish grey',interior:'solid'}),box({at:[x+a,y+h-b,z],size:[w-2*a,b,8],colour:'light bluish grey',interior:'solid',top:'tile'}),box({at:[x,y+b,z],size:[a,h-2*b,8],colour:'light bluish grey',texture:'grille'}),box({at:[x+w-a,y+b,z],size:[a,h-2*b,8],colour:'light bluish grey',texture:'grille'}),box({at:[x+a,y+b,z+1],size:[w-2*a,h-2*b,1],colour:'black',interior:'solid'}),box({at:[x+a,y+b+1,z+2],size:[w-2*a,h-2*b-2,1],colour:'trans light blue',interior:'solid'})];
for(let q=0;q<8;q+=2){ops.push(place({part:'3023b',at:[x+a,y+h,z+q],colour:'dark bluish grey'}),place({part:'2412b',at:[x+a,y+h+1,z+q],colour:'dark bluish grey'}));if(large)ops.push(place({part:'3039',at:[x,y+h-b,z+q],turn:90,colour:'light bluish grey'}),place({part:'3039',at:[x+w-a,y+h-b,z+q],turn:270,colour:'light bluish grey'}),place({part:'3660b',at:[x,y,z+q],turn:90,colour:'dark bluish grey'}),place({part:'3660b',at:[x+w-a,y,z+q],turn:270,colour:'dark bluish grey'}));}return ops;}
const engines=[box({at:[11,27,102],size:[74,12,2],colour:'dark bluish grey',texture:'grille',top:'tile'})];for(const x of [24,44,64])engines.push(...nozzle(x,20,104,8,21));for(const x of [16,36,56,76])engines.push(...nozzle(x,35,104,4,9));section('Three main drives and four auxiliary exhausts',engines);
const runner=[box({at:[4,0,3],size:[2,3,15],colour:'white',interior:'solid',top:'tile'}),box({at:[3,3,7],size:[4,3,8],colour:'white',interior:'solid',top:'tile'}),box({at:[0,0,1],size:[10,3,3],colour:'white',interior:'solid'}),range(5).map(i=>place({part:'3039',at:[2*i,3,1],colour:'white'})),floor({at:[3,6,9],size:[4,3],colour:'dark red',top:'tile'}),place({part:'3068b',at:[4,3,4],colour:'black'}),box({at:[0,0,17],size:[10,9,2],colour:'white',interior:'solid'}),range(3).map(i=>place({part:'2412b',at:[3,6,12+i],colour:'light bluish grey'}))];
for(let row=0;row<3;row++)for(const x of row===1?[2,5,8]:[0,3,6,9])runner.push(box({at:[x,3*row,19],size:[1,3,3],colour:'white',interior:'solid'}),place({part:'11477',at:[x,3*row+3,19],turn:180,colour:'white'}),place({part:'3024',at:[x,3*row+3,21],colour:'trans light blue'}));
component('Tantive IV',{size:[10,22],ops:runner});
section('Captured blockade runner',[...foot(42,52,12,12),column({at:[47,4,56],height:7,diameter:2,colour:'trans-clear'}),instance({component:'Tantive IV',at:[43,11,43]})]);
const tie=[box({at:[1,5,2],size:[6,2,2],colour:'light bluish grey',interior:'solid'}),place({part:'20953',at:[3,4,2],colour:'light bluish grey'}),place({part:'3022',at:[3,9,2],colour:'light bluish grey'}),floor({at:[1,10,2],size:[6,2],colour:'light bluish grey',top:'tile'}),place({part:'3070b',at:[3,11,2],colour:'black'})];
for(const x of [0,7])tie.push(box({at:[x,3,0],size:[1,6,6],colour:'black',interior:'solid'}),box({at:[x,0,2],size:[1,12,2],colour:'black',interior:'solid',top:'tile'}),place({part:'3665a',at:[x,0,0],colour:'black'}),place({part:'3665a',at:[x,0,4],turn:180,colour:'black'}),place({part:'3040b',at:[x,9,0],colour:'black'}),place({part:'3040b',at:[x,9,4],turn:180,colour:'black'}),box({at:[x,3,0],size:[1,6,1],colour:'dark bluish grey',interior:'solid'}),box({at:[x,3,5],size:[1,6,1],colour:'dark bluish grey',interior:'solid'}));
component('TIE escort',{size:[8,6],ops:tie});
section('Pursuit patrol',[...foot(14,27,10,10),column({at:[18,4,31],height:12,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[15,12,29]}),...foot(76,48,10,10),column({at:[80,4,52],height:15,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[77,15,50]})]);