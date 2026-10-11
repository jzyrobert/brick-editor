script({title:"Catch of the Day — Pelican Pedal Express",description:"A magnificent white pelican pedals a turquoise bicycle, its great golden pouch and long bill leading the way. A blue fish peeks from the bill; feathered wings grip the handlebars and broad orange feet work opposite pedals. Real brick-built spoked wheels and a discreet transparent rear support make a freestanding display.",palette:{bird:"white",frame:"medium azure",bill:"yellow",pouch:"orange",metal:"light bluish grey",tyre:"black"}});
const B=(at,size,colour,extra={})=>box({at,size,colour,interior:"solid",...extra});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function strip(y,z,d,h,c){const a=[];while(d>0){let n=Math.min(d,h===3?8:6);const catalog=h===3?{1:["3004",0],2:["3003",0],3:["3002",90],4:["3001",90],6:["2456",90],8:["3007",90]}:{1:["3023b",0],2:["3022",0],3:["3021",90],4:["3020",90],6:["3795",90]};while(!catalog[n])n--;const [p,t]=catalog[n];a.push(P(p,[-1,y,z],c,t));z+=n;d-=n;}return a;}
function wheel(zc){const a=[];for(let k=0;k<14;k++){const y=3*k,h=Math.min(3,40-y),dy=y+h/2-20;const o=Math.max(1,Math.ceil(8*Math.sqrt(Math.max(0,1-dy*dy/400))));const i=Math.abs(dy)<16?Math.max(0,Math.floor(6*Math.sqrt(1-dy*dy/256))):0;if(i===0)a.push(strip(y,zc-o,2*o,h,"tyre"));else{a.push(strip(y,zc-o,o-i,h,"tyre"),strip(y,zc+i,o-i,h,"tyre"));if(i>1)a.push(strip(y,zc-i,1,h,"metal"),strip(y,zc+i-1,1,h,"metal"));}}for(const [dz,y] of [[0,35],[5,29],[5,11],[0,5],[-5,11],[-5,29]])a.push(line({from:[-1,20,zc],to:[-1,y,zc+dz],colour:"metal"}));a.push(B([-4,19,zc-1],[8,3,2],"dark bluish grey"),P("3062b",[-4,22,zc-1],"metal"),P("3062b",[3,22,zc-1],"metal"),P("15068",[-1,40,zc-2],"black"),P("15068",[-1,40,zc],"black",180));return a;}
section("Two sculpted spoked wheels",[-12,12].map(wheel));
section("Transparent display cradle",[floor({at:[-6,0,9],size:[2,6],layers:1,colour:"trans-clear"}),floor({at:[4,0,9],size:[2,6],layers:1,colour:"trans-clear"}),column({at:[-6,1,11],diameter:2,height:18,colour:"trans-clear"}),column({at:[4,1,11],diameter:2,height:18,colour:"trans-clear"}),B([-6,19,11],[12,1,2],"trans-clear")]);
function tube(a,b,c="frame",width=1){return range(width).map(i=>line({from:[a[0]+i,a[1],a[2]],to:[b[0]+i,b[1],b[2]],colour:c}));}
section("Diamond frame and pedalling feet",[
 tube([-1,21,0],[-1,42,6]),tube([-1,42,6],[-1,42,-10]),tube([-1,42,-10],[-1,21,0]),
 ...[-3,2].map(x=>tube([x,20,12],[x,42,6])),...[-3,2].map(x=>tube([x,20,12],[x,21,0])),...[-3,2].map(x=>tube([x,20,-12],[x,42,-10])),
 B([-3,41,5],[6,3,3],"frame"),B([-4,43,-11],[8,2,3],"frame"),B([-2,39,-11],[4,7,3],"frame"),B([-1,42,5],[2,4,2],"metal"),B([-3,45,3],[6,2,6],"black",{top:"tile"}),
 B([-7,45,-11],[14,2,1],"metal"),B([-8,45,-12],[3,2,2],"black"),B([5,45,-12],[3,2,2],"black"),P("4740",[1,47,-12],"pearl gold"),
 B([-5,22,-1],[10,2,2],"dark bluish grey"),B([-6,24,-4],[4,2,5],"orange"),B([2,18,1],[4,2,5],"orange"),
 B([-5,20,-2],[2,4,3],"metal"),B([3,18,2],[2,6,2],"metal"),
 range(4).map(i=>P("11477",[-6+i,26,-4],"orange")),range(4).map(i=>P("11477",[2+i,20,1],"orange")),P("3024",[-4,26,-1],"orange"),P("3024",[3,20,4],"orange"),
 tube([-4,27,-1],[-3,48,5],"orange"),tube([3,21,4],[2,48,7],"orange")
]);
const body=[];
for(let k=0;k<10;k++){const y=47+3*k,t=(k+0.5-5)/5,f=Math.sqrt(Math.max(0.12,1-t*t)),rx=Math.max(3,Math.round(7*f)),rz=Math.max(4,Math.round(9*f));for(let dz=-rz;dz<rz;dz++){const q=(dz+0.5)/rz,w=Math.max(1,Math.round(rx*Math.sqrt(Math.max(0,1-q*q))));body.push(B([-w,y,5+dz],[2*w,3,1],"bird",k>6?{top:"tile"}:{}));}}
body.push(carve({at:[-4,50,0],size:[8,24,10]}),column({at:[-2,47,3],height:30,diameter:4,colour:"white"}));
section("Hollow sculpted pelican torso",body);
section("Back and tail plumage",[
 B([-4,52,11],[8,1,11],"white"),range(8).map(i=>P("61678",[-4+i,53,17],i===0||i===7?"white":"black",180)),range(6).map(i=>P("50950",[-3+i,56,12],"white",180)),
 range(3).map(i=>P("15068",[-3+2*i,77,3],"white",180)),range(3).map(i=>P("15068",[-3+2*i,77,1],"white"))
]);
section("Curving neck",[
 B([-3,68,-5],[6,9,7],"white",{top:"tile"}),B([-3,77,-7],[6,9,6],"white",{top:"tile"}),B([-3,86,-9],[6,9,6],"white",{top:"tile"}),
 range(3).map(i=>P("24309",[-3+2*i,74,-7],"white")),range(3).map(i=>P("24309",[-3+2*i,83,-9],"white")),range(3).map(i=>P("24309",[-3+2*i,92,-11],"white")),B([-3,95,-9],[6,3,6],"white")
]);
const head=[];for(const [y,h,w,d,z] of [[92,3,6,7,-10],[95,3,8,9,-12],[98,3,8,9,-12],[101,3,6,8,-11]])head.push(B([-Math.round(w/2),y,z],[w,h,d],"white",{top:"tile"}));
head.push(P("87087",[-4,98,-7],"black",90),P("87087",[3,98,-7],"black",270),P("11477",[-5,101,-7],"white",90),P("11477",[3,101,-7],"white",270),P("15068",[-2,104,-9],"white"),P("15068",[0,104,-9],"white"),P("15068",[-2,104,-7],"white",180),P("15068",[0,104,-7],"white",180));
section("Bright watchful face",head);
section("Long bill and capacious pouch",[
 B([-2,82,-18],[4,3,8],"pouch"),B([-3,85,-22],[6,3,13],"pouch"),B([-4,88,-25],[8,3,16],"pouch"),B([-4,91,-27],[8,3,17],"pouch",{top:"tile"}),
 B([-3,94,-29],[6,1,19],"orange",{top:"tile"}),B([-2,94,-32],[4,1,3],"orange",{top:"tile"}),B([-3,95,-13],[6,3,3],"orange"),B([-2,98,-29],[4,1,17],"bill"),B([-1,98,-33],[2,1,4],"bill"),
 range(2).map(i=>P("61678",[-1+i,99,-33],"yellow")),range(7).map(i=>P("87079",[-2,99,-29+2*i],"yellow")),range(4).map(i=>P("11477",[-2+i,85,-20],"orange")),
 P("64648",[-3,95,-22],"medium azure"),P("54200",[-1,94,-33],"orange"),P("54200",[0,94,-33],"orange")
]);
function steeringWing(side){const x=side<0?-8:6,wrist=side<0?-7:5,shoulderZ=side<0?0:2;return [tube([x,64,shoulderZ],[wrist,47,-10],"white",2),B([x-1,60,0],[3,6,10],"white",{top:"tile"}),B([x-1,57,6],[3,3,9],"white",{top:"tile"}),range(3).map(i=>P("61678",[x-1+i,60,10],i===1?"black":"white",180)),range(3).map(i=>P("61678",[x-1+i,63,6],"white",180)),range(3).map(i=>P("50950",[x-1+i,66,1],"white")),range(3).map(i=>P("11477",[wrist+i-1,47,-11],"white"))];}
section("Wings steer the bicycle",[-1,1].map(steeringWing));