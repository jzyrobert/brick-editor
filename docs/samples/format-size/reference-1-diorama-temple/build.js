script({title:"Komyo-ji — The Evening Bell",description:"An autumn Buddhist temple above a recessed koi pond. A vermilion arched bridge leads to the open golden Buddha hall; a saffron-robed attendant waits beside the suspended bell and timber striker. Broad curved irimoya eaves, paper screens, golden shibi, stone lanterns and an asymmetric maple canopy complete the monastery garden.",palette:{timber:"reddish brown",plaster:"white",roof:"dark bluish grey",stone:"light bluish grey",accent:"dark red"}});
const W=40,D=32,G=7;
const slab=(x,y,z,w,d,c,l=1,t=false)=>floor({at:[x,y,z],size:[w,d],colour:c,layers:l,...(t?{top:"tile"}:{})});
const block=(x,y,z,w,h,d,c,t=false)=>box({at:[x,y,z],size:[w,h,d],colour:c,interior:"solid",...(t?{top:"tile"}:{})});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
section("Connected black display and recessed garden",[
 block(0,0,0,W,3,D,"black",true),
 slab(1,3,10,38,21,"olive green",4),slab(18,3,1,21,9,"olive green",4),slab(1,3,1,1,3,"olive green",4),slab(2,3,1,16,1,"olive green",4),slab(1,3,4,9,6,"olive green",4),
 slab(2,3,2,16,2,"trans light blue",1,true),slab(10,3,4,8,6,"trans light blue",1,true),
 slab(21,7,1,8,9,"dark tan",1,true),slab(12,7,10,24,3,"dark tan",1,true),slab(2,7,10,10,3,"dark tan",1,true),
 slab(1,7,2,1,8,"dark bluish grey",1,true),slab(2,7,1,16,1,"dark bluish grey",1,true),slab(10,7,10,8,1,"dark bluish grey",1,true),
 ...[[3,2],[6,3],[13,2],[16,3]].map(([x,z],i)=>p("98138",x,4,z,i%2?"white":"orange")),
 p("32607",3,7,11,"dark green"),p("32607",35,7,5,"dark green",180)
]);
function bridge(){const ops=[];for(const z of [5,8]){ops.push(block(10,4,z,1,6,1,"stone"),block(17,4,z,1,6,1,"stone"),p("3307",11,4,z,"stone"));}ops.push(block(10,9,5,8,1,4,"stone"),slab(10,10,5,8,4,"dark tan",1,true),stairs({at:[7,7,5],width:4,steps:3,dir:"+x",rise:1,run:1,colour:"stone",top:"tile"}),stairs({at:[20,7,5],width:4,steps:3,dir:"-x",rise:1,run:1,colour:"stone",top:"tile"}));for(const z of [5,8]){for(const x of [10,13,17])ops.push(column({at:[x,11,z],height:6,diameter:1,colour:"dark red"}));ops.push(slab(10,17,z,8,1,"dark red",1,true),block(10,13,z,8,1,1,"dark red"));}return ops;}
section("Vermilion pilgrimage bridge",bridge());
const mainX=14,mainZ=13,mainW=22,mainD=16;
section("Temple podium and timber veranda",[
 box({at:[mainX,7,14],size:[mainW,3,15],colour:"stone",texture:"masonry",interior:"empty"}),slab(mainX,10,mainZ,mainW,mainD,"timber",1,true),
 stairs({at:[22,8,10],width:6,steps:3,dir:"+z",colour:"stone",top:"tile"}),
 ...[15,20,27,34].map(x=>column({at:[x,11,14],height:18,colour:"timber"})),
 ...[15,34].flatMap(x=>[19,24,27].map(z=>column({at:[x,11,z],height:18,colour:"timber"}))),
 ...[14,35].map(x=>slab(x,15,16,1,11,"timber",1,true)),
 ...[14,35].flatMap(x=>[16,21,26].map(z=>block(x,11,z,1,4,1,"timber"))),
 slab(12,28,14,26,14,"timber"),
 ...[16,19,22,25,28,31,33].map(x=>p("3665a",x,25,13,"timber")),
 ...[17,21,25].flatMap(z=>[p("3665a",13,25,z,"timber",90),p("3665a",35,25,z,"timber",270)])
]);
const paper=(side,at)=>({side,at,width:2,y:6,height:6,frame:"reddish brown",glass:"trans yellow"});
section("Open Buddha hall and paper screens",[
 room({at:[16,11,18],size:[18,18,9],colour:"plaster",quoins:"timber",openings:[{side:"front",at:5,width:8,height:18,fill:"none"},paper("front",1),paper("front",15),paper("left",3),paper("left",6),paper("right",3),paper("right",6),paper("back",3),paper("back",8),paper("back",13)]}),
 slab(17,11,19,16,7,"sand green",1,true),
 ...[20,29].map(x=>block(x,11,18,1,18,1,"timber")),
 ...[17,21,25,29].map(x=>slab(x,12,19,1,7,"dark tan",1,true)),
 block(23,12,22,4,2,4,"dark red",true),slab(23,14,22,4,4,"pearl gold",1,true),
 p("3960",23,15,22,"pearl gold"),p("3022",24,17,23,"pearl gold"),p("15068",24,18,23,"pearl gold"),p("11477",23,17,23,"pearl gold"),p("11477",26,17,23,"pearl gold"),p("3004",24,21,24,"pearl gold"),p("3626c",24,24,24,"pearl gold"),p("6141",24,27,24,"pearl gold"),
 p("4032b",22,12,20,"dark red"),p("4589",22,13,20,"pearl gold"),p("4032b",28,12,20,"dark red"),p("4589",28,13,20,"pearl gold"),
 p("4740",25,12,20,"pearl gold"),p("6141",25,13,20,"trans yellow")
]);
function grandRoof(){const ops=[block(15,29,17,20,3,8,"roof")];for(let x=12;x<38;x++)ops.push(p("61678",x,29,14,"roof"),p("61678",x,29,24,"roof",180));for(let z=18;z<24;z++)ops.push(p("61678",12,29,z,"roof",90),p("61678",34,29,z,"roof",270));for(let x=15;x<35;x++)ops.push(p("61678",x,32,17,"roof"),p("61678",x,32,21,"roof",180));for(let x=17;x<33;x+=2)ops.push(p("3043",x,35,20,"roof"));for(const x of [15,33]){ops.push(block(x,35,20,2,3,2,"roof"));for(const z of [20,21])ops.push(p("11477",x,38,z,"pearl gold",x===15?270:90));}for(const x of [15,34])ops.push(block(x,32,18,1,3,6,"timber"),block(x,35,20,1,2,2,"timber"));return ops;}
section("Broad curved irimoya roof and golden shibi",grandRoof());
section("Open bell pavilion",[
 box({at:[2,7,13],size:[9,3,11],colour:"stone",texture:"masonry",interior:"empty"}),slab(2,10,13,9,10,"timber",1,true),stairs({at:[5,7,10],width:4,steps:3,dir:"+z",colour:"stone",top:"tile"}),
 ...[3,9].flatMap(x=>[15,21].map(z=>column({at:[x,11,z],height:15,colour:"timber"}))),
 slab(1,25,13,11,10,"timber"),block(3,26,15,8,3,6,"roof"),
 ...range(1,12).flatMap(x=>[p("61678",x,26,13,"roof"),p("61678",x,26,19,"roof",180),p("93273",x,29,16,"roof")]),
 p("4032b",5,17,18,"pearl gold"),p("30151a",5,18,18,"black"),column({at:[5,23,18],height:3,colour:"black"}),
 p("3009",4,17,16,"timber"),...[4,9].map(x=>column({at:[x,20,16],height:6,colour:"black"})),
 p("3678b",7,11,13,"dark orange"),p("3626c",7,17,14,"yellow"),
 p("3068b",3,11,22,"dark tan"),p("3068b",6,11,22,"dark tan"),p("3068b",9,11,22,"dark tan")
]);
function lantern(x,z){return [p("3022",x,7,z,"stone"),column({at:[x,8,z],height:6,colour:"stone"}),p("3022",x,14,z,"stone"),p("3005",x,15,z,"trans yellow"),p("3022",x,18,z,"stone"),p("3045",x,19,z,"roof")];}
section("Lanterns maple and bamboo garden",[
 ...lantern(19,11),...lantern(31,10),
 block(5,7,27,2,18,2,"timber"),block(3,24,27,8,1,2,"timber"),block(5,25,27,2,2,2,"timber"),block(6,26,28,4,3,1,"timber"),
 p("61678",4,7,25,"timber"),p("61678",7,7,27,"timber",90),
 p("2417",2,25,24,"orange"),p("2417",7,25,26,"dark red"),p("2423",4,27,25,"red"),p("2423",8,29,27,"orange"),
 ...[[37,18,3],[37,24,2],[37,29,3]].flatMap(([x,z,n])=>range(n).map(i=>p("30176",x,7+i*3,z,"green"))),
 p("15068",35,7,10,"dark bluish grey"),p("15068",36,7,13,"light bluish grey",90),p("15068",2,7,24,"light bluish grey"),
 ...[[4,8,11],[7,8,12],[11,7,25],[13,7,28],[29,7,8],[34,8,11]].map(([x,y,z],i)=>p("24866",x,y,z,i%2?"orange":"red"))
]);