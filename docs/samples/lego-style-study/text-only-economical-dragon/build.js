script({title:"Cinderkeeper — The Last Egg",description:"An obsidian guardian shelters a cracking egg on an irregular volcanic outcrop. Connected crimson sail-wings, curved armour, gripping claws, amber eyes, sweeping horns and an encircling gold-spined tail complete its watchful pose.",palette:{hide:"black",membrane:"dark red",bone:"tan",spine:"pearl gold",rock:"dark bluish grey"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour="hide")=>box({at,size,colour});
const model=(name,ops)=>section(name,[group({at:[0,-3,0],ops})]);
function edge(x,z,n,turn){return range(n).map(i=>P("3039",[x+(turn===0||turn===180?3*i:0),3,z+(turn===90||turn===270?3*i:0)],i%3===0?"black":"rock",turn));}
section("Irregular volcanic outcrop",[
 B([10,0,12],[11,3,14],"rock"),B([29,0,15],[10,3,14],"rock"),B([10,0,28],[12,3,13],"rock"),B([28,0,29],[11,3,12],"rock"),B([18,0,24],[12,3,10],"rock"),B([17,0,4],[14,3,8],"rock"),B([4,0,25],[10,3,16],"rock"),B([9,0,39],[21,3,7],"rock"),
 floor({at:[10,0,10],size:[11,2],layers:3,colour:"black"}),floor({at:[29,0,13],size:[11,2],layers:3,colour:"black"}),floor({at:[39,0,15],size:[2,26],layers:3,colour:"black"}),floor({at:[9,0,46],size:[21,2],layers:3,colour:"black"}),floor({at:[2,0,26],size:[2,14],layers:3,colour:"black"}),floor({at:[17,0,2],size:[14,2],layers:3,colour:"black"}),
 edge(10,10,3,0),edge(29,13,4,0),edge(39,15,9,270),edge(9,46,7,180),edge(2,26,5,90),edge(17,2,5,0),
 floor({at:[19,0,0],size:[10,2],layers:2,colour:"dark red"}),floor({at:[20,2,0],size:[8,2],colour:"orange",top:"tile"}),floor({at:[41,0,20],size:[2,14],layers:2,colour:"dark red"}),floor({at:[41,2,21],size:[2,12],colour:"orange",top:"tile"}),floor({at:[12,0,48],size:[14,2],layers:2,colour:"dark red"}),floor({at:[14,2,48],size:[10,2],colour:"orange",top:"tile"}),
 ...[[29,8,6],[36,25,9],[36,39,6]].map(([x,z,h])=>[B([x,3,z],[3,h,3],"rock"),P("3039",[x,3+h,z],"rock"),P("54200",[x+2,3+h,z+2],"black",180)]),
 ...range(4).map(i=>P("98138",[20+2*i,3,0],i%2?"trans red":"trans yellow")),...range(4).map(i=>P("98138",[42,3,21+3*i],i%2?"trans red":"trans yellow")),
 floor({at:[35,3,15],size:[2,1],colour:"orange",top:"tile"}),floor({at:[37,3,18],size:[1,5],colour:"dark red",top:"tile"})
]);
function limbCore(x,y,z,courses,depth){return box({at:[x,y,z],size:[4,3*courses,depth],colour:"hide",interior:"solid"});}
function paw(x,z,hind){const d=hind?8:10,lowHip=x<20;return [floor({at:[x,6,z],size:[6,d],layers:2,colour:"hide"}),range(3).map(i=>[P("15070",[x+2*i,8,z],"bone"),P("15068",[x+2*i,8,z+2],"hide")]),hind?[
 limbCore(x+1,8,z-2,4,6),limbCore(x+2,20,z-4,lowHip?2:3,4),floor({at:[x,lowHip?26:29,z-4],size:[6,6],colour:"hide"}),range(3).map(i=>P("44126",[x+2*i,lowHip?27:30,z-4],i===0?"dark red":"hide")),range(3).map(i=>P("3678b",[x+2*i,8,z+4],"hide",180)),range(3).map(i=>P("3039",[x+2*i,14,z+4],"hide",180))
 ]:[limbCore(x+1,8,z+6,2,4),limbCore(x+1,14,z+7,2,4),limbCore(x+3,20,z+9,3,4),range(2).map(i=>[P("3678b",[x+1+2*i,8,z+4],"hide"),P("3678b",[x+1+2*i,14,z+5],"hide"),P("3678b",[x+3+2*i,20,z+7],"hide")]),range(2).map(i=>P("15068",[x+3+2*i,29,z+9],"dark red"))]
 ];}
model("Four gripping feet",[paw(13,13,false),paw(30,16,false),paw(12,31,true),paw(30,32,true),B([17,21,23],[4,9,7]),B([28,21,26],[7,9,5]),B([30,12,31],[2,3,2])]);
model("Sculpted heart and arched neck",[
 B([20,9,26],[8,6,9]),room({at:[18,15,24],size:[12,15,10],colour:"hide",openings:[]}),floor({at:[18,29,24],size:[12,10],colour:"hide"}),B([20,15,22],[8,15,4]),B([21,30,20],[6,9,8]),B([22,39,18],[4,9,7]),B([22,48,15],[4,9,7]),
 floor({at:[19,29,18],size:[10,10],colour:"hide"}),floor({at:[20,38,16],size:[8,9],colour:"hide"}),floor({at:[20,47,13],size:[8,9],colour:"hide"}),
 ...range(4).map(i=>[P("3660b",[16,15,25+2*i],"hide",90),P("3678b",[16,18,25+2*i],"hide",90),P("3039",[16,24,25+2*i],"hide",90),P("3660b",[30,15,25+2*i],"hide",270),P("3678b",[30,18,25+2*i],"hide",270),P("3039",[30,24,25+2*i],"hide",270)]),
 ...range(4).map(i=>P("44126",[20+2*i,30,28],"hide",180)),
 ...range(2).map(k=>range(4).map(i=>P("3678b",[20+2*i,18+6*k,20],k===0?"tan":"dark red"))),
 ...range(6).map(i=>P("4460b",[21+i,30,18],i===0||i===5?"hide":"tan")),...range(4).map(i=>P("4460b",[22+i,39,16],"dark red")),...range(2).map(i=>P("3678b",[22+2*i,48,13],"tan")),
 ...range(3).map(i=>[P("4460b",[19,30,20+2*i],"hide",90),P("4460b",[27,30,20+2*i],"hide",270),P("4460b",[20,39,17+2*i],"hide",90),P("4460b",[26,39,17+2*i],"hide",270),P("3678b",[20,48,15+2*i],"hide",90),P("3678b",[26,48,15+2*i],"hide",270)]),
 ...[[23,33,28],[23,39,27],[23,48,24],[23,57,21]].map(([x,y,z])=>[P("3062b",[x,y,z],"hide"),P("24482",[x,y+3,z],"spine")])
]);
const wingBottom=[54,48,45,42,42,36,36,30,30,30],wingTop=[57,63,69,72,66,60,54,48,42,36];
function wing(right){const shift=right?3:0,x0=right?28:0;let ops=[];
 for(let y=30+shift;y<72+shift;y+=3){const cells=[];for(let k=0;k<10;k++)if(wingBottom[k]+shift<=y&&wingTop[k]+shift>y){const x=x0+2*(right?9-k:k);cells.push({x,c:y===wingBottom[k]+shift?"hide":"membrane"},{x:x+1,c:y===wingBottom[k]+shift?"hide":"membrane"});}cells.sort((a,b)=>a.x-b.x);
 for(let i=0;i<cells.length;){let n=1;while(n<4&&i+n<cells.length&&cells[i+n].x===cells[i].x+n&&cells[i+n].c===cells[i].c)n++;if(i===0&&Math.round((y-shift)/3)%2&&n>2)n=2;ops.push(P(n===4?"3010":n===3?"3622":n===2?"3004":"3005",[cells[i].x,y,28],cells[i].c));i+=n;}}
 for(let k=0;k<10;k++){const x=x0+2*(right?9-k:k),lo=wingBottom[k]+shift,hi=wingTop[k]+shift;ops.push(P("3678b",[x,hi,27],"hide",right?(k<3?270:90):(k<3?90:270)));
 if(k===1||k===3||k===6||k===9){const rx=x+(right?0:1);ops.push(P("3623",[rx,lo-1,27],"hide",90));for(let y=lo;y<hi;y+=3)ops.push(P("3005",[rx,y,27],"hide"),P("3005",[rx,y,29],"hide"));ops.push(P("3070b",[rx,hi,29],"hide"));}}
 const tipx=right?41:6,tipy=78+shift;ops.push(P("3062b",[tipx,tipy,28],"hide"),P("24482",[tipx,tipy+3,28],"spine"));return ops;
}
model("Connected sheltering sail-wings",[wing(false),wing(true),B([28,30,27],[2,3,3])]);
model("Hooked curved tail",[
 B([21,6,33],[8,9,7]),B([17,6,37],[8,6,6]),B([13,6,39],[12,6,4]),B([9,6,39],[8,3,6]),B([6,6,35],[8,3,8]),B([5,6,29],[6,3,8]),B([6,6,25],[4,3,6]),
 ...range(4).map(i=>P("44126",[21+2*i,15,34],"hide",180)),...range(2).map(i=>P("42918",[13,12,39+2*i],"hide",90)),...range(3).map(i=>P("44126",[7+2*i,9,35],"hide",180)),...range(3).map(i=>P("44126",[5+2*i,9,29],"hide")),
 ...range(3).map(i=>P("15068",[9+2*i,9,41],"hide",180)),P("41747",[5,6,35],"hide"),P("41748",[12,6,37],"hide",180),P("40379",[7,9,25],"hide",180),
 ...[[24,18,34],[20,15,40],[12,12,35],[8,12,34]].map(at=>[P("6141",at,"hide"),P("4589",[at[0],at[1]+1,at[2]],"spine")])
]);
model("Watchful face and open jaws",[
 floor({at:[20,50,7],size:[8,10],layers:2,colour:"hide"}),floor({at:[21,52,8],size:[6,5],colour:"dark red",top:"tile"}),B([21,52,14],[6,13,5]),floor({at:[19,57,7],size:[10,12],layers:2,colour:"hide"}),B([20,59,11],[8,6,8]),
 ...range(4).map(i=>P("24309",[20+2*i,59,7],"hide")),...[[20,52,8],[27,52,8],[20,52,11],[27,52,11]].map(at=>P("4589",at,"bone")),P("3069b",[23,53,11],"red"),
 ...[19,28].map(x=>[P("3005",[x,59,10],"trans yellow"),P("11477",[x,62,10],"hide")]),P("3070b",[21,62,9],"hide"),P("3070b",[26,62,9],"hide"),
 P("3678b",[19,59,13],"hide",90),P("3678b",[27,59,13],"hide",270),...range(4).map(i=>P("44126",[20+2*i,65,10],"hide")),
 ...[20,26].map(x=>[P("3941",[x,65,17],"bone"),P("4032b",[x,68,17],"bone"),P("3062b",[x,69,17],"bone"),P("11089",[x,72,17],"bone",180)]),P("6141",[24,68,15],"hide"),P("24482",[24,69,15],"spine"),
 ...[20,27].map(x=>range(3).map(i=>P("3070b",[x,52,14+i],"hide")))
]);
model("Warm nest and cracking egg",[
 floor({at:[20,6,4],size:[8,10],colour:"reddish brown",top:"tile"}),floor({at:[19,6,5],size:[10,8],colour:"reddish brown",top:"tile"}),
 ...range(3).map(i=>[P("30136",[21+2*i,7,4],"reddish brown"),P("30136",[21+2*i,7,13],"reddish brown"),P("30136",[19,7,6+2*i],"reddish brown",90),P("30136",[28,7,6+2*i],"reddish brown",90)]),...[[19,4],[27,4],[19,12],[27,12]].map(([x,z],i)=>P("15068",[x,7,z],"reddish brown",i<2?0:180)),
 cylinder({at:[22,7,7],diameter:4,height:6,colour:"white"}),...[22,24].map(x=>[P("15068",[x,13,7],"white"),P("15068",[x,13,9],"white",180)]),floor({at:[23,16,8],size:[2,2],colour:"white"}),P("14769",[23,17,8],"white"),
 ...[[23,10,7],[24,11,7],[25,12,7]].map(at=>P("3070b",at,"dark bluish grey")),P("98138",[21,7,6],"spine"),P("98138",[26,7,11],"spine")
]);