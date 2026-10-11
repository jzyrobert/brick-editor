script({title:"The Early Bird Express",description:"A jaunty white pelican pedals a sea-green delivery bicycle along a timber fishing pier, carrying the morning catch. His enormous golden pouch, swept black flight feathers and streaming red scarf make the silhouette unmistakable.",palette:{sea:"dark blue",timber:{mix:["tan","dark tan","reddish brown"]},bike:"dark turquoise"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour)=>box({at:[x,y,z],size:[w,h,d],colour,interior:"solid"});
const L=(a,b,colour)=>line({from:a,to:b,colour});
section("Shared harbour display",[
 floor({at:[0,0,0],size:[44,26],layers:2,colour:"black"}),
 floor({at:[0,2,0],size:[44,26],colour:"sea",top:"tile"}),
 floor({at:[0,3,6],size:[44,13],layers:3,colour:"timber",top:"tile"}),
 ...[0,43].map(x=>B(x,3,6,1,3,13,"dark brown")),
 ...[6,18].map(z=>B(0,3,z,44,3,1,"dark brown")),
 ...[2,12,33,41].flatMap(x=>[B(x,3,4,2,6,2,"reddish brown"),P("3068b",x,9,4,"dark tan"),B(x,3,19,2,6,2,"reddish brown"),P("3068b",x,9,19,"dark tan")]),
 ...range(11).map(i=>P("2431",i*4,6,6,i%3===0?"dark tan":"tan")),
 ...range(11).map(i=>P("2431",i*4,6,18,i%3===1?"dark tan":"tan")),
 ...[[4,1],[13,3],[25,1],[34,3],[6,23],[19,21],[30,24],[38,22]].flatMap(([x,z])=>[P("3710",x,3,z,"medium azure"),P("3069b",x+1,4,z,"trans light blue"),P("25269",x+4,3,z,"white")])
]);
function bollard(x,z){return [P("4032b",x,6,z,"dark bluish grey"),P("3941",x,7,z,"white"),P("3941",x,10,z,"dark red"),P("3941",x,13,z,"white"),P("14769",x,16,z,"dark bluish grey")];}
section("Pier life",[
 ...bollard(2,8),...bollard(39,15),
 B(1,6,14,5,1,3,"reddish brown"),B(1,7,14,5,6,1,"tan"),B(1,7,16,5,6,1,"tan"),B(1,7,15,1,6,1,"tan"),B(5,7,15,1,6,1,"tan"),
 ...[1,3,5].map(x=>P("2412b",x,13,14,"reddish brown",90)),
 P("64648",2,14,15,"sand green",90),P("64648",2,17,15,"medium azure",90),
 P("4032b",37,6,8,"white"),P("4032b",37,7,8,"red"),P("14769",37,8,8,"white"),
 ...[0,1,2].map(i=>P("6141",37+i,6,11,"dark tan"))
]);
function frame(z){return [L([8,18,z],[14,31,z],"bike"),L([14,31,z],[19,18,z],"bike"),L([19,18,z],[8,18,z],"bike"),L([19,18,z],[27,31,z],"bike"),L([14,31,z],[27,31,z],"bike"),L([27,31,z],[29,18,z],"bike"),L([27,31,z],[27,35,z],"light bluish grey")];}
section("Sea-green bicycle",[
 P("88517",3,6,11,"black"),P("88517",24,6,11,"black"),
 ...frame(9),...frame(15),
 L([19,18,9],[19,18,15],"bike"),L([14,31,9],[14,31,15],"bike"),L([27,31,9],[27,31,15],"bike"),
 B(19,6,11,2,12,2,"trans-clear"),
 B(13,31,10,5,2,5,"dark brown"),floor({at:[13,33,10],size:[5,5],colour:"black",top:"tile"}),
 P("3736",16,13,7,"light bluish grey"),B(19,18,8,1,3,1,"light bluish grey"),
 L([19,19,8],[22,22,8],"light bluish grey"),B(20,22,6,4,1,3,"black"),
 L([19,19,16],[16,17,17],"light bluish grey"),B(14,17,16,4,1,3,"black"),
 L([27,35,7],[27,35,18],"light bluish grey"),B(26,35,6,3,1,2,"black"),B(26,35,18,3,1,2,"black"),
 B(29,30,10,6,1,5,"bike"),floor({at:[29,31,10],size:[6,5],colour:"tan"}),
 box({at:[29,32,10],size:[6,6,5],colour:"tan",open:["top"],texture:"log"}),
 ...[10,14].map(z=>P("3666",29,38,z,"dark tan")),
 ...[29,34].map(x=>P("3623",x,38,11,"dark tan",90)),
 P("64648",30,38,11,"sand green",90),P("64648",31,39,12,"medium azure",90),P("8043",30,41,13,"white",90),
 B(27,32,9,2,1,1,"bike"),P("6141",28,33,9,"trans yellow"),
 floor({at:[7,28,15],size:[12,2],colour:"bike"}),P("6141",7,29,15,"trans red"),
 ...range(6).map(i=>P("3069b",7+i*2,29,16,"dark bluish grey"))
]);
section("Pedalling webbed feet",[
 L([18,33,11],[17,33,8],"orange"),L([17,33,8],[22,29,8],"orange"),L([22,29,8],[21,24,8],"orange"),
 L([18,33,15],[17,33,17],"orange"),L([17,33,17],[14,26,17],"orange"),L([14,26,17],[16,19,17],"orange"),
 P("3021",21,23,6,"orange"),P("15068",21,24,6,"bright light orange",270),P("11477",21,24,8,"bright light orange",270),
 P("3021",14,18,16,"orange"),P("15068",15,19,16,"bright light orange",270),P("11477",15,19,18,"bright light orange",270),
 P("15068",21,28,7,"orange"),P("15068",13,25,16,"orange")
]);
section("Sculpted pelican body",[
 ...[10,16].map(x=>P("45410",x,34,9,"white")),B(10,40,9,12,6,8,"white"),
 ...[10,16].map(x=>P("45411",x,46,9,"white")),
 B(9,38,10,2,2,6,"white"),B(21,38,10,2,2,6,"white"),
 ...[9,11,13,15].flatMap(z=>[P("15068",8,40,z,"white",90),P("15068",22,40,z,"white",270)]),
 floor({at:[5,39,11],size:[6,4],colour:"white"}),
 ...[11,13].map(z=>P("3710",6,39,z,"white")),
 ...[11,12,13,14].map(z=>P("61678",5,40,z,"black",90)),
 B(19,46,10,4,6,6,"white"),B(21,49,11,4,15,4,"white"),B(23,61,11,4,6,4,"white"),
 ...range(4).flatMap(i=>[P("4460b",19,52,11+i,"white",90),P("4460b",25,52,11+i,"white",270)]),
 ...[10,15].flatMap(z=>[B(21,52,z,4,9,1,"white"),P("15068",21,64,z,"white",90),P("15068",23,64,z,"white",270)]),
 ...[11,13].map(z=>P("15068",19,49,z,"white",90))
]);
function wing(z){return [floor({at:[7,39,z===7?7:16],size:[7,3],layers:2,colour:"white"}),B(11,41,z,10,3,2,"white"),P("44126",10,44,z,"black",90),P("15068",16,44,z,"white",90),P("15068",18,44,z,"white",270),L([19,44,z],[27,36,z],"white"),L([19,44,z+1],[27,36,z+1],"white"),P("15068",25,36,z,"white",270),P("15068",22,39,z,"white",270),P("15068",19,42,z,"white",270),P("61678",7,40,z,"black",90),P("61678",8,41,z+1,"black",90)];}
section("Wings on the handlebars",[...wing(7),...wing(17)]);
section("Long bill and generous pouch",[
 B(23,64,10,6,8,6,"white"),
 ...[9,16].map(z=>B(25,64,z,3,3,1,"white")),
 ...[10,12,14].flatMap(z=>[P("24309",23,72,z,"white",90),P("24309",26,72,z,"white",270)]),
 ...[9,16].flatMap(z=>[P("3005",26,67,z,"yellow"),P("3005",26,70,z,"black"),P("11477",25,73,z,"white",90)]),
 B(28,64,11,12,3,4,"bright light orange"),
 ...range(5).flatMap(i=>[P("32803",28+2*i,i===4?62:60,11,"yellow"),P("32803",28+2*i,i===4?62:60,13,"yellow")]),
 floor({at:[28,67,11],size:[12,4],colour:"dark orange"}),floor({at:[38,67,12],size:[4,2],colour:"yellow"}),
 ...range(3).flatMap(i=>range(4).map(j=>P("61678",28+4*i,68,11+j,"bright light orange",270))),
 ...[12,13].map(z=>P("11477",40,68,z,"yellow",270)),
 ...[11,14].map(z=>P("2431",29,67,z,"orange")),
 ...[11,14].map(z=>P("6141",32,71,z,"black"))
]);
section("Wind-blown courier scarf",[
 ...[10,15].flatMap(z=>[P("3004",21,61,z,"red"),P("3004",23,61,z,"red")]),
 ...[20,25].flatMap(x=>[P("3004",x,61,11,"red",90),P("3004",x,61,13,"red",90)]),
 floor({at:[14,64,15],size:[8,2],colour:"red"}),
 ...[15,16].map(z=>P("61678",14,65,z,"red",90)),
 P("3710",11,63,15,"red"),P("2431",11,64,15,"red"),P("3710",12,62,16,"dark red"),P("2431",12,63,16,"dark red")
]);