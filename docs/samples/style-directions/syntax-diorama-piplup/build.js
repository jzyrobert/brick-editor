script({title:"Piplup • My First Bubble",description:"A proud Piplup on a scalloped ice floe sends a rising chain of bubbles toward a curious orange fish. A curling turquoise tide wraps the floe; a waving flipper, enormous bright eyes, webbed feet and the dark blue penguin hood give the little Pokémon its unmistakable personality."});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour,extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
const F=(x,y,z,w,d,colour,layers=1,top)=>floor({at:[x,y,z],size:[w,d],colour,layers,...(top?{top}: {})});
function blueSide(x,y,z,turn){return [P("60481a",x,y,z,"medium azure",turn),P("6091",x,y+6,z,"medium azure",turn)];}
section("Connected midnight display and tidal pool",[
F(2,0,0,36,32,"black",3),F(0,0,3,2,26,"black",3),F(38,0,3,2,26,"black",3),
F(2,3,0,36,32,"dark blue"),F(2,3,0,36,10,"dark blue",1,"tile"),F(2,3,10,13,22,"dark blue",1,"tile"),F(36,3,10,2,22,"dark blue",1,"tile"),F(15,3,29,21,3,"dark blue",1,"tile"),F(15,3,10,5,5,"dark blue",1,"tile"),F(0,3,3,2,26,"dark blue",1,"tile"),F(38,3,3,2,26,"dark blue",1,"tile"),
B(19,4,13,17,5,16,"white",{top:"tile"}),B(16,4,17,3,5,10,"white",{top:"tile"}),B(22,4,10,10,5,3,"white",{top:"tile"}),B(22,4,29,10,5,2,"white",{top:"tile"}),
...range(8).map(i=>P("93606",20+2*i,5,10,"white")),...range(7).map(i=>P("93606",20+2*i,5,28,"white",180)),...range(6).map(i=>P("93606",15,5,15+2*i,"white",90)),...range(6).map(i=>P("93606",34,5,15+2*i,"white",270)),
P("15068",18,5,13,"white"),P("15068",36,5,13,"white"),P("15068",18,5,27,"white",180),P("15068",36,5,27,"white",180)
]);
component("webbed foot",{size:[6,7],ops:[F(0,0,0,6,7,"yellow"),...range(3).map(i=>P("6091",2*i,1,0,"yellow",90)),P("93606",1,1,1,"yellow"),P("93606",3,1,1,"yellow"),P("3068b",1,1,5,"yellow"),P("3068b",3,1,5,"yellow"),B(2,5,4,2,3,2,"yellow")]});
section("Feet and pear shaped body",[
instance({component:"webbed foot",at:[22,9,13]}),instance({component:"webbed foot",at:[29,9,14]}),F(23,14,17,8,6,"medium azure"),B(21,15,15,12,16,10,"medium azure"),
...range(12).map(i=>P("24201",21+i,15,13,i>=3&&i<9?"white":"medium azure")),...range(12).map(i=>P("24201",21+i,15,25,"medium azure",180)),...range(10).map(i=>P("24201",19,15,15+i,"medium azure",90)),...range(10).map(i=>P("24201",33,15,15+i,"medium azure",270)),
...range(8).map(i=>P("4460b",23+i,19,13,"white")),...range(2).map(i=>blueSide(21+i,19,13,0)),...range(2).map(i=>blueSide(31+i,19,13,0)),...range(10).map(i=>blueSide(19,19,15+i,90)),...range(10).map(i=>blueSide(33,19,15+i,270)),
B(19,29,15,2,2,10,"medium azure"),B(33,29,15,2,2,10,"medium azure"),...range(6).map(i=>P("3678b",21+2*i,19,25,"medium azure",180)),B(21,28,13,12,3,2,"medium azure"),B(21,25,25,12,6,2,"medium azure"),
...range(6).map(i=>P("93606",21+2*i,31,13,"medium azure")),...range(6).map(i=>P("93606",21+2*i,31,23,"dark blue",180)),P("93606",19,31,21,"medium azure",90),...range(3).map(i=>P("93606",31,31,17+2*i,"medium azure",270)),
F(23,31,17,8,6,"medium azure",4),B(24,35,18,6,3,6,"dark blue"),P("6091",23,29,12,"white",90),P("6091",29,29,12,"white",90),F(25,18,24,6,8,"medium azure"),...range(6).map(i=>P("61678",25+i,19,27,"medium azure",180))
]);
section("Expressive flippers",[
...range(4).map(i=>P("13547",12,25,17+i,"medium azure",90)),F(12,28,17,10,4,"medium azure"),P("15068",12,29,17,"medium azure",90),P("15068",12,29,19,"medium azure",90),...range(2).map(i=>P("93606",14,29,17+2*i,"medium azure",90)),...range(2).map(i=>P("93606",18,29,17+2*i,"medium azure",90)),
...range(6).map(i=>P("24201",35,15,18+i,"medium azure",270)),...range(6).map(i=>blueSide(35,19,18+i,270)),F(33,29,18,4,6,"medium azure"),...range(3).map(i=>P("15068",35,30,18+2*i,"medium azure",270))
]);
section("Round penguin hood and white face",[
B(22,36,16,12,6,8,"medium azure"),B(20,42,14,16,15,12,"dark blue"),...range(16).map(i=>P("13547",20+i,39,11,"white")),...range(12).map(i=>P("13547",20+i,39,24,"dark blue",180)),...range(10).map(i=>P("13547",18,39,15+i,"dark blue",90)),...range(10).map(i=>P("13547",34,39,15+i,"dark blue",270)),
B(20,42,12,7,12,2,"white"),B(29,42,12,7,12,2,"white"),B(27,42,12,2,12,2,"medium azure"),...range(3).map(i=>P("15068",20+2*i,54,12,"white")),P("11477",26,54,12,"white"),...range(3).map(i=>P("15068",29+2*i,54,12,"white")),P("11477",35,54,12,"white"),
...range(12).map(i=>P("4460b",18,42,14+i,"dark blue",90)),...range(12).map(i=>P("4460b",36,42,14+i,"dark blue",270)),...range(6).map(i=>P("93606",18,51,14+2*i,"dark blue",90)),...range(6).map(i=>P("93606",34,51,14+2*i,"dark blue",270)),
...range(8).map(i=>P("3678b",20+2*i,42,26,"dark blue",180)),...range(16).map(i=>P("4460b",20+i,48,26,"dark blue",180)),...range(8).map(i=>P("93606",20+2*i,57,12,"dark blue")),...range(8).map(i=>P("93606",20+2*i,57,24,"dark blue",180)),
...range(4).map(i=>P("93606",18,57,16+2*i,"dark blue",90)),...range(4).map(i=>P("93606",34,57,16+2*i,"dark blue",270)),P("15068",18,57,14,"dark blue"),P("15068",36,57,14,"dark blue"),P("15068",18,57,24,"dark blue",180),P("15068",36,57,24,"dark blue",180),
F(22,57,16,12,8,"dark blue"),P("54095",22,58,16,"dark blue"),P("11290",30,58,16,"dark blue",90),P("11290",32,58,16,"dark blue",90),P("24201",27,50,11,"dark blue"),P("24201",28,50,11,"dark blue"),P("50950",27,54,11,"dark blue"),P("50950",28,54,11,"dark blue")
]);
function eye(x){return [B(x,45,10,3,7,2,"black",{interior:"solid"}),P("50950",x,52,10,"black",90),P("50950",x,52,11,"black",90),P("3005",x,49,10,"white"),P("3024",x+2,46,10,"white")];}
section("Sparkling eyes and smiling bill",[...eye(22),...eye(31),...range(4).map(i=>P("13547",26+i,43,9,"yellow")),F(26,46,9,4,3,"black"),P("93606",26,47,8,"yellow"),P("93606",28,47,8,"yellow")]);
function crest(x,z,h,w){return [B(x,4,z,w,h,4,"dark turquoise"),...range(w).map(i=>P("61678",x+i,4+h,z,"medium azure")),...range(w).map(i=>P("11477",x+i,7+h,z+2,"white"))];}
section("Curling practice wave and tide marks",[
...crest(3,21,9,3),...crest(6,23,15,3),...crest(9,24,18,3),...crest(12,24,12,2),...range(7).map(i=>P("15068",3+2*i,4,29,"medium azure",180)),...range(7).map(i=>P("15068",2,4,5+3*i,"medium azure",90)),
...range(4).map(i=>P("11477",7+2*i,4,15,"white",90)),...range(3).map(i=>P("11477",8+2*i,4,18,"trans light blue",90)),...range(4).map(i=>P("98138",4+2*i,4,20+(i%2),"white")),
P("15068",7,4,10,"dark bluish grey"),P("15068",9,4,10,"dark bluish grey",90),P("15068",7,4,12,"dark bluish grey",180),P("15068",9,4,12,"dark bluish grey",270),B(8,7,10,2,3,2,"orange"),P("15068",8,10,10,"orange"),P("54200",7,7,11,"orange",90),P("54200",10,7,11,"orange",270),P("3024",8,8,10,"black"),
...range(4).map(i=>P("25269",19+i,9,21+i,"light bluish grey",90)),...range(3).map(i=>P("25269",27+i,9,25+i,"light bluish grey",270)),P("2431",24,9,29,"trans light blue"),P("3069b",28,9,29,"trans light blue"),P("2431",18,9,19,"trans light blue",90)
]);
function bubble(x,y,z){return [column({at:[x+1,4,z+1],height:y-5,colour:"trans-clear"}),P("3020",x,y-1,z,"trans-clear"),P("3020",x,y-1,z+2,"trans-clear"),P("30342",x,y,z,"trans light blue"),P("30286",x,y+6,z,"trans light blue")];}
section("Rising bubble attack",[...bubble(4,41,8),...bubble(12,47,4),column({at:[20,4,5],height:39,colour:"trans-clear"}),P("4032b",20,43,5,"trans-clear"),P("3941",20,44,5,"trans light blue"),P("4740",20,47,5,"trans light blue"),P("86500",8,4,3,"trans light blue"),P("4740",16,4,8,"trans-clear"),P("4740",5,4,16,"trans-clear")]);