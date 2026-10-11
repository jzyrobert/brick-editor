script({title:"Special Delivery: the Pelican Pedal Post",description:"A bright-eyed pelican pedals a scarlet bicycle down a saltwater jetty, carrying the morning fish in a blue rear crate. His great golden bill and orange throat pouch lead the way; black-tipped wings steer, while broad webbed feet catch the pedals at different heights.",palette:{bird:"white",bill:"yellow",pouch:"orange",frame:"red",wood:"dark tan",sea:"dark azure"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour,extra={})=>box({at,size,colour,...extra});
const F=(at,size,colour,layers=1,top)=>floor({at,size,colour,layers,...(top?{top}: {})});
section("Connected jetty and tide",[
 F([0,0,0],[30,20],"dark bluish grey",2),
 F([0,2,0],[30,5],"sea",1,"tile"),F([0,2,15],[30,5],"sea",1,"tile"),
 B([1,2,5],[28,3,10],"reddish brown",{top:"tile"}),
 ...range(14).map(i=>F([1+i*2,4,5],[2,10],i%3===0?"tan":"wood",1,"tile")),
 ...[[4,1],[8,2],[21,1],[26,17],[17,18],[3,17]].map(([x,z])=>P("11477",[x,3,z],"white",90)),
 P("64648",[24,3,2],"medium azure",90)
]);
function bollard(x,z,h){return [column({at:[x,5,z],height:h,diameter:1,colour:"reddish brown"}),P("6141",[x,5+h,z],"tan"),P("98138",[x,6+h,z],"tan")];}
section("Jetty fittings",[
 bollard(2,5,7),bollard(27,14,9),bollard(2,14,5),
 B([25,5,12],[2,1,2],"light bluish grey",{top:"tile"}),
 P("4032b",[25,6,12],"orange"),P("14769",[25,7,12],"white"),
 P("6141",[25,8,12],"orange"),
 ...range(4).map(i=>P("98138",[3+i*7,5,5],"dark bluish grey"))
]);
const rear=5,front=20,near=6,far=10;
const tube=(a,b)=>line({from:a,to:b,colour:"frame"});
function wheel(x){return [P("33211",[x-2,5,8],"black"),tube([x,12,near],[x,12,far])];}
section("Scarlet bicycle",[
 wheel(rear),wheel(front),
 tube([rear,12,near],[12,12,near]),tube([12,12,near],[11,23,near]),tube([11,23,near],[rear,12,near]),
 tube([11,23,near],[20,24,near]),tube([20,24,near],[12,12,near]),
 tube([front,12,near],[20,27,near]),tube([front,12,far],[20,27,far]),
 tube([rear,12,far],[6,20,far]),
 B([12,5,8],[2,15,2],"trans-clear",{interior:"solid"}),
 F([10,22,7],[5,4],"black"),
 F([20,26,4],[1,10],"black"),
 B([20,24,8],[1,3,2],"light bluish grey"),
 P("6141",[20,27,7],"pearl gold"),
 tube([12,12,near],[12,12,4]),tube([12,12,far],[12,17,13]),
 F([10,11,3],[4,2],"black"),F([11,16,13],[4,2],"black"),
 F([3,20,6],[6,6],"black",1,"tile")
]);
section("The fish delivery",[
 B([3,21,7],[5,6,5],"dark blue",{open:["top"]}),
 ...[7,11].map(z=>F([3,27,z],[5,1],"medium azure",1,"tile")),
 P("64648",[4,23,8],"medium azure"),P("64648",[6,24,8],"orange"),
 P("2412b",[3,25,7],"light bluish grey"),P("2412b",[5,25,7],"light bluish grey")
]);
section("Webbed feet on the pedals",[
 P("88930",[10,12,3],"yellow"),
 B([12,15,4],[2,9,2],"yellow"),P("11477",[12,18,4],"yellow",270),
 P("88930",[11,17,13],"yellow",180),
 B([13,20,11],[2,4,3],"yellow"),P("15068",[13,20,11],"yellow",180)
]);
section("Pelican rounded body",[
 P("54091",[9,23,5],"white"),
 B([10,29,7],[7,6,4],"white"),
 ...[9,13].flatMap(x=>[P("88930",[x,29,5],"white"),P("88930",[x,29,11],"white",180)]),
 ...[7,9].flatMap(z=>[P("93606",[8,29,z],"white",90),P("93606",[15,29,z],"white",270)]),
 P("78522",[9,35,7],"white",90),
 P("3020",[12,32,4],"white",90),P("3020",[12,32,10],"white",90),
 P("41769a",[6,27,7],"white",90),P("41770a",[6,27,9],"white",90),
 P("61678",[6,28,7],"black",90),P("61678",[6,28,10],"black",90)
]);
function wing(z){return [P("61678",[12,33,z],"white",270),P("61678",[15,30,z],"white",270),P("61678",[18,27,z],"black",90)];}
section("Wings steering",[wing(4),wing(13)]);
section("S neck and courier scarf",[
 B([16,32,8],[2,11,2],"white"),
 ...[16,17].flatMap(x=>[P("60481a",[x,37,7],"white"),P("60481a",[x,37,9],"white",180)]),
 B([16,35,8],[2,2,2],"medium azure"),
 P("3710",[12,36,9],"medium azure"),P("2431",[12,37,9],"medium azure")
]);
section("Bright eyed pelican and great bill",[
 ...[16,18].flatMap(x=>[P("32803",[x,43,7],"white"),P("32803",[x,43,9],"white",180)]),
 B([16,47,7],[4,3,4],"white"),
 P("3005pe4",[18,47,7],"white"),P("3005pe4",[18,47,10],"white",180),
 P("88930",[16,50,7],"white"),P("88930",[16,50,9],"white",180),
 P("54200",[16,53,8],"white",90),
 F([18,42,7],[8,4],"yellow",2),
 P("43713",[20,39,7],"orange",270),
 F([20,44,7],[6,4],"black"),F([26,44,8],[2,2],"black"),
 P("43712",[20,45,7],"yellow",270),P("15068",[26,45,8],"yellow",270)
]);