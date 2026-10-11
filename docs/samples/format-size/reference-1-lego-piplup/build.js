script({title:"Piplup — A Little Bubble of Pride",description:"A freestanding, round-headed Piplup with a white bib, yellow webbed feet, a sculpted blue hood and a bubble balanced on its outstretched flipper.",palette:{hood:"blue",body:"medium azure",bib:"white",gold:"yellow"}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
component("webbed foot",{size:[3,4],ops:[p("3021",[0,0,0],"gold"),p("3021",[0,0,2],"gold"),range(3).map(x=>p("11477",[x,1,0],"gold")),box({at:[0,1,2],size:[3,3,2],colour:"gold",interior:"solid",top:"tile"})]});
section("Waddling feet",[instance({component:"webbed foot",at:[-3,0,-4]}),instance({component:"webbed foot",at:[0,0,-3]}),floor({at:[-2,4,-1],size:[4,4],colour:"body"})]);
section("Rounded body and white bib",[
box({at:[-2,5,-1],size:[4,12,4],colour:"body",top:"tile"}),
box({at:[-3,9,-2],size:[6,5,6],colour:"body",top:"tile"}),
range(-2,2).map(x=>p("24201",[x,5,-3],"bib")),
range(-2,2).map(x=>p("24201",[x,5,2],"body",180)),
[0,1].map(z=>[p("24201",[-3,5,z],"body",90),p("24201",[1,5,z],"body",270)]),
box({at:[-2,9,-3],size:[4,2,2],colour:"bib",interior:"solid",top:"tile"}),
[-2,0].map(x=>p("15068",[x,11,-3],"bib")),
box({at:[-2,14,-2],size:[4,3,2],colour:"body",interior:"solid",top:"tile"}),
[-2,1].map(x=>p("3062b",[x,14,-2],"bib")),
[-2,0].map(x=>p("15068",[x,14,2],"hood",180)),
p("15068",[-3,14,0],"body",90),p("15068",[1,14,0],"body",270),
[-3,2].map(x=>[p("11477",[x,14,-2],"body"),p("11477",[x,14,2],"hood",180)])]);
section("Flippers and little tail",[
[0,1].map(z=>p("24201",[-5,7,z],"body",90)),
box({at:[-5,11,0],size:[2,2,2],colour:"body",interior:"solid"}),
p("3020",[-4,13,0],"body"),p("15068",[-5,14,0],"body",90),
floor({at:[1,11,0],size:[6,2],colour:"body"}),p("15068",[3,12,0],"body",270),
[0,1].map(z=>p("11477",[5,12,z],"body",90)),
p("30151a",[5,15,0],"trans light blue"),
p("3020",[-1,8,2],"hood",90),[-1,0].map(x=>p("93273",[x,9,3],"hood"))]);
function cheek(x,eyeX){return [range(2).map(i=>p("24201",[x+i,23,-4],"bib")),box({at:[x,27,-3],size:[2,3,1],colour:"bib",interior:"solid"}),p("3005pe4",[eyeX,27,-4],"bib"),p("3005",[eyeX===x?x+1:x,27,-4],"bib"),p("15068",[x,30,-4],"bib")];}
section("Sculpted hood and face",[
p("54091",[-4,17,-3],"hood"),
box({at:[-4,23,-3],size:[8,10,8],colour:"hood",top:"tile"}),
p("54095",[-4,33,-3],"hood"),
cheek(-3,-2),cheek(1,1),
p("3039",[-1,30,-4],"body"),
p("3660b",[-1,23,-5],"gold"),p("3023b",[-1,26,-5],"black"),p("3298",[-1,27,-6],"gold"),
[-1,1].map(z=>[p("15068",[-4,30,z],"hood",90),p("15068",[2,30,z],"hood",270)])]);