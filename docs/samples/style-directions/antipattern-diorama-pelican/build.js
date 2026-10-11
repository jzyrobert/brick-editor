script({title:"Pelican on the coastal cycleway",description:"A great white pelican pedals a scarlet bicycle along a sea-blue promenade. A long pointed bill, deep throat pouch, wings on the handlebars and orange webbed feet define the rider.",palette:{sand:"tan",sea:"medium azure",path:"dark tan",frame:"red"}});
const W=48,D=28,ground=4;
section("Connected coastal display",[
 floor({at:[0,0,0],size:[W,D],layers:2,colour:"black"}),floor({at:[0,2,0],size:[W,7],colour:"sea",top:"tile"}),floor({at:[0,2,7],size:[W,21],colour:"sand"}),floor({at:[0,3,7],size:[W,5],colour:"sand"}),floor({at:[0,3,12],size:[W,8],colour:"path",top:"tile"}),floor({at:[0,3,20],size:[W,8],colour:"sand"})
]);
function wheel(cx){
 const ops=[],rows=12,cols=14,left=cx-7;
 for(let j=0;j<rows;j++){
  const cells=range(cols).map(i=>{const r=Math.sqrt(Math.pow((i-6.5)/7,2)+Math.pow((j-5.5)/6,2));return r<=1&&r>0.53?(r>0.70?"black":"light bluish grey"):null;});
  for(let i=0;i<cols;){const c=cells[i];if(!c){i++;continue;}const n=i+1<cols&&cells[i+1]===c?2:1;ops.push(place({part:n===2?"3003":"3004",at:[left+i,ground+3*j,13],colour:c,turn:n===2?0:90}));i+=n;}
 }
 ops.push(line({from:[cx-5,22,13],to:[cx+5,22,13],colour:"light bluish grey"}),line({from:[cx,8,13],to:[cx,36,13],colour:"light bluish grey"}),line({from:[cx-3,13,13],to:[cx+3,31,13],colour:"light bluish grey"}),line({from:[cx-3,31,13],to:[cx+3,13,13],colour:"light bluish grey"}),box({at:[cx-1,21,12],size:[2,3,4],colour:"dark bluish grey",interior:"solid"}));return ops;
}
section("Two spoked wheels",[wheel(11),wheel(32)]);
function tube(a,b,colour="frame"){return line({from:a,to:b,colour});}
section("Diamond bicycle frame",[
 tube([11,22,15],[18,40,15]),tube([11,22,15],[22,24,15]),tube([18,40,15],[22,24,15]),tube([18,40,15],[28,40,15]),tube([28,40,15],[22,24,15]),tube([22,24,15],[32,22,15]),tube([28,40,15],[29,44,15]),tube([29,44,15],[32,22,15],"dark bluish grey"),tube([18,35,15],[18,42,15],"dark bluish grey"),box({at:[15,42,12],size:[8,2,6],colour:"black",interior:"solid"}),tube([29,44,9],[29,44,21],"dark bluish grey"),box({at:[28,44,8],size:[3,2,3],colour:"black",interior:"solid"}),box({at:[28,44,19],size:[3,2,3],colour:"black",interior:"solid"}),tube([22,24,10],[22,24,19],"dark bluish grey"),tube([22,24,10],[24,28,10],"dark bluish grey"),tube([22,24,19],[20,20,19],"dark bluish grey"),box({at:[23,27,9],size:[4,1,3],colour:"black",interior:"solid"}),box({at:[18,19,18],size:[4,1,3],colour:"black",interior:"solid"}),tube([11,22,12],[22,24,12],"black")
]);
function ovalCourse(cx,cz,w,d,y,solid){
 const ops=[],x0=cx-Math.floor(w/2),z0=cz-Math.floor(d/2);
 const inside=(i,k)=>i>=0&&i<w&&k>=0&&k<d&&Math.pow((i-(w-1)/2)/(w/2),2)+Math.pow((k-(d-1)/2)/(d/2),2)<=1;
 for(let k=0;k<d;k++){
  let start=-1,end=-1;const needed=[];
  for(let i=0;i<w;i++){needed[i]=inside(i,k)&&(solid||!inside(i-1,k)||!inside(i+1,k)||!inside(i,k-1)||!inside(i,k+1)||i===Math.floor(w/2));if(inside(i,k)){if(start<0)start=i;end=i;}}
  for(let i=0;i<w;){if(!needed[i]){i++;continue;}const n=i+1<w&&needed[i+1]?2:1;ops.push(place({part:n===2?"3004":"3005",at:[x0+i,y,z0+k],colour:"white"}));i+=n;}
  if(start>=0)ops.push(floor({at:[x0+start,y+3,z0+k],size:[end-start+1,1],colour:"white"}));
 }return ops;
}
const profiles=[[8,6],[12,8],[14,10],[14,10],[12,8],[8,6]];
section("Hollow sculpted pelican body",profiles.map((p,j)=>ovalCourse(19,15,p[0],p[1],44+4*j,j===0||j===profiles.length-1)));
function steeringWing(z){const edge=z===19?z+2:z;return [box({at:[16,56,z],size:[5,3,3],colour:"white",interior:"solid"}),box({at:[20,53,z],size:[5,3,3],colour:"white",interior:"solid"}),box({at:[24,50,z],size:[4,3,3],colour:"white",interior:"solid"}),box({at:[27,46,z],size:[3,4,3],colour:"white",interior:"solid"}),place({part:"61678",at:[16,59,edge],colour:"white",turn:270}),place({part:"61678",at:[20,56,edge],colour:"white",turn:270}),place({part:"61678",at:[24,53,edge],colour:"white",turn:270}),place({part:"11477",at:[28,50,edge],colour:"white",turn:270})];}
section("Wings steering and feathered tail",[
 steeringWing(8),steeringWing(19),box({at:[11,49,12],size:[5,3,6],colour:"white",interior:"solid"}),floor({at:[9,52,12],size:[7,6],colour:"white"}),range(5).map(i=>place({part:"61678",at:[9,53,13+i],colour:i===0?"light bluish grey":"white",turn:90})),[[16,12],[18,12],[20,12],[22,13],[18,14],[20,14],[18,16],[20,16]].map(p=>place({part:"15068",at:[p[0],68,p[1]],colour:"white",turn:p[1]>=15?180:0}))
]);
section("Long neck, watchful head and bill pouch",[
 box({at:[23,59,12],size:[4,9,6],colour:"white"}),box({at:[24,68,12],size:[3,9,5],colour:"white"}),box({at:[25,77,12],size:[4,7,5],colour:"white"}),box({at:[26,81,11],size:[6,9,7],colour:"white"}),place({part:"3005",at:[30,86,11],colour:"black"}),place({part:"3005",at:[30,86,17],colour:"black"}),[26,28,30].map(x=>[12,14,16].map(z=>place({part:"15068",at:[x,90,z],colour:"white",turn:z>=15?180:0}))),[68,71,74].map((y,i)=>[12,16].map(z=>place({part:"61678",at:[i===2?25:24,y,z],colour:"white",turn:270}))),box({at:[32,79,12],size:[4,7,5],colour:"orange"}),box({at:[36,80,12],size:[3,6,5],colour:"orange"}),box({at:[39,83,13],size:[3,3,3],colour:"orange"}),box({at:[33,77,13],size:[5,3,3],colour:"tan",interior:"solid"}),[12,16].map(z=>place({part:"13547",at:[33,77,z],colour:"tan",turn:270})),[32,36,40].map(x=>[12,15].map(z=>place({part:"3710",at:[x,85,z],colour:"black"}))),floor({at:[32,86,12],size:[12,4],colour:"orange"}),floor({at:[44,86,13],size:[2,2],colour:"orange"}),[13,14].map(z=>place({part:"54200",at:[45,87,z],colour:"orange",turn:270}))
]);
function leg(a,knee,to,foot){return [tube(a,knee,"orange"),tube(knee,to,"orange"),floor({at:foot,size:[4,3],colour:"orange"}),range(3).map(i=>place({part:"54200",at:[foot[0]+3,foot[1]+1,foot[2]+i],colour:"orange",turn:270}))];}
section("Pedalling webbed feet",[leg([18,45,13],[20,36,10],[24,28,10],[23,28,9]),leg([18,45,17],[16,32,19],[20,20,19],[18,20,18])]);
function duneGrass(x,z){return [place({part:"3005",at:[x,4,z],colour:"tan"}),place({part:"30176",at:[x,7,z],colour:"sand green"})];}
section("Sea spray, lane markings and dune grass",[
 range(8).map(i=>place({part:"2431",at:[2+6*i,4,12],colour:"white"})),range(10).map(i=>place({part:"2431",at:[1+4*i,3,i%2===0?2:4],colour:"white"})),[[3,24],[9,25],[38,25],[44,24]].map(p=>duneGrass(p[0],p[1])),[[1,8],[7,8],[18,8],[28,8],[40,8],[46,8]].map((p,i)=>place({part:"15068",at:[p[0],4,p[1]],colour:i%2?"dark tan":"tan",turn:90})),fence({path:[[1,27],[46,27]],y:4,colour:"reddish brown",style:"lattice-low"})
]);