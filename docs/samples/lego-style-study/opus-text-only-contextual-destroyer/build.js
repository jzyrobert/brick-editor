script({title:'Devastator — The Capture of Tantive IV',description:'A terraced Imperial-class wedge rising from a razor prow to its stern drives: 18-degree armour tiers, a recessed equatorial trench, an inverted-slope keel, chamfered command decks, eight turbolaser batteries, twin shield globes, and a tractor beam hauling the captured blockade runner into the ventral hangar while two TIEs escort.',palette:{hull:'light bluish grey',shadow:'dark bluish grey'},defaults:{interior:'empty'}});
const CX=48,Z0=12,ROWS=46,YT=36,YU=39,ZS=66,PED=[31,34,37,40];
const half=r=>1+Math.floor(r*72/100);
const lowTiers=h=>h<6?0:Math.min(4,Math.floor(h/6));
const upTiers=(r,h)=>Z0+2*r>=ZS?4:Math.floor(h/4);
const shade=a=>a%17===0?'shadow':'hull';
const isPed=r=>PED.includes(r)||PED.includes(r-1);
const core=[],armour=[],keel=[],trench=[];
for(let r=0;r<ROWS;r++){const z=Z0+2*r,h=half(r),T=upTiers(r,h),K=lowTiers(h);
if(h<4){core.push(floor({at:[CX-h,YT,z],size:[2*h,2],layers:3,colour:'hull',top:'tile'}));continue;}
core.push(floor({at:[CX-h+2,YT,z],size:[2*h-4,2],layers:3,colour:'hull'}));
for(const x of [CX-h+1,CX+h-2])trench.push(place({part:'2877',at:[x,YT,z],turn:90,colour:r%5===0?'hull':'shadow'}));
for(let i=0;i<T;i++){const hi=h-4*i,y=YU+3*i;
if(i===3&&isPed(r))for(const x of [CX-hi,CX+hi-4])core.push(floor({at:[x,y,z],size:[4,2],layers:3,colour:'hull',top:'tile'}));
else for(let dz=0;dz<2;dz++)armour.push(place({part:'60477',at:[CX-hi,y,z+dz],turn:90,colour:shade(r*7+i*3+dz*5)}),place({part:'60477',at:[CX+hi-4,y,z+dz],turn:270,colour:shade(r*5+i*7+dz*3+4)}));
if(hi>4)core.push(floor({at:[CX-hi+4,y,z],size:[2*hi-8,2],layers:3,colour:'hull',...(i===T-1&&z<ZS?{top:'tile'}:{})}));}
for(let k=0;k<K;k++){const hk=h-3*k,y=YT-3*(k+1);
for(let dz=0;dz<2;dz++)keel.push(place({part:'4287a',at:[CX-hk,y,z+dz],turn:90,colour:shade(r*3+k*11+dz*7+2)}),place({part:'4287a',at:[CX+hk-3,y,z+dz],turn:270,colour:shade(r*11+k*3+dz*5+9)}));
if(hk>3)core.push(floor({at:[CX-hk+3,y,z],size:[2*hk-6,2],layers:3,colour:'hull'}));}}
section('Tiered wedge hull core',core);section('Recessed equatorial trench',trench);section('Dorsal armour terraces',armour);section('Ventral keel',keel);
section('Ventral hangar and tractor beam',[carve({at:[44,27,48],size:[8,18,16]}),
box({at:[43,30,48],size:[1,15,16],colour:'shadow',texture:'grille'}),box({at:[52,30,48],size:[1,15,16],colour:'shadow',texture:'grille'}),
box({at:[44,30,47],size:[8,15,1],colour:'shadow',texture:'grille'}),box({at:[44,27,64],size:[8,18,1],colour:'shadow',texture:'grille'}),
range(8).map(i=>[place({part:'3023b',at:[44,44,48+2*i],turn:90,colour:'trans light blue'}),place({part:'3023b',at:[51,44,48+2*i],turn:90,colour:'trans light blue'})]),
column({at:[47,21,54],height:24,diameter:2,colour:'trans light blue'})]);
const battery=(x,y,z)=>{const ops=[place({part:'3022',at:[x,y,z],colour:'shadow'}),place({part:'3941',at:[x,y+1,z],colour:'hull'}),place({part:'4032b',at:[x,y+4,z],colour:'shadow'})];for(let dx=0;dx<2;dx++)ops.push(place({part:'3005',at:[x+dx,y+5,z],colour:'hull'}),place({part:'3710',at:[x+dx,y+8,z-3],turn:90,colour:'shadow'}),place({part:'3070b',at:[x+dx,y+9,z-3],colour:'hull'}));return ops;};
section('Eight heavy turbolaser batteries',PED.map(r=>{const z=Z0+2*r,h=half(r);return [...battery(CX-h+12,51,z+1),...battery(CX+h-14,51,z+1)];}));
const decks=[],DECK=[[66,102],[74,98],[82,94]];
DECK.forEach(([zs,ze],d)=>{const yb=51+6*d,nx=DECK[d+1];for(let z=zs;z<=ze;z+=2){const wd=half((z-Z0)/2)-16-3*d,end=z===zs||z===ze;
decks.push(box({at:[CX-wd+1,yb,z],size:[2*wd-2,3,2],colour:'shadow',interior:'solid'}),place({part:'2877',at:[CX-wd,yb,z],turn:90,colour:'shadow'}),place({part:'2877',at:[CX+wd-1,yb,z],turn:90,colour:'shadow'}),place({part:'3039',at:[CX-wd,yb+3,z],turn:90,colour:'hull'}),place({part:'3039',at:[CX+wd-2,yb+3,z],turn:270,colour:'hull'}));
if(end)for(let x=CX-wd+2;x<CX+wd-2;x+=2)decks.push(place({part:'3039',at:[x,yb+3,z],turn:z===zs?0:180,colour:'hull'}));
else decks.push(box({at:[CX-wd+2,yb+3,z],size:[2*wd-4,3,2],colour:'hull',interior:'solid',top:'tile'}));
if(!end&&nx&&z>=nx[0]&&z<=nx[1]&&z%4===0)decks.push(place({part:'2412b',at:[CX-wd+2,yb+6,z],turn:90,colour:'shadow'}),place({part:'2412b',at:[CX+wd-3,yb+6,z],turn:90,colour:'shadow'}));}});
section('Chamfered command decks',decks);
const svc=[box({at:[45,69,88],size:[6,12,6],colour:'hull',texture:'grille'}),range(6).map(i=>place({part:'4460b',at:[45+i,69,86],colour:'hull'})),range(6).map(i=>place({part:'3040b',at:[45+i,78,86],colour:'hull'})),
floor({at:[33,81,85],size:[30,10],layers:2,colour:'hull'}),floor({at:[34,83,85],size:[28,1],layers:2,colour:'black'}),box({at:[33,83,86],size:[30,5,9],colour:'hull',top:'tile'}),
range(14).map(i=>place({part:'3039',at:[34+2*i,85,85],colour:'hull'})),range(14).map(i=>place({part:'3039',at:[34+2*i,85,93],turn:180,colour:'hull'})),
place({part:'3062b',at:[47,88,91],colour:'shadow'}),place({part:'3957a',at:[47,91,91],colour:'hull'})];
for(const x of [35,57])svc.push(place({part:'3941',at:[x+1,88,89],colour:'shadow'}),place({part:'3960',at:[x,91,88],colour:'hull'}),place({part:'60474',at:[x,93,88],colour:'hull'}),place({part:'86500',at:[x,94,88],colour:'hull'}));
for(const [x,z] of [[41,88],[43,90],[51,90],[53,88]])svc.push(place({part:'3022',at:[x,88,z],colour:'hull'}),place({part:'3068b',at:[x,89,z],colour:x%4===1?'shadow':'hull'}));
section('Bridge tower, shield globes and sensor mast',svc);
function nozzle(x,y,w,h){const L=w===8,a=L?2:1,b=L?3:2,ops=[floor({at:[x,y-1,102],size:[w,10],colour:'shadow'}),box({at:[x+a,y,102],size:[w-2*a,b,10],colour:'shadow',interior:'solid'}),box({at:[x+a,y+h-b,102],size:[w-2*a,b,10],colour:'hull',interior:'solid'}),floor({at:[x,y+h,102],size:[w,10],layers:2,colour:'hull',top:'tile'}),
box({at:[x,L?y+b:y,106],size:[a,L?h-2*b:h,6],colour:'hull',texture:'grille'}),box({at:[x+w-a,L?y+b:y,106],size:[a,L?h-2*b:h,6],colour:'hull',texture:'grille'}),
box({at:[x+a,y+b,106],size:[w-2*a,h-2*b,1],colour:'trans light blue',interior:'solid'})];
if(L){ops.push(box({at:[x+a,y+b,107],size:[w-2*a,1,1],colour:'black',interior:'solid'}),box({at:[x+a,y+h-b-1,107],size:[w-2*a,1,1],colour:'black',interior:'solid'}),box({at:[x+a,y+b+1,107],size:[1,h-2*b-2,1],colour:'black',interior:'solid'}),box({at:[x+w-a-1,y+b+1,107],size:[1,h-2*b-2,1],colour:'black',interior:'solid'}));
for(let q=0;q<6;q+=2)ops.push(place({part:'3039',at:[x,y+h-b,106+q],turn:90,colour:'hull'}),place({part:'3039',at:[x+w-2,y+h-b,106+q],turn:270,colour:'hull'}),place({part:'3660b',at:[x,y,106+q],turn:90,colour:'shadow'}),place({part:'3660b',at:[x+w-2,y,106+q],turn:270,colour:'shadow'}));}
return ops;}
const engines=[box({at:[18,24,102],size:[60,27,4],colour:'hull',interior:'solid',top:'tile'})];for(const x of [26,44,62])engines.push(...nozzle(x,27,8,21));for(const x of [19,37,55,73])engines.push(...nozzle(x,33,4,9));section('Three main drives and four auxiliary exhausts',engines);
component('Tantive IV',{size:[10,22],ops:[box({at:[0,0,0],size:[10,3,4],colour:'white',interior:'solid'}),range(5).map(i=>place({part:'3039',at:[2*i,3,0],colour:'white'})),range(5).map(i=>place({part:'3068b',at:[2*i,3,2],colour:i===2?'red':'white'})),
box({at:[4,0,4],size:[2,3,4],colour:'white',interior:'solid'}),place({part:'3068b',at:[4,3,4],colour:'light bluish grey'}),place({part:'3068b',at:[4,3,6],colour:'light bluish grey'}),
box({at:[2,0,8],size:[6,3,9],colour:'white',interior:'solid'}),floor({at:[2,3,8],size:[6,9],colour:'red'}),floor({at:[2,4,8],size:[6,9],layers:2,colour:'white',top:'tile'}),range(3).map(i=>place({part:'2412b',at:[6,6,9+2*i],colour:'light bluish grey'})),
box({at:[0,0,17],size:[10,5,4],colour:'white',interior:'solid'}),box({at:[0,0,21],size:[10,5,1],colour:'trans light blue',interior:'solid'}),floor({at:[0,5,17],size:[10,5],layers:2,colour:'white',top:'tile'}),range(5).map(i=>place({part:'3069b',at:[2*i,7,18],colour:i%2?'red':'white'}))]});
section('Captured blockade runner',[instance({component:'Tantive IV',at:[43,15,43]})]);
component('TIE escort',{size:[8,6],ops:[[0,7].map(wx=>[place({part:'3665a',at:[wx,0,0],colour:'shadow'}),place({part:'3665a',at:[wx,0,4],turn:180,colour:'shadow'}),box({at:[wx,0,2],size:[1,3,2],colour:'shadow',interior:'solid'}),floor({at:[wx,3,0],size:[1,6],colour:'black'}),floor({at:[wx,4,0],size:[1,2],colour:'black'}),floor({at:[wx,4,4],size:[1,2],colour:'black'}),box({at:[wx,5,0],size:[1,4,6],colour:'black',interior:'solid'}),box({at:[wx,9,2],size:[1,3,2],colour:'shadow',interior:'solid'}),place({part:'3040b',at:[wx,9,0],colour:'shadow'}),place({part:'3040b',at:[wx,9,4],turn:180,colour:'shadow'})]),
floor({at:[0,4,2],size:[8,2],colour:'hull'}),place({part:'20953',at:[3,5,2],colour:'light bluish grey'})]});
section('Pursuit patrol',[place({part:'60474',at:[12,0,26],colour:'shadow'}),place({part:'60474',at:[12,1,26],colour:'shadow'}),column({at:[13,2,27],height:33,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[10,31,25]}),
place({part:'60474',at:[82,0,49],colour:'shadow'}),place({part:'60474',at:[82,1,49],colour:'shadow'}),column({at:[83,2,50],height:45,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[80,43,48]})]);
section('Display stands',[box({at:[41,0,75],size:[14,6,14],colour:'black',top:'tile'}),place({part:'3037',at:[44,6,75],colour:'shadow'}),place({part:'3037',at:[48,6,75],colour:'shadow'}),column({at:[46,6,80],height:18,diameter:4,colour:'black'}),
box({at:[45,0,28],size:[6,3,6],colour:'black',interior:'solid',top:'tile'}),column({at:[47,3,30],height:30,diameter:2,colour:'trans-clear'})]);