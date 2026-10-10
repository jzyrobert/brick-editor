script({title:"Emberwing — Guardian of the Last Egg",description:"A crimson dragon crouches protectively over an ivory egg, roaring beneath towering scalloped bat wings. Golden throat armour, a long sweeping tail, ivory talons and twin tall horns give it a dramatic silhouette.",palette:{skin:"dark red",membrane:"red",bone:"tan",spine:"pearl gold"},defaults:{interior:"empty"}});
const C=32;
function p(part,x,y,z,colour,turn=0){return place({part,at:[x,y,z],colour,turn});}
function mass(x,y,z,w,h,d,colour){return box({at:[x,y,z],size:[w,h,d],colour,interior:"solid"});}
function skinRow(x,y,z,n,part,colour,turn=0,omit=-1){return range(n).map(i=>i!==omit&&p(part,x+i,y,z,colour,turn));}
section("Muscular torso",[
box({at:[27,16,24],size:[10,15,12],colour:"dark red",interior:"empty",supports:4}),
mass(29,13,24,6,6,13,"tan"),mass(26,19,24,12,3,10,"dark red"),box({at:[26,22,25],size:[12,9,6],colour:"dark red",interior:"empty"}),box({at:[28,19,35],size:[8,9,5],colour:"dark red",interior:"empty"}),
skinRow(27,31,24,10,"61678","dark red"),skinRow(27,31,28,10,"93273","dark red",0,4),mass(31,31,28,1,4,4,"dark red"),skinRow(27,31,32,10,"61678","dark red",180),skinRow(28,28,36,8,"61678","dark red",180),
range(5).map(i=>[p("15068",25,22,24+2*i,"dark red",90),p("15068",37,22,24+2*i,"dark red",270)]),
range(3).map(i=>[p("15068",27,16,25+3*i,"tan",90),p("15068",35,16,25+3*i,"tan",270)]),
range(4).map(i=>p("4589",31,35,28+i,"pearl gold")),floor({at:[24,29,27],size:[16,2],colour:"dark red"})
]);
function neckTier(i){const y=29+4*i,z=22-i;return [floor({at:[27,y,z],size:[10,8],colour:"dark red"}),mass(29,y+1,z+1,6,3,5,"dark red"),range(3).map(j=>p("15068",29+2*j,y+1,z,"tan")),range(2).map(j=>[p("15068",27,y+1,z+2+2*j,"dark red",90),p("15068",35,y+1,z+2+2*j,"dark red",270)]),range(3).map(j=>p("15068",29+2*j,y+1,z+5,"dark red",180)),p("4589",31,y+1,z+7,"pearl gold")];}
section("Arched neck and throat armour",range(7).map(neckTier));
section("Roaring horned head",[
mass(28,54,6,8,3,12,"dark red"),floor({at:[28,57,6],size:[8,12],colour:"tan",top:"tile"}),floor({at:[29,58,8],size:[6,8],colour:"black"}),p("87079",30,59,9,"red"),
[28,35].map(x=>range(3).map(i=>p("4589",x,58,8+3*i,"white"))),
mass(29,57,17,6,5,5,"dark red"),floor({at:[27,62,6],size:[10,16],colour:"dark red"}),mass(28,63,10,8,3,12,"dark red"),mass(26,63,11,2,3,9,"dark red"),mass(36,63,11,2,3,9,"dark red"),
skinRow(28,63,6,8,"61678","dark red"),skinRow(28,66,10,8,"61678","dark red"),skinRow(28,66,14,8,"93273","dark red",0,3),mass(31,66,14,1,4,4,"dark red"),skinRow(28,66,18,8,"61678","dark red",180),
[26,37].map(x=>[mass(x,66,12,1,3,3,"yellow"),p("3005",x,66,13,"black"),p("50950",x,69,12,"dark red")]),
[29,34].map(x=>p("98138",x,66,9,"black")),
[27,35].map(x=>[mass(x,66,18,2,4,2,"dark red"),p("3942c",x,70,18,"tan"),p("4589",x+1,76,19,"tan")]),
p("4589",31,70,16,"pearl gold"),p("4589",32,69,18,"pearl gold")
]);
function foreleg(x){return [floor({at:[x,0,17],size:[6,10],colour:"dark red"}),range(3).map(i=>p("4286",x+2*i,1,17,"white")),skinRow(x,1,20,6,"50950","dark red"),mass(x+1,1,23,3,14,4,"dark red"),mass(x+2,13,24,4,12,5,"dark red"),floor({at:[x+1,13,23],size:[3,4],colour:"tan"}),skinRow(x+2,25,24,4,"61678","dark red"),range(3).map(i=>p("11477",x+1,4+3*i,22,"dark red")),p("4589",x+4,25,28,"pearl gold")];}
function hindleg(x){return [floor({at:[x,0,31],size:[6,10],colour:"dark red"}),range(3).map(i=>p("4286",x+2*i,1,31,"white")),skinRow(x,1,34,6,"50950","dark red"),mass(x+2,1,36,4,12,4,"dark red"),mass(x+1,10,34,6,12,6,"dark red"),range(3).map(i=>[p("24309",x+1+2*i,22,34,"dark red"),p("24309",x+1+2*i,22,37,"dark red",180)]),range(3).map(i=>p("15068",x,13+3*i,34,"dark red",90)),p("4589",x+3,25,36,"pearl gold")];}
section("Four planted taloned limbs",[foreleg(23),foreleg(37),hindleg(22),hindleg(36)]);
const tailWidths=[8,8,6,6,4,4,2,2],tailTops=[27,24,21,18,15,12,8,5],tailBottoms=[12,10,8,6,4,2,1,1];
function tailSegment(i){const x=29+i+(i>5?1:0),z=40+4*i,w=tailWidths[i],y=tailTops[i];return [mass(x,tailBottoms[i],z,w,y-tailBottoms[i],4,"dark red"),skinRow(x,y,z,w,"61678","dark red",180),p("4589",x+Math.floor(w/2),y+3,z,"pearl gold")];}
section("Long sweeping scaled tail",range(8).map(tailSegment));
const tops=[42,48,54,60,66,72,69,66,63,60,57,54],bottoms=[30,33,36,39,42,45,39,33,39,42,48,51];
function rib(x,b,t,z){const n=Math.floor((t-b)/9),r=t-b-9*n;return [range(n).map(j=>p("14716",x,b+9*j,z,"black")),r>0&&column({at:[x,b+9*n,z],height:r,colour:"black"})];}
function wingSlice(i,left){const original=38+2*i,x=left?2*C-original-2:original,b=bottoms[i],t=tops[i],up=i<6,turn=up?(left?270:90):(left?90:270),finger=x+(left?1:0);return [wall({from:[x,27],to:[x+1,27],y:b,height:t-b,thickness:2,colour:"red"}),floor({at:[x,b-1,26],size:[2,4],colour:"dark red"}),floor({at:[x,t,26],size:[2,4],colour:"black"}),p(up?"60481a":"3040b",x,t+1,26,"black",turn),p(up?"3678b":"3039",x,t+1,27,"red",turn),p(up?"60481a":"3040b",x,t+1,29,"black",turn),i%3===0&&[rib(finger,b,t,26),rib(finger,b,t,29)],i===5&&p("4589",x+(left?0:1),t+7,27,"tan")];}
section("Towering scalloped bat wings",[range(12).map(i=>wingSlice(i,false)),range(12).map(i=>wingSlice(i,true))]);
section("The protected ivory egg",[p("87081",30,0,11,"white"),p("60474",30,3,11,"pearl gold"),p("87081",30,4,11,"white"),dome({at:[30,7,11],diameter:4,colour:"white"})]);