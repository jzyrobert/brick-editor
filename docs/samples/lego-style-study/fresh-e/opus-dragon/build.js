script({title:"Ruin Keeper",description:"A dark red dragon claws over a broken castle battlement, wings flared high, scorching the approach with a jet of fire.",palette:{body:"dark red",belly:"tan",wing:"dark orange",spike:"black",horn:"tan",stone:{mix:["light bluish grey","light bluish grey","light bluish grey","dark bluish grey"]}}});
const B=(at,size,colour,o={})=>box(Object.assign({at,size,colour,top:"tile"},o));
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
// broken battlement
const wallH=[3,6,9,12,12,15,15,12,12,15,15,12,12,12,12,15,15,9];
const wallOps=[];let s0=0;
for(let i=1;i<=wallH.length;i++){if(i===wallH.length||wallH[i]!==wallH[s0]){wallOps.push(box({at:[-10+s0,0,-12],size:[i-s0,wallH[s0],2],colour:"stone",texture:"masonry",top:"tile"}));s0=i;}}
section("Battlement",[...wallOps,
 P("3004",[-14,0,-15],"dark bluish grey",90),P("3005",[-12,0,-14],"light bluish grey"),P("3024",[-12,3,-14],"dark bluish grey"),P("3062b",[-13,0,-12],"light bluish grey"),P("3040b",[-11,0,-16],"dark bluish grey",270),P("98283",[-16,0,-12],"light bluish grey"),
 P("4589",[-5,15,-12],"trans orange"),P("6141",[-4,15,-11],"trans yellow"),P("3005",[6,15,-12],"trans orange"),P("4589",[6,18,-12],"trans yellow"),P("6141",[5,15,-11],"trans red"),P("4589",[-8,9,-12],"trans orange"),P("3024",[-9,6,-11],"trans red")]);
// fire jet
const jcol=["trans yellow","trans orange","trans yellow","trans orange","trans orange","trans yellow","trans orange","trans red","trans orange","trans yellow","trans orange","trans red","trans orange","trans red","trans orange"];
const jet=[P("3001",[-1,45,-19],"trans orange",90),P("3941",[-1,48,-19],"trans yellow"),P("4589",[-1,51,-19],"trans yellow"),P("54200",[0,51,-18],"trans orange"),P("3941",[-1,50,-16],"trans orange"),P("3062b",[0,50,-14],"trans yellow")];
for(let i=1;i<=15;i++){jet.push(P(i%2?"3941":"3003",[-1,45-3*i,-18-Math.round((i-1)*7/14)],jcol[i-1]));}
jet.push(P("4589",[-3,0,-25],"trans yellow"),P("3005",[-2,0,-27],"trans orange"),P("4589",[-2,3,-27],"trans yellow"),P("6141",[1,0,-27],"trans red"),P("4589",[2,0,-25],"trans orange"),P("3062b",[1,0,-23],"trans red"),P("4589",[1,3,-23],"trans orange"),P("6141",[-2,0,-22],"trans yellow"),P("3024",[-3,0,-23],"trans red"),P("4589",[0,0,-27],"trans orange"),P("3005",[2,0,-23],"trans yellow"),P("4589",[2,3,-23],"trans yellow"));
section("Fire",jet);
// body
section("Body",[
 B([-4,12,6],[8,15,6],"body"),B([-4,15,-2],[8,15,8],"body"),B([-3,18,-5],[6,15,4],"body"),B([-2,18,-6],[4,15,1],"belly"),
 B([4,24,0],[2,9,4],"body"),B([-6,24,0],[2,9,4],"body"),
 ...[6,8,10].flatMap(z=>[P("15068",[-4,24,z],"body",90),P("15068",[2,24,z],"body",270)]),
 P("3039",[-1,30,0],"spike",180),P("3039",[-1,30,3],"spike",180),P("3039",[-1,27,7],"spike",180),P("3039",[-1,27,10],"spike",180),
 // right arm braced on the wall
 B([3,15,-6],[2,12,3],"body"),B([3,12,-12],[2,3,9],"body"),P("15068",[3,24,-6],"body",270),P("27261",[3,15,-12],"spike"),
 // left arm raised, claws open
 B([-5,21,-6],[2,6,3],"body"),B([-5,18,-11],[2,3,8],"body"),B([-5,21,-11],[2,3,2],"body"),P("27261",[-5,24,-11],"spike"),P("15068",[-5,24,-6],"body",90),
 mirror({axis:"x",about:0,ops:[B([3,12,3],[4,12,8],"body"),B([4,3,6],[3,9,4],"body"),B([4,0,1],[3,3,9],"body"),...[3,5,7,9].map(z=>P("15068",[5,21,z],"body",270)),P("27261",[4,3,1],"spike"),P("54200",[6,3,1],"spike")]})
]);
// neck and head
const nz=[-6,-7,-8,-8,-9,-9,-9];
const neck=nz.flatMap((z0,k)=>{const y=33+3*k;return [B([-2,y,z0],[4,3,1],"belly"),B([-2,y,z0+1],[4,3,3],"body")];});
nz.forEach((z0,k)=>{if(k<nz.length-1&&nz[k+1]<z0){const yt=36+3*k,b=z0+3;neck.push(P("3039",[-1,yt,b],"spike",180),P("54200",[-2,yt,b],"body",180),P("54200",[1,yt,b],"body",180));}});
section("Neck and head",[...neck,
 B([-3,54,-12],[6,6,7],"body"),B([-3,48,-12],[6,6,3],"body"),B([-2,54,-18],[4,4,6],"body"),
 box({at:[-2,48,-17],size:[4,1,5],colour:"belly"}),box({at:[-2,49,-17],size:[4,1,5],colour:"body"}),
 ...[[-2,-17],[1,-17],[-2,-14],[1,-14]].map(([x,z])=>P("15070",[x,50,z],"white")),
 P("3062b",[-3,57,-12],"trans yellow"),P("3062b",[2,57,-12],"trans yellow"),P("54200",[-3,60,-12],"spike"),P("54200",[2,60,-12],"spike"),
 P("4460b",[-3,60,-9],"horn",180),P("4460b",[2,60,-9],"horn",180),P("3040b",[-3,60,-7],"horn",180),P("3040b",[2,60,-7],"horn",180),P("3039",[-1,60,-9],"spike",180),
 P("98138",[-2,58,-17],"black"),P("98138",[1,58,-17],"black"),P("85984",[-2,58,-18],"body"),P("85984",[0,58,-18],"body")]);
// wings
const tips=[[6,27],[10,22],[16,20],[22,25],[26,33]],dip=[2,6,7,3];
const wt=x=>x<=16?36+2*(x-6):56-2*(x-16);
const wb=x=>{for(let i=0;i<4;i++){const [ax,ay]=tips[i],[bx,by]=tips[i+1];if(x>=ax&&x<=bx){const t=(x-ax)/(bx-ax);return Math.round(ay+(by-ay)*t+dip[i]*Math.sin(Math.PI*t));}}return 30;};
const zw=x=>1+Math.round(3*Math.sin(Math.PI*(x-6)/24));
const fingers=[[16,54,10,22],[16,54,22,25]];
const bone=(x,y)=>{if(y>=wt(x)-2||x===16)return true;for(const [ax,ay,bx,by] of fingers){const lo=Math.min(ax,bx),hi=Math.max(ax,bx);if(x<lo||x>hi)continue;const f=v=>ay+(by-ay)*(Math.max(lo,Math.min(hi,v))-ax)/(bx-ax);const a=f(x-0.5),b=f(x+0.5);if(y>=Math.floor(Math.min(a,b))&&y<=Math.ceil(Math.max(a,b)))return true;}return false;};
const wing=[];
for(let x=6;x<=26;x++){const z1=zw(x),za=x>6?Math.min(z1,zw(x-1)):z1,zb=x>6?Math.max(z1,zw(x-1)):z1;const lo=wb(x),hi=wt(x);let s=lo;
 for(let y=lo+1;y<=hi;y++){if(y===hi||bone(x,y)!==bone(x,s)){wing.push(box({at:[x,s,za],size:[1,y-s,zb-za+1],colour:bone(x,s)?"body":"wing",interior:"solid"}));s=y;}}
 if(x!==16)wing.push(P("54200",[x,hi,z1],"body",x<16?90:270));
 for(let z=za;z<=zb;z++)if(z!==z1)wing.push(P("3070b",[x,hi,z],"body"));}
wing.push(P("4589",[16,56,zw(16)],"spike"));
section("Wings",[mirror({axis:"x",about:0,ops:wing})]);
// tail sweeping round to a raised spade
section("Tail",[
 B([-3,9,12],[6,12,3],"body"),B([-3,6,15],[6,9,2],"body"),B([-2,3,17],[4,7,2],"body"),B([-2,0,19],[4,6,3],"body"),
 B([-1,0,21],[5,5,3],"body"),B([3,0,21],[6,4,3],"body"),B([8,0,19],[4,4,4],"body"),B([10,0,15],[3,3,5],"body"),B([11,0,12],[2,3,4],"body"),B([11,0,11],[2,9,2],"body"),
 P("3039",[-1,21,13],"spike",180),P("3039",[-1,15,15],"spike",180),P("3039",[-1,10,17],"spike",180),P("3039",[-1,6,19],"spike",180),
 P("3039",[5,4,21],"spike",270),P("3039",[9,4,20],"spike",270),P("3039",[10,3,16],"spike",0),
 P("3660b",[11,9,10],"spike"),P("3039",[11,12,10],"spike"),P("3069b",[11,9,12],"body")]);