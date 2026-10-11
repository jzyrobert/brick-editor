script({title:"Piplup — The First Bubble Ballet",description:"A round, bright-eyed Piplup proudly raises one flipper on a sculpted ice floe. Its first Bubble attack becomes a descending necklace of crystalline globes above a leaping orange fish, framed by a curling, foam-tipped tide. A connected chamfered ocean plinth, webbed toes, a tiny tail, white cheek masks, sparkling eyes and the azure crown marking finish the scene on every side.",palette:{blue:"medium azure",cap:"dark blue",ice:"white",sea:"dark azure"},defaults:{interior:"empty"}});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const slab=(x,y,z,w,d,colour,layers=1,tile=false)=>floor({at:[x,y,z],size:[w,d],colour,layers,...(tile?{top:"tile"}:{})});
const core=(x,y,z,w,h,d,colour,solid=false)=>box({at:[x,y,z],size:[w,h,d],colour,interior:solid?"solid":"empty",top:"tile"});
function foot(x){return [slab(x,0,3,3,6,"yellow",2,true),range(3).map(i=>p("11477",x+i,2,3,"yellow")),p("63864",x,2,5,"yellow"),p("63864",x,2,6,"yellow"),p("3003",x+1,2,7,"yellow")];}
function cheek(x){return [range(5).map(i=>p("24201",x+i,34,2,"white")),core(x,38,2,5,12,3,"white",true),range(5).map(i=>p("50950",x+i,50,2,"white"))];}
function eye(x){return [p("24201",x,40,2,"black"),p("24201",x+1,40,2,"black"),core(x,44,2,2,3,2,"black",true),p("3005",x,44,2,"white"),p("15068",x,47,2,"black")];}
component("Piplup",{size:[25,20],ops:[
 foot(6),foot(13),
 slab(5,5,8,12,6,"blue",3),core(7,5,8,8,26,6,"blue"),core(7,5,6,8,3,8,"blue"),
 range(8).map(i=>p("24201",7+i,8,5,"white")),core(7,12,5,8,6,2,"white",true),range(4).map(i=>p("15068",7+2*i,18,5,"white")),
 core(7,21,5,8,6,3,"blue",true),p("6091",8,21,5,"white"),p("6091",13,21,5,"white"),
 range(6).map(i=>[p("24201",5,8,8+i,"blue",90),p("24201",15,8,8+i,"blue",270)]),
 core(5,12,8,2,12,6,"blue"),core(15,12,8,2,12,6,"blue"),range(3).map(i=>[p("3678b",5,24,8+2*i,"blue",90),p("3678b",15,24,8+2*i,"blue",270)]),
 range(8).map(i=>p("13547",7+i,8,13,"blue",180)),core(7,11,14,8,13,3,"blue"),range(8).map(i=>p("61678",7+i,24,13,"blue",180)),core(6,27,7,10,4,8,"cap"),
 core(3,13,9,2,10,3,"blue",true),p("3660b",3,10,9,"blue",90),range(3).map(i=>p("4460b",2,14,9+i,"cap",90)),p("3020",3,23,9,"blue"),p("15068",3,24,9,"blue"),p("11477",3,24,11,"blue",90),
 range(4).map(i=>p("3660b",17+2*i,25,9,"blue",270)),slab(15,28,9,10,2,"blue"),range(4).map(i=>p("15068",17+2*i,29,9,"blue",270)),
 slab(9,12,14,4,6,"blue",1,true),range(4).map(i=>p("50950",9+i,13,16,"blue",180)),
 core(6,30,7,10,4,7,"cap"),
 range(12).map(i=>[p("13547",5+i,31,3,"cap"),p("13547",5+i,31,13,"cap",180)]),range(6).map(i=>[p("13547",3,31,7+i,"cap",90),p("13547",15,31,7+i,"cap",270)]),
 core(5,34,5,12,24,10,"cap"),core(3,37,6,2,15,8,"cap"),core(17,37,6,2,15,8,"cap"),
 [3,17].map(x=>[core(x,37,4,2,18,2,"cap",true),core(x,37,13,2,18,2,"cap",true)]),
 range(4).map(i=>[p("3678b",3,52,6+2*i,"cap",90),p("3678b",17,52,6+2*i,"cap",270)]),
 core(5,34,15,12,21,2,"cap"),range(12).map(i=>p("61678",5+i,55,13,"cap",180)),
 cheek(5),cheek(12),eye(6),eye(14),core(10,34,2,2,19,3,"blue",true),
 core(5,53,2,3,5,4,"cap",true),core(8,53,2,6,5,4,"blue",true),core(14,53,2,3,5,4,"cap",true),
 p("3020",9,38,1,"yellow"),p("3660b",9,39,0,"yellow"),p("3660b",11,39,0,"yellow"),p("3020",9,42,0,"black"),p("3039",9,43,0,"yellow"),p("3039",11,43,0,"yellow"),
 [3,17].map(x=>[p("3045",x,55,4,"cap"),p("3045",x,55,13,"cap",180),p("15068",x,58,4,"cap"),p("15068",x,58,13,"cap",180)]),
 range(12).map(i=>[p("61678",5+i,58,2,i>=3&&i<=8?"blue":"cap"),p("61678",5+i,58,13,"cap",180)]),
 range(7).map(i=>[p("61678",3,58,6+i,"cap",90),p("61678",15,58,6+i,"cap",270)]),slab(7,58,6,8,7,"cap",3,true),
 [9,11].map(x=>[p("3068b",x,60,6,"blue"),p("3068b",x,60,8,"blue")]),p("3069b",10,60,10,"blue")
]});
section("Chamfered ocean display",[
 slab(-16,0,-8,32,28,"black",3),slab(-20,0,-4,4,20,"black",3),slab(16,0,-4,4,20,"black",3),
 floor({at:[-16,3,-8],size:[32,28],colour:"cap",top:"tile",holes:[{at:[-15,-6],size:[30,24]}]}),
 floor({at:[-20,3,-4],size:[4,20],colour:"cap",top:"tile",holes:[{at:[-18,-2],size:[2,16]}]}),floor({at:[16,3,-4],size:[4,20],colour:"cap",top:"tile",holes:[{at:[16,-2],size:[2,16]}]}),
 slab(-15,3,-6,30,24,"sea",2,true),slab(-18,3,-2,3,16,"sea",2,true),slab(15,3,-2,3,16,"sea",2,true),
 range(8).map(i=>p("3069b",-11+3*i,5,-6+(i%3===0?1:0),i%2?"medium azure":"trans light blue")),
 range(5).map(i=>p("2431",4+2*(i%3),5,3+3*i,"trans light blue"))
]);
section("Sculpted ice floe",[
 slab(-16,5,1,16,16,"white",4,true),slab(-18,5,4,2,10,"white",4,true),slab(0,5,4,4,9,"white",4,true),slab(-13,5,-1,10,2,"white",4,true),slab(-12,5,17,10,2,"white",4,true),
 range(7).map(i=>p("15068",-15+2*i,6,0,"white")),range(5).map(i=>p("15068",-13+2*i,6,-2,"white")),
 range(5).map(i=>p("15068",-18,6,4+2*i,"white",90)),range(4).map(i=>p("15068",2,6,5+2*i,"white",270)),range(5).map(i=>p("15068",-12+2*i,6,17,"white",180)),
 p("3039",-16,9,14,"white"),p("3039",-14,9,15,"white",90),p("15068",-15,12,15,"white"),p("30385",-17,9,11,"trans light blue"),p("30385",1,9,11,"trans light blue"),
 p("3068b",-2,9,14,"trans light blue"),p("3069b",0,9,15,"trans light blue"),p("3069b",-3,9,16,"trans light blue")
]);
section("Piplup",[instance({component:"Piplup",at:[-18,9,0]})]);
function globe(x,z,bottom){return [column({at:[x+1,5,z+1],height:bottom-5,diameter:1,colour:"trans-clear"}),p("30342",x,bottom,z,"trans light blue"),p("30286",x,bottom+6,z,"trans light blue")];}
function littleBubble(x,z,bottom){return [column({at:[x,5,z],height:bottom-5,diameter:1,colour:"trans-clear"}),p("30151a",x,bottom,z,"trans-clear")];}
section("A necklace of playable bubbles",[globe(-5,-4,38),globe(3,-5,26),globe(10,-2,14),littleBubble(-8,-4,26),littleBubble(6,2,11),littleBubble(0,-6,17)]);
section("Curling tide and fish",[
 p("41749",12,5,7,"trans light blue"),p("41750",15,5,7,"trans light blue"),core(14,11,8,3,8,6,"dark azure"),
 range(6).map(i=>p("65734",11,11,8+i,"trans light blue",90)),p("65734",17,11,8,"trans light blue"),p("65734",17,11,12,"trans light blue"),
 slab(13,19,9,5,4,"trans light blue"),core(14,19,9,2,6,4,"trans light blue"),p("3660b",13,19,9,"trans light blue",90),p("3660b",13,19,11,"trans light blue",90),
 p("15068",12,22,9,"white",90),p("15068",12,22,11,"white",90),p("65734",16,20,9,"trans light blue"),p("15068",14,25,9,"white",270),p("15068",14,25,11,"white",270),
 [9,11].map(z=>[p("6141",14,28,z,"white"),p("98138",14,29,z,"white")]),
 column({at:[11,5,3],height:6,colour:"trans-clear"}),p("64648",10,11,3,"orange",90),
 [7,9,11,13].map((x,i)=>p("11477",x,5,4+(i%2),"trans light blue",i%2?90:0)),
 [[8,2],[13,2],[15,4],[10,6],[18,5],[8,13]].map(([x,z],i)=>p("98138",x,5,z,i%2?"white":"trans-clear")),
 slab(7,5,-5,2,2,"white",2,true),p("15068",7,7,-5,"white"),slab(14,5,-2,3,3,"white",2,true),p("3039",14,7,-2,"white",90),p("11477",16,7,-1,"white",270)
]);