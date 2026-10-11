script({title:"Emberkeeper — The Last Egg",description:"An emerald dragon cups her lava-heated nest between ivory talons. Tall, scalloped wine-red wings shelter a golden egg; her long tail curls around the basalt crèche. A sculpted open jaw, watchful gold eyes, swept horns and plated throat give the guardian a gentle, powerful silhouette.",palette:{skin:"dark green",membrane:"dark red",ivory:"tan",gold:"pearl gold",rock:"dark bluish grey",lava:"orange"},defaults:{interior:"empty"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
section("Connected basalt display",[
 floor({at:[2,0,0],size:[32,30],layers:2,colour:"black",top:"tile"}),floor({at:[0,0,3],size:[36,24],layers:2,colour:"black",top:"tile"}),
 floor({at:[3,2,1],size:[30,28],colour:"rock"}),floor({at:[1,2,4],size:[34,22],colour:"rock"}),
 box({at:[10,3,11],size:[17,4,16],colour:"rock",top:"tile"}),box({at:[8,3,9],size:[5,3,6],colour:"rock",top:"tile"}),box({at:[20,3,8],size:[6,3,7],colour:"rock",top:"tile"}),
 cylinder({at:[10,3,2],diameter:8,height:3,colour:"rock"}),
 ...[[5,1,4,7],[6,8,3,6],[8,14,3,7],[10,21,3,4]].map(([x,z,w,d])=>floor({at:[x,3,z],size:[w,d],colour:"orange",top:"tile"})),
 ...[[5,1,3,6],[6,8,2,5],[8,15,2,5],[10,21,2,3]].map(([x,z,w,d])=>floor({at:[x,4,z],size:[w,d],colour:"trans orange",top:"tile"})),
 P("3678b",[2,3,8],"rock",90),P("3684a",[1,3,15],"rock",90),P("3678b",[3,3,20],"black",90),P("3684a",[4,3,24],"rock",180),P("3678b",[7,3,24],"rock",180),
 P("3039",[3,3,4],"black",90),P("3039",[8,3,6],"rock",270),P("3039",[5,3,12],"black",90),P("3039",[11,3,17],"rock",270),
 P("3298",[30,3,24],"rock",180),P("3039",[32,3,21],"black",270),P("3039",[29,3,10],"rock",270),
 P("15068",[20,3,3],"rock",180),P("15068",[23,3,5],"black",270),P("15068",[18,3,1],"black",180)
]);
section("The warm nest",[
 P("3960",[12,6,4],"reddish brown"),
 ...[[10,4],[16,4],[12,2],[12,8]].map(([x,z])=>P("4740",[x,6,z],"dark tan")),
 P("3676",[12,8,4],"yellow",0),P("3676",[14,8,4],"yellow",270),P("3676",[14,8,6],"yellow",180),P("3676",[12,8,6],"yellow",90),
 P("87081",[12,11,4],"yellow"),P("35320",[12,14,4],"pearl gold"),
 P("4589",[9,5,5],"trans orange"),P("4589",[7,5,9],"trans red"),P("54200",[6,5,3],"trans yellow"),
 P("98138",[17,6,8],"dark tan"),P("98138",[10,6,7],"reddish brown")
]);
function foreleg(x,z,y){return [
 floor({at:[x,y,z-1],size:[3,6],colour:"skin",top:"tile"}),
 ...range(3).map(i=>P("49668",[x+i,y+1,z-1],"ivory")),
 ...range(3).map(i=>P("11477",[x+i,y+1,z+1],"skin")),
 box({at:[x+1,y+1,z+3],size:[2,12,2],colour:"skin",top:"tile"}),
 P("4460b",[x+1,y+1,z+3],"skin"),P("4460b",[x+2,y+1,z+3],"skin"),P("15068",[x+1,y+10,z+3],"skin")
];}
function hindleg(x,z,y){return [
 floor({at:[x,y,z-1],size:[4,7],colour:"skin",top:"tile"}),
 ...[0,1,3].map(i=>P("49668",[x+i,y+1,z-1],"ivory")),
 P("15068",[x,y+1,z+1],"skin"),P("15068",[x+2,y+1,z+1],"skin"),
 box({at:[x+1,y+1,z+3],size:[2,8,3],colour:"skin",top:"tile"}),
 P("3660b",[x,y+3,z+3],"skin",90),P("3660b",[x+2,y+3,z+3],"skin",270),
 P("15068",[x,y+6,z+3],"skin",90),P("15068",[x+2,y+6,z+3],"skin",270),
 P("93273",[x+1,y+9,z+2],"skin"),P("93273",[x+2,y+9,z+2],"skin")
];}
section("Four grounded taloned limbs",[
 ...foreleg(10,9,6),...foreleg(21,8,6),...hindleg(12,20,7),...hindleg(22,21,7),
 box({at:[12,16,13],size:[4,5,3],colour:"skin",top:"tile"}),box({at:[20,16,12],size:[3,6,4],colour:"skin",top:"tile"}),
 P("93606",[11,19,14],"skin",90),P("15068",[20,22,14],"skin",270)
]);
section("Rounded torso and plated throat",[
 box({at:[15,14,15],size:[8,13,8],colour:"skin",top:"tile"}),box({at:[17,16,13],size:[4,12,3],colour:"skin",top:"tile"}),
 ...[17,20,23].flatMap(y=>[P("15068",[17,y,13],"gold"),P("15068",[19,y,13],"gold")]),
 ...[17,19].flatMap(z=>[P("3660b",[13,18,z],"skin",90),P("3660b",[23,18,z],"skin",270),P("93606",[12,21,z],"skin",90),P("93606",[22,21,z],"skin",270)]),
 ...[15,16,17,19,20,21,22].map(x=>P("93273",[x,27,18],"skin")),
 floor({at:[18,27,16],size:[1,7],colour:"skin",top:"tile"}),...[17,20,22].map(z=>P("4589",[18,28,z],"ivory")),
 P("3298",[16,24,21],"skin",180),P("3298",[20,24,21],"skin",180),
 box({at:[16,25,11],size:[6,9,5],colour:"skin",top:"tile"}),box({at:[15,32,10],size:[5,5,4],colour:"skin",top:"tile"}),
 box({at:[17,25,10],size:[2,3,2],colour:"skin",top:"tile"}),box({at:[16,28,9],size:[2,3,3],colour:"skin",top:"tile"}),box({at:[15,31,8],size:[2,3,3],colour:"skin",top:"tile"}),
 P("15068",[17,26,10],"gold"),P("15068",[16,29,9],"gold"),P("15068",[15,32,8],"gold"),
 ...[[14,27,12,90],[14,30,11,90],[13,33,10,90],[21,27,12,270],[20,30,11,270],[19,33,10,270]].map(([x,y,z,t])=>P("15068",[x,y,z],"skin",t)),
 ...range(16,21).map(x=>P("61678",[x,34,13],"skin",180))
]);
section("Watchful face and swept ivory horns",[
 floor({at:[12,33,5],size:[7,7],layers:2,colour:"skin",top:"tile"}),box({at:[14,33,10],size:[5,6,3],colour:"skin",top:"tile"}),
 ...[12,14,16].map(x=>P("15068",[x,32,4],"skin")),P("11477",[18,32,4],"skin"),
 floor({at:[13,35,6],size:[5,4],colour:"black",top:"tile"}),P("4589",[13,35,5],"ivory"),P("4589",[17,35,5],"ivory"),
 floor({at:[11,38,4],size:[9,8],colour:"skin",top:"tile"}),box({at:[12,38,8],size:[7,4,5],colour:"skin",top:"tile"}),
 ...range(12,18).map(x=>P("61678",[x,39,4],"skin")),P("6141",[13,42,7],"black"),P("6141",[16,42,7],"black"),
 P("3039p50",[11,39,8],"black",90),P("3039p50",[18,39,8],"black",270),
 P("15068",[11,42,9],"skin",90),P("15068",[18,42,9],"skin",270),
 P("3031",[13,42,10],"skin"),
 ...[13,15].flatMap(x=>[P("15068",[x,43,10],"skin"),P("15068",[x,43,12],"skin",180)]),
 P("11089",[13,46,11],"ivory"),P("11089",[16,46,11],"ivory"),P("4589",[14,46,12],"gold"),
 P("3023b",[11,42,11],"skin"),P("3023b",[18,42,11],"skin"),P("49668",[11,43,11],"ivory",90),P("49668",[18,43,11],"ivory",270)
]);
function wing(right,y,z){const ops=[];const q=(part,x,dy,dz,w,t=0,c="skin",other=part)=>{ops.push(P(right?other:part,[right?36-x-w:x,y+dy,z+dz],c,right?(360-t)%360:t));};const panel=(x,dy,w,h)=>ops.push(box({at:[right?36-x-w:x,y+dy,z+5],size:[w,h,1],colour:"membrane"}));
 ops.push(box({at:[right?20:12,y-1,z+2],size:[4,3,4],colour:"skin",top:"tile"}));
 q("30355",1,0,0,12,90,"membrane","30356");[1,7].forEach(x=>q("3666",x,1,5,6));
 panel(1,2,2,9);panel(3,11,2,9);panel(5,11,2,9);panel(7,5,2,6);
 q("2449",3,2,5,2,90,"membrane");q("2449",5,2,5,2,270,"membrane");q("3665a",7,2,5,2,270,"membrane");
 [[1,11,90],[3,20,90],[5,20,270],[7,11,270],[9,2,270]].forEach(([x,dy,t])=>q("4460b",x,dy,5,2,t));q("3040b",11,2,5,2,270);
 q("3710",3,29,5,4);q("4589",4,30,5,1,0,"ivory");
 q("41770a",9,1,2,4,90,"skin","41769a");q("93606",9,2,2,4,90);
 [9,11].forEach(x=>q("3068b",x,1,0,2,0,"membrane"));q("3068b",7,1,2,2,0,"membrane");[9,11].forEach(x=>q("3069b",x,1,4,2,0,"membrane"));q("4589",12,6,2,1,0,"ivory");return ops;}
section("Raised scalloped sheltering wings",[...wing(false,26,14),...wing(true,27,16)]);
section("A curling tail encloses the crèche",[
 box({at:[18,10,22],size:[4,7,5],colour:"skin",top:"tile"}),box({at:[21,8,24],size:[6,5,3],colour:"skin",top:"tile"}),box({at:[27,6,21],size:[4,5,6],colour:"skin",top:"tile"}),
 floor({at:[25,11,24],size:[4,2],colour:"skin",top:"tile"}),box({at:[27,4,18],size:[3,5,4],colour:"skin",top:"tile"}),box({at:[27,3,15],size:[2,2,5],colour:"skin",top:"tile"}),
 ...range(18,22).map(x=>P("61678",[x,17,23],"skin",180)),P("15068",[21,13,26],"skin",180),P("93606",[23,13,24],"skin",270),
 ...range(27,31).map(x=>P("93273",[x,11,22],"skin")),...range(27,30).map(x=>P("50950",[x,9,18],"skin")),P("41747",[27,5,14],"skin"),
 P("4589",[19,20,23],"ivory"),P("4589",[23,17,24],"ivory"),P("4589",[28,15,23],"ivory"),P("54200",[28,12,20],"gold")
]);