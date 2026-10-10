script({title:"Cinderkeeper — The Last Egg",description:"An obsidian dragon shelters its cracking egg with crimson wings. Sweeping ivory horns, amber eyes and gold spines rise above a hooked tail that grips a compact, lava-split volcanic island.",palette:{hide:"black",membrane:"dark red",bone:"tan",spine:"pearl gold",rock:{mix:["dark bluish grey","dark bluish grey","black"]}}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour="hide")=>box({at,size,colour,interior:"solid"});
const plots=[[[13,0,4],[22,10]],[[12,0,14],[8,16]],[[28,0,16],[9,24]],[[20,0,24],[8,16]],[[4,0,25],[8,16]],[[8,0,39],[24,6]]];
section("Compact volcanic island",[
 ...plots.map(([at,size])=>floor({at,size,colour:"black"})),
 ...plots.map(([at,size])=>box({at:[at[0],1,at[2]],size:[size[0],5,size[1]],colour:"rock"})),
 floor({at:[13,2,4],size:[22,2],colour:"orange",top:"tile"}),floor({at:[35,2,18],size:[2,16],colour:"dark red",top:"tile"}),floor({at:[12,2,43],size:[20,2],colour:"orange",top:"tile"}),
 carve({at:[13,3,4],size:[22,3,2]}),carve({at:[35,3,18],size:[2,3,16]}),carve({at:[12,3,43],size:[20,3,2]}),
 ...range(7).map(i=>P("3069b",[14+3*i,3,4],i%3===0?"trans yellow":"trans red")),
 ...range(5).map(i=>P("3069b",[35,3,19+3*i],"trans red",90)),
 ...range(6).map(i=>P("3069b",[13+3*i,3,44],i%2?"trans red":"trans yellow")),
 ...[[12,14],[18,14],[13,6],[15,6],[31,6],[33,6]].map(([x,z],i)=>P("3039",[x,6,z],i%3?"dark bluish grey":"black")),
 ...[26,30,34,38].map(z=>P("3039",[35,6,z],"dark bluish grey",270)),
 ...[12,16,20,24,28].map(x=>P("3039",[x,6,41],"dark bluish grey",180)),
 ...[[5,35],[32,7],[34,35]].map(([x,z],i)=>[B([x,6,z],[3,6,3],"rock"),P("3039",[x,12,z],"dark bluish grey",i*90),P("54200",[x+2,12,z+2],"black",180)])
]);
function paw(x,z,hind){return [floor({at:[x,6,z],size:[6,hind?6:10],layers:3,colour:"hide"}),...range(3).map(i=>P("15070",[x+2*i,9,z],"bone")),...range(3).map(i=>P("3070b",[x+2*i+1,9,z],"hide")),...range(3).map(i=>P("15068",[x+2*i,9,z+2],"hide")),!hind&&B([x+1,9,z+4],[4,12,5]),!hind&&range(2).map(i=>P("3678b",[x+1+2*i,12,z+4],"hide")),!hind&&range(2).map(i=>P("93606",[x+1+2*i,21,z+4],"hide"))];}
section("Four gripping feet",[
 paw(13,13,false),paw(30,16,false),paw(12,31,true),paw(30,32,true),
 B([17,18,21],[4,12,5]),B([28,18,22],[4,12,5]),B([13,9,28],[6,12,7]),B([29,9,29],[6,12,7]),
 ...[[13,21,29],[17,21,30],[29,21,30],[33,21,31]].map(at=>P("93606",at,"dark red")),
 ...[[13,12,28],[15,12,28],[29,12,29],[31,12,29]].map(at=>P("3678b",at,"hide")),
 ...[[17,27,23],[30,27,24]].map(at=>P("15068",at,"hide"))
]);
section("Sculpted heart and arched neck",[
 B([20,6,26],[8,15,9]),B([20,12,24],[8,21,10]),B([21,30,22],[6,12,9]),B([22,39,18],[4,12,8]),B([22,48,15],[4,9,6]),
 ...range(5).map(k=>range(4).map(i=>P("24309",[20+2*i,15+3*k,22],k%2===0?"tan":"dark red"))),
 ...range(3).map(k=>[24,26,28,30].map(z=>[P("24309",[18,18+3*k,z],"hide",90),P("24309",[27,18+3*k,z],"hide",270)])),
 ...range(3).map(k=>range(4).map(i=>P("24309",[20+2*i,24+3*k,33],"hide",180))),
 ...[26,28].map(z=>[P("61678",[17,30,z],"hide",90),P("61678",[27,30,z],"hide",270)]),
 ...range(2).map(k=>range(3).map(i=>P("11477",[21+2*i,33+3*k,21],i===1?"tan":"hide"))),
 ...range(4).map(k=>range(2).map(i=>P("11477",[22+i,39+3*k,17],k%2?"dark red":"tan"))),
 ...range(3).map(k=>range(2).map(i=>P("11477",[22+i,48+3*k,14],k%2?"dark red":"tan"))),
 ...[39,42,45].map(y=>[19,21,23].map(z=>[P("50950",[20,y,z],"hide",90),P("50950",[25,y,z],"hide",270)])),
 ...[48,51,54].map(y=>[16,18].map(z=>[P("50950",[20,y,z],"hide",90),P("50950",[25,y,z],"hide",270)])),
 ...[[24,33,30],[24,33,33],[24,42,28],[24,51,24],[24,57,20]].map(([x,y,z])=>[P("3062b",[x,y,z],"hide"),P("24482",[x,y+3,z],"spine")])
]);
function wing(side){const bottom=side===0?[30,33,36,39,42,39,45,54]:[30,36,39,42,45,42,48,57],top=side===0?[48,54,60,66,69,66,63,60]:[51,57,63,69,72,69,66,63];return range(8).map(k=>{const x=side===0?16-2*k:28+2*k,z=24+k,t=side===0?90:270,gap=top[k]-bottom[k]-6;return [box({at:[x,bottom[k],z],size:[4,3,2],colour:"hide",interior:"solid"}),gap>0&&box({at:[x,bottom[k]+3,z+1],size:[4,gap,1],colour:"membrane",interior:"solid"}),box({at:[x,top[k]-3,z],size:[4,3,2],colour:"hide",interior:"solid"}),...range(2).map(j=>P("61678",[x,top[k],z+j],"hide",t)),...range(2).map(j=>P("13547",[x,bottom[k],z+j],"hide",t))];});}
section("Connected sheltering wings",[
 B([16,30,24],[16,3,3]),wing(0),wing(1),
 P("3062b",[11,72,29],"hide"),P("24482",[11,75,29],"spine"),P("3062b",[36,75,29],"hide"),P("24482",[36,78,29],"spine")
]);
const tailSegments=[{at:[21,12,33],size:[8,6,7]},{at:[18,9,37],size:[8,6,6]},{at:[12,6,39],size:[9,6,6]},{at:[7,6,35],size:[7,6,8]},{at:[5,6,29],size:[5,6,8]},{at:[6,6,25],size:[3,3,6]}];
section("Hooked armoured tail",[
 ...tailSegments.map(t=>B(t.at,t.size)),
 ...[[21,18,34],[23,18,34],[27,18,34],[18,15,38],[20,15,38],[24,15,38],[7,12,35],[9,12,35],[5,12,30]].map(at=>P("93606",at,"hide")),
 ...[12,16].map(x=>[P("93606",[x,12,39],"hide",90),P("93606",[x,12,43],"hide",90)]),
 ...[[25,18,36],[22,15,40],[18,12,41],[10,12,39],[8,12,32],[7,9,27]].map(at=>P("4589",at,"spine")),P("40379",[6,9,23],"hide",180),
 ...[29,31,33].map(z=>P("11477",[8,9,z],"hide",270))
]);
section("Watchful face and open jaws",[
 floor({at:[20,50,7],size:[8,10],layers:2,colour:"hide",top:"tile"}),floor({at:[21,52,8],size:[6,5],colour:"dark red",top:"tile"}),B([19,52,14],[10,13,6]),floor({at:[19,57,7],size:[10,10],layers:2,colour:"hide"}),B([19,59,11],[10,6,8]),
 ...range(4).map(i=>P("24309",[20+2*i,59,7],"hide")),...[[20,52,8],[27,52,8],[20,52,11],[27,52,11]].map(at=>P("4589",at,"bone")),P("3069b",[23,53,11],"red"),
 ...[19,28].map(x=>[P("3005",[x,59,10],"trans yellow"),P("11477",[x,62,10],"hide")]),P("3070b",[21,62,9],"hide"),P("3070b",[26,62,9],"hide"),
 ...[14,16,18].map(z=>[P("50950",[17,59,z],"hide",90),P("50950",[28,59,z],"hide",270)]),
 P("93606",[21,65,13],"hide"),P("93606",[25,65,13],"hide"),
 ...[20,26].map(x=>[P("3941",[x,65,17],"bone"),P("4032b",[x,68,17],"bone"),P("3062b",[x,69,17],"bone"),P("11089",[x,72,17],"bone",180)]),P("3062b",[24,65,14],"hide"),P("24482",[24,68,14],"spine")
]);
section("The warm nest and cracking egg",[
 floor({at:[19,6,4],size:[10,10],colour:"reddish brown",top:"tile"}),
 wall({from:[19,4],to:[28,4],y:7,height:3,colour:"reddish brown",texture:"log"}),wall({from:[19,13],to:[28,13],y:7,height:3,colour:"reddish brown",texture:"log"}),wall({from:[19,5],to:[19,12],y:7,height:3,colour:"reddish brown",texture:"log"}),wall({from:[28,5],to:[28,12],y:7,height:3,colour:"reddish brown",texture:"log"}),
 cylinder({at:[22,7,7],diameter:4,height:6,colour:"white"}),
 ...[22,24].map(x=>[P("15068",[x,13,7],"white"),P("15068",[x,13,9],"white",180)]),floor({at:[23,16,8],size:[2,2],colour:"white",top:"tile"}),
 ...[[23,10,7],[24,11,7],[24,12,7]].map(at=>P("3070b",at,"dark bluish grey")),
 ...[[19,10,4],[28,10,4],[19,10,13],[28,10,13]].map(at=>P("4589",at,"spine")),P("98138",[21,7,6],"spine"),P("98138",[26,7,11],"spine")
]);