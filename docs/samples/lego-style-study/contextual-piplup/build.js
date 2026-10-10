script({title:"Piplup's Bubble-Berg",description:"Piplup waves from a compact drifting ice floe as an orange fish escapes through rising bubbles. Rounded azure plumage, expressive white cheeks, a navy hood and collar, a golden bill, webbed feet and a little curved tail preserve the original character and scene.",palette:{water:"trans light blue",ice:"white",penguin:"medium azure",hood:"dark blue",beak:"yellow"}});
const lift=6;
section("The drifting floe",[
 ...[[11,8,13,2],[8,10,18,5],[5,15,24,9],[7,24,20,5],[11,29,10,1],[23,2,5,6],[27,5,4,10]].map(([x,z,w,d])=>floor({at:[x,0,z],size:[w,d],colour:"water",top:"tile"})),
 ...[[8,12,16,15],[11,10,10,2],[6,16,2,8],[24,18,3,5],[11,27,10,2]].map(([x,z,w,d])=>floor({at:[x,1,z],size:[w,d],layers:5,colour:"ice",top:"tile"})),
 ...range(5).map(i=>place({part:"15068",at:[11+i*2,1,8],colour:"white"})),
 ...[[6,21,90],[25,20,270],[13,27,180]].map(([x,z,t])=>place({part:"15068",at:[x,6,z],colour:"white",turn:t})),
 ...[[10,25,0],[23,19,90],[20,27,0]].map(([x,z,t])=>place({part:"3069b",at:[x,6,z],colour:"blue",turn:t}))
]);
function ell(x,y,z,cx,cy,cz,rx,ry,rz){return ((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1;}
function headColour(x,y,z){let c="medium azure";if(z<19&&(y>=61||(y>=51&&Math.abs(x-16)<2+(y-51)*0.13)))c="dark blue";if(z<17&&[10.5,21.5].some(ex=>((x-ex)/5)**2+((y-55)/13)**2<=1))c="white";if(z<19&&y>=53&&Math.abs(x-16)<1.3+(y-53)*0.13)c="dark blue";for(const ex of [10.5,21.5]){const front=19-8*Math.sqrt(Math.max(0,1-((x-16)/10)**2-((y-55)/21)**2));if(((x-ex)/1.6)**2+((y-58)/7.5)**2<=1&&z<front+2.2){c="black";if(Math.abs(x-ex)<0.6&&y>=60&&y<63&&z<front+1.5)c="white";}}return c;}
function bodyColour(x,y,z){let c="medium azure";if(y>=37||(y>=31&&(x<12||x>20)))c="dark blue";if(z<17&&[13,19].some(ex=>((x-ex)/1.5)**2+((y-27)/4)**2<=1))c="white";return c;}
function colourAt(ix,h,iz){const x=ix+0.5,y=h+1.5,z=iz+0.5;const head=ell(x,y,z,16,55,19,10,21,8),body=ell(x,y,z,16,27,20,7.5,21,6),diaphragm=h===24||h===39||h===57;if(head&&(!ell(x,y,z,16,55,19,9,18,7)||diaphragm))return headColour(x,y,z);if(body&&(!ell(x,y,z,16,27,20,6.5,18,5)||diaphragm))return bodyColour(x,y,z);if(ell(x,y,z,8-0.22*(y-25),36,20,2.7,13,2.3))return "medium azure";if(ell(x,y,z,24+0.2*(32-y),24,20,2.7,12,2.3))return "medium azure";if([12,20].some(cx=>ell(x,y,z,cx,4.5,17,3.5,4.5,5)))return "yellow";if(h>=9&&h<69&&ix>=14&&ix<18&&iz>=18&&iz<22)return "medium azure";return null;}
const sculpture=[],occupied=new Set();
const key=(x,y,z)=>x+','+y+','+z;
function reserve(x,h,z,w,d,height=3){for(let a=x;a<x+w;a++)for(let b=z;b<z+d;b++)for(let k=h;k<h+height;k++)occupied.add(key(a,k,b));}
function skin(part,x,h,z,c,turn=0,w=1,d=2){if(turn===90||turn===270){const v=w;w=d;d=v;}for(let a=x;a<x+w;a++)for(let b=z;b<z+d;b++)for(let k=h;k<h+3;k++)if(occupied.has(key(a,k,b)))return;reserve(x,h,z,w,d);sculpture.push(place({part,at:[x,lift+h,z],colour:c,turn}));}
function roundedRim(h,cx,cy,cz,rx,ry,rz,frontColour,part="11477"){const y=h+1.5;for(let x=Math.ceil(cx-rx);x<cx+rx;x++){const zs=[];for(let z=Math.ceil(cz-rz);z<cz+rz;z++)if(ell(x+0.5,y,z+0.5,cx,cy,cz,rx,ry,rz))zs.push(z);if(zs.length<4)continue;const f=zs[0],b=zs[zs.length-1];skin(part,x,h,f,frontColour?frontColour(x+0.5,y,f+0.5):"medium azure");skin(part,x,h,b-1,"medium azure",180);}for(let z=Math.ceil(cz-rz)+2;z<cz+rz-2;z++){const xs=[];for(let x=Math.ceil(cx-rx);x<cx+rx;x++)if(ell(x+0.5,y,z+0.5,cx,cy,cz,rx,ry,rz))xs.push(x);if(xs.length<4)continue;skin(part,xs[0],h,z,"medium azure",90);skin(part,xs[xs.length-1]-1,h,z,"medium azure",270);}}
// Connected curved bands shape the crown and shoulder transitions.
[63,66,69].forEach(h=>roundedRim(h,16,55,19,10,21,8,headColour));
[30,33].forEach(h=>roundedRim(h,16,27,20,7.5,21,6,bodyColour));
for(let x=12;x<20;x++){skin("61678",x,72,15,"dark blue",0,1,4);skin("61678",x,72,19,"medium azure",180,1,4);}
for(let x=10;x<22;x++)skin("13547",x,36,14,"white",0,1,4);
for(let x=12;x<20;x++)skin("13547",x,12,16,"medium azure",0,1,4);
roundedRim(36,16,55,19,10,21,8,headColour,"3665a");
roundedRim(9,16,27,20,7.5,21,6,bodyColour,"3665a");
// The greeting flipper and resting flipper retain their different gestures.
for(let z=18;z<22;z++){skin("61678",2,45,z,"medium azure",90,1,4);skin("61678",25,18,z,"medium azure",270,1,4);}
function foot(cx){for(let i=0;i<3;i++)skin("11477",cx-2+i*2,0,12,"yellow");for(let i=0;i<5;i++)skin("61678",cx-2+i,6,14,"yellow",0,1,4);}
[12,20].forEach(foot);
for(let i=0;i<4;i++)skin("61678",14+i,21,25,"medium azure",180,1,4);
// Reserve the bill before laying the surrounding shell.
reserve(13,42,9,6,5);reserve(12,45,10,8,4);reserve(12,48,8,8,4);reserve(14,51,11,4,3);
function freeColour(x,h,z){if(occupied.has(key(x,h,z))||occupied.has(key(x,h+1,z))||occupied.has(key(x,h+2,z)))return null;return colourAt(x,h,z);}
const lengths=[6,4,3,2,1],bricks={1:"3005",2:"3004",3:"3622",4:"3010",6:"3009"};
// Economical hollow skin, a continuous spine and three binding diaphragms.
for(let h=0;h<78;h+=3){for(let z=5;z<30;z++){let x=0;while(x<32){const c=freeColour(x,h,z);if(!c){x++;continue;}let end=x+1;while(end<32&&freeColour(end,h,z)===c)end++;if([24,39,57].includes(h)){sculpture.push(floor({at:[x,lift+h,z],size:[end-x,1],layers:3,colour:c}));x=end;continue;}while(x<end){const n=lengths.find(n=>n<=end-x);sculpture.push(place({part:bricks[n],at:[x,lift+h,z],colour:c}));x+=n;}}}}
sculpture.push(box({at:[13,48,9],size:[6,3,5],colour:"bright light orange",interior:"solid",top:"tile"}),box({at:[12,51,10],size:[8,3,4],colour:"yellow",interior:"solid"}));
for(let x=12;x<20;x+=2)sculpture.push(place({part:"15068",at:[x,54,8],colour:"yellow"}),place({part:"15068",at:[x,54,10],colour:"yellow",turn:180}));
sculpture.push(box({at:[14,57,11],size:[4,3,3],colour:"yellow",interior:"solid",top:"tile"}));
section("Piplup — waving captain",sculpture);
function bubble(x,z,h){return group({at:[x,1,z],ops:[column({at:[0,0,0],diameter:1,height:h,colour:"trans-clear"}),place({part:"4740",at:[0,h,0],colour:"trans-clear"}),place({part:"54821",at:[0,h+1,0],colour:"trans light blue"})]});}
section("The escaping fish and bubble trail",[bubble(25,4,6),bubble(28,8,12),bubble(29,12,18),place({part:"64648",at:[23,1,3],colour:"orange"}),...[[22,7],[5,17],[9,27],[26,26]].map(([x,z],i)=>place({part:"14769",at:[x,1,z],colour:i%2?"white":"medium azure"}))]);