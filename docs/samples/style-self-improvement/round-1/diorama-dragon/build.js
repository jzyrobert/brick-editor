script({title:"The Ember Nursery",description:"A great garnet dragon shelters a clutch of eggs with vast scalloped wings. Its watchful horned head bends over the warm nest while four clawed feet and a curling armored tail grip a basalt island in a molten river.",palette:{hide:"dark red",membrane:"tan",horn:"pearl gold",belly:"dark tan",rock:{mix:["dark bluish grey","dark bluish grey","light bluish grey"]}},defaults:{interior:"empty"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour,extra={})=>box({at,size,colour,...extra});
const site=[floor({at:[0,0,0],size:[48,36],layers:2,colour:"black"}),floor({at:[1,2,1],size:[46,34],colour:"dark bluish grey"}),floor({at:[3,3,3],size:[42,6],colour:"dark orange",top:"tile"}),floor({at:[3,3,9],size:[13,8],colour:"orange",top:"tile"}),B([12,3,17],[30,3,15],"rock"),floor({at:[12,3,12],size:[9,8],layers:3,colour:"rock"}),floor({at:[28,3,13],size:[8,8],layers:3,colour:"rock"}),floor({at:[34,3,13],size:[8,13],layers:3,colour:"rock"})];
function rock(x,z,w,d,h){return [B([x,3,z],[w,h,d],"rock"),...range(w/2).flatMap(i=>range(d/2).map(j=>P("3039",[x+2*i,3+h,z+2*j],(i+j)%3===0?"light bluish grey":"dark bluish grey",(i+j)%2?180:0)))];}
[[2,19,6,6,3],[3,29,4,4,3],[42,17,4,6,6]].forEach(a=>site.push(...rock(...a)));
for(let i=0;i<5;i++)site.push(P("3069b",[7+2*i,4,4+i%3],i%3===0?"trans yellow":"orange"));
[[4,11],[18,5],[43,7]].forEach(([x,z])=>site.push(P("3062b",[x,4,z],"trans yellow"),P("18395",[x,7,z],"orange")));
section("Basalt island and molten river",site);
const nest=[floor({at:[4,3,6],size:[10,12],colour:"dark bluish grey"}),floor({at:[6,4,8],size:[6,9],colour:"dark orange"}),wall({from:[5,7],to:[12,7],y:4,height:3,colour:"dark brown"}),wall({from:[5,17],to:[12,17],y:4,height:3,colour:"dark brown"}),wall({from:[5,8],to:[5,16],y:4,height:3,colour:"dark brown"}),wall({from:[12,8],to:[12,16],y:4,height:3,colour:"dark brown"}),P("3009",[6,7,7],"reddish brown"),P("3009",[6,7,17],"reddish brown"),P("3010",[5,7,10],"reddish brown",90),P("3010",[12,7,10],"reddish brown",90),P("2431",[7,10,7],"dark tan"),P("2431",[7,10,17],"dark tan"),P("2431",[5,10,10],"dark tan",90),P("2431",[12,10,10],"dark tan",90),cylinder({at:[7,5,10],diameter:4,height:6,colour:"white"}),dome({at:[7,11,10],diameter:4,colour:"white"}),P("4032b",[9,5,14],"dark tan"),P("24946",[10,6,15],"white"),P("4032b",[6,5,14],"dark tan"),P("24946",[6,6,15],"tan")];
[[11,14],[11,16],[7,9]].forEach(([x,z])=>nest.push(P("6141",[x,5,z],"pearl gold")));
section("The warm clutch",nest);
const dragon=[B([20,9,20],[8,6,10],"hide"),B([18,15,18],[12,9,14],"hide"),B([20,24,20],[8,9,10],"hide"),B([20,12,17],[8,12,4],"belly"),B([20,24,14],[8,12,7],"hide"),B([19,33,11],[7,9,8],"hide"),B([18,39,11],[7,6,8],"hide")];
function foot(x,z){const ops=[B([x,6,z],[5,3,7],"hide")];for(let i=0;i<5;i++)ops.push(P("11477",[x+i,9,z],"hide"));for(const dx of [0,2,4])ops.push(P("3023b",[x+dx,6,z-1],"hide",90),P("54200",[x+dx,7,z-1],"tan"));return ops;}
[[13,13],[30,14],[13,25],[30,26]].forEach(([x,z])=>dragon.push(...foot(x,z)));
dragon.push(B([14,9,17],[3,12,4],"hide"),B([15,18,18],[5,9,5],"hide"),B([31,9,18],[3,12,4],"hide"),B([28,18,19],[5,9,5],"hide"),B([14,9,28],[6,12,6],"hide"),B([28,9,28],[6,12,6],"hide"));
for(const x of [14,28])for(let i=0;i<3;i++)for(let j=0;j<3;j++)dragon.push(P("15068",[x+2*i,21,28+2*j],"hide",j%2?180:0));
for(let z=18;z<28;z+=2)dragon.push(P("3039",[18,24,z],"hide",90),P("3039",[28,24,z],"hide",270));
for(let x=20;x<28;x+=2){dragon.push(P("3039",[x,15,16],"dark tan"),P("93606",[x,24,14],"dark tan"));for(let z=20;z<30;z+=2)dragon.push(P("15068",[x,33,z],"hide",z>=26?180:0));}
for(const z of [21,23,25,26,28])dragon.push(P("4589",[24,36,z],"horn"));
for(let i=0;i<3;i++)dragon.push(P("15068",[20+2*i,36,12],"hide"));
const tail=[[26,28,6,6,9],[30,30,6,4,6],[34,28,6,4,6],[36,24,4,6,6],[36,20,4,4,6],[34,18,6,2,3]];
const cells={};
tail.forEach(([x,z,w,d,h])=>{dragon.push(B([x,6,z],[w,h,d],"hide"));for(let a=x;a<x+w;a+=2)for(let b=z;b<z+d;b+=2){const k=a+","+b;cells[k]=Math.max(cells[k]||0,6+h);}});
Object.keys(cells).forEach((k,i)=>{const [x,z]=k.split(",").map(Number),y=cells[k];dragon.push(P("15068",[x,y,z],"hide"));if(i%4===0)dragon.push(P("54200",[x,y+3,z+1],"horn",180));});
section("Garnet dragon body and curling tail",dragon);
const tops=[72,78,72,69,63,57,51,45,39],bottoms=[69,57,42,45,30,33,24,27,30];
function wing(right){const ops=[];for(let j=0;j<9;j++){const x=right?44-2*j:2+2*j,shift=right&&j<7?-6:0,lo=bottoms[j]+shift,hi=tops[j]+shift;ops.push(B([x,lo+1,25],[2,hi-lo-1,1],"membrane",{interior:"solid"}),j===8?P("3020",[right?x-2:x,lo,24],"hide"):P("3022",[x,lo,24],"hide"),P("3660b",[x,lo-3,24],"hide"),hi-lo>3&&P("3004",[x,hi-3,25],"hide"),P("3039",[x,hi,24],"hide"));if(j===2||j===6)ops.push(B([x,lo+1,24],[1,hi-lo-1,1],"hide",{interior:"solid"}));if(j===1)ops.push(P("3062b",[x,hi+3,25],"horn"),P("3062b",[x,hi+6,25],"horn"),P("4589",[x,hi+9,25],"horn"));}return ops;}
section("Sheltering scalloped wings",[...wing(false),...wing(true)]);
const head=[B([2,0,0],[6,3,8],"hide",{interior:"solid",top:"tile"}),B([2,3,1],[6,2,7],"black",{interior:"solid"}),B([1,5,0],[8,4,7],"hide",{interior:"solid"}),B([0,5,4],[10,8,8],"hide"),B([1,13,8],[8,2,4],"hide",{top:"tile"}),P("54200",[2,3,0],"tan"),P("54200",[7,3,0],"tan")];
for(let x=1;x<9;x+=2)head.push(P("15068",[x,9,0],"hide"));
head.push(P("98138",[3,12,1],"black"),P("98138",[6,12,1],"black"));
for(const x of [0,9])head.push(P("3005",[x,10,4],"yellow"),P("3024",[x,13,4],"black"),P("3024",[x,13,5],"hide"),P("11477",[x,14,4],"hide"));
for(const x of [2,4,6])head.push(P("93606",[x,13,6],"hide"));
for(const x of [0,9])head.push(P("40379",[x,13,8],"horn"));
head.push(P("3040b",[0,8,8],"dark tan",90),P("3040b",[8,8,8],"dark tan",270),P("54200",[4,17,9],"horn",180));
component("watchful head",{size:[10,13],ops:head});
section("A mother's watchful face",[instance({component:"watchful head",at:[9,35,9],turn:90})]);