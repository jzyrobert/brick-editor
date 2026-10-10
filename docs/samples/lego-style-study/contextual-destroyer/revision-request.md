imperial star destroyer

This is a visual revision of an accepted draft, not a new concept contest.
The attached images show the draft from three-quarter, front and back.
Inspect the actual images before editing. Internally identify the three most
important visual defects, then revise the supplied source to address them.
Keep the subject recognizable and improve its existing concept. Judge its
silhouette, proportions, support footprint and surface construction in all
views. Remove unnecessary scenery slabs; keep compact supports only where
needed. Finish visible skin with coherent shaping parts and selective tiles;
retain purposeful texture and connection studs. A smooth staircase remains
a stepped silhouette, so improve the transitions rather than merely hiding
studs. Check the revised code for overlaps, colour availability and part count.
Do not add disconnected decorative parts just to approach the part target.
Reply through the same parts_search, check_build and brick.build protocols.

The supplied draft's concept is preferred. Preserve its meaningful components,
distinctive palette, overall arrangement, theme and interactions. Improve the
construction of that concept; do not substitute a new type of model or simplify
away its setting. Internally list the features that must survive before editing.
Support decisions are separate from composition: a meaningful environment may
use local plate-built patches, paths and foundations, with independent coherent
modules where appropriate. Remove or reshape only generic ground/support mass
that is unnecessary, preserving terrain/water/routes that establish the scene.
Finish smooth manufactured surfaces while retaining intended natural texture.


Accepted draft source:
```js
script({title:'Devastator — The Capture of Tantive IV',description:'An Imperial dagger suspended over its captured blockade runner: individually panelled armour, a recessed ventral hangar, seven glowing exhausts, eight turbolaser batteries, chamfered command decks and twin faceted shield globes.',palette:{hull:'light bluish grey',shadow:'dark bluish grey'},defaults:{interior:'empty'}});
const CX=48,Z0=12,ROWS=46;
const half=r=>2+Math.floor(r*0.7);
const occupied=(x,z)=>z>=58&&z<98&&Math.abs(x+1-CX)<=Math.floor((z-54)/3)+4;
const surface=(r,j)=>36+Math.floor(Math.min(j,2*half(r)-2-j)/8);
section('Starfield and exhibition cradle',[
baseplate({at:[0,0],size:[96,128],colour:'black'}),floor({at:[0,0,0],size:[96,128],layers:2,colour:'black'}),
box({at:[43,2,72],size:[10,4,10],colour:'black',top:'tile'}),box({at:[46,6,74],size:[4,15,6],colour:'black'}),box({at:[40,21,72],size:[16,3,10],colour:'black'}),
box({at:[44,2,30],size:[8,4,8],colour:'black',top:'tile'}),box({at:[47,6,32],size:[2,18,4],colour:'black'}),
floor({at:[38,2,116],size:[20,8],colour:'dark bluish grey',top:'tile'}),
range(24).map(i=>place({part:'2431',at:[4*i,2,0],colour:'dark bluish grey'})),range(24).map(i=>place({part:'2431',at:[4*i,2,127],colour:'dark bluish grey'})),
range(31).map(i=>place({part:'2431',at:[0,2,3+4*i],turn:90,colour:'dark bluish grey'})),range(31).map(i=>place({part:'2431',at:[95,2,3+4*i],turn:90,colour:'dark bluish grey'}))]);
const stars=[];for(let z=5;z<124;z+=7)for(let x=5;x<92;x+=7)if(rng()<0.54&&!(x>=36&&x<60&&z>=114))stars.push(place({part:'98138',at:[x+Math.floor(rng()*3),2,z+Math.floor(rng()*3)],colour:rng()<0.8?'white':'trans light blue'}));
section('Distant stars',stars);
const hull=[],armour=[],trenches=[];
for(let r=0;r<ROWS;r++){
const z=Z0+2*r,h=half(r),x=CX-h;
hull.push(box({at:[x,24,z],size:[2*h,5,2],colour:'hull',interior:'solid'}),box({at:[x+1,29,z],size:[2*h-2,3,2],colour:'shadow',interior:'solid'}));
for(const side of [0,1])trenches.push(place({part:'2877',at:[side?CX+h-1:x,29,z],turn:90,colour:r%7===0?'light bluish grey':'dark bluish grey'}));
for(let j=0;j<2*h;j+=2){const px=x+j,top=surface(r,j);hull.push(box({at:[px,32,z],size:[2,top-32,2],colour:'hull',interior:'solid'}));if(occupied(px,z))continue;
const detailed=r>7&&j>3&&j<2*h-6&&(r*7+j)%11<3;
for(let dz=0;dz<2;dz++)armour.push(place({part:detailed?'3023b':((r+j+dz)%17===0?'2412b':'3069b'),at:[px,top,z+dz],colour:(r+j+dz)%37===0?'dark bluish grey':'light bluish grey'}));
if(detailed)armour.push(place({part:'3024',at:[px,top+1,z],colour:'light bluish grey'}),place({part:(r+j)%3===0?'54200':'3070b',at:[px,top+2,z],colour:(r+j)%5===0?'dark bluish grey':'light bluish grey',turn:r%2?0:180}),place({part:'2412b',at:[px,top+1,z+1],colour:'dark bluish grey'}));}}
hull.push(box({at:[47,24,10],size:[2,9,2],colour:'hull',interior:'solid'}),place({part:'3039',at:[47,33,10],colour:'hull'}));
section('Interlocking triangular hull',hull);section('Recessed lateral machinery trench',trenches);section('Individual armour panels and service fittings',armour);
section('Ventral capture bay',[
carve({at:[44,24,48],size:[8,8,16]}),floor({at:[44,32,48],size:[8,16],colour:'dark bluish grey'}),
box({at:[43,24,48],size:[1,7,16],colour:'dark bluish grey',texture:'grille'}),box({at:[52,24,48],size:[1,7,16],colour:'dark bluish grey',texture:'grille'}),
range(8).map(i=>place({part:'3023b',at:[44,31,48+2*i],turn:90,colour:'trans light blue'})),range(8).map(i=>place({part:'3023b',at:[51,31,48+2*i],turn:90,colour:'trans light blue'})),box({at:[45,24,64],size:[6,6,1],colour:'dark bluish grey',texture:'grille'})]);
const citadel=[];for(let z=58;z<98;z+=2){const w=2*(4+Math.floor((z-54)/3));citadel.push(box({at:[CX-w/2,37,z],size:[w,8,2],colour:'hull',interior:'solid'}));}
citadel.push(box({at:[36,45,70],size:[24,6,26],colour:'hull'}),box({at:[39,51,78],size:[18,6,16],colour:'hull'}),box({at:[42,57,83],size:[12,3,10],colour:'shadow'}),box({at:[43,60,86],size:[10,12,8],colour:'hull',texture:'grille'}),box({at:[32,72,84],size:[32,3,10],colour:'hull'}),box({at:[34,75,85],size:[28,3,9],colour:'hull'}),box({at:[36,78,86],size:[24,3,8],colour:'hull'}),floor({at:[34,81,85],size:[28,9],layers:2,colour:'hull'}),box({at:[35,76,84],size:[26,2,1],colour:'black',interior:'solid'}));
for(let z=70;z<96;z+=2)citadel.push(place({part:'3039',at:[36,48,z],turn:90,colour:'hull'}),place({part:'3039',at:[58,48,z],turn:270,colour:'hull'}));
for(let z=78;z<94;z+=2)citadel.push(place({part:'3039',at:[39,54,z],turn:90,colour:'hull'}),place({part:'3039',at:[55,54,z],turn:270,colour:'hull'}));
for(let x=43;x<53;x++)citadel.push(place({part:'4460b',at:[x,60,84],colour:'hull'}),place({part:'3040b',at:[x,69,85],colour:'hull'}));
for(let x=34;x<62;x+=2)citadel.push(place({part:'3039',at:[x,75,83],colour:'hull'}));for(let x=36;x<60;x+=2)citadel.push(place({part:'3039',at:[x,78,93],turn:180,colour:'hull'}));section('Stepped command citadel',citadel);
function railingDetail(x,y,z,turn){return[place({part:'3023b',at:[x,y,z],turn,colour:'hull'}),place({part:'2412b',at:[x,y+1,z],turn,colour:'shadow'})];}
const service=[];for(let z=72;z<96;z+=3)service.push(...railingDetail(37,51,z,90),...railingDetail(58,51,z,90));for(let z=79;z<94;z+=3)service.push(...railingDetail(40,57,z,90),...railingDetail(55,57,z,90));
for(let x=38;x<58;x+=3)service.push(place({part:'54200',at:[x,51,70],colour:'hull'}));for(let x=40;x<56;x+=3)service.push(place({part:'54200',at:[x,57,78],colour:'hull'}));
for(let i=0;i<8;i++){const z=86+i%4*2,x=i<4?45:49;service.push(place({part:'3022',at:[x,83,z],colour:'hull'}),place({part:'3068b',at:[x,84,z],colour:i%3?'light bluish grey':'dark bluish grey'}));}
for(const x of [38,53])service.push(place({part:'3941',at:[x+1,83,89],colour:'dark bluish grey'}),cylinder({at:[x,86,88],diameter:4,height:3,colour:'hull'}),place({part:'30208',at:[x,89,88],colour:'hull'}));
service.push(box({at:[47,83,85],size:[2,4,2],colour:'hull'}),place({part:'3957a',at:[47,87,85],colour:'light bluish grey'}));section('Shield globes, bridge aerial and deck machinery',service);
function battery(x,y,z){const ops=[place({part:'3022',at:[x,y,z],colour:'dark bluish grey'}),place({part:'3941',at:[x,y+1,z],colour:'light bluish grey'}),place({part:'4032b',at:[x,y+4,z],colour:'dark bluish grey'})];for(let dx=0;dx<2;dx++)ops.push(place({part:'3005',at:[x+dx,y+5,z],colour:'light bluish grey'}),place({part:'3710',at:[x+dx,y+8,z-3],turn:90,colour:'dark bluish grey'}),place({part:'3070b',at:[x+dx,y+9,z-3],colour:'light bluish grey'}));return ops;}
const guns=[];for(const x of [27,67])for(let k=0;k<4;k++){const z=80+5*k;guns.push(box({at:[x-1,36,z-1],size:[4,5,4],colour:'hull'}),...battery(x,41,z));}section('Eight heavy turbolaser batteries',guns);
function nozzle(x,y,z,w,h){const large=w===8,a=large?2:1,b=large?3:2,ops=[];
ops.push(box({at:[x+a,y,z],size:[w-2*a,b,8],colour:'dark bluish grey',interior:'solid'}),box({at:[x+a,y+h-b,z],size:[w-2*a,b,8],colour:'light bluish grey',interior:'solid'}),box({at:[x,y+b,z],size:[a,h-2*b,8],colour:'light bluish grey',texture:'grille'}),box({at:[x+w-a,y+b,z],size:[a,h-2*b,8],colour:'light bluish grey',texture:'grille'}),box({at:[x+a,y+b,z+1],size:[w-2*a,h-2*b,1],colour:'black',interior:'solid'}),box({at:[x+a,y+b+1,z+2],size:[w-2*a,h-2*b-2,1],colour:'trans light blue',interior:'solid'}));
for(let q=0;q<8;q+=2){ops.push(place({part:'3023b',at:[x+a,y+h,z+q],colour:'dark bluish grey'}));if(large)ops.push(place({part:'3039',at:[x,y+h-b,z+q],turn:90,colour:'light bluish grey'}),place({part:'3039',at:[x+w-a,y+h-b,z+q],turn:270,colour:'light bluish grey'}),place({part:'3660b',at:[x,y,z+q],turn:90,colour:'dark bluish grey'}),place({part:'3660b',at:[x+w-a,y,z+q],turn:270,colour:'dark bluish grey'}));}return ops;}
const engines=[box({at:[15,27,102],size:[66,12,2],colour:'dark bluish grey',texture:'grille'})];for(const x of [24,44,64])engines.push(...nozzle(x,20,104,8,21));for(const x of [16,36,56,76])engines.push(...nozzle(x,35,104,4,9));section('Three main drives and four auxiliary exhausts',engines);
component('Tantive IV',{size:[10,22],ops:[box({at:[4,0,3],size:[2,3,15],colour:'white',interior:'solid'}),box({at:[3,3,7],size:[4,3,8],colour:'white',interior:'solid'}),box({at:[0,0,1],size:[10,3,3],colour:'white',interior:'solid'}),range(5).map(i=>place({part:'3039',at:[2*i,3,1],colour:'white'})),floor({at:[3,6,9],size:[4,3],colour:'dark red'}),place({part:'3068b',at:[4,3,4],colour:'black'}),box({at:[0,0,17],size:[10,2,3],colour:'white',interior:'solid'}),range(5).map(i=>box({at:[2*i,2,17],size:[1,3,4],colour:'white',interior:'solid'})),range(5).map(i=>box({at:[2*i,2,21],size:[1,2,1],colour:'trans light blue',interior:'solid'})),range(3).map(i=>place({part:'2412b',at:[3,6,12+i],colour:'light bluish grey'}))]});
section('Captured blockade runner',[column({at:[47,2,56],height:9,diameter:2,colour:'trans-clear'}),instance({component:'Tantive IV',at:[43,11,43]})]);
component('TIE escort',{size:[8,6],ops:[box({at:[0,0,0],size:[1,12,6],colour:'black',interior:'solid'}),box({at:[7,0,0],size:[1,12,6],colour:'black',interior:'solid'}),box({at:[1,5,2],size:[6,2,2],colour:'light bluish grey',interior:'solid'}),place({part:'20953',at:[3,4,2],colour:'light bluish grey'}),place({part:'3022',at:[3,9,2],colour:'light bluish grey'}),floor({at:[0,10,2],size:[8,2],colour:'light bluish grey'}),place({part:'3070b',at:[3,11,2],colour:'black'}),range(2).map(i=>floor({at:[i*7,12,0],size:[1,6],colour:'dark bluish grey'}))]});
section('Pursuit patrol',[column({at:[18,2,31],height:14,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[15,12,29]}),column({at:[80,2,52],height:17,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[77,15,50]})]);
```
