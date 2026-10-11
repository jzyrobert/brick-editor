script({title:'LL-928: The Forest Moon Explorer',description:'A 1979 blue-and-grey Galaxy Explorer rebuilt by Ewok astronauts: timber fuselage, fern solar wings, twin yellow cockpits and branch-built rocket pods. Two immense living trees carry space huts, a plank skybridge and forest radar. An acorn fuel rover brings supplies to the launch clearing; a crew member transfers fuel down the skybridge boarding ramp.',palette:{bark:'reddish brown',wood:'dark brown',space:'blue',metal:'light bluish grey',forest:'dark green',stone:{mix:['light bluish grey','light bluish grey','dark bluish grey','dark tan']}},defaults:{interior:'empty'}});
const W=56,D=44,G=5,P=55;
section('Connected display and moon clearing',[
 floor({at:[0,0,0],size:[W,D],layers:3,colour:'black'}),
 floor({at:[0,3,0],size:[W,D],layers:2,colour:'olive green'}),
 floor({at:[2,G,1],size:[41,25],colour:'light bluish grey'}),
 box({at:[0,G,28],size:[W,6,16],colour:'stone',texture:'masonry',supports:8}),
 floor({at:[0,11,28],size:[W,16],colour:'forest'}),
 floor({at:[0,1,0],size:[W,1],colour:'blue'}),
 cylinder({at:[17,6,0],diameter:12,height:3,colour:'stone'}),
 carve({at:[20,6,3],size:[6,6,6]}),
 ...[[21,4],[23,4],[21,6],[23,6]].map(([x,z],i)=>place({part:i===1?'3022':'3068b',at:[x,6,z],colour:i===1?'trans yellow':'dark bluish grey'}))
]);
function tree(x,z,height,ribs){
 const a=[cylinder({at:[x,12,z],diameter:8,height,colour:'bark',texture:'log'})];
 const edges=[[x-1,z+2,90],[x+8,z+4,90],[x+2,z-1,0],[x+4,z+8,0]];
 edges.forEach(([bx,bz,t],j)=>{for(let i=0;i<ribs-j;i++)a.push(place({part:'30136',at:[bx,12+3*i,bz],turn:t,colour:i%7===j?'dark brown':'reddish brown'}));a.push(place({part:'3040b',at:[bx,12+3*(ribs-j),bz],turn:t===90?0:90,colour:'reddish brown'}));});
 for(let k=0;k<4;k++){
  a.push(box({at:[x-3+k,12,z+2],size:[4-k,3+3*k,2],colour:'bark',interior:'solid'}));
  a.push(box({at:[x+6,12,z+3],size:[5-k,3+3*k,2],colour:'bark',interior:'solid'}));
  a.push(box({at:[x+2,12,z-3+k],size:[2,3+3*k,4-k],colour:'bark',interior:'solid'}));
 }
 return a;
}
section('Great trees and buttress roots',[...tree(6,30,96,24),...tree(46,30,114,30)]);
function canopy(x,z,y,positions){
 const a=[];
 positions.forEach(([dx,dz,t],i)=>{
  const lx=x+dx,lz=z+dz,cx=lx+2,cz=lz+3;
  a.push(box({at:[Math.min(x+4,cx),y-3,z+3],size:[Math.abs(x+4-cx)+1,3,1],colour:'bark',interior:'solid'}));
  a.push(box({at:[cx,y-3,Math.min(z+3,cz)],size:[1,3,Math.abs(z+3-cz)+1],colour:'bark',interior:'solid'}));
  a.push(place({part:'2417',at:[lx,y,lz],colour:i%4===0?'green':'dark green',turn:t}));
 });return a;
}
section('Layered living canopy',[
 ...canopy(6,30,94,[[-6,-5,0],[-1,-6,0],[4,-4,0],[9,-1,0],[-5,1,0],[0,0,0],[5,2,0],[-3,7,90],[3,7,90]]),
 ...canopy(6,30,100,[[-3,-3,0],[2,-4,0],[7,0,0],[-2,3,0],[3,3,0]]),
 place({part:'2417',at:[7,108,31],colour:'dark green'}),
 ...canopy(46,30,112,[[-8,-5,0],[-3,-7,0],[2,-5,0],[7,-1,0],[-8,1,0],[-3,0,0],[2,1,0],[6,5,0],[-5,7,90],[1,7,90]]),
 ...canopy(46,30,121,[[-5,-3,0],[0,-4,0],[5,0,0],[-4,3,0],[1,4,0]]),
 column({at:[49,126,33],height:9,diameter:2,colour:'blue'}),
 place({part:'44375b',at:[47,135,31],colour:'light bluish grey'}),
 place({part:'3957a',at:[49,137,33],colour:'red'}),
 place({part:'2417',at:[46,125,30],colour:'dark green'}),
 place({part:'2417',at:[49,126,34],colour:'green'})
]);
function deckBeams(x,w){return [
 ...[31,37].map(z=>box({at:[x,49,z],size:[w,3,2],colour:'dark brown',interior:'solid'})),
 ...[x+4,x+w-6].map(bx=>box({at:[bx,49,18],size:[2,3,22],colour:'dark brown',interior:'solid'}))
 ];}
section('Tree decks and skybridge',[
 ...deckBeams(0,20),...deckBeams(38,18),
 floor({at:[0,52,18],size:[20,22],layers:3,colour:'reddish brown',top:'tile',holes:[{at:[6,30],size:[8,8]},{at:[0,18],size:[4,4]}]}),
 floor({at:[38,52,18],size:[18,22],layers:3,colour:'reddish brown',top:'tile',holes:[{at:[46,30],size:[8,8]}]}),
 box({at:[18,49,33],size:[22,3,1],colour:'dark brown',interior:'solid'}),
 box({at:[18,49,38],size:[22,3,1],colour:'dark brown',interior:'solid'}),
 floor({at:[18,52,33],size:[22,6],layers:2,colour:'dark brown'}),
 ...range(18).map(i=>place({part:[7,8,11,13].includes(i)?'3710':'2431',at:[20+i,54,34],turn:90,colour:i%3===0?'dark tan':'reddish brown'})),
 ...range(7).flatMap(i=>[33,38].map(z=>column({at:[20+i*3,54,z],height:9,colour:'reddish brown'}))),
 ...range(6).flatMap(i=>[33,38].map(z=>place({part:'3623',at:[20+i*3,63,z],colour:'dark tan'}))),
 stairs({at:[0,G,18],width:4,steps:8,dir:'+z',rise:3,colour:'reddish brown'}),
 floor({at:[0,29,25],size:[4,5],colour:'dark tan'}),
 stairs({at:[0,30,29],width:4,steps:8,dir:'-z',rise:3,colour:'reddish brown'}),
 fence({path:[[4,18],[7,18]],y:P,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[13,18],[19,18]],y:P,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[0,39],[5,39]],y:P,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[14,39],[19,39]],y:P,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[39,18],[42,18]],y:P,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[49,18],[55,18]],y:P,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[55,19],[55,38]],y:P,colour:'reddish brown',style:'lattice-low'})
]);
function hut(x,z,w,upper){
 const d=10,doorAt=Math.floor((w-4)/2),roofY=P+9+upper+1;
 const win=(side,at)=>({side,at,width:2,y:upper===12?3:0,height:6,fill:'window',frame:'blue',glass:'trans yellow'});
 return [
 room({at:[x,P,z],size:[w,9,d],colour:'reddish brown',texture:'log',openings:[{side:'front',at:doorAt,width:4,height:9,fill:'none'}]}),
 room({at:[x,P+9,z],size:[w,upper,d],colour:'blue',openings:[{side:'front',at:doorAt,width:4,height:upper,fill:'none'},win('front',1),win('front',w-3),win('left',3),win('right',3),win('back',2),win('back',w-4)]}),
 floor({at:[x-1,roofY-1,z-1],size:[w+2,d+2],colour:'light bluish grey',holes:[{at:[x+1,z+1],size:[w-2,d-2]}]}),
 roof({style:'hip',at:[x,roofY,z],size:[w,d],colour:'blue',overhang:0,ends:0}),
 place({part:'2423',at:[x+Math.floor(w/2)-1,roofY+15,z+4],colour:'dark green'}),
 place({part:'3004p90',at:[x+1,P+6,z],colour:'blue'}),
 place({part:'3004p90',at:[x+w-3,P+6,z+d-1],colour:'blue',turn:180}),
 ...[x,x+w-1].flatMap(px=>[z,z+d-1].map(pz=>column({at:[px,P,pz],height:18,colour:'dark brown'})))
 ];
}
section('Blue space huts in the trees',[...hut(3,19,14,9),...hut(40,19,12,12)]);
function radar(x,z){return [column({at:[x,P,z],diameter:2,height:9,colour:'blue'}),place({part:'3960',at:[x-1,P+9,z-1],colour:'light bluish grey'}),place({part:'3957a',at:[x,P+11,z],colour:'black'})];}
function fuel(x,y,z){return [column({at:[x,y,z],height:6,diameter:2,colour:'reddish brown'}),place({part:'4740',at:[x,y+6,z],colour:'tan'})];}
section('Branch radar and acorn fuel stores',[
 ...radar(18,29),...radar(53,23),...fuel(16,P,35),...fuel(41,P,36),...fuel(27,P,34)
]);
const SY=27;
section('LL-928 landing gear and timber hull',[
 ...[[24,9],[30,9],[24,24],[30,24]].flatMap(([x,z])=>[place({part:'4740',at:[x,6,z],colour:'dark bluish grey'}),column({at:[x,7,z],diameter:2,height:16,colour:'light bluish grey'})]),
 floor({at:[24,23,7],size:[8,21],layers:2,colour:'dark brown'}),
 box({at:[24,25,8],size:[8,6,20],colour:'reddish brown',texture:'log'}),
 box({at:[26,25,4],size:[4,6,4],colour:'blue',interior:'solid'}),
 floor({at:[24,31,8],size:[8,20],colour:'blue'}),
 floor({at:[26,31,4],size:[4,4],colour:'blue'}),
 place({part:'3039',at:[26,32,3],colour:'blue'}),place({part:'3039',at:[28,32,3],colour:'blue'}),
 place({part:'3298p90',at:[27,32,5],colour:'blue'}),
 place({part:'4474',at:[24,32,8],colour:'trans yellow'}),place({part:'4474',at:[28,32,8],colour:'trans yellow'}),
 room({at:[24,32,16],size:[8,9,12],colour:'reddish brown',texture:'log',openings:[{side:'front',at:2,width:4,height:9,fill:'none'},{side:'back',at:2,width:4,height:9,fill:'none'}]}),
 floor({at:[24,41,16],size:[8,12],layers:2,colour:'light bluish grey',top:'tile'}),
 box({at:[26,43,18],size:[4,2,6],colour:'blue',top:'tile'}),
 stairs({at:[26,31,27],width:4,steps:8,dir:'+z',rise:3,colour:'dark tan'}),
 ...[22,32].flatMap(x=>[column({at:[x,SY,12],height:6,diameter:2,colour:'blue'}),place({part:'3941',at:[x,33,12],colour:'reddish brown'}),place({part:'4740',at:[x,36,12],colour:'tan'})])
]);
section('Delta wings with fern solar vanes',[
 ...range(6).map(i=>floor({at:[23-i*2,25,7+i*2],size:[10+i*4,2],layers:2,colour:'light bluish grey',top:'tile'})),
 floor({at:[12,25,19],size:[32,9],layers:2,colour:'light bluish grey',top:'tile'}),
 ...range(6).flatMap(i=>[23-i*2,31+i*2].map(x=>place({part:'3039',at:[x,SY,7+i*2],colour:'blue'}))),
 ...[18,22,33,37].map(x=>place({part:x===22||x===33?'3069b':'6636',at:[x,SY,17],turn:90,colour:'reddish brown'})),
 ...[19,33].flatMap(x=>[box({at:[x,SY,22],size:[4,6,6],colour:'blue'}),place({part:'3298',at:[x,27,19],colour:'blue'}),place({part:'3298',at:[x+2,27,19],colour:'blue'}),place({part:'4746',at:[x+1,33,23],colour:'blue'}),place({part:'4460b',at:[x+(x===19?0:3),33,23],colour:'blue'})]),
 ...[14,41].flatMap(x=>[place({part:'3024',at:[x,27,22],colour:'dark green'}),place({part:'3024',at:[x,28,22],colour:'dark green'})]),
 place({part:'2417',at:[12,29,19],colour:'dark green'}),place({part:'2417',at:[14,30,21],colour:'green'}),
 place({part:'2417',at:[39,29,19],colour:'dark green'}),place({part:'2417',at:[37,30,21],colour:'green'}),
 place({part:'3957a',at:[13,27,26],colour:'red'}),place({part:'3957a',at:[42,27,26],colour:'red'})
]);
component('Space Ewok',{size:[5,3],ops:[
 place({part:'3005',at:[1,0,1],colour:'reddish brown'}),place({part:'3005',at:[3,0,1],colour:'reddish brown'}),
 place({part:'3002',at:[1,3,0],colour:'reddish brown'}),
 place({part:'3020',at:[0,6,0],colour:'blue'}),place({part:'3020',at:[1,7,0],colour:'blue'}),
 place({part:'3004p90',at:[1,8,0],colour:'blue'}),place({part:'3005',at:[3,8,0],colour:'blue'}),place({part:'3622',at:[1,8,1],colour:'blue'}),
 place({part:'3005',at:[0,7,1],colour:'reddish brown'}),place({part:'3024',at:[0,10,1],colour:'tan'}),
 place({part:'3005',at:[4,8,1],colour:'reddish brown'}),place({part:'3024',at:[4,11,1],colour:'tan'}),
 place({part:'3622',at:[1,11,0],colour:'tan'}),place({part:'3622',at:[1,11,1],colour:'hood'}),
 place({part:'3005',at:[1,14,0],colour:'black'}),place({part:'3005',at:[2,14,0],colour:'tan'}),place({part:'3005',at:[3,14,0],colour:'black'}),place({part:'3622',at:[1,14,1],colour:'hood'}),
 place({part:'3062b',at:[1,17,0],colour:'reddish brown'}),place({part:'3062b',at:[3,17,0],colour:'reddish brown'}),place({part:'54200',at:[2,17,0],colour:'hood'}),
 place({part:'85984',at:[1,17,1],colour:'hood'}),place({part:'54200',at:[3,17,1],colour:'hood'})
]});
section('Ewok astronaut crew',[
 instance({component:'Space Ewok',at:[8,P,17],palette:{hood:'dark orange'}}),
 instance({component:'Space Ewok',at:[43,P,17],palette:{hood:'tan'}}),
 instance({component:'Space Ewok',at:[30,P,34],palette:{hood:'blue'},turn:180}),
 instance({component:'Space Ewok',at:[18,SY,15],palette:{hood:'dark orange'}}),
 instance({component:'Space Ewok',at:[33,SY,15],palette:{hood:'tan'}}),
 instance({component:'Space Ewok',at:[45,G,5],palette:{hood:'dark orange'},turn:90}),
 instance({component:'Space Ewok',at:[10,6,2],palette:{hood:'blue'}})
]);
section('Acorn fuel moon buggy',[
 place({part:'4600',at:[5,8,6],colour:'light bluish grey',wheels:'light bluish grey'}),
 place({part:'4600',at:[5,8,12],colour:'light bluish grey',wheels:'light bluish grey'}),
 floor({at:[5,9,5],size:[2,10],layers:2,colour:'light bluish grey'}),
 floor({at:[3,11,5],size:[6,10],layers:2,colour:'light bluish grey'}),
 box({at:[3,13,5],size:[6,3,5],colour:'blue'}),
 place({part:'62360',at:[3,16,5],colour:'trans yellow'}),
 place({part:'4079',at:[5,13,8],colour:'blue'}),
 place({part:'3039',at:[3,16,8],colour:'blue'}),place({part:'3039',at:[7,16,8],colour:'blue'}),
 place({part:'3005',at:[3,13,10],colour:'blue'}),place({part:'3957a',at:[3,16,10],colour:'red'}),
 place({part:'87081',at:[4,13,11],colour:'reddish brown'}),place({part:'87081',at:[4,16,11],colour:'reddish brown'}),
 place({part:'3960',at:[4,19,11],colour:'tan'}),
 place({part:'3004p90',at:[3,13,5],colour:'blue'})
]);
section('Moon minerals, ferns and survey equipment',[
 cylinder({at:[46,G,12],diameter:4,height:9,colour:'dark bluish grey'}),
 place({part:'3960',at:[46,14,12],colour:'tan'}),place({part:'3957a',at:[48,16,13],colour:'red'}),
 box({at:[43,G,13],size:[2,6,2],colour:'blue'}),place({part:'3004p90',at:[43,11,13],colour:'blue'}),place({part:'2412b',at:[43,14,13],colour:'black'}),
 ...[[1,2],[1,11],[2,16],[52,4],[54,11],[51,20],[35,3],[40,8]].map(([x,z],i)=>place({part:'32607',at:[x,G,z],colour:i%3===0?'green':'dark green',turn:0})),
 place({part:'6255',at:[52,G,16],colour:'green'}),
 ...[[5,26],[18,29],[39,29],[44,39],[17,41]].map(([x,z])=>place({part:'2423',at:[x,12,z],colour:'dark green'})),
 ...[[33,6],[36,8],[40,17],[15,10],[44,2]].map(([x,z],i)=>place({part:'3039',at:[x,6,z],colour:i%2?'dark bluish grey':'light bluish grey'}))
]);