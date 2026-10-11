script({title:"Tour de Pelican — lunch on the go",description:"A long-billed white pelican pedals a cherry-red bicycle, webbed feet at different crank heights, wings on the handlebars and a fish poking out of its golden pouch. Sculpted belly, swept black flight feathers and a compact kickstand make a freestanding character model.",palette:{feather:"white",flight:"black",frame:"red",bill:"yellow",pouch:"orange",metal:"light bluish grey"}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const tube=(from,to,colour)=>line({from,to,colour});
const wheels=[-14,3];
section("Spoked wheels and stable kickstand",[
 ...wheels.map(z=>p("88517",[0,0,z],"black",90)),
 ...wheels.map(z=>tube([-2,12,z+5],[3,12,z+5],"metal")),
 tube([-4,0,0],[0,14,0],"dark bluish grey"),
 floor({at:[-5,0,-1],size:[3,3],colour:"dark bluish grey",top:"tile"})
]);
section("Open diamond bicycle frame",[
 tube([0,14,0],[0,26,-5],"frame"),tube([1,14,0],[1,26,-5],"frame"),
 tube([0,26,-5],[0,26,4],"frame"),tube([1,26,-5],[1,26,4],"frame"),
 floor({at:[0,27,-5],size:[2,10],colour:"frame",top:"tile"}),
 tube([0,14,0],[0,26,4],"frame"),tube([1,14,0],[1,26,4],"frame"),
 tube([-2,12,8],[-2,26,4],"frame"),tube([3,12,8],[3,26,4],"frame"),
 tube([-2,26,4],[3,26,4],"frame"),
 tube([-2,12,8],[-2,14,0],"frame"),tube([3,12,8],[3,14,0],"frame"),
 tube([-2,14,0],[3,14,0],"frame"),
 ...[-2,3].map(x=>tube([x,12,-9],[x,27,-5],"metal")),
 tube([-2,27,-5],[3,27,-5],"frame"),
 column({at:[0,14,1],height:13,diameter:2,colour:"metal"}),
 column({at:[0,26,-6],height:6,colour:"metal"}),
 box({at:[-5,32,-6],size:[12,1,1],colour:"metal",interior:"solid",top:"tile"}),
 box({at:[-5,32,-7],size:[2,1,2],colour:"black",interior:"solid",top:"tile"}),
 box({at:[5,32,-7],size:[2,1,2],colour:"black",interior:"solid",top:"tile"}),
 p("15068",[-1,27,1],"black"),p("15068",[1,27,1],"black"),
 p("3705",[-1,15,0],"black"),
 tube([-4,18,0],[0,16,0],"metal"),tube([1,16,0],[5,23,0],"metal"),
 box({at:[-5,17,-1],size:[3,1,2],colour:"black",interior:"solid"}),
 box({at:[4,22,-1],size:[3,1,2],colour:"black",interior:"solid"})
]);
function foot(x,y){return [p("41769a",[x,y,-2],"orange"),p("15068",[x,y+1,0],"orange")];}
section("Webbed feet at opposite pedal heights",[
 ...foot(-5,18),...foot(4,23),
 tube([-4,21,1],[-3,30,4],"orange"),tube([-3,30,4],[-2,32,4],"orange"),
 tube([5,26,1],[4,32,4],"orange")
]);
section("Rounded body and swept tail",[
 p("45410",[-2,30,0],"feather"),
 box({at:[-2,36,0],size:[6,3,8],colour:"feather",interior:"solid"}),
 p("45411",[-2,39,0],"feather"),
 p("3795",[0,36,7],"feather",90),
 p("61678",[0,37,8],"flight",180),p("61678",[1,37,8],"flight",180)
]);
function wing(x){return [
 tube([x,33,-6],[x,37,1],"feather"),tube([x+1,33,-6],[x+1,37,1],"feather"),
 floor({at:[x,38,2],size:[2,6],colour:"feather",top:"tile"}),
 p("42022",[x,36,-4],"feather"),p("42022",[x+1,36,-4],"feather"),
 p("61678",[x,39,2],"feather",180),p("61678",[x+1,39,2],"feather",180),
 p("11477",[x,39,6],"flight",180),p("11477",[x+1,39,6],"flight",180)
];}
section("Wings gripping the handlebars",[
 floor({at:[-4,37,2],size:[10,2],colour:"feather"}),...wing(-4),...wing(4)
]);
section("Long curved neck",[
 box({at:[-1,45,0],size:[4,4,4],colour:"feather",interior:"solid",top:"tile"}),
 box({at:[-1,40,-1],size:[4,18,3],colour:"feather",interior:"solid"}),
 p("93606",[-1,42,-4],"feather"),p("93606",[1,42,-4],"feather"),
 ...range(4).map(i=>p("50950",[-1+i,49,-3],"feather")),
 ...range(4).map(i=>p("50950",[-1+i,49,2],"feather",180)),
 box({at:[-1,52,-3],size:[4,7,3],colour:"feather",interior:"solid"})
]);
section("Expressive head and enormous bill",[
 box({at:[-2,57,-5],size:[6,6,5],colour:"feather",interior:"solid"}),
 p("3005pe4",[-2,60,-4],"white",90),p("3005pe4",[3,60,-4],"white",270),
 ...[-2,0,2].map(x=>p("15068",[x,63,-5],"feather")),
 ...[-2,0,2].map(x=>p("24309",[x,63,-3],"feather",180)),
 ...range(4).map(i=>p("42023",[-1+i,50,-11],"pouch")),
 box({at:[-1,53,-11],size:[4,5,6],colour:"pouch",interior:"solid"}),
 p("93606",[-1,54,-11],"pouch"),p("93606",[1,54,-11],"pouch"),
 floor({at:[-1,58,-15],size:[4,11],colour:"black",top:"tile"}),
 p("42918",[-1,59,-13],"bill"),p("42918",[1,59,-13],"bill"),
 ...range(4).map(i=>p("11477",[-1+i,59,-15],"bill")),
 p("3710",[2,57,-6],"orange"),p("64648",[3,58,-6],"medium azure",90)
]);