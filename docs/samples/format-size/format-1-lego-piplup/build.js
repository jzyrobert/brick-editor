script({title:"Piplup — A Bubble of Pride",description:"A round, bright-eyed Piplup balances a water bubble on one raised flipper. Sculpted navy hood, white cheek lobes, little chest spots, webbed yellow feet and a finished cape and tail make a freestanding character model.",palette:{a:"medium azure",n:"dark blue",w:"white",y:"yellow"}});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const b=(x,y,z,w,h,d,colour)=>box({at:[x,y,z],size:[w,h,d],colour,interior:"solid",top:"tile"});
const f=(x,y,z,w,d,colour,layers=1)=>floor({at:[x,y,z],size:[w,d],colour,layers});
function foot(x,z){return [f(x,0,z,4,5,"y"),b(x,1,z+2,4,3,3,"y"),...[0,2].map(dx=>p("15068",x+dx,1,z,"y")),...[0,2].map(dx=>p("15068",x+dx,1,z+3,"y",180))];}
section("Webbed feet",[foot(-5,-5),foot(1,-4)]);
const body=[];
body.push(b(-3,4,-2,6,17,6,"a"),b(-3,7,-4,6,11,2,"a"));
for(const x of [-3,-1,1])body.push(p("3660b",x,4,-4,"a"),p("15068",x,18,-4,"a"),p("15068",x,21,-4,"n"));
for(const x of [-3,1])body.push(p("3660b",x,12,-4,"w"),p("15068",x,15,-4,"w"));
for(const z of [-2,0,2]){body.push(p("3660b",-5,7,z,"a",90),b(-5,10,z,2,8,2,"a"),b(3,10,z,2,8,2,"a"));if(z!==0)body.push(p("3660b",3,7,z,"a",270),p("15068",3,18,z,"a",270));if(z===2)body.push(p("15068",-5,18,z,"a",90));}
body.push(b(-3,7,4,6,5,2,"a"),b(-3,15,4,6,6,2,"n"),b(-3,21,-2,6,4,6,"n"));
for(const x of [-3,-1,1])body.push(p("3660b",x,12,4,"n",180),p("15068",x,21,4,"n",180));
body.push(f(-2,5,3,4,5,"a"),p("64225",-2,6,5,"a",180));
section("Rounded body, chest spots and cape",body);
section("Flippers and bubble",[
p("3660b",-7,15,-1,"a",90),f(-8,18,-1,5,2,"a"),b(-8,19,-1,5,2,2,"a"),b(-9,21,-1,2,6,2,"a"),p("3678b",-10,21,-1,"a",90),f(-9,27,-1,2,2,"a"),p("30151a",-9,28,-1,"trans light blue"),
p("24201",4,8,0,"a",270),p("24201",4,8,1,"a",270),b(4,12,0,2,6,2,"a"),b(3,18,0,2,3,2,"a"),p("3678b",4,18,0,"a",270)
]);
const head=[box({at:[-4,25,-3],size:[8,14,8],colour:"n",interior:"empty"}),b(-2,24,-1,4,15,4,"n"),b(-4,28,-5,8,8,2,"w"),f(-4,29,-5,8,5,"w")];
for(const z of [-3,-1,1])head.push(p("3660b",-6,25,z,"n",90),p("3660b",4,25,z,"n",270),b(-6,28,z,2,5,2,"n"),b(4,28,z,2,5,2,"n"),p("3678b",-6,33,z,"n",90),p("3678b",4,33,z,"n",270));
for(const x of [-4,-2,0,2])head.push(p("32803",x,25,-5,"w"),p("15068",x,36,3,"n",180));
head.push(p("54095",-4,39,-3,"n"),p("4162",-4,45,0,"n"),p("4162",-4,45,1,"n"));
for(const x of [-4,3])head.push(p("11477",x,36,-5,"w"));
for(const x of [-3,1])head.push(p("32803",x,29,-5,"black"),p("3003pe7",x,33,-5,"black"),p("15068",x,36,-5,"black"));
head.push(p("3660b",-1,33,-5,"n"),p("15068",-1,36,-5,"n"));
head.push(p("3660b",-1,26,-7,"y"),p("3020",-1,29,-7,"black",90),p("15068",-1,30,-7,"y"),p("15068",-1,30,-5,"y"));
section("Sculpted hood, cheeks and expressive face",head);