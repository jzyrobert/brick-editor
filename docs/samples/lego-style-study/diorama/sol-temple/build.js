script({title:"The Autumn Bell — Koyo-ji Buddhist Temple",description:"A riverbank Buddhist sanctuary in autumn: pilgrims cross a vermilion bridge over koi water toward an open golden Buddha hall; a three-storey pagoda carries the bronze temple bell. Deep timber verandas, sweeping tiled eaves, shoji screens, a raked garden and a spreading maple complete the connected display.",palette:{stone:{mix:["light bluish grey","light bluish grey","light bluish grey","dark bluish grey"]},wood:"reddish brown",roof:"black",lacquer:"dark red"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const post=(x,y,z,h,colour)=>column({at:[x,y,z],height:h,diameter:1,colour});
section("Connected display and stream",[
 floor({at:[0,0,0],size:[48,48],layers:3,colour:"black"}),
 floor({at:[0,3,0],size:[48,1],colour:"dark bluish grey",top:"tile"}),floor({at:[0,3,47],size:[48,1],colour:"dark bluish grey",top:"tile"}),floor({at:[0,3,1],size:[1,46],colour:"dark bluish grey",top:"tile"}),floor({at:[47,3,1],size:[1,46],colour:"dark bluish grey",top:"tile"}),
 box({at:[1,3,1],size:[46,2,8],colour:"dark tan",top:"tile"}),box({at:[1,3,17],size:[46,2,30],colour:"olive green"}),
 floor({at:[1,3,9],size:[46,8],colour:"trans light blue",top:"tile"}),
 wall({from:[1,8],to:[46,8],y:4,height:3,colour:"stone",texture:"masonry",top:"tile"}),wall({from:[1,17],to:[26,17],y:4,height:3,colour:"stone",texture:"masonry",top:"tile"}),wall({from:[33,17],to:[46,17],y:4,height:3,colour:"stone",texture:"masonry",top:"tile"}),
 ...[[8,11],[18,13],[38,11]].map(([x,z],i)=>P("64648",x,4,z,i===1?"red":"orange",i===1?90:0)),
 ...[[5,12],[14,10],[23,14],[36,14],[43,12]].map(([x,z])=>P("14769",x,4,z,"trans-clear")),
 ...[5,11,17,35,41].map(x=>P("3069b",x,4,0,"pearl gold"))
]);
section("Stone foundations and arrival",[
 box({at:[19,5,26],size:[24,8,17],colour:"stone",supports:8}),floor({at:[19,13,25],size:[24,18],layers:2,colour:"wood",top:"tile"}),
 ...[[[19,26],[42,26]],[[19,42],[42,42]],[[19,27],[19,41]],[[42,27],[42,41]]].map(([from,to])=>wall({from,to,y:5,height:3,colour:"stone",texture:"masonry"})),
 box({at:[1,5,27],size:[14,6,15],colour:"stone",texture:"masonry"}),floor({at:[1,11,27],size:[14,16],layers:2,colour:"wood",top:"tile"}),
 stairs({at:[27,5,21],width:6,steps:5,dir:"+z",rise:2,colour:"light bluish grey",top:"tile"}),
 stairs({at:[6,5,23],width:4,steps:4,dir:"+z",rise:2,colour:"light bluish grey",top:"tile"}),
 floor({at:[26,5,20],size:[8,1],colour:"light bluish grey",top:"tile"}),floor({at:[5,5,18],size:[5,5],colour:"light bluish grey",top:"tile"}),floor({at:[9,5,19],size:[8,2],colour:"light bluish grey",top:"tile"}),
 floor({at:[17,5,18],size:[8,6],colour:"tan",top:"tile"}),
 ...range(3).flatMap(r=>range(3).filter(c=>!(r===2&&c>=1)).map(c=>P("2412b",18+2*c,6,18+2*r,"tan"))),
 P("15068",22,6,21,"dark bluish grey"),P("54200",21,6,22,"light bluish grey"),
 floor({at:[3,5,5],size:[15,3],colour:"light bluish grey",top:"tile"})
]);
const windows=[{side:"front",at:1},{side:"front",at:15},...[1,5,9,13].map(at=>({side:"back",at})),...["left","right"].flatMap(side=>[2,6].map(at=>({side,at})))];
function shoji(o){const x=o.side==="left"?22:o.side==="right"?39:22+o.at;const z=o.side==="front"?29:o.side==="back"?38:29+o.at;return [21,27].map(y=>window({at:[x,y,z],facing:o.side,size:"1x2x2",frame:"reddish brown",glass:"white"}));}
const timber=[[22,29],[26,29],[35,29],[39,29],[22,38],[26,38],[30,38],[34,38],[39,38],[22,33],[39,33]];
const veranda=[[22,25],[26,25],[35,25],[39,25],[22,42],[26,42],[35,42],[39,42],[19,30],[19,34],[19,38],[42,30],[42,34],[42,38]];
section("Open Buddha hall and timber veranda",[
 room({at:[22,15,29],size:[18,24,10],colour:"white",openings:[{side:"front",at:5,width:8,height:21,fill:"none"},...windows.map(o=>({...o,width:2,y:6,height:12,fill:"none"}))]}),
 ...[[[22,29],[26,29]],[[35,29],[39,29]],[[22,38],[39,38]],[[22,30],[22,37]],[[39,30],[39,37]]].map(([from,to])=>wall({from,to,y:15,height:6,colour:"white",texture:"grille"})),
 ...windows.flatMap(shoji),...timber.map(([x,z])=>post(x,15,z,24,"wood")),
 ...veranda.map(([x,z])=>post(x,15,z,18,"wood")),
 wall({from:[20,25],to:[41,25],y:33,height:3,colour:"wood"}),wall({from:[20,42],to:[41,42],y:33,height:3,colour:"wood"}),wall({from:[19,28],to:[19,39],y:33,height:3,colour:"wood"}),wall({from:[42,28],to:[42,39],y:33,height:3,colour:"wood"}),
 ...veranda.map(([x,z])=>P("3665a",x,33,z,"wood",x===19?90:x===42?270:z===42?180:0)),
 wall({from:[22,29],to:[39,29],y:36,height:3,colour:"wood"}),wall({from:[22,38],to:[39,38],y:36,height:3,colour:"wood"}),wall({from:[22,30],to:[22,37],y:36,height:3,colour:"wood"}),wall({from:[39,30],to:[39,37],y:36,height:3,colour:"wood"}),
 fence({path:[[19,26],[25,26]],y:15,colour:"reddish brown",style:"lattice-low"}),fence({path:[[35,26],[42,26]],y:15,colour:"reddish brown",style:"lattice-low"}),fence({path:[[19,41],[42,41]],y:15,colour:"reddish brown",style:"lattice-low"}),fence({path:[[20,27],[20,40]],y:15,colour:"reddish brown",style:"lattice-low"}),fence({path:[[41,27],[41,40]],y:15,colour:"reddish brown",style:"lattice-low"}),
 ...[23,37].map(x=>P("3069b",x,34,29,"pearl gold")),
 box({at:[28,15,30],size:[8,3,7],colour:"dark red",top:"tile"}),
 P("44375b",29,18,30,"pearl gold"),P("15068",30,20,31,"pearl gold"),P("15068",32,20,31,"pearl gold"),P("3003",31,20,33,"pearl gold"),P("15068",31,23,33,"pearl gold"),P("11477",30,23,33,"pearl gold"),P("11477",33,23,33,"pearl gold"),P("3024",31,26,33,"pearl gold"),P("3626c",31,27,33,"pearl gold"),P("6141",31,30,33,"pearl gold"),
 post(29,18,36,12,"tan"),post(34,18,36,12,"tan"),P("3307",29,30,36,"tan"),
 ...[25,36].flatMap(x=>[P("4032b",x,15,32,"pearl gold"),post(x,16,32,6,"white"),P("4589",x,22,32,"trans yellow")]),
 P("4740",25,15,35,"white"),P("4740",36,15,35,"white"),P("90398",25,16,35,"pearl gold"),P("90398",36,16,35,"pearl gold")
]);
function sweepingEaves(x,y,z,w,d,len){const a=x-len,b=z-len;const ops=[floor({at:[a,y-4,b],size:[w+2*len,d+2*len],colour:"black",holes:[{at:[a,b],size:[2,2]},{at:[x+w+len-2,b],size:[2,2]},{at:[a,z+d+len-2],size:[2,2]},{at:[x+w+len-2,z+d+len-2],size:[2,2]}]})];
 const lower=len===4?"13547":"3665a",upper=len===4?"61678":"11477";
 for(let i=0;i<w;i++){ops.push(P(lower,x+i,y-3,b,"black",180),P(upper,x+i,y,b,"black",180),P(lower,x+i,y-3,z+d,"black"),P(upper,x+i,y,z+d,"black"));}
 for(let i=0;i<d;i++){ops.push(P(lower,a,y-3,z+i,"black",270),P(upper,a,y,z+i,"black",270),P(lower,x+w,y-3,z+i,"black",90),P(upper,x+w,y,z+i,"black",90));}
 if(len===4){for(const [cx,cz,t] of [[a,b,0],[x+w,b,270],[a,z+d,90],[x+w,z+d,180]]){const left=cx===a,front=cz===b;const ix=left?cx+2:cx,iz=front?cz+2:cz;ops.push(box({at:[ix,y-3,iz],size:[2,3,2],colour:"black"}),P("3045",ix,y,iz,"black",t));const az=front?cz:cz+2,bx=left?cx:cx+2;ops.push(P("3660b",ix,y-3,az,"black",front?180:0),P("15068",ix,y,az,"black",front?180:0),P("3660b",bx,y-3,iz,"black",left?270:90),P("15068",bx,y,iz,"black",left?270:90));}}
 return ops;}
section("Sweeping irimoya roof",[
 ...sweepingEaves(20,39,28,22,12,4),floor({at:[20,38,28],size:[22,12],layers:1,colour:"black"}),
 roof({style:"hip",at:[20,39,28],size:[22,12],overhang:0,colour:"black",holes:[{at:[26,31],size:[10,6]}]}),
 box({at:[26,39,31],size:[10,9,6],colour:"wood"}),roof({style:"gable",at:[26,48,31],size:[10,6],overhang:0,ends:0,ridge:"x",colour:"black",gable:"white",holes:[{at:[26,33],size:[1,1]},{at:[35,33],size:[1,1]}]}),
 ...[26,35].flatMap(x=>[post(x,48,33,9,"black"),P("54200",x,57,33,"pearl gold")]),
 ...range(10).map(i=>P("3069b",26+i,47,31,"dark red",90))
]);
function tier(x,y,z,n,hole){return [
 ...sweepingEaves(x-1,y,z-1,n+2,n+2,2),
 roof({style:"hip",at:[x,y,z],size:[n,n],colour:"black",overhang:1,holes:hole?[{at:[x+Math.round((n-hole)/2),z+Math.round((n-hole)/2)],size:[hole,hole]}]:[]}),
 fence({path:[[x-1,z-1],[x+n,z-1]],y:y-3,colour:"reddish brown",style:"lattice-low"}),fence({path:[[x-1,z+n],[x+n,z+n]],y:y-3,colour:"reddish brown",style:"lattice-low"}),
 ...[[x,z],[x+n-1,z],[x,z+n-1],[x+n-1,z+n-1]].map(([px,pz])=>P("3665a",px,y-6,pz,"reddish brown"))
 ];}
section("Three-storey bell pagoda",[
 room({at:[5,13,31],size:[6,21,6],colour:"dark red",openings:[{side:"front",at:2,width:2,height:18,fill:"none"},{side:"left",at:2,width:2,y:6,height:9,fill:"none"},{side:"right",at:2,width:2,y:6,height:9,fill:"none"},{side:"back",at:2,width:2,y:6,height:9,fill:"none"}]}),
 ...[[5,31],[10,31],[5,36],[10,36]].map(([x,z])=>post(x,13,z,21,"reddish brown")),
 ...["left","right","back"].map(side=>window({at:[side==="left"?5:side==="right"?10:7,19,side==="back"?36:33],facing:side,size:"1x2x3",frame:"reddish brown",glass:"pearl gold"})),
 P("3942c",7,25,33,"pearl gold"),P("4032b",7,31,33,"pearl gold"),floor({at:[5,32,31],size:[6,6],layers:2,colour:"wood"}),
 room({at:[6,34,32],size:[4,21,4],colour:"dark red",openings:[{side:"front",at:1,width:2,y:6,height:9,fill:"none"},{side:"back",at:1,width:2,y:6,height:9,fill:"none"}]}),
 window({at:[7,40,32],facing:"front",size:"1x2x3",frame:"reddish brown",glass:"pearl gold"}),window({at:[7,40,35],facing:"back",size:"1x2x3",frame:"reddish brown",glass:"pearl gold"}),
 ...[[6,32],[9,32],[6,35],[9,35]].map(([x,z])=>post(x,34,z,21,"reddish brown")),
 box({at:[7,55,33],size:[2,18,2],colour:"dark red",interior:"solid"}),box({at:[7,73,33],size:[2,9,2],colour:"black",interior:"solid"}),
 ...tier(4,34,30,8,4),...tier(5,55,31,6,2),...tier(6,73,32,4,2),
 P("4032b",7,82,33,"black"),...range(4).flatMap(i=>[P("4740",7,83+4*i,33,"pearl gold"),P("3062b",7,84+4*i,33,"pearl gold")]),P("4589",7,99,33,"pearl gold"),
 fence({path:[[2,28],[4,28]],y:13,colour:"reddish brown",style:"lattice-low"}),fence({path:[[11,28],[14,28]],y:13,colour:"reddish brown",style:"lattice-low"}),fence({path:[[2,41],[14,41]],y:13,colour:"reddish brown",style:"lattice-low"}),
 ...[2,13].flatMap(x=>[post(x,13,29,12,"wood"),P("4589",x,25,29,"black")])
]);
section("Vermilion pilgrim bridge",[
 stairs({at:[27,5,5],width:6,steps:6,dir:"+z",rise:1,colour:"reddish brown",top:"tile"}),stairs({at:[27,5,20],width:6,steps:6,dir:"-z",rise:1,colour:"reddish brown",top:"tile"}),box({at:[27,10,11],size:[6,2,4],colour:"reddish brown",top:"tile"}),
 ...[27,32].flatMap(x=>[[5,6],[8,9],[11,12],[14,12],[17,9],[20,6]].flatMap(([z,y])=>[post(x,y,z,6,"red"),P("3070b",x,y+6,z,"black")])),
 ...[27,32].flatMap(x=>[line({from:[x,12,5],to:[x,18,11],colour:"red"}),line({from:[x,18,11],to:[x,18,14],colour:"red"}),line({from:[x,18,14],to:[x,12,20],colour:"red"})]),
 ...[28,30].map(x=>box({at:[x,4,11],size:[1,6,4],colour:"dark brown"}))
]);
component("Stone lantern",{size:[4,4],ops:[floor({at:[0,0,0],size:[4,4],colour:"light bluish grey"}),P("4032b",1,1,1,"light bluish grey"),column({at:[1,2,1],diameter:2,height:6,colour:"light bluish grey"}),P("3941",1,8,1,"trans yellow"),P("3960",0,11,0,"light bluish grey"),P("4032b",1,13,1,"dark bluish grey"),P("4589",1,14,1,"light bluish grey")]});
component("Pilgrim monk",{size:[3,3],ops:[P("3022",0,0,0,"reddish brown"),P("15068",0,1,0,"orange"),P("3005",0,4,1,"orange"),P("3626c",0,7,1,"tan"),P("6141",0,10,1,"tan"),P("3957a",2,1,1,"black")]});
section("Maple and temple life",[
 instance({component:"Stone lantern",at:[12,5,19]}),instance({component:"Stone lantern",at:[35,5,3]}),instance({component:"Pilgrim monk",at:[29,12,11]}),instance({component:"Pilgrim monk",at:[30,15,26]}),
 box({at:[41,5,21],size:[2,15,2],colour:"reddish brown",interior:"solid"}),box({at:[38,17,21],size:[6,3,2],colour:"reddish brown",interior:"solid"}),box({at:[41,20,19],size:[2,3,6],colour:"reddish brown",interior:"solid"}),box({at:[38,20,22],size:[2,3,4],colour:"reddish brown",interior:"solid"}),box({at:[39,23,22],size:[4,3,2],colour:"reddish brown",interior:"solid"}),box({at:[42,20,18],size:[1,3,4],colour:"reddish brown",interior:"solid"}),
 P("2417",36,20,18,"dark red"),P("2417",42,23,18,"orange"),P("2417",38,26,19,"dark red"),P("2417",35,23,18,"orange"),
 ...[[36,21,19],[38,22,20],[43,24,19],[41,27,20],[39,28,21],[36,24,19],[35,25,20],[42,28,19]].map(([x,y,z],i)=>P("2423",x,y,z,i%3?"dark red":"orange")),
 ...[[37,19],[39,18],[44,19],[45,23],[44,26],[36,28],[38,29],[42,27],[35,19],[40,25]].map(([x,z],i)=>P("24866",x,5,z,i%2?"orange":"dark red")),
 ...[[2,44],[7,44],[12,44],[44,44],[44,31]].map(([x,z],i)=>P("15068",x,5,z,i%2?"dark bluish grey":"light bluish grey",i%2?90:0)),
 P("2435",3,5,19,"dark green"),P("2435",44,5,35,"dark green"),
 ...[[16,34],[16,40],[43,46],[6,46]].map(([x,z])=>P("32607",x,5,z,"dark green"))
]);