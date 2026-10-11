script({title:"Devastator: Opening Pursuit",description:"The opening chase above Tatooine: a smooth, dagger-shaped Imperial Star Destroyer overtakes a tiny red-and-white Tantive IV. Recessed hull trenches, eight twin batteries, three engines, a terraced command island and twin spherical shield generators finish a connected orbital display.",palette:{hull:"light bluish grey",trench:"dark bluish grey",space:"black"}});
const N=3,S=12,Y=15,L=N*S;
const p=(part,at,colour="hull",turn=0)=>place({part,at,colour,turn});
section("Orbital display",[
box({at:[-14,0,-4],size:[28,2,L+10],colour:"black",interior:"solid",top:"tile"}),
p("95198",[-13,2,-2],"tan"),
column({at:[-1,2,28],diameter:2,height:Y-2,colour:"black"}),
column({at:[5,2,2],diameter:1,height:4,colour:"trans-clear"}),
...[[10,0],[-11,18],[11,28],[-12,36],[8,39],[-4,-3],[11,13]].map(([x,z])=>p("98138",[x,2,z],"white")),
floor({at:[-2,2,-4],size:[4,2],colour:"dark bluish grey"}),
p("87079ps0",[-2,3,-4],"black"),
p("14769ps4",[9,2,-3],"light bluish grey")
]);
function hullCourse(i){const z=i*S,w=3*(i+1),inner=3*i;return [
...range(3).flatMap(k=>[p("47397",[-w,Y+k,z],k===1?"trench":"hull"),p("47398",[inner,Y+k,z],k===1?"trench":"hull")]),
p("42061",[-w,Y+3,z]),p("42060",[inner,Y+3,z]),
i>0&&box({at:[-inner,Y,z],size:[inner*2,3,S],colour:"hull",interior:"solid"})
];}
function engine(x){return [p("3795",[x,11,34],"hull",90),p("4868b",[x,12,34],"hull",180),p("3069b",[x,12,39],"trans light blue")];}
section("Connected wedge hull",[
...range(N).flatMap(hullCourse),
p("3020",[-1,14,10],"hull",90),
p("3020",[-4,14,22]),p("3020",[0,14,22]),
p("3020",[-7,14,32]),p("3020",[3,14,32]),
floor({at:[-1,18,S],size:[2,S],layers:3,colour:"hull",top:"tile"}),
...range(S/2).flatMap(i=>[p("15068",[-3,18,S+i*2],"hull",90),p("15068",[1,18,S+i*2],"hull",270)]),
floor({at:[-4,18,S*2],size:[8,S],layers:3,colour:"hull",top:"tile"}),
...range(S/2).flatMap(i=>[p("15068",[-6,18,S*2+i*2],"hull",90),p("15068",[4,18,S*2+i*2],"hull",270)]),
p("3660b",[-3,12,16],"trench",90),p("3660b",[1,12,16],"trench",270),
floor({at:[-1,14,16],size:[2,4],colour:"black",top:"tile"}),
...[-6,-1,4].flatMap(engine)
]);
function battery(x,z){return [p("4032b",[x,21,z]),p("30367c",[x,22,z]),p("3839b",[x,25,z],"trench"),p("3069b",[x,26,z])];}
section("Dorsal island and batteries",[
box({at:[-1,21,17],size:[2,3,7],colour:"hull",top:"tile"}),
box({at:[-2,21,24],size:[4,3,10],colour:"hull",top:"tile"}),
box({at:[-1,24,26],size:[2,6,8],colour:"hull",top:"tile"}),
box({at:[-1,30,30],size:[2,6,3],colour:"hull",top:"tile"}),
p("3660b",[-2,33,30],"hull",90),p("3660b",[0,33,30],"hull",270),
...[-4,2].flatMap(x=>[25,28,31,34].flatMap(z=>battery(x,z))),
...[-2,1].flatMap(x=>[27,30,33].map(z=>p("2412b",[x,24,z],"trench",90))),
p("15068",[-1,24,24]),
p("3069b",[-1,30,28],"trench"),
p("2412b",[-1,30,33]),
p("3069b",[-1,21,14],"trench"),
p("3070b",[0,21,16],"trench")
]);
function shield(x){return [p("4032b",[x,41,30]),p("15395",[x,42,30]),p("30367c",[x,46,30])];}
section("Command bridge",[
floor({at:[-6,36,29],size:[12,4],colour:"hull"}),
box({at:[-4,37,29],size:[8,1,4],colour:"hull",interior:"solid"}),
box({at:[-4,38,29],size:[8,1,4],colour:"black",interior:"solid"}),
box({at:[-4,39,29],size:[8,1,4],colour:"hull",interior:"solid"}),
p("43721",[-6,37,29]),p("43720",[4,37,29]),
floor({at:[-4,40,29],size:[8,4],colour:"hull",top:"tile"}),
...[-4,2].flatMap(shield),
p("3005",[0,41,32]),p("54200",[0,44,32],"trench"),
p("2412b",[-1,41,29],"trench"),
...[-3,2].map(x=>p("3070b",[x,39,29],"trench"))
]);
section("Tantive IV",[
box({at:[5,6,-1],size:[1,2,7],colour:"dark red",interior:"solid"}),
p("3710",[3,7,-1],"white"),
p("15068",[3,8,-2],"white"),p("15068",[5,8,-2],"white"),
p("3710",[5,8,0],"white",90),
...[0,1,3].map(z=>p("3070b",[5,9,z],"white")),
p("6141",[5,9,2],"dark red"),
p("3021",[4,7,4],"white"),
floor({at:[4,7,6],size:[3,1],colour:"white"}),
...[4,5,6].map(x=>p("11477",[x,8,4],"white",180)),
...[4,5,6].map(x=>p("98138",[x,8,6],"trans light blue"))
]);