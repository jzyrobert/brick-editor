script({title:"Piplup — A Little Big Wave",description:"A palm-sized Piplup with a rounded blue hood, sculpted white cheek patches, bright beak, oval chest buttons, webbed feet and one raised flipper.",palette:{hood:"blue",body:"medium azure",face:"white",beak:"yellow"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function foot(x){return [floor({at:[x,0,-4],size:[3,4],colour:"beak",layers:1}),range(3).map(i=>P("50950",[x+i,1,-4],"beak")),P("3622",[x,1,-1],"beak")];}
section("Webbed feet",[-3,1].map(foot));
section("Connected egg-shaped body",[
 box({at:[-2,4,-1],size:[4,4,2],colour:"body",interior:"solid"}),
 range(4).map(i=>[P("24201",[-2+i,4,-3],"body"),P("24201",[-2+i,4,1],"body",180)]),
 [-1,0].map(z=>[P("24201",[-3,4,z],"body",90),P("24201",[1,4,z],"body",270)]),
 box({at:[-2,8,-3],size:[4,6,6],colour:"body",interior:"solid"}),box({at:[-3,8,-2],size:[6,6,4],colour:"body",interior:"solid"}),
 P("15068",[-1,14,-3],"body"),P("15068",[-1,14,1],"hood",180),P("15068",[-3,14,-1],"body",90),P("15068",[1,14,-1],"body",270),
 [[-3,-3,0],[1,-3,270],[1,1,180],[-3,1,90]].map(([x,z,t])=>P("3045",[x,14,z],z>0?"hood":"body",t)),
 box({at:[-1,14,-1],size:[2,3,2],colour:"hood",interior:"solid"}),
 [-2,1].map(x=>[P("5847",[x,8,-3],"face"),P("11477",[x,11,-3],"face")])
]);
function flipper(x,y,turn){return [P("24201",[x,y,0],"body"),P("24201",[x+1,y,0],"body"),box({at:[x,y+4,0],size:[2,4,2],colour:"body",interior:"solid"}),P("15068",[x,y+8,0],"body",turn)];}
section("A friendly wave",[flipper(-5,5,90),P("3020",[-5,9,0],"body"),P("3020",[2,11,0],"body"),P("15068",[2,12,0],"body",90),flipper(4,12,270)]);
section("Little tail",[P("3020",[-1,8,1],"hood",90),P("15068",[-1,9,3],"hood",180)]);
section("Round blue head",[
 box({at:[-2,17,-2],size:[4,3,4],colour:"hood",interior:"solid"}),
 [[-4,-4,0],[2,-4,270],[2,2,180],[-4,2,90]].map(([x,z,t])=>P("3676",[x,17,z],"hood",t)),
 [-2,0].map(x=>[P("3660b",[x,17,-4],"hood"),P("3660b",[x,17,2],"hood",180)]),
 [-2,0].map(z=>[P("3660b",[-4,17,z],"hood",90),P("3660b",[2,17,z],"hood",270)]),
 box({at:[-3,20,-4],size:[6,10,8],colour:"hood",interior:"empty"}),box({at:[-4,20,-3],size:[8,10,6],colour:"hood",interior:"empty"}),
 [[-4,-4,0],[1,-4,270],[1,1,180],[-4,1,90]].map(([x,z,t])=>P("73682",[x,30,z],"hood",t)),
 P("24309",[-1,30,-4],"hood"),P("24309",[-1,30,1],"hood",180),P("24309",[-4,30,-1],"hood",90),P("24309",[1,30,-1],"hood",270),
 box({at:[-1,30,-1],size:[2,3,2],colour:"hood",interior:"solid",top:"tile"})
]);
function cheek(x,eyeX){return [P("32803",[x,20,-4],"face"),box({at:[x,24,-4],size:[2,3,2],colour:"face",interior:"solid"}),P("3005pe4",[eyeX,24,-4],"face"),P("15068",[x,27,-4],"face")];}
section("Expressive face",[cheek(-3,-3),cheek(1,2),P("3021",[-1,22,-6],"beak",90),P("15068",[-1,23,-6],"beak")]);