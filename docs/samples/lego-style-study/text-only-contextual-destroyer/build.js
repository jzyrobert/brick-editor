script({title:'Devastator — The Capture of Tantive IV',description:'An Imperial dagger above its captured blockade runner, with two pursuing TIE escorts. Connected ventral armour, diagonal wedge edges, chamfered command decks, twin faceted shield globes, eight turbolasers and seven recessed blue exhausts; each vessel has a compact independent cradle.',palette:{hull:'light bluish grey',shadow:'dark bluish grey'},defaults:{interior:'empty'}});
const CX=48,Z0=12,BANDS=15;
const occupied=(x,z)=>{if(z<58||z>=98)return false;const a=4+Math.floor((z-z%2-54)/3);return x+2>CX-a&&x<CX+a;};
const bay=(x,z)=>x>=44&&x<52&&z>=48&&z<64;
function foot(x,z,w,d){return floor({at:[x,0,z],size:[w,d],layers:2,colour:'black',top:'tile'});}
section('Compact connected display cradles',[
foot(40,70,16,14),box({at:[46,2,74],size:[4,19,6],colour:'black'}),box({at:[40,21,72],size:[16,3,10],colour:'black'}),
foot(43,28,10,10),box({at:[47,2,32],size:[2,22,4],colour:'black'}),
foot(44,54,8,8),column({at:[47,2,56],height:9,diameter:2,colour:'trans-clear'}),
foot(14,28,10,8),column({at:[18,2,31],height:12,diameter:1,colour:'trans-clear'}),
foot(76,49,10,8),column({at:[80,2,52],height:15,diameter:1,colour:'trans-clear'})]);
const hull=[],belly=[],armour=[],trenches=[];
for(let k=0;k<BANDS;k++){
 const z=Z0+6*k,h=4+2*k,x=CX-h,w=2*h;
 hull.push(box({at:[x+2,25,z],size:[w-4,8,6],colour:'hull',interior:'solid'}));
 for(let dz=0;dz<6;dz++)for(let j=2;j<w-2;j+=2)if(!bay(x+j,z+dz))belly.push(place({part:'3023b',at:[x+j,24,z+dz],colour:'hull'}));
 hull.push(floor({at:[x,23,z+5],size:[w,1],colour:'hull'}));
 for(const side of [0,1]){
  const px=side?CX+h-2:x;
  hull.push(place({part:side?'41764':'41765',at:[px,24,z],colour:'hull'}));
  trenches.push(place({part:side?'41747':'41748',at:[px,27,z],colour:'shadow'}));
  hull.push(place({part:side?'41747':'41748',at:[px,30,z],colour:'hull'}));
 }
 const edge=Math.min(4,h-2),inner=w-4-2*edge;
 for(let dz=0;dz<6;dz+=2){
  const part=edge===4?'30363':edge===2?'3039':'3298';
  hull.push(place({part,at:[x+2,33,z+dz],turn:90,colour:'hull'}),place({part,at:[CX+h-2-edge,33,z+dz],turn:270,colour:'hull'}));
 }
 if(inner>0){
  hull.push(box({at:[x+2+edge,33,z],size:[inner,3,6],colour:'hull',interior:'solid'}));
  for(let dz=0;dz<6;dz++)for(let j=0;j<inner;j+=2){
   const px=x+2+edge+j,zz=z+dz;
   if(occupied(px,zz))continue;
   const seam=(k*7+j+dz)%29===0;
   armour.push(place({part:seam?'2412b':'3069b',at:[px,36,zz],colour:seam?'shadow':'hull'}));
   if(k>5&&dz===2&&j>3&&j<inner-4&&(k+j)%13===0){
    armour.pop();armour.push(place({part:'3023b',at:[px,36,zz],colour:'hull'}),place({part:'2412b',at:[px,37,zz],colour:'shadow'}));
   }
  }
 }
}
hull.push(box({at:[47,24,10],size:[2,9,2],colour:'hull',interior:'solid'}),place({part:'3039',at:[47,33,10],colour:'hull'}));
section('Connected triangular hull skeleton and chamfered wedge perimeter',hull);
section('Continuous connected ventral plate armour',belly);
section('Inset dark lateral machinery trench',trenches);
section('Selective smooth dorsal armour panels',armour);
section('Recessed ventral capture bay',[
carve({at:[44,23,48],size:[8,9,16]}),floor({at:[44,32,48],size:[8,16],colour:'shadow'}),
box({at:[43,24,48],size:[1,7,16],colour:'shadow',texture:'grille'}),box({at:[52,24,48],size:[1,7,16],colour:'shadow',texture:'grille'}),
range(8).map(i=>place({part:'3023b',at:[44,31,48+2*i],turn:90,colour:'trans light blue'})),range(8).map(i=>place({part:'3023b',at:[51,31,48+2*i],turn:90,colour:'trans light blue'})),box({at:[45,24,64],size:[6,6,1],colour:'shadow',texture:'grille'})]);
const citadel=[];
for(let z=58;z<98;z+=2){const w=2*(4+Math.floor((z-54)/3));citadel.push(box({at:[CX-w/2,36,z],size:[w,9,2],colour:'hull',interior:'solid',top:'tile'}));}
function deck(x,y,z,w,h,d){return box({at:[x,y,z],size:[w,h,d],colour:'hull',top:'tile'});}
citadel.push(deck(36,45,70,24,6,26),deck(39,51,78,18,6,16),box({at:[42,57,83],size:[12,3,10],colour:'shadow',top:'tile'}),box({at:[43,60,86],size:[10,12,8],colour:'hull',texture:'grille'}),deck(32,72,84,32,3,10),deck(34,75,85,28,3,9),deck(36,78,86,24,3,8),floor({at:[34,81,85],size:[28,9],layers:2,colour:'hull',top:'tile'}),box({at:[35,76,84],size:[26,2,1],colour:'black',interior:'solid',top:'tile'}));
function bevel(x,z,w,d,y){const ops=[];for(let zz=z;zz<z+d;zz+=2)ops.push(place({part:'3039',at:[x,y,zz],turn:90,colour:'hull'}),place({part:'3039',at:[x+w-2,y,zz],turn:270,colour:'hull'}));for(let xx=x+2;xx<x+w-2;xx+=2)ops.push(place({part:'3039',at:[xx,y,z],colour:'hull'}),place({part:'3039',at:[xx,y,z+d-2],turn:180,colour:'hull'}));return ops;}
citadel.push(...bevel(36,70,24,26,48),...bevel(39,78,18,16,54));
for(let z=58;z<94;z+=6){const a=4+Math.floor((z+4-54)/3);citadel.push(place({part:'41748',at:[CX-a,42,z],colour:'hull'}),place({part:'41747',at:[CX+a-2,42,z],colour:'hull'}));}
for(let x=43;x<53;x++)citadel.push(place({part:'4460b',at:[x,60,84],colour:'hull'}),place({part:'3040b',at:[x,69,85],colour:'hull'}));
for(let x=34;x<62;x+=2)citadel.push(place({part:'3039',at:[x,75,83],colour:'hull'}));
for(let x=36;x<60;x+=2)citadel.push(place({part:'3039',at:[x,78,93],turn:180,colour:'hull'}));
for(let z=86;z<94;z+=2)citadel.push(place({part:'3039',at:[32,73,z],turn:90,colour:'hull'}),place({part:'3039',at:[62,73,z],turn:270,colour:'hull'}));
section('Chamfered command citadel and finished bridge',citadel);
function railingDetail(x,y,z,turn){return [place({part:'3023b',at:[x,y,z],turn,colour:'hull'}),place({part:'2412b',at:[x,y+1,z],turn,colour:'shadow'})];}
const service=[];
for(let z=72;z<94;z+=3)service.push(...railingDetail(37,51,z,90),...railingDetail(58,51,z,90));
for(let z=80;z<92;z+=3)service.push(...railingDetail(40,57,z,90),...railingDetail(55,57,z,90));
for(let i=0;i<8;i++){const z=86+i%4*2,x=i<4?45:49;service.push(place({part:'3022',at:[x,83,z],colour:'hull'}),place({part:'3068b',at:[x,84,z],colour:i%3?'hull':'shadow'}));}
for(const x of [38,53])service.push(place({part:'3941',at:[x+1,83,89],colour:'shadow'}),cylinder({at:[x,86,88],diameter:4,height:3,colour:'hull'}),place({part:'30208',at:[x,89,88],colour:'hull'}));
service.push(box({at:[47,83,85],size:[2,4,2],colour:'hull'}),place({part:'3957a',at:[47,87,85],colour:'hull'}));
section('Twin faceted shield globes and bridge equipment',service);
function battery(x,y,z){const ops=[place({part:'3022',at:[x,y,z],colour:'shadow'}),place({part:'3941',at:[x,y+1,z],colour:'hull'}),place({part:'4032b',at:[x,y+4,z],colour:'shadow'})];for(let dx=0;dx<2;dx++)ops.push(place({part:'3005',at:[x+dx,y+5,z],colour:'hull'}),place({part:'3710',at:[x+dx,y+8,z-3],turn:90,colour:'shadow'}),place({part:'3070b',at:[x+dx,y+9,z-3],colour:'hull'}));return ops;}
const guns=[];for(const x of [27,67])for(let k=0;k<4;k++){const z=80+5*k;guns.push(box({at:[x-1,33,z-1],size:[4,8,4],colour:'hull',top:'tile'}),...battery(x,41,z));}
section('Eight paired heavy turbolaser batteries',guns);
function nozzle(x,y,z,w,h){const large=w===8,a=large?2:1,b=large?3:2,ops=[];
ops.push(box({at:[x+a,y,z],size:[w-2*a,b,8],colour:'shadow',interior:'solid',top:'tile'}),box({at:[x+a,y+h-b,z],size:[w-2*a,b,8],colour:'hull',interior:'solid',top:'tile'}),box({at:[x,y+b,z],size:[a,h-2*b,8],colour:'hull',texture:'grille'}),box({at:[x+w-a,y+b,z],size:[a,h-2*b,8],colour:'hull',texture:'grille'}),box({at:[x+a,y+b,z+1],size:[w-2*a,h-2*b,1],colour:'black',interior:'solid'}),box({at:[x+a,y+b+1,z+2],size:[w-2*a,h-2*b-2,1],colour:'trans light blue',interior:'solid'}));
for(let q=0;q<8;q+=2){if(large)ops.push(place({part:'3039',at:[x,y+h-b,z+q],turn:90,colour:'hull'}),place({part:'3039',at:[x+w-a,y+h-b,z+q],turn:270,colour:'hull'}),place({part:'3660b',at:[x,y,z+q],turn:90,colour:'shadow'}),place({part:'3660b',at:[x+w-a,y,z+q],turn:270,colour:'shadow'}));else ops.push(place({part:'11477',at:[x,y+h-3,z+q],turn:90,colour:'hull'}),place({part:'11477',at:[x+w-1,y+h-3,z+q],turn:270,colour:'hull'}));}return ops;}
const engines=[box({at:[15,27,102],size:[66,12,2],colour:'shadow',texture:'grille'})];for(const x of [24,44,64])engines.push(...nozzle(x,20,104,8,21));for(const x of [16,36,56,76])engines.push(...nozzle(x,35,104,4,9));
section('Three main drives and four auxiliary blue exhausts',engines);
component('Tantive IV',{size:[10,22],ops:[box({at:[4,0,3],size:[2,3,15],colour:'white',interior:'solid',top:'tile'}),box({at:[3,3,7],size:[4,3,8],colour:'white',interior:'solid',top:'tile'}),box({at:[0,0,1],size:[10,3,3],colour:'white',interior:'solid',top:'tile'}),range(5).map(i=>place({part:'3039',at:[2*i,3,1],colour:'white'})),floor({at:[3,6,9],size:[4,3],colour:'dark red',top:'tile'}),place({part:'3068b',at:[4,3,4],colour:'black'}),box({at:[0,0,17],size:[10,2,3],colour:'white',interior:'solid',top:'tile'}),range(5).map(i=>box({at:[2*i,2,17],size:[1,3,4],colour:'white',interior:'solid',top:'tile'})),range(5).map(i=>box({at:[2*i,2,21],size:[1,2,1],colour:'trans light blue',interior:'solid',top:'tile'})),range(3).map(i=>place({part:'2412b',at:[3,6,12+i],colour:'hull'}))]});
section('Captured blockade runner',[instance({component:'Tantive IV',at:[43,11,43]})]);
component('TIE escort',{size:[8,6],ops:[box({at:[0,0,0],size:[1,12,6],colour:'black',interior:'solid',top:'tile'}),box({at:[7,0,0],size:[1,12,6],colour:'black',interior:'solid',top:'tile'}),box({at:[1,5,2],size:[6,2,2],colour:'hull',interior:'solid'}),place({part:'20953',at:[3,4,2],colour:'hull'}),place({part:'3022',at:[3,9,2],colour:'hull'}),floor({at:[0,10,2],size:[8,2],colour:'hull',top:'tile'}),place({part:'3070b',at:[3,11,2],colour:'black'}),range(2).map(i=>floor({at:[i*7,12,0],size:[1,6],colour:'shadow',top:'tile'}))]});
section('Pursuit patrol',[instance({component:'TIE escort',at:[15,10,29]}),instance({component:'TIE escort',at:[77,13,50]})]);