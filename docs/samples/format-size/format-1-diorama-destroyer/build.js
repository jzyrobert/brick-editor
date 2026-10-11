script({title:"A New Hope — The Pursuit",description:"An Imperial Star Destroyer eclipses Tatooine while a tiny red-striped blockade runner escapes beneath its bow. The orbital display frames a layered dagger hull, dark equatorial trenches, a sloped command citadel, twin shield generators, six turbolaser towers and seven sculpted ion engines.",palette:{hull:"light bluish grey",machinery:"dark bluish grey",space:"black"}});
const Y=15,L=12,N=3;
section("Orbital theatre",[
 floor({at:[-16,0,-24],size:[32,48],layers:3,colour:"black",top:"tile"}),
 place({part:"3961",at:[-15,3,-9],colour:"tan"}),
 place({part:"3960",at:[-13,3,-21],colour:"orange"}),
 place({part:"4740",at:[-6,3,-19],colour:"yellow"}),
 ...[[-14,-14],[-8,-23],[0,-22],[13,-21],[14,-4],[12,5],[14,17],[-14,13],[-12,21],[7,22],[-5,21],[-15,1]].map(([x,z],i)=>place({part:"98138",at:[x,3,z],colour:i%4===0?"trans light blue":"white"})),
 box({at:[-2,3,5],size:[4,12,6],colour:"black",interior:"solid",top:"tile"}),
 column({at:[9,3,-15],height:5,diameter:2,colour:"trans-clear"})
]);
function hullCourse(i){const z=-18+i*L,w=2+6*i,x=-Math.round(w/2);return [
 floor({at:[x-1,Y-1,z+9],size:[w+2,2],colour:"hull"}),
 floor({at:[x,Y,z],size:[w,L],layers:6,colour:"hull",top:"tile"}),
 ...[["47397",x-3],["47398",x+w]].flatMap(([part,px])=>[place({part,at:[px,Y,z],colour:"hull"}),place({part,at:[px,Y+1,z],colour:"black"}),place({part,at:[px,Y+2,z],colour:"hull"})]),
 place({part:"42061",at:[x-3,Y+3,z],colour:"hull"}),
 place({part:"42060",at:[x+w,Y+3,z],colour:"hull"})
];}
section("Armoured dagger",[
 ...range(N).map(hullCourse),
 box({at:[-1,21,-14],size:[2,2,13],colour:"hull",interior:"solid",top:"tile"}),
 place({part:"3039",at:[-1,21,-16],colour:"hull"}),
 ...[-3,1].map(x=>place({part:"2412b",at:[x,21,-4],colour:"machinery"})),
 floor({at:[-3,14,-2],size:[6,5],colour:"machinery"}),
 wall({from:[-3,-2],to:[2,-2],y:12,height:2,colour:"hull"}),
 wall({from:[-3,2],to:[2,2],y:12,height:2,colour:"hull"}),
 wall({from:[-3,-1],to:[-3,1],y:12,height:2,colour:"hull"}),
 wall({from:[2,-1],to:[2,1],y:12,height:2,colour:"hull"})
]);
function engine(x,large){return [place({part:large?"30358":"4868b",at:[x,large?12:15,15],colour:"hull",turn:180}),place({part:large?"3004":"3023b",at:[x,large?15:17,20],colour:"trans light blue"})];}
section("Seven ion engines",[
 box({at:[-7,12,20],size:[14,9,1],colour:"machinery",interior:"solid",top:"tile"}),
 floor({at:[-7,21,14],size:[14,7],colour:"hull",top:"tile"}),
 ...[-5,-1,3].map(x=>engine(x,true)),...[-7,-3,1,5].map(x=>engine(x,false)),
 ...[-6,4].map(x=>place({part:"2412b",at:[x,22,18],colour:"machinery"}))
]);
function terrace(x,y,z,w,d,part,sideWidth){return [
 box({at:[x+sideWidth,y,z+2],size:[w-2*sideWidth,3,d-4],colour:"hull",interior:"solid",top:"tile"}),
 ...range(d/2).flatMap(i=>[place({part,at:[x,y,z+2*i],colour:"hull",turn:90}),place({part,at:[x+w-sideWidth,y,z+2*i],colour:"hull",turn:270})]),
 place({part:w-2*sideWidth===4?"3037":"3039",at:[x+sideWidth,y,z],colour:"hull"}),
 place({part:w-2*sideWidth===4?"3037":"3039",at:[x+sideWidth,y,z+d-2],colour:"hull",turn:180})
];}
section("Command citadel",[
 terrace(-6,21,-1,12,16,"30363",4),
 terrace(-4,24,5,8,10,"3298",3),
 floor({at:[-2,27,10],size:[4,4],colour:"hull"}),
 box({at:[-2,28,10],size:[4,8,4],colour:"hull",interior:"empty",top:"tile"}),
 ...[-2,1].map(x=>place({part:"2412b",at:[x,35,11],colour:"machinery",turn:90})),
 floor({at:[-6,36,10],size:[12,4],colour:"hull"}),
 box({at:[-3,37,10],size:[6,1,4],colour:"hull",interior:"solid"}),
 floor({at:[-3,38,10],size:[6,4],colour:"black"}),
 box({at:[-3,39,10],size:[6,1,4],colour:"hull",interior:"solid"}),
 ...[10,12].flatMap(z=>[place({part:"3298",at:[-6,37,z],colour:"hull",turn:90}),place({part:"3298",at:[3,37,z],colour:"hull",turn:270})]),
 floor({at:[-5,40,10],size:[10,4],colour:"hull",top:"tile"}),
 ...[-5,2].flatMap(x=>[column({at:[x+1,41,12],height:3,diameter:1,colour:"hull"}),place({part:"44359",at:[x,44,11],colour:"hull"})]),
 place({part:"3062b",at:[-1,41,12],colour:"machinery"}),
 place({part:"54200",at:[-1,44,12],colour:"hull"}),
 ...[-1,0].map(x=>place({part:"3070b",at:[x,40,10],colour:"machinery"}))
]);
function turret(x,z){return [place({part:"6141",at:[x,21,z],colour:"machinery"}),place({part:"2921",at:[x,22,z],colour:"hull"}),place({part:"98138",at:[x,25,z],colour:"machinery"})];}
section("Heavy turbolaser batteries",[
 ...[-7,6].flatMap(x=>[8,12,16].map(z=>turret(x,z))),
 ...[-5,3].map(x=>place({part:"2412b",at:[x,21,17],colour:"machinery"}))
]);
section("Escaping blockade runner",[
 floor({at:[9,7,-14],size:[2,4],colour:"white"}),
 floor({at:[8,7,-12],size:[4,4],colour:"white"}),
 floor({at:[9,8,-20],size:[2,8],colour:"white"}),
 box({at:[9,9,-18],size:[2,1,6],colour:"white",interior:"solid"}),
 floor({at:[9,10,-18],size:[2,6],colour:"dark red"}),
 box({at:[9,11,-18],size:[2,1,6],colour:"white",interior:"solid",top:"tile"}),
 floor({at:[8,9,-20],size:[4,2],colour:"white"}),
 place({part:"15068",at:[8,10,-20],colour:"white",turn:90}),
 place({part:"15068",at:[10,10,-20],colour:"white",turn:270}),
 ...[8,10].map(x=>place({part:"4229",at:[x,8,-12],colour:"white",turn:180})),
 place({part:"3069b",at:[9,12,-15],colour:"dark red"})
]);