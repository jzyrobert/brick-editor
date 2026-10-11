script({title:"Komyo-ji — The Autumn Bell",description:"A vermilion Buddhist temple above a koi pond: a three-storey pagoda with a nine-ring sorin, an irimoya worship hall and its golden Buddha, an arched pilgrimage bridge, gravel courts, and a suspended bronze bell beside the autumn maple.",palette:{stone:{mix:["light bluish grey","light bluish grey","light bluish grey","dark bluish grey"]},roof:"dark bluish grey",timber:"red",wood:"reddish brown",plaster:"white",gold:"pearl gold"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const W=(side,at,width=2,y=6,height=9)=>({side,at,width,y,height,frame:"reddish brown",glass:"trans yellow"});
section("Connected lacquer display and temple grounds",[
 floor({at:[0,0,0],size:[48,44],layers:3,colour:"black"}),
 floor({at:[1,3,1],size:[46,42],colour:"dark tan"}),
 ...range(24).flatMap(i=>[P("3069b",i*2,3,0,"black"),P("3069b",i*2,3,43,"black")]),
 ...range(21).flatMap(i=>[P("3069b",0,3,1+i*2,"black",90),P("3069b",47,3,1+i*2,"black",90)]),
 floor({at:[3,4,8],size:[39,6],colour:"dark azure",top:"tile"}),
 floor({at:[3,4,4],size:[22,4],colour:"dark azure",top:"tile"}),
 floor({at:[3,4,14],size:[22,4],colour:"dark azure",top:"tile"}),
 floor({at:[29,4,1],size:[7,3],colour:"light bluish grey",top:"tile"}),
 floor({at:[18,4,18],size:[11,4],colour:"stone",top:"tile"}),
 floor({at:[1,4,39],size:[46,3],colour:"stone",top:"tile"}),
 ...[[3,5],[7,3],[12,3],[18,3],[23,5],[3,13],[5,16],[12,17],[20,16],[25,11],[38,8],[41,12]].map(([x,z],i)=>P("15068",x,5,z,i%3?"dark bluish grey":"light bluish grey",i%2?180:0)),
 ...[[7,8],[12,6],[17,12],[21,9]].flatMap(([x,z],i)=>[P("4032b",x,5,z,"green"),P("24866",x,6,z,i%2?"white":"bright pink")]),
 ...[[5,10],[15,10],[22,13]].flatMap(([x,z],i)=>[P("3023b",x,5,z,i%2?"white":"orange"),P("54200",x+1,6,z,i%2?"orange":"white",90)])
]);
const bridgeHeights=[1,2,3,4,5,6,6,5,4,3,2,1];
section("Arched pilgrimage bridge",bridgeHeights.flatMap((h,i)=>[
 floor({at:[29,4,4+i],size:[7,1],layers:h,colour:"reddish brown",top:"tile"}),
 ...[29,35].flatMap(x=>[P("3005",x,4+h,4+i,"red"),P("3070b",x,7+h,4+i,"black")])
]));
section("Worship hall stone terrace",[
 box({at:[20,4,23],size:[25,6,17],colour:"stone",texture:"masonry"}),
 floor({at:[19,10,22],size:[27,18],layers:2,colour:"reddish brown",top:"tile"}),
 stairs({at:[29,4,15],width:6,steps:8,dir:"+z",colour:"light bluish grey",top:"tile"}),
 ...[20,24,36,40].map(x=>P("3633",x,12,22,"red")),
 ...[26,30,34].flatMap(z=>[P("3633",19,12,z,"red",90),P("3633",45,12,z,"red",90)]),
 ...range(6).map(i=>P("3633",20+4*i,12,39,"red"))
]);
const hallPosts=[... [20,24,28,36,40,44].flatMap(x=>[[x,24],[x,38]]),...[28,32,36].flatMap(z=>[[20,z],[44,z]])];
section("Vermilion timber hall and gilded sanctuary",[
 room({at:[23,12,26],size:[19,21,12],colour:"plaster",openings:[{side:"front",at:6,width:7,height:18,fill:"none"},W("front",1,4),W("front",14,4),... [2,8,14].map(x=>W("back",x,4)),W("left",2),W("left",7),W("right",2),W("right",7)]}),
 ...hallPosts.flatMap(([x,z])=>[column({at:[x,12,z],height:18,colour:"red"}),P("3665a",x,30,z-1,"red")]),
 wall({from:[20,23],to:[43,23],y:30,height:3,colour:"red"}),
 wall({from:[20,38],to:[43,38],y:30,height:3,colour:"red"}),
 wall({from:[20,24],to:[20,37],y:30,height:3,colour:"red"}),
 wall({from:[43,24],to:[43,37],y:30,height:3,colour:"red"}),
 column({at:[29,12,26],height:15,colour:"red"}),column({at:[34,12,26],height:15,colour:"red"}),P("3307",29,27,26,"red"),
 ...[24,37].flatMap(x=>[box({at:[x,12,25],size:[4,6,1],colour:"reddish brown"}),P("2412b",x,18,25,"black"),P("2412b",x+2,18,25,"black")]),
 floor({at:[29,12,32],size:[7,5],layers:2,colour:"tan",top:"tile"}),
 P("4032b",31,14,33,"pearl gold"),P("3003",31,15,33,"pearl gold"),P("15068",31,18,33,"pearl gold"),P("3062b",31,21,34,"pearl gold"),P("98138",31,24,34,"pearl gold"),
 ...[29,35].flatMap(x=>[P("3062b",x,14,33,"pearl gold"),P("6141",x,17,33,"trans yellow")]),
 box({at:[30,12,28],size:[4,4,2],colour:"dark brown",top:"tile"}),
 ...range(4).map(i=>P("2412b",30+i,16,28,"reddish brown",90))
]);
section("Sweeping irimoya roofs",[
 floor({at:[20,33,23],size:[24,16],layers:3,colour:"black"}),
 ...range(24).flatMap(i=>[P("3665a",20+i,33,22,"black"),P("3665a",20+i,33,38,"black",180)]),
 ...range(14).flatMap(i=>[P("3665a",19,33,24+i,"black",90),P("3665a",43,33,24+i,"black",270)]),
 roof({style:"hip",at:[20,36,23],size:[24,16],colour:"roof",holes:[{at:[24,26],size:[16,10]}]}),
 room({at:[24,36,26],size:[16,12,10],colour:"white",openings:[W("front",3,4,3,6),W("front",9,4,3,6),W("back",3,4,3,6),W("back",9,4,3,6)]}),
 ...[24,39].flatMap(x=>[box({at:[x,36,26],size:[1,12,1],colour:"red"}),box({at:[x,36,35],size:[1,12,1],colour:"red"})]),
 roof({style:"gable",at:[24,48,26],size:[16,10],ridge:"x",colour:"roof",gable:"white"}),
 P("11477",24,66,30,"pearl gold",90),P("11477",38,66,30,"pearl gold",270)
]);
function balcony(x,y,z,n){return [floor({at:[x,y,z],size:[n,n],colour:"reddish brown"}),...range(0,n,2).flatMap(i=>[P("3005",x+i,y+1,z,"red"),P("3005",x+i,y+1,z+n-1,"red")]),...range(2,n-1,2).flatMap(i=>[P("3005",x,y+1,z+i,"red"),P("3005",x+n-1,y+1,z+i,"red")]),floor({at:[x,y+4,z],size:[n,n],colour:"red",top:"tile",holes:[{at:[x+1,z+1],size:[n-2,n-2]}]})];}
function pagodaRoof(x,y,z,n,hole){return [floor({at:[x,y-3,z],size:[n,n],layers:3,colour:"black"}),P("13547",x,y-3,z,"black"),P("13547",x+n-4,y-3,z,"black",270),P("13547",x+n-1,y-3,z+n-4,"black",180),P("13547",x,y-3,z+n-1,"black",90),roof({style:"hip",at:[x,y,z],size:[n,n],colour:"roof",holes:hole?[{at:[x+Math.round((n-hole)/2),z+Math.round((n-hole)/2)],size:[hole,hole]}]:[]})];}
section("Three-storey pagoda foundations and first sanctuary",[
 box({at:[3,4,24],size:[14,6,14],colour:"stone",texture:"masonry"}),
 floor({at:[3,10,24],size:[14,14],layers:3,colour:"reddish brown",top:"tile"}),
 stairs({at:[8,4,19],width:6,steps:9,dir:"+z",colour:"stone",top:"tile"}),
 room({at:[6,13,27],size:[8,21,8],colour:"white",openings:[{side:"front",at:2,width:4,height:18,fill:"none"},W("left",3),W("right",3),W("back",3)]}),
 ...[6,13].flatMap(x=>[27,34].map(z=>column({at:[x,13,z],height:21,colour:"red"}))),
 column({at:[8,13,27],height:15,colour:"reddish brown"}),column({at:[11,13,27],height:15,colour:"reddish brown"}),P("3659",8,28,27,"red"),
 P("3633",3,13,24,"red"),P("3633",13,13,24,"red"),
 ...[28,32].flatMap(z=>[P("3633",3,13,z,"red",90),P("3633",16,13,z,"red",90)]),
 ...[3,7,11].map(x=>P("3633",x,13,37,"red"))
]);
section("Pagoda upper galleries",[
 ...pagodaRoof(3,37,24,14,8),
 box({at:[7,37,28],size:[6,15,6],colour:"red"}),
 ...balcony(5,52,26,10),
 room({at:[7,53,28],size:[6,12,6],colour:"white",openings:[... ["front","back","left","right"].map(s=>W(s,2,2,3,6))]}),
 ...[7,12].flatMap(x=>[28,33].map(z=>column({at:[x,53,z],height:12,colour:"red"}))),
 ...pagodaRoof(4,67,25,12,6),
 box({at:[8,67,29],size:[4,15,4],colour:"red"}),
 ...balcony(6,82,27,8),
 room({at:[8,83,29],size:[4,12,4],colour:"white",openings:[... ["front","back","left","right"].map(s=>W(s,1,2,3,6))]}),
 ...[8,11].flatMap(x=>[29,32].map(z=>column({at:[x,83,z],height:12,colour:"red"}))),
 ...pagodaRoof(5,97,26,10,0),
 ...range(9).flatMap(i=>[P("4032b",9,115+2*i,30,"pearl gold"),i<8&&P("3024",9,116+2*i,30,"pearl gold")]),
 P("4589",9,132,30,"pearl gold")
]);
component("Stone lantern",{size:[4,4],ops:[P("3031",0,0,0,"dark bluish grey"),P("3941",1,1,1,"light bluish grey"),P("3062b",1,4,1,"light bluish grey"),P("4032b",1,7,1,"light bluish grey"),P("3062b",1,8,1,"trans yellow"),P("3005",2,8,1,"light bluish grey"),P("3005",1,8,2,"light bluish grey"),P("3005",2,8,2,"light bluish grey"),P("3960",0,11,0,"dark bluish grey"),P("4589",1,13,1,"dark bluish grey")]});
section("Lantern route",[[24,15],[36,9],[16,19],[0,38],[43,1]].map(([x,z])=>instance({component:"Stone lantern",at:[x,4,z]})));
section("Bell pavilion",[
 box({at:[39,4,15],size:[7,3,7],colour:"stone",top:"tile"}),
 ...[39,44].flatMap(x=>[15,20].map(z=>column({at:[x,7,z],height:15,colour:"red"}))),
 floor({at:[39,22,15],size:[6,6],layers:2,colour:"black"}),
 roof({style:"hip",at:[39,24,15],size:[6,6],colour:"roof"}),
 P("30151a",41,17,17,"black"),P("4740",41,16,17,"pearl gold"),
 P("3010",41,16,19,"reddish brown"),P("3005",44,19,19,"black"),
 stairs({at:[41,4,13],width:3,steps:3,dir:"+z",colour:"light bluish grey"})
]);
section("Autumn maple and mossy pond banks",[
 box({at:[2,4,18],size:[10,3,6],colour:"dark tan",top:"tile"}),
 box({at:[6,7,19],size:[2,12,2],colour:"dark brown"}),
 box({at:[3,19,20],size:[8,3,1],colour:"dark brown"}),box({at:[6,19,16],size:[1,3,8],colour:"dark brown"}),
 ...[[2,17],[5,17],[8,17],[5,13],[5,21]].map(([x,z],i)=>P("2423",x,22,z,i%2?"orange":"dark red")),
 box({at:[3,23,20],size:[8,3,1],colour:"dark brown"}),box({at:[6,23,17],size:[1,3,7],colour:"dark brown"}),
 ...[[2,19],[5,19],[8,19]].map(([x,z],i)=>P("2423",x,26,z,i%2?"dark red":"orange")),
 P("3005",6,27,20,"dark brown"),P("2423",5,30,18,"orange"),
 ...[[2,19],[11,20],[4,23],[15,22],[23,19],[42,40],[4,40],[14,40]].flatMap(([x,z],i)=>[box({at:[x,4,z],size:[2,3,2],colour:"olive green"}),P("15068",x,7,z,i%2?"dark tan":"light bluish grey")]),
 ...[[2,2],[8,2],[14,2],[20,2],[26,2],[1,34],[46,28],[46,34]].map(([x,z])=>P("32607",x,4,z,"dark green")),
 ...[[10,18],[13,19],[14,21],[16,23],[8,23],[2,16]].map(([x,z],i)=>P("24866",x,4,z,i%2?"orange":"dark red"))
]);