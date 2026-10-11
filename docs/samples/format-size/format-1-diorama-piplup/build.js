script({title:"Piplup's First Bubble",description:"A round, bright-eyed Piplup balances on a sculpted ice floe, reaching a flipper toward its first enormous Bubble attack. A curious fish watches below; a trail of smaller bubbles crosses the blue meltwater.",palette:{blue:"medium azure",cap:"dark blue",snow:"white",water:"dark blue"},defaults:{interior:"empty"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
section("Rounded display and meltwater",[
 floor({at:[2,0,0],size:[22,22],layers:2,colour:"black",top:"tile"}),floor({at:[0,0,2],size:[26,18],layers:2,colour:"black",top:"tile"}),
 floor({at:[2,2,1],size:[22,20],colour:"water",top:"tile"}),floor({at:[1,2,2],size:[24,18],colour:"water",top:"tile"}),
 floor({at:[2,3,3],size:[6,3],colour:"trans light blue",top:"tile"}),floor({at:[17,3,2],size:[7,4],colour:"trans light blue",top:"tile"}),floor({at:[20,3,15],size:[4,5],colour:"trans light blue",top:"tile"})
]);
const snowLip=(x,z,turn=0)=>P("3037",x,3,z,"white",turn);
section("Piplup's ice floe",[
 box({at:[7,3,9],size:[12,3,8],colour:"white",top:"tile"}),
 ...[7,11,15].map(x=>snowLip(x,7)),
 floor({at:[7,6,8],size:[12,9],colour:"white",top:"tile"}),
 P("15068",5,3,10,"white",90),P("15068",5,3,13,"white",90),P("15068",19,3,11,"white",270),
 floor({at:[8,3,17],size:[9,3],layers:2,colour:"white",top:"tile"}),
 P("30357",2,3,8,"white"),P("15068",3,4,9,"white"),
 P("30357",20,4,3,"white",180)
]);
section("Blue glacier pinnacle",[
 box({at:[2,3,16],size:[5,9,2],colour:"white",top:"tile"}),
 P("3678b",3,3,14,"white"),P("3678b",3,3,18,"white",180),P("3678b",1,3,16,"white",90),
 P("4460b",4,6,16,"white"),P("54200",4,15,17,"trans light blue"),
 P("15068",5,3,18,"white",180),P("11477",2,12,16,"white",90)
]);
const foot=x=>P("93606",x,7,7,"yellow");
section("Yellow paddles and rounded torso",[
 ...[10,14].map(foot),
 box({at:[10,11,10],size:[6,13,6],colour:"blue",top:"tile"}),
 ...[10,15].map(x=>P("24201",x,11,9,"blue")),
 ...[10,15].map(x=>P("3005",x,15,9,"blue")),
 ...[10,15].map(x=>P("11477",x,18,9,"blue")),
 ...[11,13].map(x=>P("32803",x,11,8,"white")),
 box({at:[11,15,8],size:[4,3,2],colour:"white",interior:"solid"}),
 ...[11,14].map(x=>P("3005",x,15,8,"blue")),
 ...[11,13].map(x=>P("15068",x,18,8,"white")),
 ...[10,12,14].map(x=>P("15068",x,21,9,"cap")),
 box({at:[10,18,14],size:[6,3,3],colour:"cap"}),
 ...[10,12,14].map(x=>P("24309",x,21,14,"cap",180)),
 P("3795",12,12,14,"cap",90),P("93606",12,13,16,"cap",180)
]);
section("One flipper reaching, one flipper balancing",[
 P("3678b",8,11,12,"blue",90),P("3020",8,17,12,"blue"),P("15068",8,18,12,"blue",90),
 P("3795",14,17,11,"blue"),P("15068",14,18,11,"blue",270),P("93606",16,18,11,"blue",270)
]);
section("Spherical head and signature face",[
 P("54091",9,24,8,"blue"),
 box({at:[9,30,8],size:[8,6,8],colour:"blue",top:"tile"}),
 P("54095",9,36,8,"cap"),
 ...[10,14].map(x=>P("32803",x,26,6,"white")),
 ...[10,14].map(x=>box({at:[x,30,6],size:[2,3,3],colour:"white",interior:"solid"})),
 ...[10,14].map(x=>P("15068",x,33,6,"white")),
 ...[10,15].map(x=>P("3005pe4",x,30,6,"white")),
 P("3678b",12,30,7,"cap"),
 P("3020",12,29,4,"black",90),P("15068",12,30,4,"yellow"),P("3004",12,30,6,"yellow")
]);
const littleBubble=(x,y,z)=>[P("3941",x,y,z,"trans-clear"),P("30151a",x,y+3,z,"trans light blue")];
section("First Bubble attack",[
 column({at:[21,3,10],height:18,diameter:2,colour:"trans-clear"}),
 P("3960",20,21,9,"trans light blue"),P("86500",20,23,9,"trans light blue"),
 ...littleBubble(17,4,3),P("30151a",22,4,17,"trans light blue"),
 P("64648",4,4,4,"orange"),
 ...[[8,4,4],[9,3,5],[15,3,5],[20,3,8],[23,3,14],[3,3,12],[6,3,18]].map(([x,y,z],i)=>P("98138",x,y,z,i%3===0?"white":"trans-clear")),
 P("2431",10,3,3,"white"),P("3069b",12,3,4,"trans light blue"),P("3069b",20,3,19,"white")
]);