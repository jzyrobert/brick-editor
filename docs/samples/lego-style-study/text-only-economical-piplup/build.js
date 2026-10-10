script({title:"Piplup's Bubble-Berg",description:"A bright-eyed Piplup waves from a compact sculpted ice floe while an orange fish escapes into three rising bubbles. Rounded cheeks, an inlaid navy forehead, a broad curved bill, webbed feet, scalloped collar and swept flippers retain the original character and story.",palette:{water:"trans light blue",ice:"white",penguin:"medium azure",hood:"dark blue",beak:"yellow"}});
const A="medium azure", N="dark blue", W="white", Y="yellow";
function corners(x,y,z,w,d,part,shade){return [[x,z,0],[x+w-2,z,270],[x,z+d-2,90],[x+w-2,z+d-2,180]].map(([px,pz,t])=>place({part,at:[px,y,pz],turn:t,colour:shade(px,pz,pz===z?"front":"back")}));}
function ring(x,y,z,w,d,kind,shade,skip=()=>false){
 const p=kind==="expand"?"3660b":kind==="curve"?"15068":"3039", out=[];
 for(let px=x+2;px<x+w-2;px+=2){
  if(!skip(px,"front"))out.push(place({part:p,at:[px,y,z],colour:shade(px,z,"front")}));
  out.push(place({part:p,at:[px,y,z+d-2],turn:180,colour:shade(px,z+d-2,"back")}));
 }
 for(let pz=z+2;pz<z+d-2;pz+=2){out.push(place({part:p,at:[x,y,pz],turn:90,colour:shade(x,pz,"left")}));out.push(place({part:p,at:[x+w-2,y,pz],turn:270,colour:shade(x+w-2,pz,"right")}));}
 return [...out,...corners(x,y,z,w,d,kind==="expand"?"1750":"3045",shade)];
}
const icePatches=[[6,13,20,13],[9,10,14,3],[9,26,14,3],[4,17,2,7],[26,16,2,8]];
const wakePatches=[[22,1,10,5],[25,6,9,5],[27,11,7,7],[26,18,6,4]];
section("An ice floe and its narrow bubbling wake",[
 ...wakePatches.map(([x,z,w,d])=>floor({at:[x,0,z],size:[w,d],layers:2,colour:"water",top:"tile"})),
 ...icePatches.map(([x,z,w,d])=>floor({at:[x,0,z],size:[w,d],layers:5,colour:W,top:"tile"})),
 ...range(7).flatMap(i=>[place({part:"15068",at:[9+2*i,2,10],colour:W}),place({part:"15068",at:[9+2*i,2,27],turn:180,colour:W})]),
 ...range(3).map(i=>place({part:"15068",at:[4,2,17+2*i],turn:90,colour:W})),
 ...range(4).map(i=>place({part:"15068",at:[26,2,16+2*i],turn:270,colour:W})),
 place({part:"2431",at:[7,4,25],colour:"blue"}),place({part:"3069b",at:[23,4,13],colour:"blue"}),
 ...[6,7].map(x=>place({part:"61678",at:[x,5,23],turn:180,colour:W})),
 place({part:"61678",at:[26,5,21],turn:180,colour:W})
]);
function foot(cx){return [
 floor({at:[cx-3,5,12],size:[6,11],layers:3,colour:Y}),
 box({at:[cx-3,8,16],size:[6,4,7],colour:Y,interior:"solid",top:"tile"}),
 ...range(3).map(i=>place({part:"93606",at:[cx-3+2*i,8,i===1?11:12],colour:Y})),
 place({part:"3004",at:[cx-1,8,15],colour:Y}),place({part:"3069b",at:[cx-1,11,15],colour:Y})
];}
const body=[...foot(12),...foot(20),floor({at:[11,12,17],size:[10,8],colour:A}),box({at:[14,12,19],size:[4,55,4],interior:"solid",colour:A})];
for(let i=0;i<4;i++)body.push(...ring(11-i,12+3*i,17-i,10+2*i,8+2*i,"expand",()=>A));
body.push(room({at:[8,24,14],size:[16,9,14],colour:A,openings:[]}));
for(let y=24;y<33;y+=3)body.push(...corners(8,y,14,16,14,"85080",()=>A));
body.push(floor({at:[8,24,14],size:[16,14],colour:A}),floor({at:[8,32,14],size:[16,14],colour:A}));
function button(x){return [place({part:"3660b",at:[x,24,14],colour:W}),place({part:"3004",at:[x,27,14],colour:W}),place({part:"15068",at:[x,30,14],colour:W})];}
body.push(...button(12),...button(18));
body.push(place({part:"15068",at:[10,30,14],colour:N}),place({part:"88930",at:[14,30,14],colour:N}),place({part:"15068",at:[20,30,14],colour:N}));
for(let i=0;i<3;i++)body.push(...ring(8+i,33+3*i,14+i,16-2*i,14-2*i,"curve",(x,z,side)=>i===0&&side==="front"&&x>=12&&x<20?A:N));
body.push(floor({at:[10,42,16],size:[12,10],colour:N}));
section("Webbed feet, round belly and scalloped collar",body);
function ribbon(x,y,tiers){return range(tiers).flatMap(i=>range(2).flatMap(j=>[place({part:"3660b",at:[x-i,y+3*i,18+2*j],turn:90,colour:A}),place({part:"3039",at:[x-i+2,y+3*i,18+2*j],turn:270,colour:A})]));}
section("A raised waving flipper, a lowered flipper and curved tail",[
 ...[18,20].map(z=>place({part:"2456",at:[6,24,z],colour:A})),
 ...ribbon(6,27,7),...ring(0,48,18,4,4,"curve",()=>A),place({part:"14769",at:[1,51,19],colour:A}),
 ...ribbon(27,12,5),...[18,20].map(z=>place({part:"2456",at:[21,27,z],colour:A})),
 place({part:"3031",at:[14,24,26],colour:A}),
 ...range(4).flatMap(i=>[place({part:"13547",at:[14+i,25,26],turn:180,colour:A}),place({part:"61678",at:[14+i,28,26],turn:180,colour:A})]),place({part:"2431",at:[14,31,26],colour:A})
]);
function lowerFace(x,z,side,y){if(side==="front"&&y>=46)return x<14||x>=18?W:A;return A;}
const head=[];
for(let i=0;i<4;i++){const y=43+3*i;head.push(...ring(9-i,y,15-i,14+2*i,12+2*i,"expand",(x,z,s)=>lowerFace(x,z,s,y),(x,s)=>s==="front"&&((y===49&&x>=13&&x<19)||(y===52&&x>=14&&x<18))));}
head.push(room({at:[6,55,12],size:[20,12,18],colour:A,openings:[]}));
for(let y=55;y<67;y+=3)head.push(...corners(6,y,12,20,18,"85080",(x,z,s)=>s==="front"?W:A));
function faceColour(x,y){let c=W;const half=y===55||y===58?1:y===61?2:3;if(x>=16-half&&x<16+half)c=N;if((x>=10&&x<12)||(x>=20&&x<22)){c="black";if(y===61&&(x===10||x===20))c=W;}return c;}
function faceRow(y){const out=[];let x=8;while(x<24){if(y===55&&((x>=10&&x<12)||(x>=20&&x<22))){x+=2;continue;}const c=faceColour(x,y);let end=x+1;while(end<24&&faceColour(end,y)===c&&!(y===55&&((end>=10&&end<12)||(end>=20&&end<22))))end++;while(x<end){const n=Math.min(4,end-x);out.push(place({part:{1:"3005",2:"3004",3:"3622",4:"3010"}[n],at:[x,y,12],colour:c}));x+=n;}}return out;}
for(let y=55;y<67;y+=3)head.push(...faceRow(y));
head.push(...[10,20].map(x=>place({part:"3660b",at:[x,55,12],colour:"black"})),floor({at:[6,66,12],size:[20,18],colour:A}));
function hood(x,z,side,y){if(y===67&&side==="front"){if(x===10||x===20)return "black";return x<14||x>=18?W:N;}return z<21?N:A;}
for(let i=0;i<7;i++){const y=67+3*i;head.push(...ring(6+i,y,12+i,20-2*i,18-2*i,i<2?"taper":"curve",(x,z,s)=>hood(x,z,s,y)));}
head.push(floor({at:[13,88,19],size:[6,2],colour:N,top:"tile"}),floor({at:[13,88,21],size:[6,2],colour:A,top:"tile"}));
section("Rounded head, white cheeks and sparkling inlaid eyes",head);
section("A broad curved golden bill",[
 box({at:[13,49,9],size:[6,4,15],colour:Y,interior:"solid"}),
 ...range(4).map(i=>place({part:"13547",at:[14+i,46,9],colour:"bright light orange"})),
 ...range(4).map(i=>place({part:"93606",at:[12+2*i,53,8],colour:Y}))
]);
function bubble(x,z,h){return group({at:[x,2,z],ops:[column({at:[1,0,1],diameter:2,height:h,colour:"trans-clear"}),place({part:"3960",at:[0,h,0],colour:"trans-clear"}),...range(2).map(i=>place({part:"3020",at:[0,h+2,2*i],colour:"trans-clear"})),place({part:"11833",at:[0,h+3,0],colour:"trans light blue"}),place({part:"86500",at:[0,h+4,0],colour:"trans light blue"})]});}
section("The escaping fish and three rising bubbles",[
 bubble(25,2,6),bubble(29,7,12),bubble(29,13,18),place({part:"64648",at:[23,2,2],colour:"orange"}),
 ...[[24,3],[30,3],[27,8],[32,11],[30,19]].map(([x,z],i)=>place({part:"14769",at:[x,2,z],colour:i%2?W:A}))
]);