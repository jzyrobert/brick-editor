script({title:"The Penny-Farthing Pelican",description:"A bright-eyed pelican pedals a scarlet penny-farthing, its enormous golden bill balancing the big white-spoked wheel. A blue scarf streams behind; curved wings hold the handlebars and webbed feet work opposite pedals.",palette:{feather:"white",pouch:"tan",bill:"bright light orange",frame:"red",metal:"light bluish grey",rubber:"black",scarf:"dark blue"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const wheel=(part,x,colour)=>P(part,x,0,2,colour);
section("Wheels and scarlet bicycle",[
 wheel("49295p02",0,"white"),wheel("44293",17,"light bluish grey"),
 P("2458",5,13,3,"red"),P("2458",18,5,4,"red"),
 box({at:[5,13,4],size:[2,19,1],colour:"frame",interior:"solid",top:"tile"}),
 line({from:[7,28,4],to:[19,6,4],colour:"frame"}),
 P("42022",6,29,4,"red",270),
 box({at:[9,28,3],size:[2,3,2],colour:"frame",interior:"solid"}),
 floor({at:[8,31,2],size:[4,4],colour:"rubber",layers:1,top:"tile"}),
 floor({at:[4,29,4],size:[3,1],colour:"metal",layers:1}),
 column({at:[4,30,4],height:6,diameter:1,colour:"metal"}),
 box({at:[4,36,-1],size:[1,1,9],colour:"rubber",interior:"solid",top:"tile"}),
 box({at:[6,14,1],size:[1,5,1],colour:"metal",interior:"solid"}),
 floor({at:[5,18,-1],size:[3,3],colour:"rubber",layers:1,top:"tile"}),
 box({at:[8,17,5],size:[1,5,1],colour:"metal",interior:"solid"}),
 floor({at:[7,21,5],size:[3,3],colour:"rubber",layers:1,top:"tile"})
]);
section("Discreet parking stand",[
 floor({at:[9,0,5],size:[4,4],layers:1,colour:"rubber",top:"tile"}),
 column({at:[10,1,6],height:30,diameter:2,colour:"trans-clear"}),
 floor({at:[8,31,4],size:[4,4],layers:1,colour:"rubber",top:"tile"})
]);
function foot(x,y,z,turn){return [P("43723a",x,y,z,"bright light orange",turn),P("3069b",x+1,y+1,z,"bright light orange"),P("54200",x,y+1,z+1,"bright light orange",90)];}
section("Pedalling webbed feet",[
 column({at:[8,23,1],height:10,diameter:1,colour:"orange"}),
 line({from:[8,23,1],to:[7,20,0],colour:"orange"}),
 foot(5,19,-1,90),
 column({at:[9,26,5],height:7,diameter:1,colour:"orange"}),
 line({from:[9,26,5],to:[8,23,7],colour:"orange"}),
 foot(7,22,6,90)
]);
function bellySide(x){return [P("24201",x,33,0,"white"),P("24201",x,33,5,"white",180)];}
function shoulder(x){return [P("24309",x,43,0,"white"),P("24309",x,43,4,"white",180)];}
section("Rounded white body and black-tipped tail",[
 box({at:[8,32,2],size:[3,1,3],colour:"feather",interior:"solid"}),
 box({at:[7,33,2],size:[5,10,3],colour:"feather",interior:"empty",top:"tile"}),
 range(7,12).map(bellySide),
 floor({at:[7,37,0],size:[5,7],layers:3,colour:"feather"}),
 box({at:[7,40,0],size:[6,3,7],colour:"feather",interior:"solid",top:"tile"}),
 [7,9,11].map(shoulder),
 floor({at:[7,43,3],size:[6,1],layers:3,colour:"feather",top:"tile"}),
 floor({at:[11,38,2],size:[5,3],layers:2,colour:"feather",top:"tile"}),
 P("24309",12,40,2,"white",270),
 P("54200",15,40,2,"black",270),P("54200",15,40,3,"black",270),
 P("3070b",15,40,4,"white")
]);
function steeringWing(z){return [P("13547",4,37,z,"white",90),P("61678",4,40,z,"white",90)];}
section("Wings on the handlebars",[
 steeringWing(0),steeringWing(6),
 P("15068",8,40,0,"white",270),P("15068",8,40,5,"white",270)
]);
section("Crooked neck and bright-eyed head",[
 box({at:[6,41,2],size:[2,12,3],colour:"feather",interior:"solid"}),
 box({at:[4,52,2],size:[3,6,3],colour:"feather",interior:"solid"}),
 P("3678b",4,43,2,"white",90),
 P("24309",3,49,2,"white",90),
 box({at:[3,56,2],size:[4,6,2],colour:"feather",interior:"solid"}),
 P("15068",3,56,1,"white"),P("15068",3,56,3,"white",180),
 P("3005pe4",5,59,1,"white"),P("3005pe4",5,59,4,"white",180),
 P("11477",6,59,1,"white"),P("11477",6,59,3,"white",180),
 [3,5].map(x=>[P("15068",x,62,1,"white"),P("15068",x,62,3,"white",180)])
]);
function pouchEdge(x){return [P("24201",x,51,1,"tan"),P("24201",x,51,3,"tan",180)];}
section("Long bill and pendulous throat pouch",[
 box({at:[-3,51,2],size:[6,7,2],colour:"pouch",interior:"empty"}),
 range(1,5).map(z=>P("13547",-3,48,z,"tan",90)),
 [2,3].map(z=>P("24201",1,47,z,"tan",270)),
 range(-3,3).map(pouchEdge),
 [1,4].map(z=>[P("61678",-3,55,z,"tan",90),P("50950",1,55,z,"tan",270)]),
 floor({at:[-7,58,2],size:[11,2],layers:1,colour:"bill"}),
 [2,3].map(z=>P("61678",-7,59,z,"bright light orange",90)),
 box({at:[-3,59,2],size:[6,3,2],colour:"bill",interior:"solid",top:"tile"})
]);
section("Streaming club scarf",[
 floor({at:[4,52,1],size:[4,4],layers:1,colour:"scarf",top:"tile"}),
 floor({at:[6,52,3],size:[6,1],layers:1,colour:"scarf"}),
 P("3069b",7,53,3,"dark blue"),P("11477",9,53,3,"dark blue",270),P("54200",11,53,3,"dark blue",270)
]);