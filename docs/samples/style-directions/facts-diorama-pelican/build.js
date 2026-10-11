script({title:"Special Delivery: The Pelican Pedaller",description:"A pelican pedals a scarlet delivery bicycle along the harbour boardwalk: webbed feet on opposite pedals, wings holding the handlebars, a billowing sailor scarf and today's catch in the rear crate. Its enormous golden bill and orange throat pouch lead the way above the tide.",defaults:{interior:"empty"}});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const slab=(x,y,z,w,d,colour,layers=1)=>floor({at:[x,y,z],size:[w,d],colour,layers});
const core=(x,y,z,w,h,d,colour)=>box({at:[x,y,z],size:[w,h,d],colour,interior:"solid"});
const sea=[slab(0,0,0,32,36,"black",2),floor({at:[0,2,0],size:[10,36],colour:"dark azure",top:"tile"}),slab(10,2,0,22,36,"reddish brown",2)];
for(let z=0;z<36;z++){for(let k=0;k<5;k++)sea.push(p(k===2&&(z===18||z===19)?"3710":"2431",10+4*k,4,z,["tan","dark tan","tan","reddish brown"][(k+Math.floor(z/5))%4]));sea.push(p("3069b",30,4,z,z%5===0?"reddish brown":"dark tan"));}
for(const q of [[1,5,6],[3,3,14],[0,4,24],[4,4,31]])sea.push(floor({at:[q[0],3,q[2]],size:[q[1],1],colour:"medium azure",top:"tile"}));
for(const z of [4,16,31])sea.push(column({at:[8,3,z],height:12,diameter:2,colour:"reddish brown"}),p("4032b",8,15,z,"dark tan"));
sea.push(wall({from:[9,4],to:[9,32],y:13,height:2,colour:"white",top:"tile"}));
for(const z of [3,15,30])sea.push(p("6141",10,5,z,"dark bluish grey"));
section("Harbour boardwalk and tide",sea);
const bike=[];
for(const z of [6,23])bike.push(p("2903c02",20,5,z,"light bluish grey",90));
for(const x of [18,23]){for(const z of [10,27])bike.push(core(x,17,z,1,12,2,"red"));bike.push(line({from:[x,29,11],to:[x,29,23],colour:"red"}),line({from:[x,29,11],to:[x,17,19],colour:"red"}),line({from:[x,17,19],to:[x,29,23],colour:"red"}),line({from:[x,29,23],to:[x,17,28],colour:"red"}),line({from:[x,17,19],to:[x,17,28],colour:"red"}));}
bike.push(core(20,5,18,2,12,2,"trans-clear"),core(18,17,18,6,3,2,"red"),core(20,20,22,2,11,2,"light bluish grey"),slab(18,30,21,6,4,"red"),box({at:[18,31,21],size:[6,1,4],colour:"black",top:"tile"}),core(20,28,10,2,5,2,"light bluish grey"),slab(18,29,10,6,3,"red"));
for(let x=12;x<30;x+=6)bike.push(p("3009",x,33,10,"black"));
bike.push(slab(13,17,19,9,2,"light bluish grey"),slab(22,21,21,7,2,"light bluish grey"),slab(13,18,17,4,4,"black"),slab(25,22,19,4,4,"black"));
for(const x of [18,23])bike.push(core(x,29,28,1,5,5,"light bluish grey"));
bike.push(slab(18,34,28,6,6,"light bluish grey"),p("3070b",18,35,28,"trans red"),p("3070b",23,35,28,"trans red"),p("6141",22,36,10,"trans yellow"));
for(const z of [11,28])bike.push(p("3749",18,17,z,"light bluish grey"));
section("Scarlet bicycle, pedals and rear carrier",bike);
const bird=[slab(17,32,18,8,8,"white"),core(17,33,18,8,14,8,"white"),core(17,42,16,8,5,2,"white"),core(17,42,26,8,5,2,"white"),p("2431",17,47,27,"white"),p("2431",21,47,27,"white")];
for(let x=17;x<25;x+=2)bird.push(p("3660b",x,33,16,"white"),p("3660b",x,33,26,"white",180),p("3678b",x,36,16,"white"),p("3678b",x,36,26,"white",180),p("24309",x,47,15,"white"),p("24309",x,47,24,"white",180));
for(let z=18;z<26;z+=2){bird.push(p("3660b",15,33,z,"white",90),p("3660b",25,33,z,"white",270));if(z!==20)bird.push(p("3684a",15,36,z,"white",90),p("3684a",25,36,z,"white",270));bird.push(p("3022",15,45,z,"white"),p("3022",25,45,z,"white"),p("15068",15,46,z,"white",90),p("15068",25,46,z,"white",270));}
bird.push(core(13,41,20,16,3,2,"white"),core(15,36,20,2,5,2,"white"),core(25,36,20,2,5,2,"white"),slab(15,44,20,12,2,"white"),p("78522",17,47,18,"white"),p("78522",21,47,18,"white"),slab(18,41,27,6,4,"white"));
for(let x=18;x<24;x++)bird.push(p("61678",x,42,27,x===18||x===23?"black":"white",180));
for(const side of [0,1]){const x=side?27:13;bird.push(core(x,37,12,2,7,10,"white"),slab(side?25:13,43,20,4,2,"white"),slab(x,36,10,2,3,"white"),p("15068",x,37,10,"black"));for(let dx=0;dx<2;dx++)bird.push(p("42022",x+dx,44,12,"white"),p("61678",x+dx,44,18,"white",180));for(let z=14;z<22;z+=2)bird.push(slab(side?28:12,39,z,2,1,"white"),p("11477",side?29:12,40,z,"white",side?270:90));}
const foot=(x,y,z)=>[slab(x,y,z,4,4,"yellow"),p("43721",x,y+1,z,"yellow"),p("43720",x+2,y+1,z,"yellow")];
bird.push(...foot(13,19,17),...foot(25,23,19),core(15,23,20,2,10,2,"yellow"),core(25,27,21,2,9,2,"yellow"),p("15068",15,30,19,"yellow"),p("15068",25,33,20,"yellow"));
bird.push(core(19,47,17,4,9,4,"white"),core(19,53,14,4,3,4,"white"),core(19,56,15,4,9,4,"white"));
for(let x=19;x<23;x+=2)bird.push(p("3678b",x,56,13,"white"),p("3678b",x,56,19,"white",180),p("3022",x,62,13,"white"),p("15068",x,63,13,"white"));
bird.push(core(18,65,12,6,6,6,"white"));
for(const x of [18,23])bird.push(p("3005",x,68,12,"black"),p("6141",x,71,12,"white"));
for(let x=18;x<24;x+=2)bird.push(p("15068",x,71,12,"white"));
for(let x=18;x<24;x++)bird.push(p("61678",x,71,14,"white",180));
bird.push(slab(19,65,2,4,12,"yellow"),slab(20,65,0,2,2,"yellow"),p("15068",20,66,0,"yellow"),p("42918",19,66,2,"yellow"),p("42918",21,66,2,"yellow"),box({at:[19,66,10],size:[4,3,4],colour:"yellow",top:"tile"}),core(19,59,7,4,6,7,"orange"),slab(19,61,4,4,3,"orange"));
for(let x=19;x<23;x+=2)bird.push(p("24309",x,62,4,"orange"),p("3660b",x,56,7,"orange"),p("3660b",x,56,12,"orange",180));
for(const z of [9,11])bird.push(slab(18,59,z,2,1,"orange"),slab(22,59,z,3,1,"orange"),p("11477",18,60,z,"orange",90),p("11477",23,60,z,"orange",270));
bird.push(slab(18,52,16,6,5,"dark blue"),p("2431",19,53,16,"dark blue"),p("2431",19,53,20,"dark blue"),p("3069b",18,53,17,"dark blue",90),p("3069b",23,53,17,"dark blue",90),slab(23,52,19,3,6,"dark blue"),p("43720",24,53,21,"dark blue",180),p("63864",23,53,19,"dark blue"));
section("Pelican: webbed pedals, steering wings, long bill and pouch",bird);
const cargo=[slab(18,35,30,6,4,"dark blue"),box({at:[18,35,30],size:[6,6,4],colour:"dark blue",open:["top"],texture:"grille"})];
for(const z of [30,33])cargo.push(p("2431",18,41,z,"tan"),p("3069b",22,41,z,"tan"));
for(const x of [18,23])cargo.push(p("3069b",x,41,31,"tan",90));
cargo.push(p("64648",19,36,30,"sand green"),p("64648",21,36,30,"medium azure"),p("64648",22,36,30,"orange"));
section("Today's catch in the delivery crate",cargo);