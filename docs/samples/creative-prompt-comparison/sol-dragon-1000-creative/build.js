script({title:"Cinderkeeper — The Last Egg",description:"An obsidian dragon spreads its crimson wings over a cracking egg in a volcanic nest. Its hooked tail encircles the island; golden spines, sweeping horns, gripping claws and watchful amber eyes complete the silhouette.",palette:{hide:"black",membrane:"dark red",bone:"tan",spine:"pearl gold",rock:"dark bluish grey"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
section("Volcanic island",[
 baseplate({at:[0,0],size:[48,48],colour:"light bluish grey"}),floor({at:[0,0,0],size:[48,48],colour:"black"}),
 floor({at:[0,1,0],size:[48,4],colour:"orange",top:"tile"}),floor({at:[0,1,4],size:[4,41],colour:"dark red"}),floor({at:[40,1,4],size:[8,41],colour:"orange"}),floor({at:[0,1,45],size:[48,3],colour:"dark red"}),
 box({at:[8,1,12],size:[32,5,28],colour:"rock"}),box({at:[13,1,4],size:[22,5,8],colour:"rock"}),box({at:[4,1,24],size:[4,5,15],colour:"rock"}),box({at:[12,1,40],size:[20,5,5],colour:"rock"}),
 ...range(12).map(i=>P("3069b",[i*4,2,1],i%3===0?"trans yellow":"trans red")),...range(10).map(i=>P("3069b",[44,2,5+i*4],i%3===1?"trans yellow":"trans red",90)),
 ...range(8).map(i=>P("3039",[8+i*4,6,12],i%3===0?"black":"dark bluish grey")),...range(7).map(i=>P("3039",[38,6,14+i*4],"dark bluish grey",270)),...range(5).map(i=>P("3039",[12+i*4,6,43],"dark bluish grey",180)),
 ...[[9,15],[5,35],[9,19],[35,7],[37,35],[33,42]].map(([x,z],i)=>(i===1||i===4)&&[box({at:[x,6,z],size:[3,3+(i%3)*3,3],colour:"rock"}),P("3039",[x,9+(i%3)*3,z],"dark bluish grey",(i%4)*90),P("54200",[x+2,9+(i%3)*3,z+2],"black",180)])
]);
function paw(x,z,y,hind){return [floor({at:[x,y,z],size:[6,hind?8:10],layers:3,colour:"hide"}),...range(3).map(i=>P("15070",[x+2*i,y+3,z],"bone")),...range(3).map(i=>P("3039",[x+2*i,y+3,z+2],"hide")),!hind&&box({at:[x+1,y+3,z+5],size:[4,12,5],colour:"hide"}),!hind&&range(2).map(i=>P("11477",[x+1+3*i,y+15,z+5],"dark red"))];}
section("Four gripping feet",[
 paw(13,13,6,false),paw(30,16,6,false),paw(12,31,6,true),paw(30,32,6,true),
 box({at:[17,18,21],size:[4,12,5],colour:"hide"}),box({at:[28,18,22],size:[4,12,5],colour:"hide"}),
 box({at:[13,9,28],size:[6,12,7],colour:"hide"}),box({at:[29,9,29],size:[6,12,7],colour:"hide"}),
 ...[[13,21,29],[17,21,30],[29,21,30],[33,21,31]].map(at=>P("93606",at,"dark red"))
]);
section("Heart and arched neck",[
 box({at:[20,6,26],size:[8,15,9],colour:"hide"}),box({at:[20,12,22],size:[8,21,12],colour:"hide"}),box({at:[20,33,20],size:[8,9,9],colour:"hide"}),box({at:[21,39,17],size:[6,12,8],colour:"hide"}),box({at:[21,48,14],size:[6,9,7],colour:"hide"}),
 ...range(4).map(k=>range(4).map(i=>P("24309",[20+2*i,15+6*k,20],k%2===0?"tan":"dark red"))),
 ...range(4).map(k=>range(2).map(i=>P("11477",[23+i,39+3*k,16],k%2===0?"tan":"dark red"))),
 ...[24,30].map(y=>range(4).map(i=>P("24309",[20+2*i,y,33],"hide",180))),
 ...[24,27,30].map(z=>[P("61678",[17,30,z],"hide",90),P("61678",[27,30,z],"hide",270)]),
 ...[[20,42,20],[26,42,20],[21,51,17],[26,51,17]].map((at,i)=>P("50950",at,"hide",i%2===0?90:270)),
 ...[[24,33,30],[24,33,33],[24,42,26],[24,51,22]].map(at=>P("24482",at,"spine"))
]);
function wing(side){const bottom=side===0?[30,33,36,39,42,39,45,54]:[30,36,39,42,45,42,48,57],top=side===0?[48,54,60,66,69,66,63,60]:[51,57,63,69,72,69,66,63],rib=[36,42,48,57,63,54,54];return range(8).map(k=>{const x=side===0?16-2*k:30+2*k,z=24+k;return [box({at:[x,bottom[k],z],size:[2,3,2],colour:"hide",interior:"solid"}),top[k]-bottom[k]>6&&box({at:[x,bottom[k]+3,z],size:[2,top[k]-bottom[k]-6,2],colour:"membrane",interior:"solid"}),box({at:[x,top[k]-3,z],size:[2,3,2],colour:"hide",interior:"solid"}),k>0&&k<4&&box({at:[x,rib[k]+side*3,z],size:[2,3,1],colour:"hide",interior:"solid"}),...range(2).map(j=>P("11477",[x,top[k],z+j],"hide",side===0?90:270))];});}
section("Raised sheltering wings",[wing(0),wing(1),box({at:[9,45,28],size:[1,21,2],colour:"hide",interior:"solid"}),box({at:[38,48,28],size:[1,21,2],colour:"hide",interior:"solid"}),P("24482",[9,72,29],"spine"),P("24482",[38,75,29],"spine")]);
const tailSegments=[{at:[21,12,33],size:[8,6,7]},{at:[18,9,37],size:[8,6,6]},{at:[12,6,39],size:[9,6,6]},{at:[7,6,35],size:[7,6,8]},{at:[5,6,29],size:[5,6,8]},{at:[6,6,25],size:[3,3,6]}];
section("Hooked armoured tail",[
 ...tailSegments.map(t=>box({...t,colour:"hide"})),
 ...[[21,18,34],[27,18,34],[18,15,38],[24,15,38],[7,12,35],[5,12,30]].map(at=>P("93606",at,"hide")),
 P("93606",[12,12,39],"hide",90),P("93606",[12,12,43],"hide",90),
 ...[[25,18,36],[22,15,40],[18,12,41],[10,12,39],[8,12,32],[7,9,27]].map(at=>P("4589",at,"spine")),P("40379",[6,9,23],"hide",180)
]);
section("Watchful face and open jaws",[
 floor({at:[20,50,7],size:[8,10],layers:2,colour:"hide"}),floor({at:[21,52,8],size:[6,5],colour:"dark red",top:"tile"}),box({at:[19,52,14],size:[10,13,6],colour:"hide"}),floor({at:[19,57,7],size:[10,10],layers:2,colour:"hide"}),box({at:[19,59,11],size:[10,6,8],colour:"hide"}),
 ...range(4).map(i=>P("24309",[20+2*i,59,7],"hide")),...[[20,52,8],[27,52,8],[20,52,11],[27,52,11]].map(at=>P("4589",at,"bone")),P("3069b",[23,53,11],"red"),P("3005",[19,59,10],"trans yellow"),P("3005",[28,59,10],"trans yellow"),P("11477",[19,62,10],"hide"),P("11477",[28,62,10],"hide"),P("3070b",[21,62,9],"hide"),P("3070b",[26,62,9],"hide"),
 ...[20,26].map(x=>[P("3941",[x,65,16],"bone"),P("4032b",[x,68,16],"bone"),P("3062b",[x,69,16],"bone"),P("11089",[x,72,16],"bone",180)]),P("24482",[24,65,14],"spine")
]);
section("The warm nest and cracking egg",[
 floor({at:[19,6,4],size:[10,10],colour:"reddish brown",top:"tile"}),
 wall({from:[19,4],to:[28,4],y:7,height:3,colour:"reddish brown"}),wall({from:[19,13],to:[28,13],y:7,height:3,colour:"reddish brown"}),wall({from:[19,5],to:[19,12],y:7,height:3,colour:"reddish brown"}),wall({from:[28,5],to:[28,12],y:7,height:3,colour:"reddish brown"}),
 cylinder({at:[22,7,7],diameter:4,height:6,colour:"white"}),
 ...[22,24].map(x=>[P("15068",[x,13,7],"white"),P("15068",[x,13,9],"white",180)]),floor({at:[23,16,8],size:[2,2],colour:"white"}),
 ...[[23,10,7],[24,11,7],[24,12,7]].map(at=>P("3070b",at,"dark bluish grey")),
 ...[[19,10,4],[28,10,4],[19,10,13],[28,10,13]].map(at=>P("4589",at,"spine")),P("98138",[21,7,6],"spine"),P("98138",[26,7,11],"spine")
]);