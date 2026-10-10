script({title:'Devastator — The Capture of Tantive IV',description:'The accepted capture scene rebuilt with a true wedge perimeter, shallow sloped armour, compact independent flight cradles, chamfered command decks and seven bevelled blue exhausts. Tantive IV remains suspended beneath the illuminated ventral hangar, with two TIE escorts.',palette:{hull:'light bluish grey',shadow:'dark bluish grey'},defaults:{interior:'empty'}});
const CX=48,Z0=12,BANDS=11;
section('Compact flight cradles',[
floor({at:[40,0,72],size:[16,14],layers:3,colour:'black',top:'tile'}),box({at:[44,3,75],size:[8,18,8],colour:'black'}),box({at:[40,21,73],size:[16,3,12],colour:'black'}),
floor({at:[42,0,28],size:[12,10],layers:3,colour:'black',top:'tile'}),box({at:[46,3,31],size:[4,21,4],colour:'black'}),
floor({at:[44,0,54],size:[8,8],layers:2,colour:'black',top:'tile'}),column({at:[47,2,56],height:7,diameter:2,colour:'trans-clear'})]);
const occupied=(x,z,w=1)=>z>=58&&z<100&&x<48+4+Math.floor((z-54)/3)&&x+w>48-4-Math.floor((z-54)/3);
const core=[],skin=[],rim=[],under=[];
for(let b=0;b<BANDS;b++){
 const z=Z0+8*b,h=2+3*b,x=CX-h,n=Math.floor((h-2)/6),rem=(h-2)%6,peak=34+3*n,transition=b>0&&b%2===0;
 core.push(box({at:[x,24,z],size:[2*h,5,8],colour:'hull',interior:'solid'}),box({at:[x,29,z],size:[2*h,3,8],colour:'shadow',interior:'solid'}),box({at:[x,32,z],size:[2*h,2,8],colour:'hull',interior:'solid'}));
 for(const right of [false,true]){
  const ex=right?CX+h:x-3,wing=right?'3545':'3544';
  for(let y=24;y<34;y++)rim.push(place({part:wing,at:[ex,y,z],colour:y>=29&&y<32?'dark bluish grey':'light bluish grey'}));
  if(rem)core.push(box({at:[right?CX+h-rem:x,34,z],size:[rem,1,8],colour:'hull',interior:'solid',top:'tile'}));
  for(let k=0;k<n;k++){
   const px=right?CX+h-rem-6*(k+1):x+rem+6*k,sy=34+3*k;
   core.push(box({at:[px,34,z],size:[6,Math.max(1,sy-34),8],colour:'hull',interior:'solid',top:'tile'}));
   for(let dz=0;dz<8;dz++)if(!occupied(px,z+dz,6))skin.push(place({part:'4569',at:[px,sy,z+dz],colour:'light bluish grey',turn:right?270:90}));
  }
 }
 core.push(box({at:[46,34,z],size:[4,Math.max(1,peak-34),8],colour:'hull',interior:'solid',top:'tile'}));
 if(transition&&!occupied(46,z,4))for(const px of [46,48])skin.push(place({part:'30363',at:[px,peak-3,z],colour:'hull'}));
 for(let dz=0;dz<8;dz++)if(!occupied(46,z+dz,4)&&!(transition&&dz<4))skin.push(place({part:'2431',at:[46,peak,z+dz],colour:(b===4&&dz===5)?'dark bluish grey':'light bluish grey'}));
 for(let dz=0;dz<8;dz+=2)for(const right of [false,true]){
  const tx=right?CX+h-1:x;
  rim.push(place({part:'2877',at:[tx,29,z+dz],turn:90,colour:'dark bluish grey'}),place({part:'2412b',at:[right?CX+h-2:x,33,z+dz],turn:90,colour:'dark bluish grey'}));
 }
 for(let ux=x;ux<x+2*h;ux+=4)for(let dz=0;dz<8;dz++)if(!(ux<52&&ux+4>44&&z+dz>=48&&z+dz<64))under.push(place({part:'3710',at:[ux,23,z+dz],colour:dz===3&&b%3===0?'dark bluish grey':'light bluish grey'}));
}
core.push(box({at:[47,24,10],size:[2,10,2],colour:'hull',interior:'solid'}),place({part:'3039',at:[47,34,10],colour:'hull'}));
section('Connected dagger chassis',core);section('Shallow port and starboard armour planes',skin);section('Continuous wedge edges and recessed trenches',rim);section('Connected ventral armour plates',under);
section('Ventral capture bay',[
carve({at:[44,24,48],size:[8,8,16]}),floor({at:[44,32,48],size:[8,16],colour:'dark bluish grey',top:'tile'}),box({at:[43,24,48],size:[1,7,16],colour:'dark bluish grey',texture:'grille'}),box({at:[52,24,48],size:[1,7,16],colour:'dark bluish grey',texture:'grille'}),range(8).map(i=>place({part:'3023b',at:[44,31,48+2*i],turn:90,colour:'trans light blue'})),range(8).map(i=>place({part:'3023b',at:[51,31,48+2*i],turn:90,colour:'trans light blue'})),box({at:[45,24,64],size:[6,6,1],colour:'dark bluish grey',texture:'grille'})]);
const citadel=[];
for(let z=58;z<100;z+=2){const w=2*(4+Math.floor((z-54)/3));citadel.push(box({at:[CX-w/2,38,z],size:[w,13,2],colour:'hull',top:'tile'}));for(let dz=0;dz<2;dz++)citadel.push(place({part:'4460b',at:[CX-w/2,42,z+dz],turn:90,colour:'hull'}),place({part:'4460b',at:[CX+w/2-2,42,z+dz],turn:270,colour:'hull'}));}
for(let x=45;x<51;x++)citadel.push(place({part:'4460b',at:[x,42,58],colour:'hull'}));
citadel.push(box({at:[36,51,70],size:[24,6,26],colour:'hull',top:'tile'}),box({at:[39,57,78],size:[18,6,16],colour:'hull',top:'tile'}),box({at:[42,63,83],size:[12,3,10],colour:'shadow',top:'tile'}),box({at:[43,66,86],size:[10,12,8],colour:'hull',texture:'grille'}),box({at:[32,78,84],size:[32,3,10],colour:'hull',top:'tile'}),floor({at:[32,78,83],size:[32,11],colour:'hull'}),box({at:[34,81,85],size:[28,3,9],colour:'hull',top:'tile'}),box({at:[36,84,86],size:[24,3,8],colour:'hull',top:'tile'}),floor({at:[34,87,85],size:[28,9],layers:2,colour:'hull',top:'tile'}),box({at:[35,79,83],size:[26,2,1],colour:'black',interior:'solid'}));
for(let z=70;z<96;z+=2)citadel.push(place({part:'3039',at:[36,54,z],turn:90,colour:'hull'}),place({part:'3039',at:[58,54,z],turn:270,colour:'hull'}));
for(let z=78;z<94;z+=2)citadel.push(place({part:'3039',at:[39,60,z],turn:90,colour:'hull'}),place({part:'3039',at:[55,60,z],turn:270,colour:'hull'}));
for(let x=38;x<58;x+=2)citadel.push(place({part:'3298',at:[x,54,69],colour:'hull'}));
for(let x=41;x<55;x+=2)citadel.push(place({part:'3298',at:[x,60,77],colour:'hull'}));
for(let x=43;x<53;x++)citadel.push(place({part:'4460b',at:[x,66,84],colour:'hull'}),place({part:'3040b',at:[x,75,85],colour:'hull'}));
for(let x=34;x<62;x+=2)citadel.push(place({part:'3039',at:[x,81,83],colour:'hull'}));
for(let x=36;x<60;x+=2)citadel.push(place({part:'3039',at:[x,84,93],turn:180,colour:'hull'}));
section('Chamfered command citadel',citadel);
function railingDetail(x,y,z,turn){return[place({part:'3023b',at:[x,y,z],turn,colour:'hull'}),place({part:'2412b',at:[x,y+1,z],turn,colour:'shadow'})];}
const service=[];
for(let z=72;z<96;z+=3)service.push(...railingDetail(38,57,z,90),...railingDetail(57,57,z,90));
for(let z=79;z<94;z+=3)service.push(...railingDetail(41,63,z,90),...railingDetail(54,63,z,90));
for(let i=0;i<8;i++){const z=86+i%4*2,x=i<4?45:49;service.push(place({part:'3022',at:[x,89,z],colour:'hull'}),place({part:'3068b',at:[x,90,z],colour:i%3?'light bluish grey':'dark bluish grey'}));}
for(const x of [38,53])service.push(place({part:'3941',at:[x+1,89,89],colour:'dark bluish grey'}),cylinder({at:[x,92,88],diameter:4,height:3,colour:'hull'}),place({part:'30208',at:[x,95,88],colour:'hull'}));
service.push(box({at:[47,89,85],size:[2,4,2],colour:'hull',top:'tile'}),place({part:'3957a',at:[47,93,85],colour:'light bluish grey'}));
for(let z=61;z<98;z+=4){const h=4+Math.floor((z-54)/3);for(const x of [CX-h+2,CX+h-4])service.push(place({part:'3020',at:[x,51,z],colour:'hull'}),place({part:'2412b',at:[x,52,z],colour:'shadow'}),place({part:'3069b',at:[x+2,52,z],colour:'hull'}),place({part:'3069b',at:[x,52,z+1],colour:'hull'}),place({part:'2412b',at:[x+2,52,z+1],colour:'shadow'}));}
section('Shield globes, bridge aerial and concentrated service equipment',service);
function battery(x,y,z){const ops=[place({part:'3022',at:[x,y,z],colour:'dark bluish grey'}),place({part:'3941',at:[x,y+1,z],colour:'light bluish grey'}),place({part:'4032b',at:[x,y+4,z],colour:'dark bluish grey'})];for(let dx=0;dx<2;dx++)ops.push(place({part:'3005',at:[x+dx,y+5,z],colour:'light bluish grey'}),place({part:'3710',at:[x+dx,y+8,z-3],turn:90,colour:'dark bluish grey'}),place({part:'3070b',at:[x+dx,y+9,z-3],colour:'light bluish grey'}));return ops;}
const guns=[];for(const x of [27,67])for(let k=0;k<4;k++){const z=80+5*k;guns.push(box({at:[x-1,34,z-1],size:[4,10,4],colour:'hull',top:'tile'}),...battery(x,44,z));}section('Eight heavy turbolaser batteries',guns);
function nozzle(x,y,z,w,h){const large=w===10,a=large?2:1,b=3,ops=[box({at:[x+a,y,z],size:[w-2*a,b,8],colour:'dark bluish grey',interior:'solid'}),box({at:[x+a,y+h-b,z],size:[w-2*a,b,8],colour:'light bluish grey',interior:'solid',top:'tile'}),box({at:[x,y+b,z],size:[a,h-2*b,8],colour:'light bluish grey',texture:'grille'}),box({at:[x+w-a,y+b,z],size:[a,h-2*b,8],colour:'light bluish grey',texture:'grille'}),box({at:[x+a,y+b,z+5],size:[w-2*a,h-2*b,1],colour:'black',interior:'solid'}),box({at:[x+a,y+b+1,z+6],size:[w-2*a,h-2*b-2,2],colour:'trans light blue',interior:'solid'})];for(let q=0;q<8;q+=2){if(large)ops.push(place({part:'3039',at:[x,y+h-b,z+q],turn:90,colour:'light bluish grey'}),place({part:'3039',at:[x+w-a,y+h-b,z+q],turn:270,colour:'light bluish grey'}),place({part:'3660b',at:[x,y,z+q],turn:90,colour:'dark bluish grey'}),place({part:'3660b',at:[x+w-a,y,z+q],turn:270,colour:'dark bluish grey'}));else ops.push(place({part:'3048b',at:[x,y+h-b,z+q],turn:90,colour:'light bluish grey'}),place({part:'3048b',at:[x+w-a,y+h-b,z+q],turn:270,colour:'light bluish grey'}));}return ops;}
const engines=[box({at:[13,27,100],size:[70,14,4],colour:'dark bluish grey',texture:'grille',top:'tile'})];for(const x of [22,43,64])engines.push(...nozzle(x,20,104,10,21));for(const x of [16,36,56,76])engines.push(...nozzle(x,36,104,4,9));section('Seven bevelled luminous exhausts',engines);
component('Tantive IV',{size:[10,22],ops:[box({at:[4,0,3],size:[2,3,15],colour:'white',interior:'solid',top:'tile'}),box({at:[3,3,7],size:[4,3,8],colour:'white',interior:'solid',top:'tile'}),box({at:[0,0,1],size:[10,3,3],colour:'white',interior:'solid'}),range(5).map(i=>place({part:'3039',at:[2*i,3,1],colour:'white'})),floor({at:[3,6,9],size:[4,3],colour:'dark red',top:'tile'}),place({part:'3068b',at:[4,3,4],colour:'black'}),box({at:[0,0,17],size:[10,2,3],colour:'white',interior:'solid',top:'tile'}),range(5).map(i=>box({at:[2*i,2,17],size:[1,3,4],colour:'white',interior:'solid',top:'tile'})),range(5).map(i=>box({at:[2*i,2,21],size:[1,2,1],colour:'trans light blue',interior:'solid'})),range(3).map(i=>place({part:'2412b',at:[3,6,12+i],colour:'light bluish grey'}))]});
section('Captured blockade runner',[instance({component:'Tantive IV',at:[43,9,43]})]);
component('TIE escort',{size:[8,6],ops:[box({at:[0,0,0],size:[1,12,6],colour:'black',interior:'solid'}),box({at:[7,0,0],size:[1,12,6],colour:'black',interior:'solid'}),box({at:[1,5,2],size:[6,2,2],colour:'light bluish grey',interior:'solid'}),place({part:'20953',at:[3,4,2],colour:'light bluish grey'}),place({part:'3022',at:[3,9,2],colour:'light bluish grey'}),floor({at:[0,10,2],size:[8,2],colour:'light bluish grey',top:'tile'}),place({part:'3070b',at:[3,11,2],colour:'black'}),range(2).map(i=>floor({at:[i*7,12,0],size:[1,6],colour:'dark bluish grey',top:'tile'}))]});
section('Pursuit patrol',[floor({at:[15,0,28],size:[8,8],layers:2,colour:'black',top:'tile'}),column({at:[17,2,31],height:15,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[15,12,29]}),floor({at:[77,0,49],size:[8,8],layers:2,colour:'black',top:'tile'}),column({at:[79,2,52],height:18,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[77,15,50]})]);