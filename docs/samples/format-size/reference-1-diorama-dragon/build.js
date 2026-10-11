script({title:"The Ember Cradle",description:"A ruby dragon shelters her clutch in a warm obsidian nest. Broad, ribbed wings shade the eggs, ivory horns crown a lowered head, and a long tail curls around the lava-lit basalt island.",palette:{scale:"dark red",membrane:"dark tan",horn:"tan",rock:{mix:["dark bluish grey","dark bluish grey","black"]}},defaults:{interior:"empty"}});
const W=40,D=32;
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function rock(at,size){return box({at,size,colour:"rock",top:"tile"});}
section("Lava-cut display island",[
 floor({at:[0,0,0],size:[W,D],layers:2,colour:"black"}),
 floor({at:[1,2,1],size:[W-2,D-2],colour:"dark red",top:"tile"}),
 floor({at:[1,3,2],size:[12,6],colour:"orange",top:"tile"}),
 floor({at:[3,3,8],size:[7,8],colour:"orange",top:"tile"}),
 floor({at:[1,3,16],size:[6,9],colour:"orange",top:"tile"}),
 floor({at:[28,3,3],size:[10,6],colour:"orange",top:"tile"}),
 floor({at:[31,3,9],size:[7,16],colour:"orange",top:"tile"}),
 floor({at:[25,3,25],size:[11,5],colour:"orange",top:"tile"}),
 floor({at:[1,4,4],size:[9,1],colour:"yellow",top:"tile"}),
 floor({at:[5,4,9],size:[1,6],colour:"yellow",top:"tile"}),
 floor({at:[34,4,8],size:[1,13],colour:"yellow",top:"tile"}),
 floor({at:[28,4,27],size:[6,1],colour:"yellow",top:"tile"}),
 rock([11,3,6],[8,6,8]),rock([23,3,9],[7,6,10]),
 rock([12,3,14],[17,9,12]),rock([9,3,18],[6,6,9]),
 rock([15,3,25],[10,6,4]),rock([27,3,21],[5,6,7]),
 rock([8,3,10],[4,3,6]),rock([5,3,20],[5,3,7]),
 rock([29,3,10],[3,3,9]),rock([10,3,28],[13,3,2]),
 ...[[10,3,6,90],[8,3,15,90],[5,3,24,0],[27,3,28,180],[12,3,28,180]].map(([x,y,z,t])=>p("3678b",[x,y,z],"dark bluish grey",t)),
 ...[[11,3,16,90],[11,3,22,90],[28,3,17,270]].map(([x,y,z,t])=>p("3684a",[x,y,z],"dark bluish grey",t)),
 ...[[2,4,3],[8,4,6],[4,4,18],[3,4,23],[30,4,6],[36,4,15],[32,4,26]].map(at=>p("98138",at,"trans red")),
 floor({at:[0,2,0],size:[W,1],colour:"black",top:"tile"}),floor({at:[0,2,D-1],size:[W,1],colour:"black",top:"tile"}),
 floor({at:[0,2,1],size:[1,D-2],colour:"black",top:"tile"}),floor({at:[W-1,2,1],size:[1,D-2],colour:"black",top:"tile"})
]);
function egg(at){return group({at,ops:[p("4032b",[0,0,0],"tan"),p("3941",[0,1,0],"white"),p("15068",[0,4,0],"white"),p("24946",[0,7,1],"white")]});}
section("The warm clutch",[
 cylinder({at:[15,3,1],diameter:10,height:6,colour:"dark bluish grey"}),
 cylinder({at:[16,9,2],diameter:8,height:1,colour:"dark tan"}),
 ...[[16,9,2,0],[19,9,1,0],[22,9,2,90],[24,9,5,90],[22,9,9,0],[18,9,9,0],[15,9,6,90]].map(([x,y,z,t])=>p("3069b",[x,y,z],"reddish brown",t)),
 egg([17,10,3]),egg([20,10,2]),
 p("3941",[21,10,6],"white"),p("3022",[21,13,6],"dark red"),
 p("3005pe1",[21,14,6],"red"),p("3005",[21,14,7],"dark red"),p("11477",[22,14,6],"dark red"),
 p("4589",[21,17,7],"tan"),p("54200",[22,17,7],"dark red",180),
 p("49668",[20,10,8],"white",90),p("49668",[23,10,6],"white",270)
]);
function hindLeg(x){return [
 floor({at:[x,12,21],size:[4,6],layers:2,colour:"scale",top:"tile"}),
 ...range(3).map(i=>p("49668",[x+i,14,21],"white")),
 p("15068",[x,14,23],"scale"),p("15068",[x+2,14,23],"scale"),
 box({at:[x+1,15,19],size:[3,11,6],colour:"scale"}),
 p("93606",[x,26,19],"scale"),p("93606",[x+2,26,19],"scale"),
 p("15068",[x,26,23],"scale",180),p("15068",[x+2,26,23],"scale",180)
];}
function foreLeg(x,z,h){return [
 floor({at:[x,9,z],size:[4,4],layers:2,colour:"scale",top:"tile"}),
 ...range(3).map(i=>p("49668",[x+i,11,z],"white")),
 p("15068",[x,11,z+2],"scale"),p("15068",[x+2,11,z+2],"scale"),
 box({at:[x+2,14,z+2],size:[2,h,4],colour:"scale"}),
 p("50950",[x+2,14,z+2],"scale"),p("50950",[x+3,14,z+2],"scale"),
 p("3678b",[x+2,14+h-9,z+2],"scale"),
 p("42022",[x+2,14+h,z+1],"scale"),p("42022",[x+3,14+h,z+1],"scale")
];}
section("Four planted feet and rounded haunches",[
 hindLeg(13),hindLeg(23),foreLeg(13,9,13),foreLeg(24,11,15),
 floor({at:[15,23,20],size:[10,4],layers:2,colour:"scale"}),
 box({at:[16,24,14],size:[2,6,3],colour:"scale"}),
 box({at:[23,25,15],size:[3,6,3],colour:"scale"})
]);
section("Sculpted torso and armoured breast",[
 p("45410",[17,17,15],"scale"),
 box({at:[17,23,15],size:[6,12,8],colour:"scale"}),
 ...[17,18,21,22].map(x=>p("42022",[x,35,15],"scale")),
 p("15068",[17,35,21],"scale",180),p("15068",[21,35,21],"scale",180),
 p("15068",[17,32,22],"scale",180),p("15068",[21,32,22],"scale",180),
 floor({at:[19,35,15],size:[2,8],layers:3,colour:"scale",top:"tile"}),
 box({at:[18,27,10],size:[4,11,6],colour:"scale"}),
 p("3678b",[18,27,10],"tan"),p("3678b",[20,27,10],"tan"),
 p("15068",[18,33,10],"tan"),p("15068",[20,33,10],"tan"),
 p("11477",[18,36,12],"scale"),p("11477",[21,36,12],"scale"),
 ...[15,18,21].map(z=>p("4589",[19,38,z],"horn")),
 p("44126",[17,35,13],"scale",90)
]);
section("Open jaws, watchful eyes and swept horns",[
 floor({at:[17,30,3],size:[6,8],layers:2,colour:"scale"}),
 p("15068",[17,32,3],"scale"),p("15068",[21,32,3],"scale"),
 p("3068b",[19,32,4],"black"),
 p("2431",[18,32,8],"scale"),
 ...[[17,32,6],[22,32,6],[17,32,8],[22,32,8]].map(at=>p("4589",at,"white")),
 box({at:[17,38,6],size:[6,4,6],colour:"scale"}),
 box({at:[18,38,3],size:[4,3,4],colour:"scale"}),
 p("15068",[18,41,3],"scale"),p("15068",[20,41,3],"scale"),
 p("98138",[18,44,4],"black"),p("98138",[21,44,4],"black"),
 floor({at:[17,42,6],size:[6,5],colour:"scale",top:"tile"}),
 p("3005pe1",[17,40,7],"red",90),p("3005pe1",[22,40,7],"red",270),
 p("11477",[17,43,7],"scale",90),p("11477",[21,43,7],"scale",270),
 p("11477",[17,43,8],"scale"),p("11477",[22,43,8],"scale"),
 p("15068",[19,43,8],"scale"),
 ...[17,22].map(x=>[p("3062b",[x,43,10],"horn"),p("11089",[x,46,10],"horn",180)]),
 p("4589",[18,43,10],"horn"),p("4589",[21,43,10],"horn")
]);
function wing(right=false){const ops=[
 floor({at:[0,-1,2],size:[14,6],colour:"scale",top:"tile"}),
 floor({at:[2,-1,7],size:[4,6],colour:"scale",top:"tile"}),
 floor({at:[6,-1,10],size:[4,6],colour:"scale",top:"tile"}),
 floor({at:[10,0,0],size:[4,6],layers:2,colour:"scale",top:"tile"}),
 floor({at:[2,0,2],size:[12,4],layers:2,colour:"scale",top:"tile"}),
 floor({at:[4,0,6],size:[10,4],layers:2,colour:"scale",top:"tile"}),
 floor({at:[8,0,10],size:[6,3],layers:2,colour:"scale",top:"tile"}),
 p("41747",[0,0,2],"scale"),p("41747",[2,0,7],"scale"),p("41748",[6,0,10],"scale"),
 ...[4,7,10].map(x=>p("41748",[x,2,3],"membrane")),
 p("43723a",[8,2,9],"membrane"),p("41770a",[10,2,9],"membrane"),p("41769a",[12,2,8],"membrane"),
 ...[2,6,10].map(x=>p("61678",[x,2,2],"scale",90)),
 p("15068",[12,2,0],"scale"),
 ...[[6,7],[9,9],[12,10]].map(([x,len])=>[
 box({at:[x,2,3],size:[1,3,len],colour:"scale"}),
 p("61678",[x,5,3],"scale",180),
 p(len===7?"11477":"61678",[x,5,7],"scale",180),
 len===10&&p("11477",[x,5,11],"scale",180)
 ])
].flat(Infinity).filter(Boolean);
 if(!right)return ops;
 const dims={"41747":[2,6],"41748":[2,6],"43723a":[2,3],"41770a":[2,4],"41769a":[2,4],"61678":[1,4],"15068":[2,2],"11477":[1,2]};
 const hand={"41747":"41748","41748":"41747","43723a":"43722a","41770a":"41769a","41769a":"41770a"};
 return ops.map(o=>{if(o.op==="place"){const t=o.turn||0;const d=dims[o.part];const width=t%180===0?d[0]:d[1];return {...o,at:[14-o.at[0]-width,o.at[1],o.at[2]],turn:(360-t)%360,part:hand[o.part]||o.part};}return {...o,at:[14-o.at[0]-o.size[0],o.at[1],o.at[2]]};});
}
section("Scalloped wings shading the clutch",[
 floor({at:[14,32,15],size:[12,2],colour:"scale"}),
 box({at:[14,26,15],size:[3,6,4],colour:"scale"}),
 box({at:[23,29,13],size:[3,6,4],colour:"scale"}),
 group({at:[2,32,14],ops:wing()}),
 group({at:[24,35,12],ops:wing(true)})
]);
section("A tail curled around the island",[
 box({at:[19,20,23],size:[4,6,5],colour:"scale"}),
 p("44126",[19,26,23],"scale",180),p("44126",[21,26,23],"scale",180),
 box({at:[22,15,26],size:[7,6,3],colour:"scale"}),
 ...[26,27,28].map(z=>p("61678",[22,21,z],"scale",270)),
 box({at:[28,10,25],size:[3,6,3],colour:"scale"}),
 p("15068",[28,16,25],"scale",270),
 box({at:[30,10,23],size:[4,3,3],colour:"scale"}),
 p("50950",[30,13,23],"scale",270),p("41747",[32,12,20],"scale",180),
 ...[[20,29,24],[22,24,27],[28,19,26],[32,15,23]].map(at=>p("4589",at,"horn")),
 p("15068",[26,21,26],"scale",270)
]);