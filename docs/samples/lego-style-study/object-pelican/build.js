script({title:"The Fish Express",description:"An exuberant great white pelican pedals a turquoise touring bicycle. Its enormous golden bill and pendulous throat pouch carry a blue fish, its wings grasp swept handlebars, and orange webbed feet work opposite pedals. Seven-spoke wheels, a diamond frame, feathered shoulders and a compact kickstand complete this freestanding character sculpture.",palette:{bird:"white",bike:"dark turquoise",rubber:"black",metal:"light bluish grey",bill:"yellow",pouch:"tan",feet:"orange"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour)=>box({at,size,colour,interior:"solid"});
function beam(a,b,colour,wide=2){return range(wide).flatMap(z=>range(2).map(y=>line({from:[a[0],a[1]+y,a[2]+z],to:[b[0],b[1]+y,b[2]+z],colour})));}
function wheel(cx){return [P("71720c01",[cx-8,0,-1],"blue"),B([cx-1,19,-3],[3,5,8],"metal")];}
section("Real seven spoke wheels",[-14,14].flatMap(wheel));
const frame=[];
frame.push(...beam([-10,37,-4],[8,40,-4],"bike"),...beam([-10,37,-4],[0,21,-4],"bike"),...beam([0,21,-4],[8,40,-4],"bike"));
for(const z of [-3,4])frame.push(...beam([8,40,z],[14,21,z],"bike",1),...beam([0,21,z],[14,21,z],"bike",1),...beam([-14,21,z],[-10,40,z],"metal",1));
frame.push(...beam([8,39,-4],[8,44,-4],"metal"),...beam([-10,39,-4],[-14,49,-4],"metal"),B([-15,49,-8],[2,2,16],"metal"),B([-15,49,-7],[5,2,2],"metal"),B([-15,49,5],[5,2,2],"metal"));
for(const z of [-8,4])for(const x of [-15,-14])frame.push(P("61678",[x,51,z],"black",z<0?0:180));
frame.push(B([5,43,-3],[8,4,6],"black"));
for(const x of [5,7,9,11])for(const z of [-3,1])frame.push(P("15068",[x,44,z],"black",z<0?0:180));
frame.push(B([-1,19,-5],[4,7,1],"metal"),B([-1,21,-4],[16,2,1],"black"));
for(const x of [0,4,8])frame.push(P("61678",[x,23,-4],"bike",270));
frame.push(...beam([0,23,-4],[-3,25,-6],"metal",1),...beam([0,23,3],[5,31,5],"metal",1),B([-5,23,-7],[6,1,4],"black"),B([2,30,4],[6,1,4],"black"));
frame.push(floor({at:[3,0,-8],size:[8,3],colour:"dark bluish grey",layers:1,top:"tile"}),...beam([7,1,-7],[8,32,1],"dark bluish grey",1));
section("Diamond frame and pedals",frame);
const torso=[];
const rx=[4,6,7,8,8,8,7,6,4],rz=[4,5,6,7,7,7,6,5,4];
for(let k=0;k<rx.length;k++){const y=47+3*k;for(let z=-rz[k];z<rz[k];z++){const w=Math.max(3,Math.round(rx[k]*Math.sqrt(Math.max(0,1-Math.pow((z+0.5)/rz[k],2)))));const left=6-w;torso.push(B([left,y,z],[2*w,3,1],"bird"));if((z+rz[k])%2===0&&!(k===6&&z===-6))torso.push(P("11477",[left,y,z],"bird",90),P("11477",[6+w-2,y,z],"bird",270));}}
section("Sculpted white body",torso);
function foot(x,y,z){const ops=[B([x,y,z],[6,1,4],"feet")];for(let j=0;j<4;j++){const middle=x>0&&(j===1||j===2);const heel=x<0&&j>=2;ops.push(P("11477",[x,y+1,z+j],"feet",90),P(middle?"3023b":"3069b",[x+2,y+1,z+j],"feet"),P(heel?"3023b":"3069b",[x+4,y+1,z+j],"feet"));}return ops;}
section("Webbed feet in mid pedal",[...beam([2,49,-5],[-5,38,-5],"feet",2),...beam([-5,38,-5],[-2,26,-5],"feet",2),...beam([8,49,5],[10,40,5],"feet",2),...beam([10,40,5],[5,33,5],"feet",2),...foot(-6,24,-7),...foot(2,31,4)]);
function wing(z){const ops=[];const stages=[[-12,50,8],[-4,54,4],[0,58,4],[4,62,8]];ops.push(...beam([8,64,z+1],[-11,50,z+1],"bird",1));for(const [x,y,w] of stages){ops.push(B([x,y,z],[w,3,3],"bird"));for(let a=0;a<w;a+=4)for(let j=0;j<3;j++)ops.push(P("61678",[x+a,y+3,z+j],a===4&&x===4&&j===0?"black":"bird",90));}return ops;}
section("Wings steering the handlebars",[...wing(-8),...wing(5)]);
const tail=[B([12,44,-3],[12,3,6],"bird"),B([12,47,-3],[8,3,6],"bird")];
for(let z=-3;z<3;z++)tail.push(P("42022",[14,50,z],"bird",270),P("61678",[20,47,z],z===-3||z===2?"light bluish grey":"bird",270));
section("Swept feather tail",tail);
const neck=[];
const neckX=[-5,-6,-7,-8,-9,-10,-10];
for(let k=0;k<neckX.length;k++){const y=65+k*3;neck.push(B([neckX[k],y,-3],[6,3,6],"bird"));if(k>=3)for(let z=-3;z<3;z+=2)neck.push(P("11477",[neckX[k],y,z],"bird",90),P("11477",[neckX[k]+4,y,z],"bird",270));}
neck.push(B([-13,86,-4],[9,9,8],"bird"),B([-12,95,-2],[8,3,4],"bird"));
for(const y of [86,89,92])for(let z=-4;z<4;z+=2)neck.push(P("11477",[-6,y,z],"bird",270));
for(const x of [-12,-10,-8,-6])neck.push(P("15068",[x,95,-4],"bird"),P("15068",[x,95,2],"bird",180));
neck.push(P("3003pe2",[-10,92,-4],"white"),P("3003pe2",[-10,92,2],"white",180));
for(let z=-2;z<2;z++)neck.push(P("42022",[-9,98,z],"bird",270));
section("Long neck and bright eyed head",neck);
const bill=[];
const strips=[[-36,2],[-28,4],[-20,6]];
for(const [x,d] of strips){bill.push(B([x,85,-Math.round(d/2)],[8,4,d],"orange"));for(let z=-Math.round(d/2);z<Math.round(d/2);z+=2)bill.push(P("42918",[x,89,z],"bill",90));}
bill.push(P("3034",[-36,87,-1],"yellow"),P("4282",[-28,87,-1],"yellow"),P("4282",[-36,88,-1],"yellow"),P("3034",[-20,88,-1],"yellow"));
for(const [x,y,d] of [[-28,81,4],[-24,77,6],[-20,74,8],[-16,77,8]]){bill.push(B([x,y,-Math.round(d/2)],[4,85-y,d],"pouch"));for(let z=-Math.round(d/2);z<Math.round(d/2);z++)bill.push(P("13547",[x,y,z],"pouch",90));}
for(let z=-1;z<1;z++)bill.push(P("11477",[-38,86,z],"orange",90));
bill.push(P("64648",[-30,86,-2],"medium azure",90));
section("Golden bill with fish and pendulous pouch",bill);