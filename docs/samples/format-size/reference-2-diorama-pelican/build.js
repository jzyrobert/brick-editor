script({title:"The Fish Express",description:"A white pelican pedals a scarlet bicycle along the harbour boardwalk, webbed feet on opposing pedals and wings gripping the handlebars. His long golden bill and orange throat pouch lead the way; fresh fish ride in a wicker basket, with a blue cooler on the rear rack. A compact clear stand steadies the bicycle.",defaults:{interior:"empty"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const F=(x,y,z,w,d,colour,layers=1,top)=>floor({at:[x,y,z],size:[w,d],colour,layers,top});
const L=(a,b,colour)=>line({from:a,to:b,colour});
section("Harbour display",[
 F(0,0,0,40,22,"black",2),F(0,2,0,40,8,"dark azure",1,"tile"),
 box({at:[0,2,8],size:[40,2,13],colour:"dark bluish grey",interior:"solid"}),
 ...range(20).map(i=>F(i*2,4,8,2,13,i%4===0?"tan":"dark tan",1,"tile")),
 ...[2,11,21,30,37].map(x=>column({at:[x,5,20],height:9,diameter:1,colour:"reddish brown"})),
 F(2,14,20,36,1,"dark brown",1,"tile"),
 ...[[4,3],[5,3],[6,3],[16,2],[17,2],[26,5],[27,5]].map(([x,z])=>P("11477",x,3,z,"white")),
 ...[[10,1],[22,4],[29,2]].map(([x,z])=>P("25269",x,3,z,"white")),
 P("4032b",34,3,3,"light bluish grey"),P("3941",34,4,3,"red"),P("3941",34,7,3,"white"),P("3942c",34,10,3,"red"),
 column({at:[21,5,11],diameter:2,height:14,colour:"trans-clear"})
]);
const fork=z=>[
 L([11,18,z],[14,36,z],"red"),P("4460b",11,18,z,"red",90),P("4460b",12,27,z,"red",90),
 L([29,18,z],[25,34,z],"red"),L([22,20,z],[29,18,z],"red"),
 P("3700",10,17,z,"light bluish grey"),P("3700",28,17,z,"light bluish grey")
];
section("Scarlet bicycle",[
 P("2903c02",6,5,11,"light bluish grey"),P("2903c02",24,5,11,"light bluish grey"),
 fork(10),fork(13),
 L([14,34,10],[25,34,10],"red"),L([25,34,10],[22,20,10],"red"),L([22,20,10],[14,34,10],"red"),
 L([22,20,13],[25,34,13],"red"),L([22,19,9],[29,18,9],"dark bluish grey"),
 box({at:[21,19,10],size:[2,3,4],colour:"dark bluish grey",interior:"solid"}),F(21,22,9,2,5,"dark bluish grey"),
 F(13,36,10,3,4,"red"),F(24,34,10,4,4,"red"),F(24,35,10,4,4,"black",2),
 column({at:[14,37,11],height:2,diameter:2,colour:"light bluish grey"}),
 F(13,39,6,2,12,"light bluish grey"),P("3023b",13,40,6,"black"),P("3023b",13,40,17,"black"),
 P("3700",21,19,9,"black"),L([22,20,9],[20,22,7],"light bluish grey"),L([22,20,14],[23,27,16],"light bluish grey"),
 F(18,22,6,4,2,"black"),F(22,27,16,4,2,"black"),
 F(7,32,9,9,6,"dark bluish grey",1,"tile"),F(27,32,9,11,6,"dark bluish grey",1,"tile"),
 box({at:[32,33,10],size:[5,6,4],colour:"medium azure",interior:"solid"}),F(32,39,10,5,4,"white",1,"tile"),
 P("2412b",33,40,11,"dark bluish grey"),P("11477",37,33,11,"red",270)
]);
section("Fish basket",[
 F(7,33,9,6,6,"tan"),box({at:[7,34,9],size:[6,6,6],colour:"tan",texture:"grille",open:["top"]}),
 F(8,34,10,4,4,"medium azure"),
 floor({at:[7,40,9],size:[6,6],colour:"tan",top:"tile",holes:[{at:[8,10],size:[4,4]}]}),
 P("64648",8,35,10,"orange",90),P("64648",8,35,12,"medium azure",90),P("64648",10,38,11,"sand green")
]);
const foot=(x,y,z)=>[
 P("43723a",x,y,z,"orange",90),P("85984",x,y+1,z,"orange",90),P("54200",x+2,y+1,z,"orange",90)
];
section("Pedalling feet",[
 foot(18,23,6),foot(22,28,16),
 L([24,37,8],[22,31,7],"orange"),L([22,31,7],[20,25,7],"orange"),
 L([25,37,15],[24,32,16],"orange"),L([24,32,16],[23,30,16],"orange")
]);
const wing=z=>[
 L([14,40,z+1],[24,46,z+1],"white"),
 P("44126",14,41,z,"white",90),P("44126",20,44,z,"white",90),P("24309",26,44,z,"black",270)
];
section("Pelican sculpted body",[
 P("45410",21,37,8,"white"),F(20,43,8,8,8,"white"),
 box({at:[20,43,9],size:[8,7,6],colour:"white",interior:"solid"}),
 F(20,43,6,6,12,"white"),F(18,46,9,12,6,"white"),
 ...[20,22,24,26].map(x=>[P("15068",x,44,8,"white"),P("15068",x,44,14,"white",180),P("15068",x,47,8,"white"),P("15068",x,47,14,"white",180)]),
 ...[10,12].map(z=>[P("15068",18,47,z,"white",90),P("15068",28,47,z,"white",270)]),
 P("78522",20,50,8,"white",90),P("78522",20,50,12,"white",90),
 ...[8,10,12,14].map(z=>P("15068",26,50,z,"white",270)),
 wing(6),wing(16),
 F(26,43,10,6,4,"white"),P("41769a",28,44,10,"white",270),P("41770a",28,44,12,"white",270),
 P("24309",30,45,10,"black",270),P("24309",30,45,12,"black",270)
]);
section("S neck and alert face",[
 box({at:[18,46,10],size:[4,15,4],colour:"white",interior:"solid"}),
 ...range(10,14).map(z=>[P("4460b",17,49,z,"white",90),P("6091",16,58,z,"white",90)]),
 box({at:[15,61,9],size:[6,5,6],colour:"white",interior:"solid"}),
 P("3005pe4",17,63,9,"white"),P("3005pe4",17,63,14,"white",180),
 ...[15,17,19].map(x=>[P("15068",x,66,9,"white"),P("15068",x,66,13,"white",180)]),
 F(15,66,11,6,2,"white",1,"tile"),
 floor({at:[17,55,9],size:[6,6],colour:"medium azure",top:"tile",holes:[{at:[18,10],size:[4,4]}]}),
 F(22,55,14,7,2,"medium azure",1,"tile"),P("15068",27,55,14,"medium azure",270)
]);
section("Long bill and pendulous pouch",[
 ...range(9,15).map(z=>P("42023",9,55,z,"orange",90)),
 box({at:[11,58,10],size:[4,3,4],colour:"orange",interior:"solid"}),
 P("42022",9,58,9,"orange",90),P("42022",9,58,14,"orange",90),
 F(5,60,10,10,4,"black"),F(5,61,10,12,4,"yellow"),F(3,61,11,2,2,"yellow"),
 P("42918",5,62,10,"yellow",90),P("42918",5,62,12,"yellow",90),
 P("15068",13,62,10,"yellow",90),P("15068",13,62,12,"yellow",90),P("15068",3,62,11,"yellow",90)
]);