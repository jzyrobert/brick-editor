script({title:"Piplup's First Bubble Lesson",description:"A proud Piplup lifts one flipper to send shimmering bubbles across a polar lagoon. Its rounded navy hood, white cheek mask, sparkling eyes, yellow bill, broad webbed feet and twin white chest spots create the unmistakable little penguin. A scalloped ice shelf, swimming fish and rising bubble trail form one connected display.",palette:{hood:"dark blue",body:"medium azure",snow:"white",sea:"dark blue"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour,extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
const inBase=(x,z)=>x>=2&&x<34&&z>=0&&z<30;
const inIce=(x,z)=>(x>=8&&x<30&&z>=10&&z<28)||(x>=6&&x<32&&z>=14&&z<24)||(x>=10&&x<26&&z>=8&&z<28);
section("Connected midnight-blue display",[floor({at:[2,0,0],size:[32,30],layers:3,colour:"black"}),floor({at:[2,3,0],size:[32,30],colour:"sea"})]);
const foam=[[8,6],[12,6],[18,6],[23,6],[31,12],[32,17],[4,17],[8,28],[18,28],[27,28]];
const mounts=[[26,4],[31,10],[32,22],[4,13],[4,24],[28,3],[4,5],...foam.map(([x,z])=>[x+1,z+1])];
const used=new Set(),water=[];
for(let z=0;z<30;z++)for(let x=2;x<34;x+=2){if(used.has(x+","+z)||!inBase(x,z)||!inBase(x+1,z)||inIce(x,z)||inIce(x+1,z))continue;const big=z<29&&inBase(x,z+1)&&inBase(x+1,z+1)&&!inIce(x,z+1)&&!inIce(x+1,z+1)&&!used.has(x+","+(z+1));const depth=big?2:1;const mount=mounts.some(([a,b])=>a>=x&&a<x+2&&b>=z&&b<z+depth);const r=(x+2*z)%13;water.push(P(mount?(big?"3022":"3023b"):(big?"3068b":"3069b"),x,4,z,r<3?"medium azure":r<8?"trans light blue":"dark blue"));for(let k=0;k<depth;k++)used.add(x+","+(z+k));}
section("Smooth lagoon and flowing colour currents",water);
const ice=[B(8,4,10,22,6,18,"white",{top:"tile"}),B(6,4,14,26,6,10,"white",{top:"tile"}),B(10,4,8,16,6,20,"white",{top:"tile"})];
for(let x=10;x<26;x+=2)ice.push(P("3039",x,7,8,"white"));
for(let x=8;x<30;x+=2)ice.push(P("3039",x,7,26,"white",180));
for(let z=14;z<24;z+=2){ice.push(P("3039",6,7,z,"white",90),P("3039",30,7,z,"white",270));}
for(const a of [[8,10],[28,10],[8,24],[28,24]])ice.push(P("3045",a[0],7,a[1],"white"));
for(const a of [[8,17],[28,22],[10,25],[26,13]])ice.push(P("15068",a[0],10,a[1],"white",a[0]<18?90:270));
section("Scalloped floating ice shelf",ice);
function foot(x){return [floor({at:[x,10,10],size:[4,7],layers:2,colour:"yellow"}),...range(4).map(i=>P("61678",x+i,12,10,"yellow")),B(x,12,14,4,4,3,"yellow",{top:"tile"})];}
section("Two broad webbed feet",[...foot(12),...foot(21)]);
const body=[floor({at:[12,16,14],size:[12,11],layers:2,colour:"body"}),B(13,18,15,10,4,9,"body",{open:["top"]}),B(11,22,15,14,18,10,"body",{open:["top"]}),B(14,18,13,8,4,2,"white"),B(13,22,12,10,9,3,"white"),B(12,31,11,12,4,3,"hood"),B(12,35,14,12,8,10,"hood")];
for(let x=13;x<23;x++){body.push(P("24201",x,18,12,"white"),P("24201",x,18,24,"body",180));}
for(let z=15;z<25;z++){body.push(P("24201",11,18,z,"body",90),P("24201",23,18,z,"body",270));}
for(let z=15;z<25;z+=2){body.push(P("3678b",11,34,z,"body",90),P("3678b",23,34,z,"body",270));}
for(let x=12;x<24;x+=2)body.push(P("3678b",x,35,12,"hood"));
for(let x=16;x<20;x++)body.push(P("24201",x,28,11,"hood"));
body.push(B(16,32,11,4,3,2,"hood"));
for(const x of [13,21])body.push(B(x,32,10,2,3,2,"white"),P("15068",x,35,10,"white"));
section("Pear-shaped body and sailor bib",body);
const wings=[B(7,24,17,4,9,5,"body"),B(10,32,18,3,4,4,"body"),P("3660b",7,21,18,"body"),P("3660b",9,21,18,"body"),B(24,32,16,6,7,4,"body"),B(28,38,15,4,5,4,"body")];
for(let z=17;z<22;z++){wings.push(P("60481a",6,24,z,"body",90),P("11477",6,30,z,"body",90));}
for(let z=18;z<22;z++)wings.push(P("61678",7,33,z,"body",90));
for(let x=25;x<28;x++)wings.push(P("61678",x,39,15,"body"));
for(let z=15;z<19;z+=2)wings.push(P("3678b",30,37,z,"body",270));
for(let x=28;x<32;x++)wings.push(P("61678",x,43,15,"body"));
section("One flipper waving, one balancing",wings);
section("Little upturned tail",[B(16,18,23,4,6,4,"body"),P("43713",16,21,25,"body",180),floor({at:[16,24,25],size:[4,6],colour:"body"}),...range(4).map(i=>P("61678",16+i,25,27,"body",180))]);
const head=[B(11,40,12,14,4,14,"hood"),floor({at:[9,43,12],size:[18,14],colour:"hood"}),B(10,44,13,16,30,12,"hood"),B(8,53,13,20,12,12,"hood",{open:["top"]}),B(10,53,11,16,12,16,"hood",{open:["top"]}),B(10,53,10,6,9,3,"white"),B(20,53,10,6,9,3,"white")];
for(let x=10;x<26;x++){head.push(P("2449",x,44,11,(x<16||x>=20)?"white":"hood"),P("2449",x,44,25,"hood",180),P("4460b",x,65,11,"hood"),P("4460b",x,65,25,"hood",180));}
for(let z=13;z<25;z++){head.push(P("2449",8,44,z,"hood",90),P("2449",26,44,z,"hood",270),P("4460b",8,65,z,"hood",90),P("4460b",26,65,z,"hood",270));}
for(const start of [10,20])for(let x=start;x<start+6;x+=2)head.push(P("15068",x,62,10,"white"));
for(let x=10;x<26;x++){head.push(P("61678",x,74,13,"hood"),P("61678",x,74,21,"hood",180));}
for(let z=17;z<21;z++)head.push(P("61678",10,74,z,"hood",90),P("61678",22,74,z,"hood",270));
head.push(floor({at:[14,74,17],size:[8,4],layers:3,top:"tile",colour:"hood"}));
section("Oversized rounded penguin hood",head);
function eye(x){return [B(x,53,10,2,6,1,"black"),P("3005",x,56,10,"white"),P("15068",x,59,10,"black")];}
section("Glossy eyes and smiling golden bill",[...eye(12),...eye(22),P("51739",16,49,7,"yellow"),floor({at:[16,50,7],size:[4,5],layers:3,colour:"yellow"}),B(16,50,10,4,6,2,"yellow"),P("3710",16,52,7,"dark orange"),P("24309",16,53,7,"yellow"),P("24309",18,53,7,"yellow")]);
function bubble(x,z,h,big){const ops=[column({at:[x+1,5,z+1],height:h,diameter:1,colour:"trans-clear"})];const y=5+h;if(big){ops.push(P("3960",x,y,z,"trans light blue"),P("86500",x,y+2,z,"trans light blue"));}else{ops.push(P("4032b",x,y,z,"trans-clear"),P("30151a",x,y+1,z,"trans light blue"));}return ops;}
section("Bubble attack, rising from the lagoon",[...bubble(25,3,14,true),...bubble(30,9,24,true),...bubble(31,21,36,true),...bubble(3,12,4,false),...bubble(3,23,9,false),P("64648",28,5,3,"orange"),P("64648",4,5,5,"medium azure",90)]);
section("Snow glints and foam at the floe edge",[...foam.map(([x,z],i)=>P("4740",x,5,z,i%3===0?"white":"trans-clear")),...[[11,22],[25,22],[12,25],[23,25]].map(([x,z])=>P("25269",x,10,z,"trans light blue"))]);