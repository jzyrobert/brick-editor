script({title: "Piplup's Big Catch at Lake Acuity", description: 'A proud Piplup, flipper raised in triumph, on a snowbank at frozen Lake Acuity - beside the ice-fishing hole it has just flung a flopping Magikarp out of, with its stash of fish and a Poke Ball in the snow.'});
const key=(i,g,j)=>i+','+g+','+j;
const inE=(x,z,cx,cz,rx,rz)=>{const a=(x+0.5-cx)/rx,b=(z+0.5-cz)/rz;return a*a+b*b<=1;};
const hash=(i,j)=>{let h=Math.imul(i+101,374761393)^Math.imul(j+57,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const CAP='blue',FACE='bright light blue',BEAK='yellow',FOOT='orange';
const CX=17,BZ=18.5,HZ=18,BRX=6.2,BRZ=5.4,HRX=7.2,HRZ=6.6;
const BODY=[0.78,0.92,0.99,1.0,0.96,0.88,0.76,0.62];
const bodyIn=(i,g,j)=>{if(g<0||g>7)return false;const f=BODY[g];const a=(i+0.5-CX)/(BRX*f),b=(j+0.5-BZ)/(BRZ*f);return a*a+b*b<=1;};
const headS=h=>Math.pow(1-Math.pow(Math.abs((h+0.5-5)/5),2.4),1/2.4);
const headIn=(i,g,j)=>{const h=g-6;if(h<0||h>9)return false;const s=headS(h);const a=(i+0.5-CX)/(HRX*s),b=(j+0.5-HZ)/(HRZ*s);return a*a+b*b<=1;};
const frontOf=(fn,i,g)=>{for(let j=0;j<32;j++)if(fn(i,g,j))return j;return 99;};
// appendages: flippers, tail, beak (cell -> colour, slope turn)
const extra=new Map();
const addX=(x0,x1,g,z0,z1,c,d)=>{for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++)extra.set(key(i,g,j),{c,d});};
addX(10,11,5,18,19,CAP,90);addX(8,10,4,18,19,CAP,90);addX(7,9,3,18,19,CAP,90);addX(7,8,2,18,19,CAP,90);
addX(22,23,5,18,19,CAP,90);addX(23,25,6,18,19,CAP,90);addX(24,26,7,18,19,CAP,90);addX(25,26,8,18,19,CAP,90);
addX(16,17,0,23,25,CAP,180);
for(const i of [15,16,17,18]){const f=frontOf(headIn,i,9);extra.set(key(i,9,f-1),{c:BEAK,d:0});if(i===16||i===17)extra.set(key(i,9,f-2),{c:BEAK,d:0});}
for(const i of [16,17])extra.set(key(i,8,frontOf(headIn,i,8)-1),{c:BEAK,d:0});
// eyes with a highlight, chest dots
const paint=new Map();
for(const [x0,hl] of [[13,13],[19,19]])for(const g of [10,11])for(const i of [x0,x0+1])paint.set(key(i,g,frontOf(headIn,i,g)),(g===11&&i===hl)?'white':'black');
for(const i of [14,19])paint.set(key(i,5,frontOf(bodyIn,i,5)),'white');
const pipIn=(i,g,j)=>extra.has(key(i,g,j))||bodyIn(i,g,j)||headIn(i,g,j);
const pipColour=(i,g,j)=>{const k=key(i,g,j);const e=extra.get(k);if(e)return e.c;const p=paint.get(k);if(p)return p;const dx=i+0.5-CX;
  if(headIn(i,g,j)){const dz=j+0.5-HZ,a=Math.atan2(Math.abs(dx),-dz),h=g-6;return (a<1.25&&h<=(Math.abs(dx)<1?5:6))?FACE:CAP;}
  const dz=j+0.5-BZ,a=Math.atan2(Math.abs(dx),-dz);return a<1.0?FACE:CAP;};
const outward=(IN,cx,cz,i,g,j)=>{const dx=i+0.5-cx,dz=j+0.5-cz;let t,ni=i,nj=j;if(Math.abs(dz)>=Math.abs(dx)){t=dz<0?0:180;nj+=dz<0?-1:1;}else{t=dx<0?90:270;ni+=dx<0?-1:1;}return {turn:t,rim:!IN(ni,g,nj)};};
const pipDir=(i,g,j)=>{const e=extra.get(key(i,g,j));if(e)return {turn:e.d,rim:true};return outward(pipIn,CX,headIn(i,g,j)?HZ:BZ,i,g,j);};
// voxel sculpting: hollow shell of brick courses, cheese-slope rims, tiled steps
function sculpt(o){
  const IN=o.inside,shell=new Map(),ops=[];
  for(let g=o.g0;g<=o.g1;g++)for(let j=o.z0;j<=o.z1;j++)for(let i=o.x0;i<=o.x1;i++){
    if(!IN(i,g,j))continue;let s=false;
    for(let a=-1;a<=1&&!s;a++)for(let b=-1;b<=1&&!s;b++)for(let c=-1;c<=1&&!s;c++)if(!IN(i+a,g+b,j+c))s=true;
    if(s)shell.set(key(i,g,j),[i,g,j]);}
  for(const [i,g,j] of [...shell.values()])if(!IN(i,g+1,j)&&IN(i,g-1,j))shell.set(key(i,g-1,j),[i,g-1,j]);
  const col=new Map();for(const [k,[i,g,j]] of shell)col.set(k,o.colour(i,g,j));
  for(let g=o.g0;g<=o.g1;g++)for(let j=o.z0;j<=o.z1;j++){let i=o.x0;while(i<=o.x1){const c=col.get(key(i,g,j));if(!c){i++;continue;}let e=i;while(e+1<=o.x1&&col.get(key(e+1,g,j))===c)e++;ops.push(box({at:[i,o.y0+3*g,j],size:[e-i+1,3,1],colour:c,interior:'solid'}));i=e+1;}}
  for(const [k,[i,g,j]] of shell){if(IN(i,g+1,j))continue;const d=o.dir(i,g,j),y=o.y0+3*g+3,c=col.get(k);
    ops.push(d.rim?place({part:'54200',at:[i,y,j],colour:c,turn:d.turn}):floor({at:[i,y,j],size:[1,1],colour:c,top:'tile'}));}
  return ops;}
// ground
const mound=(x,z)=>x>=0&&x<32&&z>=0&&z<32&&(inE(x,z,17,19,11.5,9.5)||inE(x,z,6,25,6.5,7)||inE(x,z,27,22,6,10));
const edgeDir=(x,z)=>{if(x<0||x>31||z<0||z>31||mound(x,z))return null;if(mound(x,z+1))return 0;if(mound(x,z-1))return 180;if(mound(x+1,z))return 90;if(mound(x-1,z))return 270;return null;};
const hole=(x,z)=>inE(x,z,5,4,2.3,2);
const ice=(x,z)=>inE(x,z,9,3,15,7.5)&&!mound(x,z)&&edgeDir(x,z)===null&&!hole(x,z);
const runs=(test,make)=>{const ops=[];for(let z=0;z<32;z++){let x=0;while(x<32){if(!test(x,z)){x++;continue;}let e=x;while(e+1<32&&test(e+1,z))e++;ops.push(make(x,z,e-x+1));x=e+1;}}return ops;};
const edges=[];for(let z=0;z<32;z++)for(let x=0;x<32;x++){const d=edgeDir(x,z);if(d!==null)edges.push(place({part:'54200',at:[x,0,z],colour:'white',turn:d}));}
section('Snow and ice',[
  baseplate({at:[0,0],size:[32,32],colour:'white'}),
  ...runs(mound,(x,z,n)=>floor({at:[x,0,z],size:[n,1],colour:'white',layers:2})),
  ...runs(ice,(x,z,n)=>floor({at:[x,0,z],size:[n,1],colour:'trans light blue',top:'tile'})),
  ...runs(hole,(x,z,n)=>floor({at:[x,0,z],size:[n,1],colour:'dark blue',top:'tile'})),
  ...edges]);
section('Piplup',sculpt({inside:pipIn,colour:pipColour,dir:pipDir,y0:2,x0:5,x1:28,g0:0,g1:15,z0:8,z1:27}));
section('Feet',[13,18].map(x=>[place({part:'3021',at:[x,2,12],colour:FOOT}),place({part:'63864',at:[x,3,13],colour:FOOT}),[0,1,2].map(d=>place({part:'54200',at:[x+d,3,12],colour:FOOT}))]));
// Magikarp flopping on the ice, flung from the fishing hole
const K='red';
const kc=(x0,x1,c,z0,z1,col)=>box({at:[x0,1+3*c,z0],size:[x1-x0+1,3,z1-z0+1],colour:col,interior:'solid'});
section('Magikarp',[
  kc(11,15,0,4,6,K),kc(16,16,0,5,5,'white'),
  kc(10,14,1,4,4,K),kc(15,15,1,4,4,'white'),kc(16,16,1,4,4,K),kc(10,16,1,5,5,K),kc(10,14,1,6,6,K),kc(15,15,1,6,6,'white'),kc(16,16,1,6,6,K),
  kc(11,15,2,4,6,K),
  kc(8,9,0,5,5,'white'),kc(9,9,1,5,5,'white'),kc(8,9,2,5,5,'white'),
  [11,12,13,14,15].map(x=>[place({part:'54200',at:[x,10,4],colour:K,turn:0}),place({part:'54200',at:[x,10,6],colour:K,turn:180})]),
  place({part:'54200',at:[11,10,5],colour:K,turn:90}),place({part:'54200',at:[15,10,5],colour:K,turn:270}),
  [12,13,14].map(x=>place({part:'4589',at:[x,10,5],colour:'yellow'})),
  [4,5,6].map(z=>[place({part:'54200',at:[10,7,z],colour:K,turn:90}),place({part:'54200',at:[16,7,z],colour:K,turn:270})]),
  place({part:'54200',at:[8,10,5],colour:'white',turn:90}),place({part:'54200',at:[9,10,5],colour:'white',turn:90}),place({part:'54200',at:[8,4,5],colour:'white',turn:90}),
  place({part:'54200',at:[12,1,3],colour:'white',turn:0}),place({part:'54200',at:[12,1,7],colour:'white',turn:180}),
  place({part:'6141',at:[8,1,3],colour:'trans light blue'}),place({part:'6141',at:[7,1,6],colour:'trans light blue'}),place({part:'6141',at:[11,1,8],colour:'trans light blue'})]);
// snow-capped rocks
const rockIn=(cx,cz,rx,rz,rg)=>(i,g,j)=>{if(g<0||!mound(i,j))return false;const a=(i+0.5-cx)/rx,b=(j+0.5-cz)/rz,c=(g+0.5)/rg;return a*a+b*b+c*c<=1+0.3*(hash(i,j)-0.5);};
const rock=(cx,cz,rx,rz,rg)=>{const IN=rockIn(cx,cz,rx,rz,rg);return sculpt({inside:IN,y0:2,x0:Math.floor(cx-rx-2),x1:Math.ceil(cx+rx+1),z0:Math.floor(cz-rz-2),z1:Math.ceil(cz+rz+1),g0:0,g1:Math.ceil(rg),
  colour:(i,g,j)=>!IN(i,g+1,j)?'white':(hash(i+g*7,j)<0.3?'dark bluish grey':'light bluish grey'),dir:(i,g,j)=>outward(IN,cx,cz,i,g,j)});};
section('Rocks',[rock(27.5,15,3.6,3.2,3.4),rock(28.5,22,3,3.3,5.5)]);
section('Props',[
  // fishing hole: splash and broken ice
  place({part:'3062b',at:[5,1,4],colour:'trans light blue'}),place({part:'6141',at:[5,4,4],colour:'trans-clear'}),
  place({part:'6141',at:[4,1,3],colour:'trans light blue'}),place({part:'6141',at:[4,1,5],colour:'trans-clear'}),
  place({part:'3024',at:[7,1,4],colour:'white'}),place({part:'3024',at:[3,1,6],colour:'trans-clear'}),place({part:'54200',at:[5,1,1],colour:'white',turn:0}),place({part:'3024',at:[2,1,4],colour:'trans-clear'}),place({part:'54200',at:[1,1,3],colour:'white',turn:90}),
  // Piplup's fish stash
  place({part:'64648',at:[8,2,13],colour:'orange',turn:90}),place({part:'64648',at:[9,2,14],colour:'medium azure',turn:90}),
  // Poke Ball in the snow
  place({part:'87081',at:[24,0,6],colour:'white'}),place({part:'60474',at:[24,3,6],colour:'black'}),place({part:'60474',at:[24,4,6],colour:'red'}),place({part:'86500',at:[24,5,6],colour:'red'}),
  // Lake Acuity signpost
  place({part:'2453b',at:[3,2,19],colour:'reddish brown'}),place({part:'3010',at:[2,17,19],colour:'tan'}),place({part:'2431',at:[2,20,19],colour:'white'}),
  // snowy pines
  place({part:'3471',at:[2,2,26],colour:'green'}),place({part:'2435',at:[8,2,27],colour:'white'}),place({part:'3471',at:[27,2,27],colour:'green'}),place({part:'2435',at:[28,0,1],colour:'white'})]);
