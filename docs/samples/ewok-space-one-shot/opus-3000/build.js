script({title:'Endor Outpost: Classic Space meets the Ewok Village',description:'Three Ewok tree huts in classic-space blue and grey with trans-yellow windows, linked by rope bridges, a comms crow\'s nest, a log hangar and a blue star glider with tan canvas wings on a grey landing pad.',palette:{bark:'reddish brown',deck:'dark tan',thatch:{mix:['tan','dark tan','tan']},leaves:{mix:['dark green','green','dark green']},space:'blue',grey:'light bluish grey',stone:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']}}});
const PLAT=30,HUT_H=18,HUT_TOP=PLAT+2+HUT_H,TRUNK=HUT_TOP+18;
const run=(a,b,y,c)=>fence({path:[a,b],y,colour:c,style:'lattice-low'});
const torch=(x,y,z,c)=>[place({part:'3062b',at:[x,y,z],colour:'bark'}),place({part:'3062b',at:[x,y+3,z],colour:c||'trans yellow'})];
function treeHut(cx,cz,o){
 const y=PLAT+2,top=o.upper?TRUNK+15:TRUNK;
 const corners=[[cx+1,cz+1],[cx+14,cz+1],[cx+1,cz+14],[cx+14,cz+14]];
 const posts=[...corners,[cx+7,cz+1],[cx+7,cz+14],[cx+1,cz+7],[cx+14,cz+7]];
 const side=(x,gap)=>gap?[run([x,cz+2],[x,cz+5],y,'bark'),run([x,cz+10],[x,cz+13],y,'bark')]:[run([x,cz+2],[x,cz+13],y,'bark')];
 const win=(s,at)=>({side:s,at,width:2,y:6,height:6,frame:o.frame,glass:'trans yellow'});
 const u=TRUNK+2;
 return [
  posts.map(([x,z])=>column({at:[x,0,z],height:PLAT,diameter:1,colour:'bark'})),
  floor({at:[cx+1,PLAT,cz+1],size:[14,14],layers:2,colour:'deck',top:'tile'}),
  cylinder({at:[cx+4,0,cz+4],diameter:8,height:3,colour:'bark',texture:'log'}),
  cylinder({at:[cx+5,0,cz+5],diameter:6,height:top,colour:'bark',texture:'log'}),
  run([cx+2,cz+1],[cx+5,cz+1],y,'bark'),
  run([cx+10,cz+1],[cx+13,cz+1],y,'bark'),
  run([cx+2,cz+14],[cx+13,cz+14],y,'bark'),
  side(cx+1,o.left),side(cx+14,o.right),
  corners.map(([x,z])=>torch(x,y,z)),
  place({part:'87079p50',at:[cx+6,y,cz+1],colour:'blue'}),
  room({at:[cx+3,y,cz+3],size:[10,HUT_H,10],colour:o.wall,texture:'log',quoins:o.quoin,openings:[
   {side:'front',at:3,width:4,height:18,frame:'light bluish grey',door:o.door,opens:'out'},
   win('left',1),win('left',7),win('right',1),win('right',7),win('back',1),win('back',7)]}),
  roof({style:'hip',at:[cx+3,HUT_TOP,cz+3],size:[10,10],colour:'thatch',holes:[{at:[cx+5,cz+5],size:[6,6]}]}),
  o.upper&&[
   floor({at:[cx+2,TRUNK,cz+2],size:[12,12],layers:2,colour:'deck',top:'tile'}),
   run([cx+3,cz+2],[cx+12,cz+2],u,'bark'),run([cx+3,cz+13],[cx+12,cz+13],u,'bark'),
   run([cx+2,cz+3],[cx+2,cz+12],u,'bark'),run([cx+13,cz+3],[cx+13,cz+12],u,'bark'),
   [[cx+2,cz+2],[cx+13,cz+2],[cx+2,cz+13],[cx+13,cz+13]].map(([x,z])=>torch(x,u,z))],
  o.dome&&dome({at:[cx+1,top,cz+1],diameter:14,colour:'leaves'})
 ];
}
function crowsNest(cx,cz){
 const T=TRUNK,y=T+2;
 return [
  floor({at:[cx+3,T,cz+3],size:[10,10],layers:2,colour:'grey',top:'tile'}),
  run([cx+4,cz+3],[cx+11,cz+3],y,'grey'),run([cx+4,cz+12],[cx+11,cz+12],y,'grey'),
  run([cx+3,cz+4],[cx+3,cz+11],y,'grey'),run([cx+12,cz+4],[cx+12,cz+11],y,'grey'),
  [[cx+3,cz+3],[cx+12,cz+3],[cx+3,cz+12],[cx+12,cz+12]].map(([x,z])=>torch(x,y,z,'trans red')),
  place({part:'3960',at:[cx+6,y,cz+6],colour:'grey'}),
  place({part:'3957a',at:[cx+4,y,cz+4],colour:'grey'}),
  place({part:'3957a',at:[cx+11,y,cz+11],colour:'grey'})
 ];
}
const bridge=(x,cz)=>[floor({at:[x,PLAT,cz+6],size:[10,4],layers:2,colour:'deck',top:'tile'}),run([x,cz+6],[x+9,cz+6],PLAT+2,'bark'),run([x,cz+9],[x+9,cz+9],PLAT+2,'bark')];

component('Star Glider',{size:[18,20],ops:[
 [[6,5],[10,5],[6,14],[10,14]].map(([x,z])=>column({at:[x,0,z],height:3,diameter:2,colour:'grey'})),
 box({at:[6,3,0],size:[6,3,20],colour:'space',interior:'solid'}),
 floor({at:[0,5,7],size:[18,8],colour:'tan'}),
 [6,8,10].map(x=>place({part:'3039',at:[x,6,0],colour:'space'})),
 box({at:[6,6,2],size:[6,3,18],colour:'space',interior:'solid'}),
 place({part:'2437',at:[7,9,2],colour:'trans yellow'}),
 place({part:'4286',at:[6,9,2],colour:'grey'}),
 place({part:'4286',at:[11,9,2],colour:'grey'}),
 box({at:[6,9,5],size:[6,4,7],colour:'grey',interior:'solid',top:'tile'}),
 box({at:[6,9,12],size:[6,3,8],colour:'space',interior:'solid'}),
 place({part:'87079p50',at:[7,13,6],colour:'blue'}),
 place({part:'3957a',at:[11,13,11],colour:'grey'}),
 place({part:'4740',at:[6,13,10],colour:'grey'}),
 column({at:[6,12,13],height:6,diameter:2,colour:'grey',cap:'cone'}),
 column({at:[10,12,13],height:6,diameter:2,colour:'grey',cap:'cone'}),
 place({part:'60481a',at:[8,12,18],colour:'space'}),
 place({part:'60481a',at:[9,12,18],colour:'space'}),
 [0,3,14,17].map(x=>floor({at:[x,6,7],size:[1,8],colour:'bark'})),
 [1,2,4,5,12,13,15,16].map(x=>place({part:'54200',at:[x,6,7],colour:'tan'})),
 place({part:'6141',at:[0,7,7],colour:'trans red'}),
 place({part:'6141',at:[17,7,7],colour:'trans yellow'})
]});
component('Rover',{size:[4,6],ops:[
 place({part:'4600',at:[1,0,0],colour:'grey',wheels:'light bluish grey'}),
 place({part:'4600',at:[1,0,4],colour:'grey',wheels:'light bluish grey'}),
 floor({at:[1,1,0],size:[2,6],colour:'space'}),
 place({part:'3829c01',at:[1,2,0],colour:'grey'}),
 place({part:'4079',at:[1,2,1],colour:'grey'}),
 place({part:'3957a',at:[1,2,4],colour:'grey'}),
 place({part:'3062b',at:[2,2,4],colour:'grey'}),
 place({part:'3062b',at:[2,2,5],colour:'trans yellow'}),
 place({part:'3062b',at:[1,2,5],colour:'grey'})
]});

section('Site',[
 baseplate({at:[0,0],size:[64,48],colour:'green'}),
 floor({at:[0,0,1],size:[12,12],colour:'deck'}),
 floor({at:[6,0,13],size:[4,2],colour:'deck'}),
 floor({at:[12,0,9],size:[23,3],colour:'deck'}),
 place({part:'3471',at:[1,0,16],colour:'green'}),
 place({part:'2435',at:[12,0,26],colour:'dark green'}),
 place({part:'3471',at:[20,0,25],colour:'green'}),
 place({part:'2435',at:[30,0,25],colour:'dark green'}),
 place({part:'3471',at:[40,0,25],colour:'green'}),
 place({part:'2435',at:[48,0,26],colour:'dark green'}),
 place({part:'3471',at:[57,0,25],colour:'green'})
]);
section('Tree huts',[
 treeHut(0,30,{wall:'blue',quoin:'light bluish grey',frame:'light bluish grey',door:'light bluish grey',right:true,dome:true}),
 treeHut(24,30,{wall:'dark tan',quoin:'blue',frame:'blue',door:'blue',left:true,right:true,dome:true,upper:true}),
 treeHut(48,30,{wall:'light bluish grey',quoin:'blue',frame:'blue',door:'blue',left:true}),
 crowsNest(48,30),
 bridge(15,30),bridge(39,30),
 stairs({at:[7,0,15],width:2,steps:16,dir:'+z',rise:2,colour:'bark'})
]);
section('Hangar hut',[
 box({at:[13,0,12],size:[16,3,12],colour:'stone',texture:'masonry',interior:'solid'}),
 stairs({at:[19,0,9],width:4,steps:3,dir:'+z',rise:1,colour:'stone'}),
 torch(18,3,12),torch(23,3,12),
 room({at:[14,3,13],size:[14,21,10],colour:'bark',texture:'log',quoins:'grey',openings:[
  {side:'front',at:5,width:4,height:18,frame:'grey',door:'space',opens:'out'},
  ...[['front',1],['front',11],['left',4],['right',4],['back',2],['back',10]].map(([s,a])=>({side:s,at:a,width:2,y:6,height:6,frame:'space',glass:'trans yellow'}))]}),
 roof({style:'gable',at:[14,24,13],size:[14,10],ridge:'x',colour:'thatch',gable:'space'}),
 column({at:[29,0,15],height:24,diameter:1,colour:'grey'}),
 place({part:'4740',at:[29,24,15],colour:'grey'})
]);
section('Landing pad',[
 floor({at:[35,0,1],size:[26,23],colour:'grey',top:'tile'}),
 [[35,1],[60,1],[35,23],[60,23]].map(([x,z])=>place({part:'6141',at:[x,1,z],colour:'trans yellow'})),
 place({part:'87079p50',at:[45,1,2],colour:'blue'}),
 place({part:'3003',at:[36,1,20],colour:'dark bluish grey'}),
 place({part:'3039',at:[36,4,20],colour:'grey'}),
 instance({component:'Star Glider',at:[38,1,5],turn:270}),
 instance({component:'Rover',at:[15,0,2]})
]);
const ring=[[3,5],[3,6],[3,7],[3,8],[6,5],[6,6],[6,7],[6,8],[4,5],[5,5],[4,8],[5,8]];
section('Campfire',[
 ring.map(([x,z])=>place({part:'3062b',at:[x,1,z],colour:'dark bluish grey'})),
 place({part:'3062b',at:[4,1,6],colour:'trans red'}),place({part:'3062b',at:[5,1,7],colour:'trans red'}),
 place({part:'4589',at:[5,1,6],colour:'trans yellow'}),place({part:'4589',at:[4,1,7],colour:'trans yellow'}),
 place({part:'4589',at:[4,4,6],colour:'trans yellow'}),place({part:'4589',at:[5,4,7],colour:'trans yellow'}),
 place({part:'30136',at:[0,1,5],colour:'bark',turn:90}),place({part:'30136',at:[9,1,6],colour:'bark',turn:90}),
 place({part:'30136',at:[4,1,2],colour:'bark'}),place({part:'30136',at:[4,1,11],colour:'bark'})
]);
section('Flowers',[
 [[[20,0],[14,8]],[[0,22],[6,6]],[[29,17],[5,5]],[[61,0],[3,24]],[[9,16],[4,8]]].map(([at,size],i)=>scatter({region:{at,size},parts:['24866'],colours:['red','yellow','white'],density:0.15,seed:i+1}))
]);