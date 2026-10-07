const LBG='light bluish grey',DBG='dark bluish grey',TLB='trans light blue';
script({title:'Imperial Star Destroyer: Launch Day at Kuat Drydock',description:'An Imperial-class Star Destroyer, hull complete and engines lit, held in the clamp arms of a Kuat Drive Yards drydock above an open launch pit. Gantry towers, cranes fitting the last turbolasers, hazard-striped decks and green launch beacons point the way out to space.'});
const Y0=36,NOSE=10,BACK=88,CZ=32,UP=18,LO=8;
const seq=(a,b,s)=>{const o=[];for(let i=a;i<=b;i+=(s||1))o.push(i);return o;};
const hw=x=>Math.min(22,Math.round((x-8)*22/72));
const eOf=z=>z>=CZ?z-CZ+1:CZ-z;
const surfY=(x,z)=>{const H=hw(x),e=eOf(z);if(e<=H)return Y0+Math.min(UP,H-e+1)+1;return Y0+1;};
const keelY=(x,z)=>{const H=hw(x),e=eOf(z);if(e>H)return Y0;return Y0-Math.min(LO,Math.floor((H-e)/2));};
function runs(fn){const out=[];let cur=null;for(let x=NOSE;x<=BACK+1;x++){const r=x<=BACK?fn(x):null;const key=r?r.key:null;if(cur&&key===cur.key){cur.len++;continue;}if(cur)out.push(cur);cur=r?Object.assign({},r,{x0:x,len:1}):null;}return out;}
const rims=(h,rw,full)=>(full||h<=rw)?[[CZ-h,2*h]]:[[CZ-h,rw],[CZ+h-rw,rw]];
const layer=(y,fn,extra)=>runs(fn).map(r=>r.rects.map(([z0,w])=>floor(Object.assign({at:[r.x0,y,z0],size:[r.len,w],colour:r.colour},extra))));
const seamFn=x=>{const h=hw(x)+1,full=x>=BACK-1;return {key:h+'|'+full,rects:rims(h,4,full),colour:DBG};};
const upFn=j=>x=>{const H=hw(x),h=H-(j-1);if(h<1)return null;const top=j===Math.min(UP,H),full=top||x>=BACK-1,colour=(top&&x<44)?DBG:LBG;return {key:h+'|'+full+'|'+colour,rects:rims(h,2,full),colour};};
const loFn=j=>x=>{const H=hw(x),h=H-2*j;if(h<1)return null;const full=j===Math.min(LO,Math.floor((H-1)/2))||x>=BACK-1;return {key:h+'|'+full,rects:rims(h,3,full),colour:LBG};};
section('Hull',[layer(Y0,seamFn,{top:'tile'}),seq(1,UP).map(j=>layer(Y0+j,upFn(j),{top:'tile'})),seq(1,LO).map(j=>layer(Y0-j,loFn(j),{}))]);
const tier=(segs,y,h,tex)=>segs.map(([a,b,s])=>box(Object.assign({at:[a,y,CZ-s],size:[b-a+1,h,2*s],colour:LBG},tex?{texture:tex}:{})));
section('Superstructure',[
 tier([[36,47,5],[48,59,8],[60,87,11]],42,15,'grille'),
 tier([[50,61,6],[62,87,8]],55,9,'grille'),
 tier([[66,87,5]],62,9,'grille'),
 box({at:[70,69,CZ-3],size:[12,6,6],colour:LBG}),
 box({at:[72,73,CZ-2],size:[8,8,4],colour:DBG,texture:'grille'}),
 box({at:[71,81,CZ-8],size:[10,3,16],colour:LBG,interior:'solid'}),
 box({at:[72,84,CZ-8],size:[8,3,16],colour:'black',interior:'solid'}),
 floor({at:[71,87,CZ-9],size:[10,18],layers:2,colour:LBG,top:'tile'}),
 [CZ-9,CZ+5].map(z=>[place({part:'3941',at:[75,89,z+1],colour:LBG}),place({part:'3960',at:[74,92,z],colour:LBG}),place({part:'86500',at:[74,94,z],colour:LBG})]),
 place({part:'3957a',at:[77,89,CZ],colour:LBG}),
 place({part:'4740',at:[72,89,CZ-1],colour:DBG}),
 [[66,21],[77,21],[70,40],[81,40],[63,36]].map(([x,z])=>place({part:'44359',at:[x,x===63?64:57,z],colour:DBG}))
]);
const segHalf=x=>x<36?0:x<=47?5:x<=59?8:11;
const used=new Set();const panels=[];
const armX=[39,40,41,42,46,47,48,49,61,62,63,64];
const gun=(x,z)=>{used.add(x+','+z);const y=surfY(x,z);return [place({part:'6141',at:[x,y,z],colour:LBG}),place({part:'4589',at:[x,y+1,z],colour:DBG})];};
const turrets=[[62,65,69,72,76,79,83,86].map(x=>[CZ-13,CZ+12].map(z=>gun(x,z))),[50,53,57].map(x=>[CZ-10,CZ+9].map(z=>gun(x,z))),[37,40,44].map(x=>[CZ-7,CZ+6].map(z=>gun(x,z)))];
for(let i=0;i<600&&panels.length<160;i++){const x=14+Math.floor(rng()*73);const H=hw(x);if(H<3)continue;const e=2+Math.floor(rng()*(H-1));const z=rng()<0.5?CZ-e:CZ+e-1;if(e<=segHalf(x)+1)continue;if(e>=H-3&&armX.includes(x))continue;if(e===13&&x>=62)continue;const k=x+','+z;if(used.has(k))continue;used.add(k);panels.push(place({part:'3070b',at:[x,surfY(x,z),z],colour:rng()<0.8?DBG:'black'}));}
section('Greebles',[turrets,panels,scatter({region:{at:[36,21],size:[52,22]},parts:['3024','6141','54200','3070b','98138'],colours:[LBG,DBG,LBG],density:0.2,seed:3})]);
const engine=(z0,w,y0,glows)=>[box({at:[BACK+1,y0,z0],size:[2,glows.length*3,w],colour:DBG,interior:'solid'}),floor({at:[BACK+3,y0-1,z0],size:[2,w],colour:DBG}),floor({at:[BACK+3,y0+3*glows.length,z0],size:[2,w],colour:DBG}),glows.map((g,c)=>{const off=(w-g)/2,yy=y0+3*c;return [box({at:[BACK+3,yy,z0+off],size:[1,3,g],colour:TLB,interior:'solid'}),off>0&&box({at:[BACK+3,yy,z0],size:[2,3,off],colour:DBG,interior:'solid'}),off>0&&box({at:[BACK+3,yy,z0+off+g],size:[2,3,off],colour:DBG,interior:'solid'})];})];
section('Engines',[[17,28,39].map(z=>engine(z,8,31,[4,6,6,6,4])),[11,49].map(z=>engine(z,4,34,[2,2])),[25,36].map(z=>engine(z,3,34,[1,1]))]);
function gantry(x0,z0,top,rings,fenceRings){return [
 [[0,0],[5,0],[0,5],[5,5]].map(([dx,dz])=>box({at:[x0+dx,4,z0+dz],size:[1,top-4,1],colour:DBG,interior:'solid'})),
 box({at:[x0+2,4,z0+2],size:[2,top-4,2],colour:LBG,interior:'solid'}),
 rings.map(y=>floor({at:[x0,y,z0],size:[6,6],layers:2,colour:DBG,holes:[{at:[x0+1,z0+1],size:[4,4]}]})),
 fenceRings.map(y=>[[[x0+1,z0],[x0+4,z0]],[[x0+1,z0+5],[x0+4,z0+5]],[[x0,z0+1],[x0,z0+4]],[[x0+5,z0+1],[x0+5,z0+4]]].map(p=>fence({path:p,y:y+2,colour:'black',style:'lattice'}))),
 floor({at:[x0-1,top,z0-1],size:[8,8],layers:2,colour:DBG}),
 [[0,0],[7,0],[0,7],[7,7]].map(([dx,dz])=>place({part:'6141',at:[x0-1+dx,top+2,z0-1+dz],colour:'trans red'}))
];}
function arm(x0,back){const H=hw(x0);return [[Y0-3,3,30+H,DBG],[Y0,2,33+H,DBG],[Y0+2,1,31+H,'black']].map(([y,l,zs,c])=>{let za=zs,zb=59;if(!back){za=4;zb=63-zs;}return floor({at:[x0,y,za],size:[2,zb-za+1],layers:l,colour:c});});}
const pylon=xs=>[box({at:[xs-2,0,27],size:[8,6,10],colour:DBG,texture:'grille'}),seq(xs,xs+3).map(x=>seq(30,33).map(z=>box({at:[x,6,z],size:[1,keelY(x,z)-6,1],colour:DBG,interior:'solid'}))),[[xs-2,27],[xs+5,27],[xs-2,36],[xs+5,36]].map(([x,z])=>place({part:'6141',at:[x,6,z],colour:'trans yellow'}))];
section('Drydock',[
 gantry(60,56,85,[16,28,46,58,70],[16,46,58,70]),
 gantry(38,56,61,[16,28,46],[16,28,46]),
 gantry(45,2,46,[16,28],[16]),
 arm(62,true),arm(40,true),arm(47,false),
 floor({at:[62,87,34],size:[2,30],layers:3,colour:DBG}),
 box({at:[61,90,59],size:[4,3,4],colour:'black',interior:'solid'}),
 place({part:'30395',at:[62,79,36],colour:DBG}),
 floor({at:[40,63,28],size:[2,36],layers:3,colour:DBG}),
 box({at:[39,66,59],size:[4,3,4],colour:'black',interior:'solid'}),
 place({part:'30395',at:[40,55,30],colour:DBG}),
 [26,50,72].map(pylon)
]);
section('Site',[
 baseplate({at:[0,0],size:[96,64],colour:'black'}),
 box({at:[0,0,0],size:[96,4,10],colour:DBG,top:'tile'}),
 box({at:[0,0,52],size:[96,4,12],colour:DBG,top:'tile'}),
 seq(0,94,2).map((x,i)=>[place({part:'3069b',at:[x,4,9],colour:i%2?'black':'yellow'}),place({part:'3069b',at:[x,4,52],colour:i%2?'black':'yellow'})]),
 seq(6,90,4).map(x=>[place({part:'6141',at:[x,0,11],colour:'trans yellow'}),place({part:'6141',at:[x,0,50],colour:'trans yellow'})]),
 seq(1,7,3).map(x=>[place({part:'6141',at:[x,0,31],colour:'trans green'}),place({part:'6141',at:[x,0,32],colour:'trans green'})]),
 [13,50].map(z=>[column({at:[1,0,z],height:'4b',diameter:1,colour:DBG}),place({part:'3062b',at:[1,12,z],colour:'trans green'})]),
 room({at:[66,4,1],size:[14,9,6],colour:LBG,openings:[2,5,8,11].map(a=>({side:'front',at:a,width:2,y:2,height:6,frame:'black',glass:TLB}))}),
 roof({style:'flat',at:[66,13,1],size:[14,6],colour:DBG}),
 place({part:'3960',at:[67,14,2],colour:LBG}),
 place({part:'3957a',at:[78,14,5],colour:LBG}),
 cylinder({at:[18,4,3],diameter:4,height:12,colour:'white'}),
 cylinder({at:[23,4,3],diameter:4,height:9,colour:'white'}),
 place({part:'3943b',at:[18,16,3],colour:'white'}),
 place({part:'3943b',at:[23,13,3],colour:'white'}),
 place({part:'4345b',at:[84,4,2],colour:DBG}),place({part:'4345b',at:[84,10,2],colour:LBG}),place({part:'4345b',at:[87,4,2],colour:'white'}),place({part:'4345b',at:[91,4,5],colour:DBG}),place({part:'4345b',at:[30,4,4],colour:LBG}),place({part:'4345b',at:[33,4,4],colour:DBG}),place({part:'4345b',at:[30,10,4],colour:DBG}),
 room({at:[74,4,55],size:[14,12,7],colour:LBG,quoins:DBG,openings:[...[2,6,10].map(a=>({side:'front',at:a,width:2,y:3,height:6,frame:'black',glass:TLB})),...[3,7,11].map(a=>({side:'back',at:a,width:2,y:3,height:6,frame:'black',glass:TLB}))]}),
 roof({style:'flat',at:[74,16,55],size:[14,7],colour:DBG}),
 place({part:'3960',at:[76,17,56],colour:LBG}),
 place({part:'6141',at:[86,17,61],colour:'trans red'}),
 column({at:[92,4,58],height:'7b',diameter:1,colour:DBG}),
 place({part:'4740',at:[92,25,58],colour:LBG}),
 floor({at:[4,4,55],size:[10,6],layers:3,colour:LBG}),
 floor({at:[5,7,56],size:[8,4],layers:2,colour:LBG}),
 floor({at:[24,4,56],size:[8,5],layers:4,colour:LBG}),
 place({part:'4345b',at:[16,4,56],colour:DBG}),place({part:'4345b',at:[16,10,56],colour:DBG}),place({part:'4345b',at:[19,4,57],colour:LBG}),
 fence({path:[[0,54],[14,54]],y:4,colour:'black',style:'spindle'}),
 fence({path:[[46,54],[58,54]],y:4,colour:'black',style:'spindle'})
]);
