script({title:"Piplup — A Proud Little Wave",description:"A large freestanding Piplup with an exuberantly raised flipper, rounded navy hood, snowy eye patches, sparkling eyes, smiling golden beak, two white belly buttons, staggered webbed feet and a little forked tail.",palette:{blue:"medium azure",hood:"dark blue",snow:"white",gold:"yellow",ink:"black"},defaults:{interior:"empty"}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function oval(w,d,y,h,c,clip=2){const l=-w/2,r=w/2-1,f=-d/2,b=d/2-1;let a=[wall({from:[l+clip,f],to:[r-clip,f],y,height:h,colour:c}),wall({from:[l+clip,b],to:[r-clip,b],y,height:h,colour:c}),wall({from:[l,f+clip],to:[l,b-clip],y,height:h,colour:c}),wall({from:[r,f+clip],to:[r,b-clip],y,height:h,colour:c})];for(let i=0;i<clip;i++){for(const z of [f+i,b-i]){for(const x of [l+clip-1-i,r-clip+i]){if(h===18||h===24){a.push(P("2454b",x,y,z,c));if(h===18)a.push(P("3004",x,y+15,z,c));else a.push(P("14716",x,y+15,z,c),P("14716",x+1,y+15,z,c));}else a.push(box({at:[x,y,z],size:[2,h,1],colour:c,interior:"solid",open:["top"]}));}}}return a;}
function rim(part,w,d,y,dep,c,stride=1,sides=true){let a=[];for(let x=-w/2+dep;x<w/2-dep;x+=stride){a.push(P(part,x,y,-d/2,c),P(part,x,y,d/2-dep,c,180));}if(sides)for(let z=-d/2+dep;z<d/2-dep;z+=stride){a.push(P(part,-w/2,y,z,c,90),P(part,w/2-dep,y,z,c,270));}return a;}
function foot(x,z){return [floor({at:[x,0,z],size:[8,11],layers:2,colour:"gold",top:"tile"}),box({at:[x+1,2,z+4],size:[6,3,7],colour:"gold",top:"tile"}),...range(8).map(i=>P("61678",x+i,2,z,"gold")),...range(3).map(i=>P("50950",x+1+2*i,5,z+4,"gold",180))];}
section("Staggered golden webbed feet",[foot(-10,-12),foot(2,-9)]);
section("Pear-shaped body",[
...oval(14,10,5,7,"blue",2),...oval(18,14,12,6,"blue",2),...oval(22,18,18,18,"blue",3),...oval(18,14,36,9,"blue",2),...oval(12,10,45,6,"hood",2),
...rim("3660b",22,18,15,2,"blue",2),...rim("3678b",22,18,36,2,"blue",2),...rim("61678",18,14,42,4,"blue"),
floor({at:[-8,18,-10],size:[16,4],layers:1,colour:"blue"}),floor({at:[-8,36,-10],size:[16,4],layers:1,colour:"blue",top:"tile"}),
...range(8).map(k=>P("2454b",-8+2*k,19,-10,"blue")),...range(4).map(k=>P("3010",-8+4*k,34,-10,"blue")),
...range(10).map(i=>P("3747b",-10+2*i,36,-9,"hood")),...range(10).map(i=>P("24309",-10+2*i,39,-9,"hood")),
floor({at:[-7,21,-11],size:[14,3],layers:1,colour:"blue"}),floor({at:[-6,45,-5],size:[12,10],layers:1,colour:"hood"})]);
function button(x){return [P("3004",x+1,22,-11,"snow"),P("3010",x,25,-11,"snow"),P("3010",x,28,-11,"snow"),P("37352",x+1,31,-11,"snow")];}
section("Two snowy belly buttons",[button(-7),button(3)]);
section("Rounded navy head and hood",[
...oval(18,12,45,6,"hood",2),...oval(22,16,51,6,"hood",2),...oval(26,20,57,6,"hood",3),...oval(30,24,63,24,"hood",3),...oval(26,20,87,6,"hood",3),...oval(20,14,93,6,"hood",3),...oval(14,8,99,3,"hood",2),
...rim("3660b",24,18,51,2,"hood",2,false),...rim("3660b",28,22,57,2,"hood",2),...rim("3660b",30,24,60,2,"hood",2),
...rim("3678b",30,24,87,2,"hood",2),...rim("24309",26,20,93,3,"hood",2),...rim("24309",20,14,96,3,"hood",2),...rim("24309",14,8,99,3,"hood",2),
floor({at:[-12,60,-13],size:[24,5],layers:1,colour:"blue"}),floor({at:[-12,84,-13],size:[24,5],layers:1,colour:"hood",top:"tile"}),floor({at:[-4,102,-1],size:[8,2],layers:1,colour:"hood",top:"tile"}),
floor({at:[-10,87,-6],size:[20,12],layers:1,colour:"hood"}),box({at:[-2,87,-1],size:[4,15,2],colour:"hood",interior:"solid"})]);
const faceWidths=[20,24,28,28,28,28,28,24,20];
function faceColour(r,x){const a=Math.abs(x+1);let c="blue";if(r>=2&&r<=7&&a>=4&&a<=11)c="snow";if(r>=4&&a<=(r-3)*2)c="hood";return c;}
const face=[];for(let r=0;r<faceWidths.length;r++){const w=faceWidths[r];for(let x=-w/2;x<w/2;){let c=faceColour(r,x);let n=2;if(x+2<w/2&&faceColour(r,x+2)===c)n=4;face.push(P(n===4?"3010":"3004",x,61+3*r,-13,c));x+=n;}}
section("Twin-lobed face mask",[face]);
function eye(x){return [P("3004",x+1,70,-14,"ink"),P("3010",x,73,-14,"ink"),P("3005",x,76,-14,"ink"),P("3005",x+1,76,-14,"snow"),P("3005",x+2,76,-14,"ink"),P("3005",x+3,76,-14,"ink"),P("37352",x+1,79,-14,"ink")];}
section("Bright eyes and smiling beak",[
floor({at:[-11,69,-14],size:[22,4],layers:1,colour:"snow"}),eye(-10),eye(6),
box({at:[-3,66,-16],size:[6,3,3],colour:"gold",top:"tile"}),...range(6).map(i=>P("13547",-3+i,66,-17,"gold")),
floor({at:[-4,69,-17],size:[8,5],layers:1,colour:"gold"}),floor({at:[-3,69,-17],size:[6,2],layers:1,colour:"ink",top:"tile"}),...range(8).map(i=>P("61678",-4+i,70,-17,"gold"))]);
function wingBand(x,y,w){return [box({at:[x,y,-2],size:[w,9,6],colour:"blue",open:["top"]}),...range(w).map(i=>P("50950",x+i,y+3,-4,"blue")),...range(w).map(i=>P("50950",x+i,y+3,2,"blue",180))];}
section("Raised left flipper",[
wingBand(-14,27,4),wingBand(-17,33,6),wingBand(-20,39,6),box({at:[-22,45,-2],size:[6,6,6],colour:"blue",open:["top"]}),
...range(6).map(i=>P("50950",-22+i,48,-4,"blue")),...range(6).map(i=>P("50950",-22+i,48,2,"blue",180)),
...range(6).map(i=>P("61678",-22+i,51,-2,"blue")),...range(3).map(i=>P("15068",-22+2*i,51,2,"blue",180))]);
section("Relaxed right flipper",[
box({at:[15,18,-1],size:[3,6,5],colour:"blue",open:["top"]}),box({at:[13,24,-2],size:[5,9,6],colour:"blue",open:["top"]}),box({at:[11,33,-2],size:[5,6,6],colour:"blue",open:["top"]}),
...range(3).map(i=>P("24201",15+i,18,-3,"blue")),...range(5).map(i=>P("50950",13+i,27,-4,"blue")),...range(5).map(i=>P("50950",13+i,27,2,"blue",180)),...range(5).map(i=>P("61678",11+i,39,-2,"blue")),...range(2).map(i=>P("15068",11+2*i,39,2,"blue",180))]);
section("Little forked tail",[box({at:[-3,12,7],size:[6,6,6],colour:"blue",top:"tile"}),floor({at:[-4,17,8],size:[8,6],layers:1,colour:"blue"}),P("41769a",-4,18,10,"blue",180),P("41770a",2,18,10,"blue",180),...range(4).map(i=>P("61678",-2+i,18,9,"blue",180))]);