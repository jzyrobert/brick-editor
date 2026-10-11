script({title:'LL-79: Forest Moon Launch Lodge',description:'Ewok-built 1979 spaceport: a blue and grey canopy explorer with wooden log nacelles, transparent yellow cockpit, root-grown launch deck, treetop tracking lodge, timber skybridge and acorn-fuel buggy.',palette:{wood:'reddish brown',bark:'dark brown',space:'blue',metal:'light bluish grey',glass:'trans yellow',leaf:'dark green'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour,extra={})=>box({at,size,colour,...extra});
const F=(at,size,colour,layers=1,extra={})=>floor({at,size,colour,layers,...extra});
component('canopy explorer',{size:[22,16],ops:[
 ...[8,12].flatMap(x=>[4,13].map(z=>column({at:[x,0,z],height:4,diameter:2,colour:'metal'}))),
 B([8,4,2],[6,2,13],'metal',{interior:'solid'}),F([7,6,1],[8,14],'space'),
 F([1,7,9],[7,6],'metal',1,{top:'tile'}),F([14,7,9],[7,6],'metal',1,{top:'tile'}),
 ...[1,3,5].map(x=>P('41770a',[x,7,5],'space')),
 ...[15,17,19].map(x=>P('41769a',[x,7,5],'space')),
 B([8,7,2],[6,1,9],'space',{interior:'solid'}),
 P('50950',[8,8,1],'space'),P('50950',[9,8,1],'space'),P('3298p90',[10,8,1],'space'),P('50950',[12,8,1],'space'),P('50950',[13,8,1],'space'),
 P('4474',[9,8,4],'glass'),
 B([9,7,11],[4,7,4],'space',{top:'tile'}),P('87079p50',[9,14,12],'space'),
 P('50950',[8,8,11],'wood',180),P('50950',[13,8,11],'wood',180),
 ...[2,18].flatMap(x=>[
 B([x,8,7],[2,3,9],'wood',{interior:'solid'}),
 ...[x,x+1].flatMap(xx=>[7,11].map(z=>P('93273',[xx,11,z],'wood'))),
 P('2412b',[x,8,6],'metal'),P('3069b',[x,11,15],'trans red')]),
 ...[5,16].map(x=>P('4460b',[x,8,13],'space',180)),
 ...[1,19].map(x=>P('2431',[x,8,10],'space',90)),
 ...[7,14].map(x=>P('3957a',[x,7,14],'metal')),
 P('3069b',[10,8,15],'trans red'),
 P('54200',[8,8,4],'metal'),P('54200',[13,8,4],'metal')
]});
function ewok(at,turn,torso,colour,fur){return group({at,turn,ops:[P('41879a',[1,0,0],fur),P(torso,[0,4,0],colour),P('64805',[1,11,0],fur)]});}
function treeTrunk(x,z,h){return [B([x,3,z],[4,h,4],'wood',{texture:'log',interior:'solid'}),...[[x-3,z,90],[x+4,z,270],[x,z-3,0],[x,z+4,180]].map(([xx,zz,t])=>P('3298',[xx,3,zz],'wood',t)),F([x-1,15,z-1],[6,6],'space',3,{holes:[{at:[x,z],size:[4,4]}],top:'tile'}),P('3004p90',[x+1,15,z-1],'space')];}
section('Connected forest display',[
 F([0,0,0],[40,32],'black',2,{top:'tile'}),F([1,2,1],[38,30],'dark tan'),
 B([1,3,21],[12,2,10],'dark green',{top:'tile'}),B([27,3,21],[12,2,10],'dark green',{top:'tile'}),
 B([2,3,16],[5,1,5],'green'),B([27,3,17],[6,1,4],'green'),
 B([11,3,3],[22,4,16],'dark bluish grey',{top:'tile',supports:6}),B([9,3,5],[2,4,12],'dark bluish grey',{top:'tile'}),B([33,3,5],[2,4,12],'dark bluish grey',{top:'tile'}),
 F([11,7,5],[22,12],'metal',1,{top:'tile'}),
 ...[11,31].flatMap(x=>[6,12].map(z=>P('2431',[x,8,z],'yellow',90))),
 ...[15,23].map(x=>P('2431',[x,8,3],'yellow')),
 ...[12,28].map(x=>P('3068b',[x,8,17],'black')),
 F([16,8,18],[12,1],'space',1,{top:'tile'}),P('3004p90',[21,3,2],'space'),
 stairs({at:[1,3,8],width:3,steps:10,dir:'+z',rise:2,run:1,colour:'wood',top:'tile'}),
 ...range(5).map(i=>B([0,3+4*i,8+2*i],[1,6,1],'space',{interior:'solid',top:'tile'}))
]);
section('Root supported spacecraft',[instance({component:'canopy explorer',at:[10,8,3]})]);
section('Treetop tracking lodge',[
 ...treeTrunk(6,25,63),
 column({at:[2,3,19],height:18,diameter:2,colour:'wood'}),column({at:[12,3,19],height:18,diameter:2,colour:'wood'}),
 F([1,21,18],[14,13],'space'),F([1,22,18],[14,13],'wood',1,{top:'tile'}),
 F([14,21,25],[14,3],'space'),F([14,22,25],[14,3],'wood',1,{top:'tile'}),
 room({at:[3,23,22],size:[10,20,8],colour:'wood',texture:'log',openings:[{side:'front',at:1,width:4,y:6,height:6,fill:'none'},{side:'front',at:6,width:3,height:20,fill:'none'},{side:'left',at:2,width:2,y:6,height:6,fill:'none'},{side:'back',at:1,width:2,y:6,height:6,fill:'none'}]}),
 P('87552',[4,29,22],'glass'),P('87552',[6,29,22],'glass'),P('87552',[3,29,24],'glass',90),P('87552',[4,29,29],'glass'),
 P('3004p90',[4,35,22],'space'),F([2,41,21],[12,10],'space',2,{holes:[{at:[4,23],size:[8,6]}],top:'tile'}),
 roof({style:'hip',at:[3,43,22],size:[10,8],colour:'space',holes:[{at:[6,25],size:[4,4]}]}),
 ...[2,7,12].map(x=>column({at:[x,23,18],height:6,diameter:1,colour:'wood',cap:'tile'})),B([2,29,18],[11,1,1],'wood',{top:'tile',interior:'solid'}),
 ...[15,20,25].flatMap(x=>[24,28].map(z=>column({at:[x,22,z],height:6,diameter:1,colour:'wood'}))),
 B([14,28,24],[14,1,1],'wood',{top:'tile',interior:'solid'}),B([14,28,28],[14,1,1],'wood',{top:'tile',interior:'solid'}),
 ...range(7).map(i=>P('63864',[14+2*i,23,25],'dark tan',90)),
 B([1,61,24],[13,3,2],'wood',{interior:'solid'}),B([9,61,21],[3,3,5],'wood',{interior:'solid'}),
 P('2417',[1,64,21],'dark green'),P('2417',[6,64,24],'green'),P('2417',[9,64,18],'dark green'),P('2417',[4,65,20],'green'),P('2417',[7,66,22],'dark green'),
 ewok([4,23,19],0,'76382p91','blue','reddish brown'),P('3068bp5c',[10,26,20],'white'),B([10,23,20],[2,3,2],'space',{interior:'solid'}),
 P('3941',[1,23,27],'light bluish grey'),P('4740',[1,26,27],'trans yellow')
]);
section('Skybridge satellite nest',[
 ...treeTrunk(31,26,41),F([27,21,21],[11,9],'space'),F([27,22,21],[11,9],'wood',1,{top:'tile'}),column({at:[36,3,22],height:18,diameter:2,colour:'wood'}),
 B([32,39,20],[5,3,8],'wood',{interior:'solid'}),column({at:[35,42,20],height:7,diameter:2,colour:'space'}),P('44375b',[33,49,18],'metal'),P('3957a',[35,51,20],'black'),
 B([29,41,26],[8,3,2],'wood',{interior:'solid'}),P('2417',[29,44,25],'dark green'),P('2423',[34,44,27],'green'),P('2423',[31,45,26],'green'),
 ...[28,33,37].map(x=>column({at:[x,23,29],height:6,diameter:1,colour:'wood',cap:'tile'})),B([28,29,29],[10,1,1],'wood',{top:'tile',interior:'solid'}),
 B([34,23,23],[3,5,2],'space',{top:'tile'}),P('3068bp5c',[34,28,23],'white'),P('3957a',[36,28,24],'metal'),ewok([28,23,21],0,'76382p90','white','dark tan')
]);
section('Acorn refuelling crew',[
 ...[7,11].map(z=>place({part:'4600',at:[36,5,z],colour:'light bluish grey',wheels:'light bluish grey'})),
 F([36,6,7],[2,7],'space'),P('15068',[36,7,7],'space'),P('3829c01',[36,7,9],'black'),P('49309',[36,7,10],'wood'),P('3941',[36,13,10],'wood'),P('4740',[36,16,10],'tan'),P('6141',[36,17,10],'wood'),P('3069b',[36,7,13],'trans red'),
 ewok([35,3,3],90,'76382p3z','reddish brown','reddish brown'),
 P('3941',[6,3,5],'wood'),P('4740',[6,6,5],'metal'),P('30035',[6,7,5],'blue'),
 ...[[17,29],[24,29],[37,17]].map(([x,z])=>P('6255',[x,3,z],'green')),
 ...[[7,8,90],[24,22,0],[37,28,180],[11,30,90]].map(([x,z,t])=>P('32607',[x,3,z],'green',t)),
 P('15068',[7,3,14],'dark bluish grey'),P('15068',[21,3,21],'dark bluish grey'),P('15068',[36,3,30],'light bluish grey')
]);