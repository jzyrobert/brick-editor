script({title:"Tour de Beak",description:"A determined pelican pedals a cherry-red bicycle, his enormous golden bill leading the way. Swept white wings steer, black feather tips grip the handlebars, and orange webbed feet work opposite pedals. Spoked wheels, a golden bell, and a discreet transparent crank support complete the character display.",palette:{bird:"white",feather:"black",bike:"red",bill:"yellow",pouch:"orange",metal:"light bluish grey"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const L=(from,to,colour)=>line({from,to,colour});
const wheelZ=[-13,7];
section("Spoked wheels and discreet support",[
 ...wheelZ.map(z=>P("88517",[0,0,z],"black",90)),
 ...wheelZ.map(z=>P("3707",[-3,11,z+5],"black")),
 floor({at:[-2,0,0],size:[6,5],layers:1,colour:"dark blue",top:"tile"}),
 box({at:[0,1,1],size:[2,11,2],colour:"trans-clear",interior:"solid"})
]);
function frame(x){return [
 L([x,27,-6],[x,29,7],"bike"),
 L([x,29,7],[x,12,2],"bike"),
 L([x,12,2],[x,27,-6],"bike"),
 L([x,29,7],[x,12,12],"bike"),
 L([x,12,2],[x,12,12],"bike"),
 L([x,12,-8],[x,27,-6],"bike"),
 L([x,27,-6],[x,37,-5],"metal"),
 ...wheelZ.map(z=>box({at:[x,9,z+4],size:[1,6,3],colour:"bike",interior:"solid",top:"tile"}))
];}
section("Open diamond bicycle frame",[
 frame(-3),frame(4),
 L([-3,12,2],[4,12,2],"metal"),
 L([-3,28,-6],[4,28,-6],"bike"),
 L([-3,30,7],[4,30,7],"bike"),
 box({at:[0,29,7],size:[2,3,1],colour:"metal",interior:"solid"}),
 floor({at:[-2,31,6],size:[6,3],colour:"black"}),
 P("88930",[-1,32,6],"black"),
 P("3069b",[-1,32,8],"black"),P("3069b",[1,32,8],"black"),
 box({at:[-5,37,-6],size:[11,1,1],colour:"metal",interior:"solid",top:"tile"}),
 P("63864",[-5,38,-6],"black"),P("63864",[3,38,-6],"black"),
 P("4740",[0,38,-6],"pearl gold"),P("6141",[0,39,-6],"pearl gold"),
 L([-3,12,2],[-5,16,0],"metal"),L([4,12,2],[5,12,5],"metal"),
 floor({at:[-6,15,-1],size:[3,3],colour:"black",top:"tile"}),
 floor({at:[4,11,4],size:[3,3],colour:"black",top:"tile"})
]);
function foot(x,y,z,right){return [
 P(right?"41769a":"41770a",[x,y,z],"pouch"),
 ...range(2).map(i=>P("54200",[x+i,y+1,z],"pouch"))
];}
section("Alternating webbed pedals",[
 foot(-5,16,-1,false),foot(4,12,3,true),
 L([-4,17,1],[-3,27,5],"pouch"),
 L([-3,27,5],[-2,36,7],"pouch"),
 L([5,13,5],[4,24,7],"pouch"),
 L([4,24,7],[3,36,7],"pouch"),
 P("11477",[-3,25,4],"pouch"),P("11477",[4,22,6],"pouch")
]);
section("Rounded belly and swept back",[
 ...range(8).map(i=>P("13547",[-3+i,35,3],"bird")),
 ...range(8).map(i=>P("13547",[-3+i,35,7],"bird",180)),
 box({at:[-3,38,3],size:[8,10,8],colour:"bird",interior:"empty",top:"tile"}),
 ...[-3,-1,1,3].map(x=>P("93606",[x,45,1],"bird")),
 ...[-3,-1,1,3].map(x=>P("44126",[x,48,7],"bird",180)),
 ...[3,5].map(z=>[
 P("24309",[-4,47,z],"bird",90),
 P("24309",[3,47,z],"bird",270)
 ]),
 floor({at:[-1,48,3],size:[4,4],layers:2,colour:"bird",top:"tile"}),
 floor({at:[-2,39,11],size:[6,6],colour:"bird",top:"tile"}),
 P("41769a",[-2,40,13],"bird",180),
 P("41770a",[2,40,13],"bird",180),
 ...range(2).map(x=>P("61678",[x,40,13],"feather",180))
]);
function wing(left){
 const x=left?-6:5;
 const y=left?42:40;
 const z=left?-3:-4;
 return [
 L([x+1,y+4,7],[x+1,y,1],"bird"),
 L([x+1,y,1],[x+1,39,-5],"bird"),
 ...range(3).map(i=>P("42022",[x+i,y,z],"bird")),
 ...range(3).map(i=>P("11477",[x+i,39,-6],"feather")),
 ...range(3).map(i=>P("13547",[x+i,y+2,3],"bird",180))
 ];
}
section("Wings steering the cruiser",[wing(true),wing(false)]);
section("S curved neck",[
 box({at:[-1,48,2],size:[4,20,3],colour:"bird",interior:"empty",top:"tile"}),
 ...[-1,1].map(x=>[
 P("3678b",[x,49,0],"bird"),
 P("93606",[x,55,0],"bird"),
 P("15068",[x,59,0],"bird"),
 P("15068",[x,65,3],"bird",180)
 ]),
 ...range(4).map(i=>P("24201",[-1+i,62,-1],"bird"))
]);
section("Pelican face and enormous golden bill",[
 box({at:[-2,66,-3],size:[6,9,6],colour:"bird",interior:"empty",top:"tile"}),
 P("3005pe4",[-2,72,-1],"white",90),
 P("3005pe4",[3,72,-1],"white",270),
 ...[-2,0,2].map(x=>[
 P("15068",[x,75,-3],"bird"),
 P("15068",[x,75,1],"bird",180)
 ]),
 floor({at:[-2,75,-1],size:[6,2],layers:3,colour:"bird",top:"tile"}),
 P("54200",[-2,75,-1],"bill",90),
 P("54200",[3,75,-1],"bill",270),
 ...range(2).map(x=>P("11477",[x,78,1],"bird",180)),
 P("61487",[-1,59,-7],"pouch"),
 ...range(2).map(x=>P("13547",[x,62,-11],"pouch")),
 box({at:[-1,65,-11],size:[4,1,8],colour:"pouch",interior:"solid",top:"tile"}),
 floor({at:[-1,66,-11],size:[4,8],colour:"dark orange"}),
 floor({at:[0,66,-15],size:[2,4],colour:"dark orange"}),
 P("44126",[0,67,-15],"bill"),
 ...[-1,1].map(x=>P("44126",[x,67,-9],"bill"))
]);