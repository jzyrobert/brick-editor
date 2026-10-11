script({title:"Piplup — A Proud Little Wave",description:"A freestanding Piplup with a smoothly rounded oversized hood, white cheek lobes, shining black eyes, a yellow beak, two bib buttons, webbed feet and one flipper raised in greeting.",palette:{a:"medium azure",n:"dark blue",w:"white",y:"yellow",k:"black"},defaults:{interior:"empty"}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function foot(x,z){return [floor({at:[x,0,z],size:[3,4],colour:"y",layers:1}),range(3).map(i=>p("61678",[x+i,1,z],"y")),box({at:[x+1,4,z+3],size:[2,2,1],colour:"y",interior:"solid"})];}
section("Webbed feet",[foot(-4,-3),foot(1,-4)]);
section("Rounded body",[
 floor({at:[-3,6,-1],size:[6,5],layers:2,colour:"a",top:"tile"}),
 box({at:[-2,8,0],size:[4,18,4],colour:"a",interior:"solid",top:"tile"}),
 box({at:[-4,8,-1],size:[2,13,6],colour:"a",top:"tile"}),box({at:[2,8,-1],size:[2,13,6],colour:"a",top:"tile"}),
 [-4,2].map((x,i)=>range(-1,5,2).map(z=>p("15068",[x,21,z],"a",i?270:90))),
 [-3,-1,1].map(x=>p("3660b",[x,6,-3],"w")),
 box({at:[-3,9,-3],size:[6,9,2],colour:"w",top:"tile"}),
 [-3,-1,1].map(x=>p("15068",[x,18,-3],"w")),
 box({at:[-2,15,4],size:[4,6,1],colour:"n",top:"tile"}),[-2,0].map(x=>p("15068",[x,21,3],"n",180)),
 floor({at:[-3,24,-1],size:[6,5],layers:3,colour:"n",top:"tile"}),
 [-3,1].map(x=>p("15068",[x,21,-3],"n")),
 [-2,1].map(x=>box({at:[x,13,-3],size:[1,4,1],colour:"n",interior:"solid",top:"tile"})),
 p("3020",[-1,10,3],"a",90),p("15068",[-1,11,5],"a",180)
]);
section("Expressive flippers",[
 p("3678b",[-6,7,0],"a",90),box({at:[-6,13,0],size:[2,8,2],colour:"a",interior:"solid"}),p("15068",[-6,21,0],"a",90),p("3020",[-6,24,0],"a"),p("3068b",[-6,25,0],"a"),
 [0,1].map(z=>p("13547",[4,16,z],"a",270)),p("3795",[2,19,0],"a"),p("93606",[4,20,0],"a",270)
]);
section("Oversized rounded hood",[
 p("54091",[-4,27,-3],"a"),p("11301",[-6,27,-3],"a",90),p("11301",[4,27,-3],"a",270),
 box({at:[-4,33,-3],size:[8,9,8],colour:"a",interior:"empty"}),
 box({at:[-6,33,-3],size:[2,9,8],colour:"a",top:"tile"}),box({at:[4,33,-3],size:[2,9,8],colour:"a",top:"tile"}),
 box({at:[-4,33,3],size:[8,9,2],colour:"n",top:"tile"}),
 p("54095",[-4,42,-3],"n"),p("11290",[-6,42,-3],"n",90),p("11290",[4,42,-3],"n",270),
 box({at:[-1,37,-4],size:[2,5,1],colour:"a",interior:"solid",top:"tile"}),p("15068",[-1,42,-5],"n"),
 p("3020",[-1,39,-4],"a",90)
]);
function cheek(x){return [p("3660b",[x,30,-5],"w"),p("3660b",[x+2,30,-5],"w"),box({at:[x,33,-5],size:[4,6,2],colour:"w",interior:"solid"}),[0,2].map(i=>p("15068",[x+i,39,-5],"w")),[0,2].map(i=>p("3020",[x+i,36,-5],"w",90))];}
function eye(x,turn){return [p("3021",[x,33,-6],"w",90),box({at:[x,34,-6],size:[2,6,1],colour:"k",interior:"solid"}),p("11477",[x,40,-6],"k",turn),p("3024",[x,38,-6],"w")];}
section("Face and shining eyes",[cheek(-5),cheek(1),eye(-4,90),eye(2,270),
 p("3660b",[-1,30,-5],"y"),p("3020",[-1,33,-6],"y",90),p("24309",[-1,34,-6],"y")
]);