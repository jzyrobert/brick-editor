script({title:"Temple of the Evening Bell",description:"A Japanese Buddhist hondo with a sweeping irimoya roof, a curved entrance canopy, open timber veranda and golden Kannon altar. An open shoro pavilion shelters a suspended bell and its hanging wooden striker.",palette:{timber:"reddish brown",posts:"dark red",plaster:"white",roof:"black",stone:"light bluish grey",gold:"pearl gold"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function eaves(x,y,z,w,d,s){const a=[floor({at:[x,y,z],size:[w,d],colour:"timber",layers:1}),box({at:[x+s,y+1,z+s],size:[w-2*s,3,d-2*s],colour:"roof",interior:"empty"})];const p=s===4?"61678":"11477";for(let i=0;i<w;i++){a.push(P(p,[x+i,y+1,z],"roof"),P(p,[x+i,y+1,z+d-s],"roof",180));}for(let j=s;j<d-s;j++){a.push(P(p,[x,y+1,z+j],"roof",90),P(p,[x+w-s,y+1,z+j],"roof",270));}return a;}
function post(x,z,y,h){return box({at:[x,y,z],size:[1,h,1],colour:"posts",interior:"solid"});}
function lattice(x,y,z,turn=0){return range(3).flatMap(k=>[P("2877",[x,y+3*k,z],"timber",turn),P("2877",turn===0?[x+2,y+3*k,z]:[x,y+3*k,z+2],"timber",turn)]);}
section("Stone footing and timber veranda",[
box({at:[-10,0,-1],size:[20,5,14],colour:"stone",texture:"masonry",interior:"empty",supports:8}),
box({at:[-11,5,-2],size:[22,1,16],colour:"timber",interior:"solid"}),
floor({at:[-11,6,-2],size:[22,16],layers:2,colour:"tan",top:"tile"}),
stairs({at:[-3,0,-6],width:6,steps:4,rise:2,dir:"+z",colour:"stone",top:"tile"}),
...[-9,5].map(x=>P("3633",[x,8,-2],"timber")),
...[2,8].flatMap(z=>[P("3633",[-11,8,z],"timber",90),P("3633",[10,8,z],"timber",90)]),
...[-11,10].flatMap(x=>[-2,13].map(z=>post(x,z,8,12))),
...[-2,13].map(z=>box({at:[-11,20,z],size:[22,3,1],colour:"timber",interior:"solid"})),
...[-11,10].map(x=>box({at:[x,20,-1],size:[1,3,14],colour:"timber",interior:"solid"}))
]);
const openings=[{side:"front",at:6,width:6,height:15,fill:"none"},...[1,13].map(at=>({side:"front",at,width:4,y:3,height:9,fill:"none"})),...["left","right"].flatMap(side=>[2,7].map(at=>({side,at,width:4,y:3,height:9,fill:"none"}))),...[2,12].map(at=>({side:"back",at,width:4,y:3,height:9,fill:"none"})),{side:"back",at:8,width:2,y:3,height:9,fill:"none"}];
section("Hondo and lattice screens",[
room({at:[-9,8,0],size:[18,18,12],colour:"plaster",openings}),
...[-8,4].flatMap(x=>lattice(x,11,0)),
...[-9,8].flatMap(x=>[2,7].flatMap(z=>lattice(x,11,z,90))),
...[-7,3].flatMap(x=>lattice(x,11,11)),
...range(3).map(k=>P("2877",[-1,11+3*k,11],"timber")),
...[-9,-4,3,8].map(x=>post(x,0,8,18)),
...[-9,8].flatMap(x=>[6,11].map(z=>post(x,z,8,18))),
...[-3,2].map(x=>post(x,11,8,18)),
...[-9,-3,3].map(x=>P("3009",[x,23,0],"timber")),
...[-9,-3,3].map(x=>P("3009",[x,23,11],"timber")),
...[-9,8].flatMap(x=>[P("3009",[x,23,1],"timber",90),P("3010",[x,23,7],"timber",90)]),
post(-3,0,8,12),post(2,0,8,12),P("3009",[-3,20,0],"timber")
]);
section("Kannon sanctuary",[
box({at:[-2,8,7],size:[4,3,3],colour:"posts",interior:"empty",top:"tile"}),
floor({at:[-3,11,6],size:[6,4],colour:"gold",layers:1,top:"tile"}),
P("3960",[-2,12,7],"gold"),P("90398",[-1,14,8],"gold"),
...[-3,2].flatMap(x=>[P("3062b",[x,12,8],"timber"),P("6141",[x,15,8],"white"),P("4589",[x,16,8],"trans yellow")]),
floor({at:[-2,8,3],size:[4,3],colour:"dark tan",layers:1,top:"tile"})
]);
section("Curved entrance canopy",[
...[-4,3].flatMap(x=>[box({at:[x,0,-5],size:[1,3,1],colour:"stone",interior:"solid"}),post(x,-5,3,14)]),
box({at:[-4,17,-5],size:[8,3,1],colour:"timber",interior:"solid"}),
...[-4,3].map(x=>box({at:[x,17,-4],size:[1,3,3],colour:"timber",interior:"solid"})),
floor({at:[-4,19,-6],size:[8,5],colour:"timber",layers:1}),
...range(4).flatMap(j=>[P("61678",[-4,20,-6+j],"roof",90),P("61678",[0,20,-6+j],"roof",270)]),
P("3023b",[-1,23,-6],"roof",90),P("3023b",[0,23,-6],"roof",90),P("3070b",[-1,24,-6],"gold")
]);
section("Sweeping irimoya roof",[
...eaves(-14,22,-4,28,20,4),
box({at:[-6,26,3],size:[12,9,6],colour:"timber",interior:"empty"}),
roof({style:"hip",at:[-9,26,0],size:[18,12],colour:"roof",holes:[{at:[-6,3],size:[12,6]}]}),
roof({style:"gable",at:[-6,35,3],size:[12,6],colour:"roof",gable:"plaster",ridge:"x",overhang:0,ends:0,holes:[{at:[-6,5],size:[12,2]}]}),
box({at:[-6,35,5],size:[12,11,2],colour:"roof",interior:"solid",top:"tile"}),
P("64847",[-6,46,5],"roof"),P("64847",[5,46,5],"roof",180),
...[-14,13].flatMap(x=>[-1,12].map(z=>P("64847",[x,26,z],"roof",x<0?0:180)))
]);
section("Open shoro bell pavilion",[
floor({at:[18,0,4],size:[8,8],layers:2,colour:"stone",top:"tile"}),
box({at:[18,2,4],size:[8,2,8],colour:"timber",interior:"solid",top:"tile"}),
...[18,25].flatMap(x=>[4,11].map(z=>post(x,z,4,18))),
...[4,11].map(z=>box({at:[18,22,z],size:[8,3,1],colour:"timber",interior:"solid"})),
...[18,25].map(x=>box({at:[x,22,5],size:[1,3,6],colour:"timber",interior:"solid"})),
box({at:[18,22,7],size:[8,3,2],colour:"timber",interior:"solid"}),
P("3960",[20,10,6],"dark bluish grey"),P("3941",[21,12,7],"dark bluish grey"),P("3942c",[21,15,7],"dark bluish grey"),P("4032b",[21,21,7],"dark bluish grey"),
box({at:[23,13,7],size:[5,2,1],colour:"timber",interior:"solid",top:"tile"}),
...[24,27].map(x=>box({at:[x,15,7],size:[1,6,1],colour:"roof",interior:"solid"})),
...eaves(16,21,2,12,12,2),
roof({style:"hip",at:[18,25,4],size:[8,8],colour:"roof"}),
...[16,27].flatMap(x=>[3,12].map(z=>P("64847",[x,25,z],"roof",x<20?0:180)))
]);
section("Stone toro lantern",[
floor({at:[-10,0,-10],size:[4,4],layers:1,colour:"dark bluish grey",top:"tile"}),
P("4032b",[-9,1,-9],"stone"),P("3941",[-9,2,-9],"stone"),
...range(2).map(k=>P("3062b",[-9,5+3*k,-9],"stone")),
P("3022",[-9,11,-9],"stone"),P("3003",[-9,12,-9],"trans yellow"),P("3045",[-9,15,-9],"stone"),P("98138",[-8,18,-8],"dark bluish grey")
]);