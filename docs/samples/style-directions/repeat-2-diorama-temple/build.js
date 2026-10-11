script({title:"Komyo-ji — The Autumn Bell",description:"A Japanese Buddhist mountain temple at the hour of the autumn bell: a three-storey pagoda, an irimoya-roofed worship hall with a golden altar, a suspended bonsho bell and an autumn maple reflected in the koi pond beneath the pilgrim bridge. Open verandas and winding stone approaches connect the buildings into one temple precinct.",palette:{stone:{mix:["light bluish grey","light bluish grey","light bluish grey","dark bluish grey"]},wood:"reddish brown",roof:"black",earth:"dark tan"},defaults:{interior:"empty"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const F=(x,y,z,w,d,colour,layers=1,top)=>floor({at:[x,y,z],size:[w,d],colour,layers,...(top?{top}: {})});
section("Connected chamfered display",[F(0,0,4,52,36,"black",3),F(4,0,0,44,44,"black",3),F(0,3,4,52,36,"earth"),F(4,3,0,44,44,"earth"),F(4,4,5,30,10,"dark azure",1,"tile"),F(8,4,15,10,6,"dark azure",1,"tile"),F(5,5,6,17,7,"trans light blue",1,"tile"),F(10,5,15,6,4,"trans light blue",1,"tile"),F(24,4,0,8,2,"stone",1,"tile"),F(23,4,19,12,4,"stone",1,"tile"),F(16,4,20,7,3,"stone",1,"tile"),box({at:[21,4,23],size:[26,6,18],colour:"stone",top:"tile",supports:8}),box({at:[2,4,23],size:[16,6,18],colour:"stone",top:"tile",supports:8}),wall({from:[21,23],to:[46,23],y:4,height:6,colour:"stone",texture:"masonry"}),wall({from:[2,23],to:[17,23],y:4,height:6,colour:"stone",texture:"masonry"}),stairs({at:[27,4,17],width:6,steps:6,dir:"+z",colour:"stone",top:"tile"}),stairs({at:[18,4,23],width:6,steps:6,dir:"-x",colour:"stone",top:"tile"}),wall({from:[21,42],to:[48,42],y:4,height:6,colour:"stone",texture:"masonry",top:"tile"})]);
const bridge=[];
bridge.push(stairs({at:[24,4,2],width:8,steps:5,dir:"+z",colour:"wood",top:"tile"}),stairs({at:[24,4,18],width:8,steps:5,dir:"-z",colour:"wood",top:"tile"}),F(24,8,7,8,7,"wood",1,"tile"));
for(const x of [24,30]) for(const z of [7,11]) bridge.push(column({at:[x,5,z],height:3,diameter:2,colour:"dark bluish grey"}));
for(const x of [24,31]) {bridge.push(fence({path:[[x,7],[x,13]],y:9,colour:"red",style:"lattice-low"}));for(const z of [6,14]) bridge.push(column({at:[x,8,z],height:6,diameter:1,colour:"dark red",cap:"cone"}));}
section("Pilgrim bridge",bridge);
const win=(side,at,width=2)=>({side,at,width,y:6,height:9,frame:"reddish brown",glass:"black"});
const hall=[];
hall.push(room({at:[25,10,26],size:[18,22,12],colour:"wood",floor:"reddish brown",quoins:"dark brown",openings:[{side:"front",at:6,width:6,height:18,fill:"none"},win("front",1,4),win("front",13,4),win("back",1,4),win("back",7,4),win("back",13,4),win("left",2),win("left",8),win("right",2),win("right",8)]}));
for(const x of [23,44]) for(const z of [24,30,36]) hall.push(column({at:[x,10,z],height:18,diameter:1,colour:"dark brown"}));
for(const x of [28,39]) hall.push(column({at:[x,10,24],height:18,diameter:1,colour:"dark brown"}));
hall.push(floor({at:[22,28,23],size:[24,16],colour:"wood",holes:[{at:[25,26],size:[18,12]}]}),floor({at:[22,31,23],size:[24,16],colour:"wood",holes:[{at:[26,24],size:[16,8]}]}),F(23,31,19,22,4,"black"),F(23,31,39,22,4,"black"),F(18,31,24,4,14,"black"),F(46,31,24,4,14,"black"));
for(const z of [23,38]) hall.push(wall({from:[22,z],to:[45,z],y:29,height:2,colour:"wood"}));
for(const x of [22,45]) hall.push(wall({from:[x,24],to:[x,37],y:29,height:2,colour:"wood"}));
for(let i=0;i<22;i++) hall.push(P("13547",23+i,32,19,"black"),P("13547",23+i,32,39,"black",180));
for(let i=0;i<14;i++) hall.push(P("13547",18,32,24+i,"black",90),P("13547",46,32,24+i,"black",270));
for(let i=0;i<11;i++) hall.push(P("3665a",23+i*2,29,23,"reddish brown"),P("3665a",23+i*2,29,37,"reddish brown",180));
for(let i=1;i<6;i++) hall.push(P("3665a",22,29,24+i*2,"reddish brown",90),P("3665a",44,29,24+i*2,"reddish brown",270));
hall.push(roof({style:"hip",at:[23,32,24],size:[22,14],colour:"black",holes:[{at:[26,24],size:[16,8]}]}),box({at:[26,32,24],size:[16,6,8],colour:"dark brown"}),roof({style:"gable",at:[26,38,24],size:[16,8],colour:"black",gable:"tan",ridge:"x",overhang:0,ends:0}));
for(let i=0;i<8;i++) hall.push(P("2412b",26+i*2,33,23,"pearl gold"),P("2412b",26+i*2,33,32,"pearl gold"));
for(const x of [26,40]) hall.push(P("11477",x,50,27,"black",90),P("4589",x+1,53,27,"pearl gold"));
hall.push(column({at:[31,10,26],height:15,colour:"wood"}),column({at:[36,10,26],height:15,colour:"wood"}),P("3307",31,25,26,"reddish brown"));
for(const x of [22,45]) hall.push(fence({path:[[x,25],[x,37]],y:10,colour:"reddish brown",style:"lattice-low"}));
for(const x of [24,37]) hall.push(fence({path:[[x,23],[x+5,23]],y:10,colour:"reddish brown",style:"lattice-low"}));
hall.push(box({at:[31,11,31],size:[6,6,4],colour:"black",top:"tile"}),F(32,17,32,4,2,"pearl gold"),P("4032b",33,18,32,"pearl gold"),P("90398",33,19,32,"pearl gold"),P("4740",31,17,31,"pearl gold"),P("4740",35,17,31,"pearl gold"));
for(const x of [30,37]) hall.push(P("3062b",x,11,31,"pearl gold"),P("6141",x,14,31,"pearl gold"),P("4589",x,15,31,"trans yellow"));
for(const x of [29,37]) hall.push(P("3062b",x,21,24,"dark red"),P("4032b",x,24,24,"pearl gold"),P("3942c",x,25,24,"dark red"));
section("Worship hall and golden altar",hall);
function pagodaTier(x,z,w,y,h,rw,upper) {
 const ry=y+h,rx=x-Math.round((rw-w)/2),rz=z-Math.round((rw-w)/2);
 const a=[room({at:[x,y,z],size:[w,h,w],colour:"wood",openings:[{side:"front",at:Math.round(w/2)-1,width:2,y:6,height:6,frame:"reddish brown",glass:"white"},{side:"back",at:Math.round(w/2)-1,width:2,y:6,height:6,frame:"reddish brown",glass:"white"},{side:"left",at:Math.round(w/2)-1,width:2,y:6,height:6,frame:"reddish brown",glass:"white"},{side:"right",at:Math.round(w/2)-1,width:2,y:6,height:6,frame:"reddish brown",glass:"white"}]}),floor({at:[x-1,y+3,z-1],size:[w+2,w+2],colour:"dark brown",top:"tile",holes:[{at:[x+1,z+1],size:[w-2,w-2]}]}),floor({at:[rx-2,ry-1,rz-2],size:[rw+4,rw+4],colour:"black",holes:[{at:[x+1,z+1],size:[w-2,w-2]}]}),roof({style:"hip",at:[rx,ry,rz],size:[rw,rw],colour:"black",overhang:0,ends:0,...(upper?{holes:[{at:[x,z],size:[w,w]}]}:{})})];
 for(const xx of [rx-2,rx+rw]) for(const zz of [rz-2,rz+rw]) a.push(P("3068b",xx,ry,zz,"black"));
 for(const zz of [z-1,z+w]) a.push(fence({path:[[x-1,zz],[x+w,zz]],y:y+4,colour:"reddish brown",style:"lattice-low"}));
 for(const xx of [x-1,x+w]) a.push(fence({path:[[xx,z],[xx,z+w-1]],y:y+4,colour:"reddish brown",style:"lattice-low"}));
 for(let i=0;i<rw;i++) a.push(P("24201",rx+i,ry,rz-2,"black"),P("24201",rx+i,ry,rz+rw,"black",180));
 for(let i=0;i<rw;i++) a.push(P("24201",rx-2,ry,rz+i,"black",90),P("24201",rx+rw,ry,rz+i,"black",270));
 for(let i=0;i<w;i+=2) a.push(P("3665a",x+i,ry-3,z-1,"dark red"),P("3665a",x+i,ry-3,z+w-1,"dark red",180));
 return a;
}
const pagoda=[...pagodaTier(5,27,10,10,18,14,true),...pagodaTier(6,28,8,28,21,12,true),...pagodaTier(7,29,6,49,21,10,false)];
pagoda.push(P("3942c",9,85,31,"pearl gold"));
for(let i=0;i<7;i++) {pagoda.push(P("4032b",9,91+i*2,31,"pearl gold"));if(i<6) pagoda.push(P("6141",9,92+i*2,31,"black"));}
pagoda.push(P("4589",9,104,31,"pearl gold"));
section("Three-storey pagoda and sorin",pagoda);
const bell=[F(38,4,5,12,12,"stone",2,"tile")];
for(const x of [39,48]) for(const z of [6,15]) bell.push(column({at:[x,6,z],height:18,diameter:1,colour:"dark brown"}));
bell.push(F(39,23,5,10,11,"wood",2),roof({style:"hip",at:[39,25,6],size:[10,10],colour:"black"}),P("3960",42,8,9,"dark bluish grey"),P("60474",42,10,9,"dark bluish grey"),P("87081",42,11,9,"dark bluish grey"),P("3943b",42,14,9,"dark bluish grey"),column({at:[43,20,10],height:3,colour:"black"}),P("3009",41,14,6,"reddish brown"),column({at:[41,17,6],height:6,colour:"black"}));
for(const x of [39,48]) bell.push(fence({path:[[x,7],[x,14]],y:6,colour:"reddish brown",style:"lattice-low"}));
for(let i=1;i<4;i++) {if(i!==1) bell.push(P("3665a",39+i*2,22,5,"dark red"));bell.push(P("3665a",39+i*2,22,15,"dark red",180));}
section("Bonsho bell pavilion",bell);
component("stone lantern",{size:[4,4],ops:[F(0,0,0,4,4,"light bluish grey",2,"tile"),column({at:[1,2,1],height:6,diameter:2,colour:"light bluish grey"}),P("3003",1,8,1,"trans yellow"),roof({style:"hip",at:[0,11,0],size:[4,4],colour:"dark bluish grey",overhang:0,ends:0}),P("6141",1,17,1,"light bluish grey"),P("4589",1,18,1,"light bluish grey")]});
section("Lanterns and garden approach",[instance({component:"stone lantern",at:[16,4,1]}),instance({component:"stone lantern",at:[34,4,17]}),instance({component:"stone lantern",at:[1,10,37]}),F(35,4,4,3,12,"stone",1,"tile"),F(34,4,16,10,2,"stone",1,"tile"),F(0,4,17,8,4,"olive green"),F(0,4,6,4,11,"olive green"),F(18,4,32,3,8,"olive green"),F(47,4,24,5,16,"olive green")]);
const maple=[box({at:[7,4,7],size:[2,24,2],colour:"reddish brown",interior:"solid"}),F(2,18,5,12,2,"reddish brown",1),F(4,21,4,8,2,"reddish brown",1),F(4,24,7,7,2,"reddish brown",1),F(3,27,6,6,2,"reddish brown",1)];
const leafSpecs=[[2,19,3,0],[8,19,5,1],[4,22,1,1],[9,22,4,0],[1,22,6,0],[4,25,7,1],[8,25,7,0],[3,28,4,0],[7,28,3,1]];
for(const [x,y,z,c] of leafSpecs) {maple.push(P("2417",x,y,z,c?"orange":"dark red"));for(const [dx,dz] of [[0,1],[2,4],[4,2]]) {const lx=x+dx,lz=z+dz;if(y+1<28&&lx>=7&&lx<=9&&lz>=6&&lz<=8) continue;maple.push(P("32607",lx,y+1,lz,c?"dark red":"orange",180));}}
section("Old autumn maple",maple);
const rocks=[];
for(const [x,z,t] of [[3,5,0],[4,14,180],[7,15,90],[18,15,270],[20,14,0],[22,7,180],[32,5,0],[33,12,270],[8,20,90],[15,20,180],[0,16,0],[48,22,0],[49,35,90],[18,39,180]]) rocks.push(P("3039",x,4,z,"dark bluish grey",t),P("54200",x,7,z,"light bluish grey",t));
for(const [x,z] of [[2,18],[5,19],[19,35],[49,27],[48,32]]) rocks.push(P("3023b",x,4,z,"dark green"),P("32607",x,5,z,"dark green"));
for(const [x,z] of [[9,12],[12,8],[18,10],[6,10],[13,17]]) rocks.push(P("3023b",x,6,z,"orange"),P("54200",x,7,z,"white"));
for(const [x,z] of [[5,3],[12,3],[16,22],[22,20],[33,19],[3,33]]) rocks.push(P("3070b",x,4,z,"dark red"));
section("Pond stones, koi and fallen leaves",rocks);