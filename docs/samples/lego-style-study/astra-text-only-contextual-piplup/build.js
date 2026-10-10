script({title:"Piplup's Bubble-Berg",description:"Piplup waves from a sculpted ice floe as an orange fish escapes through three rising bubbles. White cheek masks and sparkling eyes frame a rounded golden bill; a navy collar, webbed feet and swept tail complete the captain. Curved and inverted slopes finish the hollow, internally braced sculpture.",palette:{water:"trans light blue",ice:"white",penguin:"medium azure",hood:"dark blue",beak:"yellow"}});
const lift=5,terrain=[];
const icePlots=[[8,11,16,15],[6,14,2,10],[24,15,3,9],[10,26,12,2],[10,9,12,2]];
for(const [x,z,w,d] of icePlots)terrain.push(box({at:[x,0,z],size:[w,5,d],colour:"white",top:"tile",supports:6}));
for(const [x,z,w,d] of [[20,1,8,9],[24,7,8,10],[25,17,5,11],[21,28,8,3]])terrain.push(floor({at:[x,0,z],size:[w,d],colour:"blue"}),floor({at:[x,1,z],size:[w,d],colour:"water",top:"tile"}));
for(let x=10;x<22;x+=2)terrain.push(place({part:"3039",at:[x,2,8],colour:"white"}));
for(let x=10;x<22;x++)terrain.push(place({part:"50950",at:[x,2,25],colour:"white",turn:180}));
for(let z=15;z<23;z+=2)terrain.push(place({part:"15068",at:[6,2,z],colour:"white",turn:90}),place({part:"15068",at:[25,2,z],colour:"white",turn:270}));
section("An iceberg with a narrow bubbling wake",terrain);
function ell(x,y,z,cx,cy,cz,rx,ry,rz){return ((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1;}
function headColour(x,y,z){let c="medium azure";if(z<19&&(y>=61||(y>=51&&Math.abs(x-16)<2+(y-51)*.13)))c="dark blue";if(z<17&&[10.5,21.5].some(ex=>((x-ex)/5)**2+((y-55)/13)**2<=1))c="white";if(z<19&&y>=53&&Math.abs(x-16)<1.3+(y-53)*.13)c="dark blue";return c;}
function bodyColour(x,y,z){let c="medium azure";if(y>=37||(y>=31&&(x<12||x>20)))c="dark blue";if(z<17&&[13,19].some(ex=>((x-ex)/1.5)**2+((y-27)/4)**2<=1))c="white";return c;}
function outer(ix,h,iz){const x=ix+.5,y=h+1.5,z=iz+.5;if(ell(x,y,z,16,55,19,10,21,8))return headColour(x,y,z);if(h>=9&&ell(x,y,z,16,27,20,7.5,21,6))return bodyColour(x,y,z);if(ell(x,y,z,8-.22*(y-25),36,20,2.7,13,2.3))return "medium azure";if(ell(x,y,z,24+.2*(32-y),24,20,2.7,12,2.3))return "medium azure";return null;}
function shell(ix,h,iz){const c=outer(ix,h,iz);if(!c)return null;const x=ix+.5,y=h+1.5,z=iz+.5;const head=ell(x,y,z,16,55,19,10,21,8),body=ell(x,y,z,16,27,20,7.5,21,6);if(head&&!ell(x,y,z,16,55,19,9,18,7))return c;if(!head&&body&&!ell(x,y,z,16,27,20,6.5,18,5))return c;if(!head&&!body)return c;if(h===39||ix>=14&&ix<18&&iz>=18&&iz<20||h===57&&iz>=18&&iz<20)return c;return null;}
const sculpture=[];
for(let h=9;h<78;h+=3){
 const occupied=new Set();const key=(x,z)=>x+','+z;
 function skin(x,z,dx,dz,turn){if(!outer(x,h,z))return;const above=outer(x,h+3,z),below=outer(x,h-3,z);if(above&&below)return;let len=2;if(!above){while(len<4&&!outer(x+dx*(len-1),h+3,z+dz*(len-1)))len++;}else{while(len<4&&!outer(x+dx*(len-1),h-3,z+dz*(len-1)))len++;if(len===3)len=4;}
 const cells=range(len).map(i=>[x+dx*i,z+dz*i]);if(cells.some(([a,b])=>!outer(a,h,b)||occupied.has(key(a,b))))return;
 let p=!above?({2:"11477",3:"50950",4:"61678"}[len]):(len===2?"3665a":"13547");
 if(len===2){const px=dz?1:0,pz=dx?1:0;const more=cells.map(([a,b])=>[a+px,b+pz]);if(!outer(x+px-dx,h,z+pz-dz)&&Boolean(outer(x+px,h+3,z+pz))===Boolean(above)&&outer(x+px,h,z+pz)===outer(x,h,z)&&more.every(([a,b])=>outer(a,h,b)&&!occupied.has(key(a,b)))){cells.push(...more);p=!above?"15068":"3660b";}}
 sculpture.push(place({part:p,at:[Math.min(...cells.map(a=>a[0])),lift+h,Math.min(...cells.map(a=>a[1]))],colour:outer(x,h,z),turn}));cells.forEach(([a,b])=>occupied.add(key(a,b)));
 }
 for(let x=0;x<32;x++){const zs=range(7,30).filter(z=>outer(x,h,z));if(zs.length){skin(x,zs[0],0,1,0);skin(x,zs[zs.length-1],0,-1,180);}}
 for(let z=7;z<30;z++){const xs=range(32).filter(x=>outer(x,h,z));if(xs.length){skin(xs[0],z,1,0,90);skin(xs[xs.length-1],z,-1,0,270);}}
}
for(let z=7;z<30;z++)for(let x=0;x<32;x++){let start=9,last=null;for(let h=9;h<=78;h+=3){const c=h<78?shell(x,h,z):null;if(c!==last){if(last)sculpture.push(box({at:[x,lift+start,z],size:[1,h-start,1],colour:last,interior:"solid"}));start=h;last=c;}}}
section("Interlocked body and shaped waving flippers",sculpture);
function foot(cx){const ops=[floor({at:[cx-3,5,12],size:[6,9],layers:3,colour:"yellow"}),box({at:[cx-3,8,15],size:[6,6,5],colour:"yellow",interior:"solid"})];for(let i=0;i<6;i++)ops.push(place({part:"61678",at:[cx-3+i,8,12],colour:"yellow"}));for(let i=0;i<6;i+=2)ops.push(place({part:"15068",at:[cx-3+i,11,15],colour:"yellow"}),place({part:"15068",at:[cx-3+i,11,19],colour:"yellow",turn:180}));return ops;}
section("Webbed feet and swept tail",[...foot(12),...foot(20),floor({at:[13,25,24],size:[6,6],layers:2,colour:"medium azure"}),...range(6).map(i=>place({part:"61678",at:[13+i,27,26],colour:"medium azure",turn:180}))]);
function eye(x){return [box({at:[x-1,55,11],size:[4,15,3],colour:"white",interior:"solid"}),place({part:"3660b",at:[x,56,10],colour:"black"}),box({at:[x,59,10],size:[2,6,2],colour:"black",interior:"solid"}),place({part:"3005",at:[x,62,10],colour:"white"}),place({part:"15068",at:[x,65,10],colour:"black"}),place({part:"15068",at:[x-1,70,11],colour:"white"}),place({part:"15068",at:[x+1,70,11],colour:"white"})];}
section("Bright eyes and rounded golden bill",[...eye(10),...eye(20),box({at:[13,49,10],size:[6,4,5],colour:"yellow",interior:"solid"}),...range(6).map(i=>place({part:"13547",at:[13+i,49,8],colour:"yellow"})),floor({at:[13,52,8],size:[6,5],colour:"bright light orange"}),...range(6).map(i=>place({part:"61678",at:[13+i,53,8],colour:"yellow"})),...range(3).map(i=>place({part:"15068",at:[13+2*i,53,12],colour:"yellow",turn:180}))]);
function bubble(x,z,h){return group({at:[x,2,z],ops:[column({at:[0,0,0],diameter:2,height:h,colour:"trans-clear"}),place({part:"4740",at:[0,h,0],colour:"trans-clear"}),place({part:"54821",at:[0,h+1,0],colour:"trans light blue"})]});}
section("Escaping fish and rising bubbles",[bubble(25,4,6),bubble(28,8,12),bubble(29,12,18),place({part:"64648",at:[23,2,3],colour:"orange"}),...[[20,2],[27,2],[22,7],[28,24],[26,28]].map(([x,z],i)=>place({part:"14769",at:[x,2,z],colour:i%3===0?"white":"medium azure"}))]);
section("Selective smooth finish",[smooth({region:{at:[13,16],size:[6,6]}})]);