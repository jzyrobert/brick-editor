script({title:"Piplup's First Bubble Beam",description:"A proud little Piplup practices Bubble Beam on a sculpted sea-ice shelf. Its oversized navy hood, white eye patches, yellow bill, twin pearl buttons and outstretched flippers overlook sparkling bubbles and an inquisitive orange fish.",palette:{ice:"white",sea:"trans light blue",blue:"medium azure",hood:"dark blue"}});
const W=24,D=22;
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
section("Ocean display",[
box({at:[0,0,0],size:[W,3,D],colour:"dark blue",interior:"solid",top:"tile"}),
floor({at:[1,3,1],size:[W-2,D-2],colour:"sea",top:"tile"}),
floor({at:[16,3,12],size:[7,8],colour:"trans dark blue",top:"tile"}),
box({at:[2,4,10],size:[12,3,10],colour:"ice",top:"tile"}),
...[2,6,10].map(x=>p("88930",[x,4,8],"white")),
...range(10,20).map(z=>p("3040b",[0,4,z],"white",90)),
...range(12,18).map(z=>p("3040b",[14,4,z],"white",270)),
...range(3).map(i=>p("15068",[4+i*3,4,20],"white",180)),
p("2450",[13,4,9],"white",90),
box({at:[2,7,16],size:[2,3,3],colour:"white",top:"tile"}),
p("3298",[2,10,16],"white",180),
box({at:[5,7,19],size:[6,3,1],colour:"white",top:"tile"}),
...range(3).map(i=>p("15068",[5+2*i,10,19],"white",180)),
box({at:[19,4,15],size:[3,3,4],colour:"white",top:"tile"}),
p("3298",[19,7,16],"white",180),p("3040b",[21,7,16],"white",180),
p("11127",[19,7,14],"trans light blue"),
p("64648",[21,4,7],"orange",90)
]);
const foot=x=>range(3).map(i=>p("50950",[x+i,7,8],"yellow"));
section("Piplup - feet and round body",[
...foot(6),...foot(10),
p("54091",[5,10,10],"blue"),
box({at:[5,16,10],size:[8,3,8],colour:"blue",interior:"solid"}),
p("54095",[5,19,10],"blue"),
floor({at:[5,16,9],size:[8,2],colour:"blue",top:"tile"}),
p("6091",[7,17,9],"white"),p("6091",[10,17,9],"white"),
box({at:[5,22,9],size:[8,3,1],colour:"hood",top:"tile"}),
floor({at:[5,16,17],size:[8,2],colour:"hood",top:"tile"}),
p("3020",[8,16,17],"dark blue",90),
p("24309",[8,17,19],"dark blue",180),
box({at:[5,17,18],size:[8,8,1],colour:"hood",top:"tile"}),
...[5,7,9,11].map(x=>p("15068",[x,25,18],"dark blue",180)),
p("3020",[2,16,13],"medium azure"),
...[13,14].map(z=>p("50950",[2,17,z],"medium azure",90)),
p("3020",[12,17,10],"medium azure"),
...[10,11].map(z=>p("61678",[13,18,z],"medium azure",270))
]);
const cheek=x=>[
p("13547",[x,28,7],"white",90),
box({at:[x,31,7],size:[4,8,3],colour:"white",interior:"solid"}),
...range(4).map(i=>p("50950",[x+i,39,7],"white")),
p("20953",[x+1,33,7],"black"),
p("98138",[x+1,38,7],"white")
];
section("Piplup - hood and expression",[
p("54091",[5,25,10],"medium azure"),
box({at:[5,31,10],size:[8,6,8],colour:"hood",interior:"solid"}),
p("54095",[5,37,10],"dark blue"),
floor({at:[4,31,9],size:[10,4],colour:"white"}),
...cheek(4),...cheek(10),
box({at:[8,31,8],size:[2,8,2],colour:"hood",interior:"solid"}),
p("15068",[8,39,8],"dark blue"),
...[4,13].flatMap(x=>[p("11477",[x,32,10],"dark blue",x===4?90:270),p("11477",[x,35,10],"dark blue",x===4?90:270)]),
box({at:[8,28,8],size:[2,3,2],colour:"yellow",interior:"solid"}),
...[8,9].map(x=>p("24201",[x,27,6],"yellow")),
p("24309",[8,31,5],"yellow")
]);
const bubble=(x,z,y,big)=>[
column({at:[x+(big?1:0),4,z+(big?1:0)],height:y-4,diameter:1,colour:"trans-clear"}),
p(big?"86500":"30151b",[x,y,z],"trans-clear")
];
section("Bubble Beam and tidepool ripples",[
...bubble(14,5,25,false),...bubble(16,3,17,false),...bubble(19,1,9,true),
p("6908",[17,4,9],"trans-clear"),p("6908",[20,4,10],"trans-clear"),
...[[17,7],[18,8],[19,9],[21,9],[22,8],[22,6],[18,5]].map(([x,z])=>p("25269",[x,4,z],"white")),
...[[3,5],[5,4],[8,5],[10,3],[12,4]].map(([x,z],i)=>p("3069b",[x,4,z],i%2?"trans-clear":"trans light blue")),
p("30385",[3,7,12],"trans light blue"),p("30153",[15,4,19],"trans light blue")
]);