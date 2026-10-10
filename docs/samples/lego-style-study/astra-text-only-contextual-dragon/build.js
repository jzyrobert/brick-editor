script({title:"Cinderkeeper — The Last Egg",description:"An obsidian dragon shelters its cracking egg beneath raised crimson wings. Continuous wing spars, a curved armoured chest and gripping feet support the watchful pose; its golden-spined tail curls around a compact volcanic nest.",palette:{hide:"black",membrane:"dark red",bone:"tan",spine:"pearl gold",rock:"dark bluish grey"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const build=(name,ops)=>section(name,[group({at:[0,-5,0],ops})]);
const spike=([x,y,z])=>[P("85861",[x,y,z],"black"),P("24482",[x,y+1,z],"spine")];
function island(x,z,w,d){return floor({at:[x+1,0,z+1],size:[w-2,d-2],colour:"rock"});}
section("Connected volcanic outcrop",[
 island(16,2,16,14),island(10,11,12,26),island(28,14,11,27),island(18,20,14,22),island(4,24,13,18),island(9,37,23,8),
 ...[[17,1,4],[29,1,4],[11,1,12],[36,1,15],[36,1,37],[28,1,42],[12,1,42]].map((at,i)=>P("3039",at,i%3===0?"black":"dark bluish grey",i%4*90)),
 ...[[17,1,3],[21,1,3],[26,1,3],[11,1,17],[11,1,22],[5,1,26],[5,1,39],[15,1,43],[23,1,43],[37,1,22],[37,1,29],[37,1,34]].map((at,i)=>P("3069b",at,i%3===0?"trans yellow":"trans red",at[0]===37||at[0]===5||at[0]===11?90:0)),
 ...[[19,1,3],[24,1,3],[11,1,20],[37,1,26],[21,1,43]].map(at=>P("3069b",at,"orange"))
]);
function paw(x,z,hind){return [floor({at:[x,6,z],size:[6,8],layers:3,colour:"hide"}),...range(3).map(i=>P("15070",[x+2*i,9,z],"bone")),...range(3).map(i=>P("3039",[x+2*i,9,z+2],"hide")),...range(2).map(i=>P(hind?"93606":"15068",[x+1+2*i,9,z+4],"hide")),P("2431",[x,9,z+4],"hide",90),P("2431",[x+5,9,z+4],"hide",90),!hind&&box({at:[x+1,9,z+6],size:[4,12,4],colour:"hide",interior:"solid"}),!hind&&range(2).map(i=>P("15068",[x+1+2*i,21,z+6],"hide"))];}
build("Four gripping feet and rounded haunches",[
 paw(13,13,false),paw(30,16,false),paw(12,31,true),paw(30,32,true),
 box({at:[16,18,21],size:[5,12,6],colour:"hide",interior:"solid"}),box({at:[27,18,23],size:[5,12,6],colour:"hide",interior:"solid"}),
 box({at:[13,9,28],size:[6,12,7],colour:"hide",interior:"solid"}),box({at:[29,9,29],size:[6,12,7],colour:"hide",interior:"solid"}),
 ...range(3).map(k=>[P("3678b",[13,15,28+2*k],"hide",90),P("3678b",[33,15,29+2*k],"hide",270)]),
 ...[[13,21,28],[15,21,28],[17,21,28],[29,21,29],[31,21,29],[33,21,29]].map((at,i)=>P("93606",at,i%3===1?"dark red":"hide")),
 ...range(3).map(k=>[P("3678b",[15,24,21+2*k],"hide",90),P("3678b",[31,24,23+2*k],"hide",270)]),
 ...[[16,30,22],[18,30,22],[28,30,24],[30,30,24]].map(at=>P("93606",at,"hide"))
]);
build("Sculpted heart and arched neck",[
 box({at:[20,6,26],size:[8,15,9],colour:"hide"}),box({at:[19,15,23],size:[10,12,11],colour:"hide"}),box({at:[21,27,23],size:[6,6,11],colour:"hide"}),box({at:[20,12,21],size:[8,24,5],colour:"hide"}),box({at:[20,30,20],size:[8,9,9],colour:"hide"}),box({at:[21,39,17],size:[6,9,9],colour:"hide"}),box({at:[21,48,14],size:[6,9,8],colour:"hide"}),
 ...range(5).map(k=>[P("3660b",[17,18,23+2*k],"hide",90),P("3660b",[29,18,23+2*k],"hide",270),P("3678b",[17,21,23+2*k],"hide",90),P("3678b",[29,21,23+2*k],"hide",270)]),
 ...range(10).map(k=>[P("61678",[18,27,23+k],"hide",90),P("61678",[26,27,23+k],"hide",270)]),
 ...range(4).map(k=>range(4).map(i=>P("24309",[20+2*i,15+6*k,20],"tan"))),
 ...range(3).map(k=>range(4).map(i=>P("3069b",[20+2*i,18+6*k,20],"dark red"))),
 ...range(4).map(i=>P("24309",[20+2*i,27,33],"hide",180)),
 ...range(3).map(k=>[P("15068",[22,33,29+2*k],"hide",90),P("15068",[24,33,29+2*k],"hide",270)]),
 ...range(3).map(i=>P("3747b",[21+2*i,36,17],"hide")),
 ...range(3).map(k=>[P("3678b",[19,33,23+2*k],"hide",90),P("3678b",[27,33,23+2*k],"hide",270)]),
 ...range(4).map(k=>[P("15068",[20,45,17+2*k],"hide",90),P("15068",[26,45,17+2*k],"hide",270)]),
 ...range(3).map(i=>[P("24309",[21+2*i,39,26],"hide",180),P("24309",[21+2*i,48,23],"hide",180),P("24309",[21+2*i,54,20],"hide",180)]),
 ...range(3).map(k=>[P("11477",[23,39+3*k,16],k===1?"dark red":"tan"),P("11477",[24,39+3*k,16],k===1?"dark red":"tan")]),
 ...[[24,36,33],[24,42,26],[24,51,23]].map(spike)
]);
function wing(){const top=[60,66,72,75,69,63,57,51,45,42],bottom=[48,39,30,33,36,27,24,27,30,30],low=[3,9,9,3,3,9,3,3,3,3];const ops=[];for(let k=0;k<10;k++){const x=2+2*k,z=29,b=bottom[k],t=top[k],h=low[k];ops.push(box({at:[x,b+h,z],size:[2,t-b-h-6,2],colour:"membrane",interior:"solid"}));if(h===9){ops.push(P("2449",[x,b,z],"hide",90),P("2449",[x,b,z+1],"hide",90));}else{ops.push(P("3660b",[x,b,z],"hide",k<3?90:270));}ops.push(P("3678b",[x,t-6,z],"hide",k<3?90:270));}
 ops.push(box({at:[18,33,29],size:[6,3,2],colour:"hide",interior:"solid"}),box({at:[20,33,26],size:[4,6,4],colour:"hide",interior:"solid"}),spike([8,75,29]));
 [[8,60],[10,51],[12,42],[14,33]].forEach(([x,y])=>ops.push(P("4460b",[x,y,29],"hide",270)));[[4,48],[6,57]].forEach(([x,y])=>ops.push(P("4460b",[x,y,29],"hide",90)));return ops;}
build("Interlocked crimson sheltering wings",[wing(),group({at:[0,3,1],ops:[mirror({axis:"x",about:24,ops:wing()})]})]);
const tailSegments=[{at:[21,12,33],size:[8,6,7]},{at:[18,9,37],size:[8,6,6]},{at:[12,6,39],size:[9,6,6]},{at:[7,6,35],size:[7,6,8]},{at:[5,6,29],size:[5,6,8]},{at:[6,6,25],size:[3,3,6]}];
build("Hooked armoured tail",[
 ...tailSegments.map(t=>box({...t,colour:"hide",interior:"solid",top:"tile"})),
 ...[[21,18,34],[27,18,34],[18,15,38],[7,12,35],[5,12,30]].map(at=>P("93606",at,"hide")),P("93606",[12,12,39],"hide",90),P("93606",[12,12,43],"hide",270),
 ...range(4).map(i=>P("24309",[21+2*i,15,38],"hide",180)),...range(3).map(i=>P("24309",[18+2*i,12,41],"hide",180)),P("3045",[5,9,29],"hide"),P("3045",[7,9,41],"hide",180),
 ...[[25,18,36],[20,15,40],[16,12,41],[10,12,37],[8,12,32],[7,9,27]].map(at=>P("4589",at,"spine")),P("40379",[6,9,22],"hide",180),
 ...[[9,12,35],[10,12,41],[16,12,43],[20,15,38]].map((at,i)=>P("11477",at,"hide",i%2?180:0))
]);
build("Watchful face and open jaws",[
 floor({at:[20,50,7],size:[8,10],layers:2,colour:"hide"}),floor({at:[21,52,8],size:[6,5],colour:"dark red"}),box({at:[19,52,14],size:[10,13,6],colour:"hide"}),floor({at:[19,57,7],size:[10,10],layers:2,colour:"hide"}),box({at:[19,59,11],size:[10,6,8],colour:"hide"}),
 ...range(4).map(i=>P("3660b",[20+2*i,47,7],"hide")),...range(4).map(i=>P("24309",[20+2*i,59,7],"hide")),
 ...[[20,52,8],[27,52,8],[20,52,11],[27,52,11]].map(at=>P("4589",at,"bone")),P("3069b",[23,53,11],"red"),
 ...[19,28].map(x=>[P("3005",[x,59,10],"trans yellow"),P("11477",[x,62,10],"hide")]),P("3070b",[21,62,9],"hide"),P("3070b",[26,62,9],"hide"),
 ...range(3).map(k=>[P("15068",[18,62,12+2*k],"hide",90),P("15068",[28,62,12+2*k],"hide",270)]),
 ...range(4).map(i=>P("15068",[20+2*i,65,12],"hide")),
 ...[20,26].map(x=>[P("3941",[x,65,16],"bone"),P("4032b",[x,68,16],"bone"),P("3062b",[x,69,16],"bone"),P("11089",[x,72,16],"bone",180)]),spike([24,65,14]),
 ...range(4).map(i=>P("15068",[20+2*i,65,18],"hide",180))
]);
build("The warm nest and cracking egg",[
 floor({at:[19,6,4],size:[10,10],colour:"reddish brown",top:"tile"}),
 wall({from:[20,4],to:[27,4],y:7,height:3,colour:"reddish brown"}),wall({from:[20,13],to:[27,13],y:7,height:3,colour:"reddish brown"}),wall({from:[19,5],to:[19,12],y:7,height:3,colour:"reddish brown"}),wall({from:[28,5],to:[28,12],y:7,height:3,colour:"reddish brown"}),
 ...range(4).map(i=>[P("11477",[20+2*i,10,4],"reddish brown",90),P("11477",[20+2*i,10,13],"reddish brown",270)]),
 ...range(4).map(i=>[P("11477",[19,10,5+2*i],"reddish brown"),P("11477",[28,10,5+2*i],"reddish brown",180)]),
 cylinder({at:[22,7,7],diameter:4,height:6,colour:"white"}),
 ...[22,24].map(x=>[P("15068",[x,13,7],"white"),P("15068",[x,13,9],"white",180)]),
 ...[[23,10,7],[24,11,7],[24,12,7]].map(at=>P("3070b",at,"dark bluish grey")),
 ...[[19,7,4],[28,7,4],[19,7,13],[28,7,13]].map(at=>P("4589",at,"spine")),P("98138",[21,7,6],"spine"),P("98138",[26,7,11],"spine")
]);