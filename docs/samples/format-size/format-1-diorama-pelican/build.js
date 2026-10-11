script({title:"The Early Bird Express",description:"A long-billed pelican pedals a red delivery bicycle along a seaside boardwalk, wings on the handlebars and a basket of fish behind the saddle. Spoked wheels, alternating webbed feet, a deep orange throat pouch and wind-swept feathers give the bird a purposeful cycling gesture.",palette:{frame:"red",feather:"white",bill:"yellow",pouch:"orange"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour,extra={})=>box({at,size,colour,interior:"solid",...extra});
const L=(from,to,colour)=>line({from,to,colour});
const W=42,D=20;
section("Seaside display",[
 floor({at:[0,0,0],size:[W,D],layers:2,colour:"black"}),
 floor({at:[0,2,0],size:[W,5],colour:"dark azure",top:"tile"}),
 floor({at:[0,2,5],size:[W,15],colour:"tan",top:"tile"}),
 floor({at:[1,3,7],size:[39,9],colour:"dark tan",top:"tile"}),
 ...range(13).map(i=>floor({at:[1+i*3,3,7],size:[1,9],colour:i%3===0?"reddish brown":"tan",top:"tile"})),
 ...[[3,3,2],[7,3,3],[10,3,2],[31,3,1],[34,3,2]].map(a=>P("11477",a,"white",90)),
 P("14769",[5,3,5],"white"),P("98138",[7,3,6],"dark tan"),P("14769",[35,3,17],"white"),
 P("32607",[2,3,18],"dark green"),P("32607",[39,3,18],"green"),
 column({at:[20,4,10],height:16,diameter:2,colour:"trans-clear"})
]);
function wheel(x){return P("88517c01",[x,4,9],"light bluish grey");}
function frameSide(z){return [
 L([8,20,z],[17,35,z],"frame"),L([8,20,z],[21,20,z],"frame"),
 L([17,35,z],[21,20,z],"frame"),L([21,20,z],[28,35,z],"frame"),
 B([17,35,z],[12,2,1],"frame",{top:"tile"}),
 L([28,35,z],[30,20,z],"frame"),B([17,35,z],[1,4,1],"frame"),
 L([28,35,z],[28,43,z],"light bluish grey"),
 P("3700",[7,19,z],"red"),P("3700",[29,19,z],"red")
];}
section("Red bicycle",[
 wheel(2),wheel(24),...frameSide(7),...frameSide(12),
 B([20,20,7],[3,2,6],"red"),
 floor({at:[15,38,8],size:[6,6],colour:"black",layers:2,top:"tile"}),
 P("3035",[13,39,7],"white"),P("3035",[13,39,11],"white"),
 L([28,43,5],[28,43,15],"light bluish grey"),
 B([27,43,4],[2,2,2],"black",{top:"tile"}),B([27,43,14],[2,2,2],"black",{top:"tile"}),
 P("3941",[28,44,9],"light bluish grey"),P("14769",[28,47,9],"yellow"),
 B([20,21,5],[3,2,3],"black",{top:"tile"}),B([18,28,12],[3,2,4],"black",{top:"tile"}),
 L([8,20,7],[8,37,7],"red"),L([8,20,12],[8,37,12],"red"),
 floor({at:[3,37,7],size:[9,8],colour:"reddish brown"}),
 floor({at:[4,38,8],size:[7,6],colour:"tan"}),
 B([4,39,8],[7,5,6],"dark tan",{open:["top"],interior:"empty",texture:"log"}),
 P("64648",[5,39,10],"medium azure"),P("8043",[7,39,10],"white"),
 P("3069b",[4,44,8],"reddish brown"),P("3069b",[4,44,13],"reddish brown"),
 P("6141",[30,36,7],"trans yellow"),P("6141",[8,36,12],"trans red")
]);
section("Pedalling feet",[
 L([17,41,6],[19,34,6],"orange"),L([19,34,6],[21,26,6],"orange"),
 B([20,25,5],[2,2,2],"orange"),P("15068",[20,23,5],"orange",270),
 L([16,41,15],[17,35,15],"orange"),L([17,35,15],[19,33,15],"orange"),
 B([18,33,14],[2,2,2],"orange"),P("15068",[18,30,14],"orange",270)
]);
section("Rounded pelican body",[
 B([14,40,9],[6,4,4],"white"),
 ...range(7,15).map(z=>P("13547",[10,40,z],"white",90)),
 ...range(7,15).map(z=>P("13547",[18,40,z],"white",270)),
 B([11,43,7],[11,5,8],"white"),
 B([12,48,9],[10,3,3],"white",{top:"tile"}),
 ...range(5).map(i=>P("93606",[12+i*2,48,5],"white")),
 ...range(5).map(i=>P("93606",[12+i*2,48,12],"white",180)),
 ...range(7,15).map(z=>P("11477",[10,46,z],"white",90)),
 floor({at:[6,43,9],size:[8,4],colour:"black"}),
 floor({at:[9,43,8],size:[5,6],colour:"black"}),
 ...range(8,14).map(z=>P("50950",[7,44,z],"black",90)),
 ...range(9,13).map(z=>P("11477",[5,44,z],"black",90)),
 B([20,48,8],[4,7,6],"white"),
 ...[8,10,12].map(z=>P("24309",[22,48,z],"white",270))
]);
function wing(z,rootZ){return [
 B([12,45,rootZ],[5,3,4],"white"),B([9,47,z],[8,1,1],"white"),
 B([16,44,z],[8,3,1],"white"),B([21,42,z],[7,2,1],"white"),B([26,44,z],[1,1,1],"white"),
 P("93606",[10,48,z-1],"white",90),P("11477",[8,48,z],"black",90),
 P("61678",[14,48,z],"white",270),
 P("61678",[18,46,z],"white",270),
 P("61678",[22,44,z],"white",270),
 P("11477",[26,45,z],"white",270)
];}
section("Wings steering",[...wing(4,4),...wing(15,12)]);
section("Long neck and expressive head",[
 B([21,53,9],[3,6,4],"white"),B([23,57,9],[3,8,4],"white"),
 ...[9,11].map(z=>P("11477",[21,57,z],"white",90)),
 ...range(8,14).map(z=>P("13547",[22,60,z],"white",90)),
 B([23,63,8],[6,5,6],"white"),B([21,66,9],[3,2,4],"white",{top:"tile"}),
 ...[24,25].map(x=>P("11477",[x,63,7],"white")),
 ...[24,25].map(x=>P("11477",[x,63,13],"white",180)),
 P("87087",[26,65,8],"black"),P("87087",[26,65,13],"black",180),
 P("93606",[23,68,9],"white",90),P("93606",[23,68,11],"white",90),
 P("11477",[21,68,10],"white",90),P("11477",[21,68,11],"white",90),
 ...range(9,13).map(z=>P("13547",[28,57,z],"orange",270)),
 ...range(9,13).map(z=>P("13547",[32,57,z],"orange",90)),
 B([28,60,9],[9,2,4],"orange"),
 floor({at:[25,62,9],size:[14,4],colour:"yellow"}),
 ...[9,12].map(z=>[P("4162",[28,61,z],"black"),P("63864",[36,61,z],"black")]),
 ...[9,11].map(z=>[P("87079",[28,63,z],"yellow"),P("87079",[32,63,z],"yellow")]),
 P("61678",[36,61,10],"yellow",270),P("61678",[36,61,11],"yellow",270)
]);