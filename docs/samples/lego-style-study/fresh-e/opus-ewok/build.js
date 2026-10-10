script({title:"Endor Explorer: Ewok Treetop Spaceport",description:"A 1978 Classic Space outpost rebuilt by Ewoks: a log-hulled Galaxy Explorer with hide glider wings on a lashed-log launch pad, a woven radar dish tree, grey log command huts and a rope bridge high in the forest canopy.",palette:{bark:"reddish brown",deck:{mix:["dark tan","tan","dark tan"]},moss:{mix:["green","dark green","green"]},leaf:{mix:["dark green","green","dark green","olive green"]},thatch:{mix:["tan","dark tan","tan"]},padlog:{mix:["dark tan","reddish brown","dark tan"]}}});
const B="reddish brown",G="light bluish grey",DT="dark tan";
const P=(part,at,colour,turn)=>place({part,at,colour,turn:turn||0});
const rail=(path,y)=>fence({path,y,colour:B,style:"spindle"});
const strut=(at,turn)=>P("2449",at,B,turn);

section("Forest floor",[
 floor({at:[32,0,16],size:[22,22],colour:"moss"}),
 floor({at:[34,0,14],size:[18,26],colour:"moss"}),
 floor({at:[0,0,20],size:[20,18],colour:"moss"}),
 floor({at:[2,0,18],size:[16,22],colour:"moss"}),
 floor({at:[20,0,29],size:[12,4],colour:DT}),
 floor({at:[28,0,17],size:[4,5],colour:"moss"}),
 P("6255",[51,1,20],"green"),P("6255",[3,1,35],"green"),P("6255",[33,1,35],"green"),
 P("24866",[36,1,17],"yellow"),P("24866",[50,1,35],"yellow"),P("24866",[14,1,37],"yellow"),P("24866",[17,1,20],"yellow"),
 column({at:[50,1,15],height:9,diameter:1,colour:G}),P("4589",[50,10,15],"trans yellow")
]);

section("Command tree",[
 box({at:[35,28,21],size:[16,3,14],colour:"deck",texture:"log"}),
 box({at:[37,28,19],size:[12,3,18],colour:"deck",texture:"log"}),
 box({at:[33,52,21],size:[18,3,14],colour:"deck",texture:"log"}),
 box({at:[29,52,18],size:[11,3,11],colour:"deck",texture:"log"}),
 cylinder({at:[38,0,24],diameter:8,height:93,colour:"bark",texture:"log"}),
 carve({at:[39,28,22],size:[4,3,2]}),
 carve({at:[42,52,32],size:[5,3,2]}),
 P("3678b",[41,1,22],B,0),P("3039",[41,1,20],B,0),
 P("3678b",[40,1,32],B,180),P("3039",[40,1,34],B,180),
 P("3678b",[36,1,27],B,90),P("3039",[34,1,27],B,90),
 P("3678b",[46,1,26],B,270),P("3039",[48,1,26],B,270),
 strut([36,19,28],90),strut([46,19,27],270),strut([46,19,29],270),strut([42,19,32],180),strut([40,19,32],180),
 strut([41,43,22],0),strut([40,43,22],0),strut([46,43,26],270),strut([46,43,28],270),strut([36,43,29],90),
 column({at:[30,1,19],height:51,diameter:2,colour:B}),
 column({at:[36,1,19],height:51,diameter:2,colour:B}),
 range(10).map(k=>P("3003",[34+k,1+3*k,22],DT)),
 range(8).map(k=>P("3003",[47-k,31+3*k,32],DT)),
 rail([[39,19],[48,19]],31),rail([[50,21],[50,34]],31),rail([[37,36],[48,36]],31),rail([[35,21],[35,25]],31),rail([[35,30],[35,34]],31),
 P("3003",[45,31,20],G),P("3039",[45,34,20],"black"),
 P("4345b",[47,31,22],"blue"),
 rail([[29,18],[35,18]],55),rail([[29,19],[29,28]],55),rail([[50,27],[50,33]],55),rail([[33,34],[50,34]],55),
 cylinder({at:[30,55,19],diameter:8,height:3,colour:"blue"}),
 cylinder({at:[30,58,19],diameter:8,height:15,colour:G,texture:"log"}),
 cylinder({at:[30,73,19],diameter:8,height:1,colour:"blue"}),
 window({at:[33,62,19],facing:"front",size:"1x2x2",frame:"blue",glass:"trans yellow"}),
 window({at:[33,62,26],facing:"back",size:"1x2x2",frame:"blue",glass:"trans yellow"}),
 window({at:[30,62,22],facing:"left",size:"1x2x2",frame:"blue",glass:"trans yellow"}),
 door({at:[37,55,21],facing:"right",frame:"blue",colour:B}),
 roof({style:"hip",at:[30,74,19],size:[8,8],colour:"thatch"}),
 P("3666",[45,55,25],"tan"),P("3710",[46,55,24],"tan"),P("3023b",[47,55,23],"tan"),P("3023b",[47,55,22],"blue"),
 P("54200",[47,56,22],"trans yellow"),P("54200",[48,56,22],"trans yellow"),
 P("63864",[47,56,23],B,90),P("3069b",[45,56,25],B),P("6141",[50,56,25],"trans red"),
 floor({at:[33,90,22],size:[18,12],colour:"leaf"}),
 floor({at:[36,90,19],size:[12,18],colour:"leaf"}),
 dome({at:[35,91,21],diameter:14,colour:"leaf"}),
 dome({at:[43,89,27],diameter:10,colour:"leaf"}),
 dome({at:[32,92,23],diameter:8,colour:"leaf"}),
 dome({at:[34,91,29],diameter:8,colour:"leaf"}),
 box({at:[46,80,27],size:[3,3,2],colour:"bark",interior:"solid"}),P("2423",[46,83,25],"green"),
 box({at:[40,76,32],size:[2,3,3],colour:"bark",interior:"solid"}),P("2423",[39,79,33],"green"),
 P("2417",[38,89,16],"green"),P("2417",[40,89,33],"dark green")
]);

section("Radar tree and bridge",[
 box({at:[2,28,22],size:[17,3,13],colour:"deck",texture:"log"}),
 box({at:[4,28,20],size:[12,3,17],colour:"deck",texture:"log"}),
 cylinder({at:[7,0,26],diameter:6,height:60,colour:"bark",texture:"log"}),
 P("3678b",[9,1,24],B,0),P("3039",[9,1,22],B,0),
 P("3678b",[8,1,32],B,180),P("3039",[8,1,34],B,180),
 P("3678b",[5,1,28],B,90),P("3039",[3,1,28],B,90),
 P("3678b",[13,1,27],B,270),P("3039",[15,1,27],B,270),
 strut([10,19,24],0),strut([9,19,32],180),strut([5,19,29],90),strut([13,19,28],270),
 rail([[4,20],[11,20]],31),rail([[2,22],[2,27]],31),rail([[4,36],[15,36]],31),rail([[18,22],[18,25]],31),rail([[18,30],[18,34]],31),
 box({at:[12,31,21],size:[4,3,4],colour:"blue",interior:"solid"}),
 column({at:[13,34,22],height:6,diameter:2,colour:G}),
 P("3960",[12,40,21],"tan"),
 P("3957a",[16,31,23],G),
 P("3941",[14,31,32],B),P("14769",[14,34,32],"tan"),
 cylinder({at:[2,31,28],diameter:6,height:3,colour:"blue"}),
 cylinder({at:[2,34,28],diameter:6,height:9,colour:G,texture:"log"}),
 window({at:[4,35,28],facing:"front",size:"1x2x2",frame:"blue",glass:"trans yellow"}),
 window({at:[2,35,30],facing:"left",size:"1x2x2",frame:"blue",glass:"trans yellow"}),
 roof({style:"hip",at:[2,43,28],size:[6,6],colour:"thatch"}),
 floor({at:[3,60,24],size:[14,10],colour:"leaf"}),
 floor({at:[5,60,22],size:[10,14],colour:"leaf"}),
 dome({at:[4,61,23],diameter:12,colour:"leaf"}),
 dome({at:[10,59,27],diameter:8,colour:"leaf"}),
 P("2417",[1,59,25],"green"),
 P("2549",[19,29,26],B,90)
]);

const wing=[];
for(let r=0;r<7;r++){const z=7-r,xs=12+2*r;wing.push(floor({at:[xs,12,z],size:[30-xs,1],layers:2,colour:"tan",top:"tile"}));if(z!==2)wing.push(P("3069b",[xs,14,z],B));}
wing.push(P("2431",[22,14,4],"blue",90),P("63864",[18,14,5],B,90),
 box({at:[24,14,2],size:[6,3,2],colour:G,interior:"solid",top:"tile"}),
 P("3040b",[22,14,2],"blue",90),P("3040b",[22,14,3],"blue",90),
 P("98138",[29,17,2],"trans red"),P("98138",[29,17,3],"trans red"),
 box({at:[20,9,4],size:[9,3,2],colour:G,interior:"solid"}),
 P("3665a",[18,9,4],G,90),P("3665a",[18,9,5],G,90),
 P("4070",[29,9,4],"dark bluish grey",270),P("4070",[29,9,5],"dark bluish grey",270));

section("Launch pad and Endor Explorer",[
 box({at:[6,0,4],size:[26,3,14],colour:"padlog",texture:"log"}),
 carve({at:[6,0,4],size:[2,3,2]}),carve({at:[30,0,4],size:[2,3,2]}),carve({at:[6,0,16],size:[2,3,2]}),carve({at:[30,0,16],size:[2,3,2]}),
 stairs({at:[34,0,9],width:4,steps:3,dir:"-x",colour:B}),
 P("6141",[9,3,5],"trans yellow"),P("6141",[28,3,5],"trans yellow"),P("6141",[9,3,16],"trans yellow"),P("6141",[28,3,16],"trans yellow"),
 [[10,8],[10,12],[24,8],[24,12]].map(([x,z])=>[P("4032b",[x,3,z],G),column({at:[x,4,z],height:6,diameter:2,colour:"blue"})]),
 [13,15,17,19,21].map(x=>[P("3660b",[x,7,8],G,0),P("3660b",[x,7,12],G,180)]),
 box({at:[6,10,8],size:[24,3,6],colour:"bark",texture:"log"}),
 box({at:[6,13,8],size:[25,3,6],colour:"blue",interior:"solid"}),
 floor({at:[6,16,8],size:[25,6],colour:G,top:"tile"}),
 [8,10,12].map(z=>[P("3660b",[4,10,z],G,90),P("3039",[4,13,z],"blue",90)]),
 P("4070",[30,13,9],"dark bluish grey",270),P("4070",[30,13,12],"dark bluish grey",270),
 P("4070",[16,13,8],G,0),P("4070",[20,13,8],G,0),P("4070",[16,13,13],G,180),P("4070",[20,13,13],G,180),
 P("2877",[24,13,8],G,0),P("2877",[24,13,13],G,180),
 mirror({axis:"z",about:11,ops:wing}),
 P("6141",[28,14,1],"trans red"),P("6141",[28,14,20],"trans green"),
 P("4474",[6,17,9],"trans yellow",90),
 range(6,13).map(x=>[P("54200",[x,17,8],"blue",0),P("54200",[x,17,13],"blue",180)]),
 box({at:[13,17,8],size:[9,6,6],colour:"blue",top:"tile"}),
 [15,18].map(x=>[window({at:[x,17,8],facing:"front",size:"1x2x2",frame:G,glass:"trans yellow"}),window({at:[x,17,13],facing:"back",size:"1x2x2",frame:G,glass:"trans yellow"})]),
 box({at:[22,17,8],size:[2,3,6],colour:"blue",interior:"solid"}),
 [8,10,12].map(z=>P("3039",[22,20,z],"blue",270)),
 P("3941",[24,17,10],B),P("14769",[24,20,10],"tan"),
 box({at:[26,17,8],size:[5,3,6],colour:G,interior:"solid",top:"tile"}),
 [9,12].map(z=>[P("3004",[27,20,z],"blue"),P("3040b",[27,23,z],"blue",90)]),
 P("4740",[27,20,10],G),
 P("3960",[17,23,9],"tan"),
 P("3957a",[14,23,9],B),P("3957a",[14,23,12],B)
]);

section("Log moon buggy",[
 place({part:"4600",at:[42,2,3],colour:G,wheels:G}),place({part:"4600",at:[42,2,8],colour:G,wheels:G}),
 floor({at:[42,3,2],size:[2,9],layers:2,colour:"dark bluish grey"}),
 box({at:[40,5,2],size:[6,3,8],colour:"bark",texture:"log"}),
 P("3039",[40,8,2],"blue"),P("3039",[44,8,2],"blue"),P("3069b",[42,8,2],G),P("3039",[42,8,3],"trans yellow"),
 P("4079",[42,8,5],"tan"),
 P("3068b",[40,8,4],"blue"),P("3068b",[44,8,4],"blue"),P("3068b",[40,8,6],"blue"),P("3068b",[44,8,6],"blue"),
 P("4032b",[40,8,8],G),P("4740",[40,9,8],"tan"),
 P("3069b",[42,8,8],G),P("3069b",[42,8,9],G),P("3070b",[44,8,8],"blue"),P("3070b",[44,8,9],"blue"),P("3957a",[45,8,9],B)
]);