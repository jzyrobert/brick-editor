script({title:'Endor Outpost: Ewok Star Base', description:'Classic 1970s LEGO Space (blue, grey, trans-yellow) as the Ewoks would build it: log treehouses on giant trunks with radar dishes, a rope bridge, and a log-hulled starship on a moon-grey landing pad.', palette:{trunk:'reddish brown', plank:{mix:['dark tan','dark tan','tan']}}});

const Y=18, TOP=Y+2;

// Log hut with a classic-space blue or grey hip roof and trans-yellow window.
const hut=(x,z,wall,roofC,door)=>[
  room({at:[x,TOP,z],size:[6,'4b',6],colour:wall,texture:'log',openings:[
    {side:'front',at:2,width:2,y:3,height:6,frame:'light bluish grey',glass:'trans yellow'},
    {side:door,at:2,width:2,y:0,height:9,fill:'none'}]}),
  roof({style:'hip',at:[x,TOP+12,z],size:[6,6],colour:roofC}),
];

// Two pinwheels of leaves on top of a trunk.
const canopy=(ox,oz,t)=>{const sx=ox+5,sz=oz+5,tx=ox+7,tz=oz+7;return [
  floor({at:[ox+6,t,oz+6],size:[8,8],colour:'dark green'}),
  place({part:'2417',at:[sx,t+1,sz],colour:'dark green',turn:90}),
  place({part:'2417',at:[sx+6,t+1,sz],colour:'dark green'}),
  place({part:'2417',at:[sx+5,t+1,sz+6],colour:'dark green',turn:90}),
  place({part:'2417',at:[sx,t+1,sz+5],colour:'dark green'}),
  place({part:'3024',at:[ox+10,t+1,oz+10],colour:'dark green'}),
  floor({at:[tx,t+2,tz],size:[6,6],colour:'green'}),
  place({part:'2423',at:[tx,t+3,tz],colour:'green',turn:90}),
  place({part:'2423',at:[tx+4,t+3,tz],colour:'green'}),
  place({part:'2423',at:[tx+3,t+3,tz+4],colour:'green',turn:90}),
  place({part:'2423',at:[tx,t+3,tz+3],colour:'green'}),
  place({part:'4589',at:[ox+10,t+3,oz+10],colour:'green'}),
];};

const treehouse=(ox,oz,trunkB,huts,fences)=>{const t=trunkB*3;return [
  cylinder({at:[ox+7,0,oz+7],diameter:6,height:t,colour:'trunk'}),
  [[1,1],[18,1],[1,18],[18,18]].map(([dx,dz])=>column({at:[ox+dx,0,oz+dz],height:Y,diameter:1,colour:'reddish brown'})),
  floor({at:[ox,Y,oz],size:[20,20],layers:2,colour:'plank',top:'tile',holes:[{at:[ox+7,oz+7],size:[6,6]}]}),
  hut(ox+1,oz+1,huts[0],huts[1],'right'),
  hut(ox+13,oz+1,huts[2],huts[3],'left'),
  column({at:[ox+16,TOP,oz+16],height:6,diameter:2,colour:'light bluish grey'}),
  place({part:'3960',at:[ox+15,TOP+6,oz+15],colour:'light bluish grey'}),
  place({part:'3957a',at:[ox+1,TOP,oz+18],colour:'light bluish grey'}),
  place({part:'4345b',at:[ox+2,TOP,oz+16],colour:'tan'}),
  fences.map(p=>fence({path:p,y:TOP,colour:'tan',style:'lattice-low'})),
  canopy(ox,oz,t),
];};

const flowers=(at,size)=>scatter({region:{at,size},parts:['24866'],colours:['red','yellow','white'],density:0.2,spacing:2});

section('Site',[
  baseplate({at:[0,0],size:[48,48],colour:'green'}),
  floor({at:[3,0,2],size:[20,16],colour:'light bluish grey',top:'tile'}),
  [3,8,13,18,22].map(x=>[2,17].map(z=>place({part:'6141',at:[x,1,z],colour:'trans yellow'}))),
  floor({at:[23,0,10],size:[14,2],colour:'tan',top:'tile'}),
  place({part:'3471',at:[24,0,4],colour:'green'}),
  place({part:'3471',at:[41,0,3],colour:'green'}),
  [[30,5],[1,19],[22,24],[40,44],[24,42]].map(([x,z])=>place({part:'2435',at:[x,0,z],colour:'dark green'})),
  flowers([4,18],[17,6]),
  flowers([25,17],[9,4]),
  flowers([38,9],[9,12]),
]);

section('Treehouse A', treehouse(1,26,14,['reddish brown','blue','tan','light bluish grey'],[
  [[1,26],[20,26]],[[1,27],[1,45]],[[2,45],[20,45]],[[20,27],[20,33]],[[20,38],[20,44]]]));

section('Treehouse B', treehouse(27,22,15,['dark tan','light bluish grey','reddish brown','blue'],[
  [[27,22],[34,22]],[[37,22],[46,22]],[[46,23],[46,41]],[[27,41],[45,41]],[[27,23],[27,33]],[[27,38],[27,40]]]));

section('Bridge and stairs',[
  floor({at:[21,Y,34],size:[6,4],layers:2,colour:'plank',top:'tile'}),
  fence({path:[[21,34],[26,34]],y:TOP,colour:'tan',style:'lattice-low'}),
  fence({path:[[21,37],[26,37]],y:TOP,colour:'tan',style:'lattice-low'}),
  stairs({at:[35,0,12],width:2,steps:10,dir:'+z',rise:2,run:1,colour:'reddish brown'}),
]);

// Log-hulled classic-space cruiser, nose to the front.
const ship=[
  [[2,4],[7,4],[2,11],[7,11]].map(([x,z])=>column({at:[x,0,z],height:6,diameter:1,colour:'dark bluish grey'})),
  floor({at:[-4,6,1],size:[18,13],colour:'blue'}),
  box({at:[1,7,3],size:[8,9,9],colour:'reddish brown',texture:'log'}),
  box({at:[1,7,1],size:[8,6,2],colour:'blue',interior:'solid'}),
  [[1,'blue'],[3,'trans yellow'],[5,'trans yellow'],[7,'blue']].map(([x,c])=>place({part:'3039',at:[x,13,1],colour:c})),
  window({at:[1,8,6],facing:'left',size:'1x2x2',frame:'light bluish grey',glass:'trans yellow'}),
  window({at:[8,8,6],facing:'right',size:'1x2x2',frame:'light bluish grey',glass:'trans yellow'}),
  place({part:'4740',at:[2,16,7],colour:'light bluish grey'}),
  place({part:'3957a',at:[7,16,10],colour:'light bluish grey'}),
  place({part:'3941',at:[5,16,4],colour:'light bluish grey'}),
  place({part:'4589',at:[5,19,4],colour:'trans yellow'}),
  [2,6].map(x=>[
    place({part:'3941',at:[x,7,12],colour:'light bluish grey'}),
    place({part:'3941',at:[x,10,12],colour:'light bluish grey'}),
    place({part:'3942c',at:[x,13,12],colour:'light bluish grey'}),
  ]),
  [-4,13].map(x=>[
    place({part:'4460b',at:[x,7,11],colour:'light bluish grey',turn:180}),
    place({part:'6141',at:[x,7,1],colour:'trans yellow'}),
  ]),
];

section('Starship',[group({at:[8,1,2],ops:ship})]);
