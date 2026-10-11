script({title:"Piplup — The First Bubble",description:"Piplup proudly tests Bubble on a curling tide from a little ice shelf. A sculpted blue crown, twin white cheeks, sparkling black eyes, golden beak and webbed feet, pale blue belly and two white buttons form the unmistakable little penguin. A connected midnight-blue display carries faceted ice and a translucent curling wave.",palette:{ice:"white",body:"medium azure",cap:"blue",cape:"dark blue"}});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,c)=>box({at:[x,y,z],size:[w,h,d],colour:c});
const foam=range(4,29,3).map((x,i)=>[x,3+(i%3)]);
const ripples=[[3,12],[2,18],[31,3],[32,24],[27,29],[15,6],[19,8]];
const islands=[[4,8],[7,5],[25,10],[30,27]];
const supports=[[7,16,20,13],[9,12,15,4],[5,16,2,12],[27,16,2,12],[7,29,20,2],[12,29,11,2],[29,7,4,4],[30,12,4,4],[29,17,4,4],[28,7,2,2],[25,5,2,2],[18,6,3,1],...islands.map(([x,z])=>[x,z,3,3]),...ripples.map(([x,z])=>[x,z,2,2]),...foam.map(([x,z])=>[x,z,2,1])];
const sea=[floor({at:[0,0,0],size:[36,32],layers:3,colour:"dark blue"}),floor({at:[1,3,1],size:[34,30],colour:"dark blue",top:"tile"}),...range(0,36,4).flatMap(x=>[p("2431",x,3,0,"black"),p("2431",x,3,31,"black")]),...range(1,31,2).flatMap(z=>[p("3069b",0,3,z,"black",90),p("3069b",35,3,z,"black",90)])];
for(let x=1;x<33;x+=4)for(let z=1;z<29;z+=4)if(!supports.some(([sx,sz,w,d])=>x<sx+w&&x+4>sx&&z<sz+d&&z+4>sz))sea.push(p("1751",x,3,z,"dark blue"));
section("Connected ocean display",sea);
section("The ice shelf",[B(7,4,16,20,5,13,"light bluish grey"),B(9,4,12,15,5,4,"light bluish grey"),B(5,4,20,2,3,7,"light bluish grey"),B(12,4,29,11,3,2,"light bluish grey"),floor({at:[7,9,16],size:[20,13],colour:"white",top:"tile"}),floor({at:[9,9,12],size:[15,4],colour:"white",top:"tile"}),floor({at:[5,7,20],size:[2,7],colour:"white",top:"tile"}),floor({at:[12,7,29],size:[11,2],colour:"white",top:"tile"}),...range(9,24,2).map(x=>p("3039",x,6,12,x%3===0?"trans light blue":"white")),...range(16,28,2).map(z=>p("3039",5,4,z,"white",90)),...range(16,28,2).map(z=>p("3039",27,4,z,z%4===0?"trans light blue":"white",270)),...range(7,27,2).map(x=>p("3039",x,4,29,"white",180)),...islands.flatMap(([x,z],i)=>[B(x,4,z,3,2,3,"trans light blue"),p("3039",x,6,z,"white",i%2?90:0),p("11477",x+2,6,z,"white")])]);
function foot(x){return [B(x,10,17,4,3,4,"yellow"),p("3020",x,13,17,"yellow"),...range(4).map(i=>p("61678",x+i,10,13,"yellow")),...range(4).map(i=>p("11477",x+i,14,19,"yellow",180))];}
section("Webbed feet",[...foot(11),...foot(18)]);
const torso=[B(10,14,18,12,18,9,"medium azure")];
for(let y=17;y<32;y+=3){for(let x=10;x<22;x+=2)if(!([12,18].includes(x)&&[20,23,26].includes(y)))torso.push(p("3004",x,y,16,"medium azure"));for(let x=10;x<22;x+=6)torso.push(p("3009",x,y,27,"dark blue"));for(let z=18;z<26;z+=4)torso.push(p("3010",9,y,z,"medium azure",90),p("3010",22,y,z,"blue",90));}
for(let x=10;x<22;x++)torso.push(p("3665a",x,14,16,"medium azure"),p("3665a",x,14,26,"blue",180));
for(let z=18;z<26;z++)torso.push(p("3665a",9,14,z,"medium azure",90),p("3665a",21,14,z,"blue",270));
for(const x of [12,18])torso.push(B(x,20,16,2,9,1,"white"),p("3660b",x,20,15,"white"),p("3003",x,23,15,"white"),p("15068",x,26,15,"white"));
torso.push(B(11,32,18,10,6,8,"dark blue"),B(13,38,18,6,2,6,"medium azure"));
for(let x=10;x<22;x++)torso.push(p("11477",x,32,16,x>=14&&x<18?"medium azure":"dark blue"),p("11477",x,32,26,"dark blue",180));
for(let z=18;z<26;z++)torso.push(p("11477",9,32,z,"dark blue",90),p("11477",21,32,z,"dark blue",270));
torso.push(p("3039",14,35,16,"dark blue"),p("3039",16,35,16,"dark blue"));
section("Round belly and pointed collar",torso);
section("Flippers and little tail",[B(7,20,21,3,9,4,"blue"),B(8,17,22,2,3,2,"blue"),...range(21,25).map(z=>p("61678",5,29,z,"blue",90)),...range(22,24).map(z=>p("3665a",6,20,z,"blue",90)),B(22,26,21,5,5,4,"blue"),...range(21,25).map(z=>p("61678",25,31,z,"blue",270)),...range(21,25).map(z=>p("3665a",25,28,z,"blue",270)),B(13,17,28,6,3,3,"dark blue"),...range(13,19).map(x=>p("50950",x,20,28,"dark blue",180))]);
const head=[B(10,38,16,12,6,8,"medium azure"),B(8,44,13,16,15,14,"blue"),B(9,44,12,14,15,1,"medium azure"),B(8,44,11,6,12,2,"white"),B(18,44,11,6,12,2,"white")];
const bricks={2:"3004",4:"3010",6:"3009"};
for(let c=0;c<5;c++){let x=9;for(const n of c%2?[2,6,6]:[6,6,2]){head.push(p(bricks[n],x,44+c*3,27,"blue"));x+=n;}let z=14;for(const n of c%2?[4,4,4]:[6,6]){head.push(p(bricks[n],7,44+c*3,z,"blue",90),p(bricks[n],24,44+c*3,z,"blue",90));z+=n;}}
for(let x=9;x<23;x++)head.push(p("24201",x,40,12,"medium azure"),p("24201",x,40,26,"blue",180));
for(let z=14;z<26;z++)head.push(p("24201",7,40,z,"blue",90),p("24201",23,40,z,"blue",270));
for(const x of [8,18])for(let i=0;i<6;i++){head.push(p("24201",x+i,40,10,"white"));if(![10,11,20,21].includes(x+i))head.push(p("11477",x+i,56,11,"white"));}
function eye(x){const a=[p("3660b",x,44,10,"black")];for(let dx=0;dx<2;dx++){a.push(p("3004",x+dx,47,10,"black",90),p("3004",x+dx,50,10,"black",90));if(dx===0)a.push(p("3023b",x+dx,53,10,"black",90),p("3023b",x+dx,54,10,"white",90),p("3023b",x+dx,55,10,"black",90));else a.push(p("3004",x+dx,53,10,"black",90));}a.push(p("15068",x,56,10,"black"));return a;}
head.push(...eye(10),...eye(20),B(11,59,16,10,3,8,"blue"),floor({at:[11,62,16],size:[10,8],colour:"blue",top:"tile"}));
for(let x=9;x<23;x++)head.push(p("42022",x,59,12,"blue"),p("42022",x,59,22,"blue",180));
for(let z=18;z<22;z++)head.push(p("61678",7,59,z,"blue",90),p("61678",21,59,z,"blue",270));
for(const z of [14,24])head.push(p("3039",7,59,z,"blue",90),p("3039",23,59,z,"blue",270));
section("Oversized head and expressive face",head);
section("Golden beak",[B(14,42,11,4,4,2,"yellow"),p("3660b",14,42,9,"yellow"),p("3660b",16,42,9,"yellow"),p("3020",14,45,8,"black"),p("3020",14,45,10,"yellow"),...range(14,18).map(x=>p("61678",x,46,8,"yellow"))]);
function breaker(x,z,h){const a=[B(x,4,z,2,h,4,"trans light blue")];for(let y=7;y<4+h;y+=3)a.push(p("3660b",x-1,y,z,"trans light blue",90));for(let dz=0;dz<4;dz++)a.push(p("50950",x-2,4+h,z+dz,"white",90));return a;}
section("Bubble meets the curling tide",[...breaker(31,7,12),...breaker(32,12,9),...breaker(31,17,6),...foam.map(([x,z],i)=>p("3069b",x,4,z,i%2?"white":"trans light blue")),...ripples.flatMap(([x,z],i)=>[p("4032b",x,4,z,"trans-clear"),p("14769",x,5,z,i%2?"white":"trans-clear")]),p("3941",28,4,7,"trans light blue"),p("3941",28,7,7,"trans light blue"),p("4740",28,10,7,"trans light blue"),p("3941",25,4,5,"trans light blue"),p("4740",25,7,5,"trans light blue"),p("64648",18,4,6,"orange",90)]);