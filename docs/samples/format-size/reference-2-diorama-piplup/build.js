script({title:"Piplup — The Bubble Lesson",description:"A proud little Piplup balances on a scalloped ice floe, spreading its flippers as its first Bubble attack skips across a sapphire tide pool. Its rounded blue hood, white cheek mask, twin breast spots and golden webbed feet frame the scene. Clear stems carry the rising bubbles, and a low crystalline outcrop finishes the back of the connected display.",defaults:{interior:"empty"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const W=24,D=20;
section("Connected sapphire display",[
 floor({at:[2,0,0],size:[W-4,D],layers:2,colour:"dark blue"}),
 floor({at:[0,0,2],size:[2,D-4],layers:2,colour:"dark blue"}),
 floor({at:[W-2,0,2],size:[2,D-4],layers:2,colour:"dark blue"}),
 floor({at:[2,2,2],size:[W-4,D-4],colour:"blue",top:"tile"}),
 floor({at:[2,2,0],size:[20,2],colour:"dark blue",top:"tile"}),
 floor({at:[2,2,18],size:[20,2],colour:"dark blue",top:"tile"}),
 floor({at:[0,2,2],size:[2,16],colour:"dark blue",top:"tile"}),
 floor({at:[22,2,2],size:[2,16],colour:"dark blue",top:"tile"})
]);
const ice=[box({at:[4,3,9],size:[10,4,8],colour:"white",top:"tile"}),box({at:[2,3,11],size:[2,4,5],colour:"white",top:"tile"}),box({at:[14,3,13],size:[2,4,4],colour:"white",top:"tile"})];
for(let x=4;x<14;x+=2){ice.push(P("15068",[x,4,8],"white"),P("15068",[x,4,16],"white",180));}
for(let z=11;z<15;z+=2){ice.push(P("15068",[2,4,z],"white",90));}
ice.push(P("15068",[14,4,13],"white",270),P("15068",[14,4,15],"white",270));
section("Scalloped ice landing",ice);
section("Webbed feet",[...[6,7,10,11].map(x=>P("50950",[x,7,9],"yellow"))]);
function ring(x,y,z,w,d,part,front,other){const ops=[];for(let i=0;i<w;i++){ops.push(P(part,[x+i,y,z],typeof front==="function"?front(i):front));ops.push(P(part,[x+i,y,z+d-2],other,180));}for(let k=2;k<d-2;k++){ops.push(P(part,[x,y,z+k],other,90),P(part,[x+w-2,y,z+k],other,270));}return ops;}
section("Rounded body and breast spots",[
 box({at:[7,10,12],size:[4,13,4],colour:"medium azure",interior:"solid"}),
 ...ring(6,10,11,6,6,"24201","medium azure","medium azure"),
 box({at:[6,14,11],size:[6,6,6],colour:"medium azure",interior:"empty"}),
 ...[7,10].flatMap(x=>[P("11477",[x,14,10],"white"),P("3062b",[x,17,11],"white")]),
 ...ring(6,20,11,6,6,"11477","dark blue","dark blue"),
 P("41769a",[8,14,16],"dark blue"),
 P("61678",[8,15,16],"dark blue",180),P("61678",[9,15,16],"dark blue",180)
]);
function flipper(left){const x=left?2:12,z=left?13:12,t=left?90:270;return [box({at:[left?4:10,16,z],size:[4,3,2],colour:"dark blue",interior:"solid"}),P(left?"41770a":"41769a",[x,19,z],"dark blue",t),P("61678",[x,20,z],"dark blue",t),P("61678",[x,20,z+1],"dark blue",t)];}
section("Spread flippers",[flipper(true),flipper(false)]);
const hx=5,hz=10;
section("Round hood and cheek mask",[
 P("41539",[hx,23,hz],"dark blue"),
 ...ring(hx,24,hz,8,8,"24201",i=>(i===3||i===4)?"medium azure":"white","dark blue"),
 box({at:[hx,28,hz],size:[8,9,8],colour:"dark blue",interior:"empty"}),
 box({at:[5,28,10],size:[3,6,2],colour:"white",interior:"solid"}),
 box({at:[10,28,10],size:[3,6,2],colour:"white",interior:"solid"}),
 box({at:[8,28,10],size:[2,9,2],colour:"medium azure",interior:"solid"}),
 ...[5,6,7,10,11,12].map(x=>P("11477",[x,34,10],"white")),
 ...range(4).flatMap(k=>[P("60481a",[5,31,12+k],"dark blue",90),P("60481a",[11,31,12+k],"dark blue",270)]),
 ...range(8).map(k=>P("60481a",[5+k,31,16],"dark blue",180)),
 P("3003pe2",[6,31,10],"white"),P("3003pe2",[10,31,10],"white"),
 P("54095",[5,37,10],"dark blue")
]);
section("Golden beak",[
 ...[8,9].map(x=>P("3710",[x,28,9],"yellow",90)),
 ...[8,9].map(x=>P("24201",[x,29,9],"yellow")),
 P("15068",[8,33,9],"yellow")
]);
const ripples=[[8,5,0],[11,3,0],[15,7,90],[18,9,0],[20,12,90],[5,6,0],[3,8,90]];
section("Bubble current",[
 ...ripples.map(([x,z,t])=>P("2431",[x,2,z],"trans light blue",t)),
 ...[[12,7],[14,6],[17,7],[18,4]].map(([x,z],i)=>P("98138",[x,3,z],i%2?"white":"trans light blue")),
 P("11477",[12,3,6],"trans light blue",270),
 P("11477",[15,3,8],"trans light blue",180),
 P("11477",[20,3,8],"trans light blue",90)
]);
function bubble(x,z,h){return [column({at:[x+1,3,z+1],height:h,diameter:2,colour:"trans-clear"}),P("3960",[x,3+h,z],"trans light blue"),P("86500",[x,5+h,z],"trans light blue")];}
section("Rising Bubble attack",[
 bubble(18,3,10),bubble(14,3,21),
 column({at:[11,3,3],height:4,diameter:2,colour:"trans-clear"}),
 P("3941",[11,7,3],"trans light blue"),P("4740",[11,10,3],"trans light blue")
]);
section("Low ice crystals",[
 box({at:[18,3,14],size:[4,3,4],colour:"medium azure",top:"tile"}),
 P("3684a",[18,6,15],"white",90),
 P("3941",[20,6,15],"trans light blue"),P("3039",[20,9,15],"trans light blue"),
 P("15068",[18,6,17],"white",180),
 P("15068",[20,6,17],"white",180),
 P("54200",[17,3,14],"white",90),P("54200",[21,3,13],"white",180)
]);