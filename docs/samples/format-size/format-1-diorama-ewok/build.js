script({title:'Bright Tree Explorer — 1979',description:'Ewok explorers reinvent the first blue-and-grey space sets: a leaf-wing survey glider docks beneath a treetop tracking village, with yellow observation glass, timber launch stairs, a rope bridge, barrel engine pods and classic planet-and-rocket insignia.',palette:{bark:{mix:['reddish brown','reddish brown','dark brown']}}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const F=(at,size,colour,layers=1,extra={})=>floor({at,size,colour,layers,...extra});
component('Ewok astronaut',{size:[4,4],ops:[P('41879a',[1,0,1],'red'),P('76382p6j',[0,4,1],'red'),P('64805',[1,11,1],'reddish brown')]});
component('Ewok surveyor',{size:[4,4],ops:[P('41879a',[1,0,1],'white'),P('76382p90',[0,4,1],'white'),P('64805',[1,11,1],'dark tan')]});
component('Leafwing explorer',{size:[16,18],ops:[
 ...[[4,5],[10,5],[4,13],[10,13]].flatMap(([x,z])=>[P('3021',[x,0,z],'dark bluish grey'),P('3003',[x,1,z],'light bluish grey')]),
 F([5,4,2],[6,16],'reddish brown'),F([4,4,7],[8,2],'reddish brown'),F([0,4,11],[16,2],'reddish brown'),F([2,4,13],[12,5],'reddish brown'),
 box({at:[6,5,3],size:[4,3,13],colour:'blue',interior:'solid'}),
 P('43721',[6,5,0],'blue'),P('43720',[8,5,0],'blue'),P('2431',[6,8,3],'blue'),
 ...[3,6,9].flatMap(z=>[P('50950',[5,5,z],'blue'),P('50950',[10,5,z],'blue')]),P('11477',[5,5,16],'blue'),P('11477',[10,5,16],'blue'),
 P('4474',[6,8,5],'trans yellow'),P('87079p50',[6,8,12],'blue'),P('3068b',[7,8,14],'light bluish grey'),
 P('54384',[2,5,7],'light bluish grey'),P('54383',[11,5,7],'light bluish grey'),
 P('41770a',[0,5,9],'reddish brown'),P('41769a',[14,5,9],'reddish brown'),
 P('3565',[0,6,8],'dark green'),P('3565',[14,6,8],'dark green'),
 P('63864',[2,6,11],'blue'),P('63864',[11,6,11],'blue'),
 P('3020',[2,5,13],'blue'),P('3020',[10,5,13],'blue'),
 P('4746',[2,6,13],'blue'),P('4746',[12,6,13],'blue'),
 ...[4,10].flatMap(x=>[P('2489',[x,6,14],'reddish brown'),P('4032b',[x,11,14],'blue'),P('14769',[x,12,14],'light bluish grey')]),
 P('6141',[3,6,9],'trans red'),P('6141',[12,6,9],'trans yellow')
]});
section('Moonstone and moss',[F([2,0,0],[36,32],'black',2),F([0,0,3],[40,26],'black',2),F([2,2,0],[36,31],'dark bluish grey'),F([1,3,15],[17,15],'olive green'),F([28,3,21],[10,10],'olive green'),
 box({at:[19,3,1],size:[18,3,19],colour:'light bluish grey',interior:'solid',top:'tile'}),
 ...[1,5,9,13,17].map(z=>P('3069b',[19,6,z],'yellow',90)),
 ...[2,6,10,14,18].map(z=>P('3069b',[36,6,z],'blue',90)),
 F([10,3,4],[8,3],'dark tan',1,{top:'tile'}),F([12,3,7],[6,5],'dark tan',1,{top:'tile'}),
 box({at:[1,3,19],size:[5,6,3],colour:'dark bluish grey',interior:'solid'}),P('3297',[1,9,19],'dark bluish grey'),
 box({at:[23,3,28],size:[4,3,3],colour:'dark bluish grey',interior:'solid'}),P('3039',[23,6,28],'light bluish grey'),P('3039',[25,6,28],'dark bluish grey'),
 P('6255',[8,4,18],'green'),P('6255',[20,3,25],'green'),P('30176',[38,2,18],'sand green'),P('32607',[8,3,7],'dark green'),P('32607',[16,4,11],'green'),P('32607',[27,3,19],'dark green')
]);
const tree=(x,z,top,big)=>[
 cylinder({at:[x-1,4,z-1],diameter:6,height:big?15:12,colour:'bark'}),
 cylinder({at:[x,big?19:16,z],diameter:4,height:top-(big?19:16),colour:'bark'}),
 cylinder({at:[x-1,26,z-1],diameter:6,height:3,colour:'blue'}),
 P('4460b',[x,4,z-3],'reddish brown'),P('4460b',[x+3,4,z-3],'dark brown'),P('4460b',[x-3,4,z+1],'reddish brown',90),P('4460b',[x+5,4,z+2],'reddish brown',270),P('4460b',[x+1,4,z+5],'dark brown',180)
];
section('Living launch towers',[
 ...tree(10,25,72,true),...tree(31,25,59,false),
 line({from:[11,55,26],to:[4,64,26],colour:'reddish brown'}),line({from:[12,56,27],to:[18,62,28],colour:'reddish brown'}),line({from:[11,63,27],to:[8,69,28],colour:'reddish brown'}),
 P('2417',[2,65,24],'dark green'),P('2423',[3,66,25],'green'),P('2417',[16,63,25],'green'),P('2423',[17,64,26],'dark green'),P('2423',[7,70,27],'green'),P('2417',[9,72,24],'dark green'),P('2423',[10,73,25],'green'),
 line({from:[32,48,27],to:[27,55,29],colour:'reddish brown'}),line({from:[33,48,26],to:[37,54,26],colour:'reddish brown'}),
 P('2417',[24,56,25],'dark green'),P('2423',[25,57,26],'green'),P('2423',[35,55,24],'green'),P('2417',[30,59,24],'green'),P('2423',[31,60,25],'dark green'),
 line({from:[11,18,26],to:[3,29,13],colour:'reddish brown'}),line({from:[12,20,26],to:[16,29,13],colour:'reddish brown'}),line({from:[11,22,27],to:[3,29,28],colour:'reddish brown'}),
 line({from:[32,20,26],to:[28,29,22],colour:'reddish brown'}),line({from:[33,20,27],to:[37,29,29],colour:'reddish brown'})
]);
section('Platforms, launch stairs and rope bridge',[
 F([2,30,12],[16,18],'dark tan',2,{top:'tile',holes:[{at:[10,25],size:[4,4]}]}),F([27,30,21],[12,10],'dark tan',2,{top:'tile',holes:[{at:[31,25],size:[4,4]}]}),
 stairs({at:[2,3,0],width:5,steps:14,dir:'+z',rise:2,colour:'reddish brown'}),
 ...range(14).map(i=>P('63864',[3,5+2*i,i],i%4===0?'tan':'dark tan')),
 line({from:[2,10,1],to:[2,36,14],colour:'dark tan'}),line({from:[6,10,1],to:[6,36,14],colour:'dark tan'}),
 ...[1,5,9,13].flatMap(z=>[column({at:[2,5+2*z,z],height:3,colour:'reddish brown'}),column({at:[6,5+2*z,z],height:3,colour:'reddish brown'})]),
 F([16,30,24],[13,4],'reddish brown'),...range(18,27).map(x=>P('2431',[x,31,24],x%3===0?'tan':'dark tan',90)),
 ...[23,28].flatMap(z=>[...[[17,6],[22,4],[27,6]].map(([x,h])=>column({at:[x,32,z],height:h,colour:'reddish brown'})),line({from:[17,38,z],to:[22,36,z],colour:'dark tan'}),line({from:[22,36,z],to:[27,38,z],colour:'dark tan'})]),
 fence({path:[[2,14],[2,28]],y:32,colour:'reddish brown',style:'lattice-low'}),fence({path:[[7,12],[17,12]],y:32,colour:'reddish brown',style:'lattice-low'}),fence({path:[[3,29],[17,29]],y:32,colour:'reddish brown',style:'lattice-low'}),fence({path:[[38,22],[38,29]],y:32,colour:'reddish brown',style:'lattice-low'}),
 P('32607',[3,32,25],'green'),P('2489',[4,32,23],'reddish brown'),P('14769',[4,37,23],'light bluish grey')
]);
section('Thatch-roof tracking hut',[
 cylinder({at:[5,32,14],diameter:8,height:12,colour:'blue'}),carve({at:[8,32,14],size:[2,9,2]}),
 window({at:[5,35,15],facing:'front',size:'1x2x2',frame:'light bluish grey',glass:'trans yellow'}),window({at:[11,35,17],facing:'right',size:'1x2x2',frame:'light bluish grey',glass:'trans yellow'}),window({at:[5,35,18],facing:'left',size:'1x2x2',frame:'light bluish grey',glass:'trans yellow'}),window({at:[8,35,21],facing:'back',size:'1x2x2',frame:'light bluish grey',glass:'trans yellow'}),
 ...[[5,16],[12,16],[5,20],[12,20]].map(([x,z])=>column({at:[x,32,z],height:12,colour:'reddish brown'})),
 F([4,43,13],[10,10],'blue',1,{holes:[{at:[5,14],size:[8,8]}]}),
 roof({style:'hip',at:[4,44,13],size:[10,10],colour:'tan',holes:[{at:[8,17],size:[2,2]}]}),
 column({at:[8,44,17],height:20,diameter:2,colour:'light bluish grey'}),P('44375b',[6,64,15],'light bluish grey'),P('4032b',[8,66,17],'blue'),P('3957a',[8,67,17],'black'),P('6141',[9,67,18],'trans red'),
 P('3039p23',[13,32,15],'blue'),P('3039p34',[13,32,13],'blue'),
 instance({component:'Ewok astronaut',at:[14,32,17],turn:90}),
 column({at:[27,32,22],height:8,colour:'blue'}),P('3960',[26,40,21],'light bluish grey'),P('6141',[27,42,22],'trans red'),P('3957a',[27,43,22],'black'),
 P('3039p34',[35,32,21],'blue'),instance({component:'Ewok surveyor',at:[34,32,22]})
]);
section('Launch-day activity',[
 instance({component:'Leafwing explorer',at:[20,6,2]}),instance({component:'Ewok astronaut',at:[14,4,5],turn:270}),instance({component:'Ewok surveyor',at:[34,6,15],turn:90}),
 P('2489',[16,4,10],'reddish brown'),P('4032b',[16,9,10],'light bluish grey'),P('6141',[16,10,10],'trans yellow'),
 column({at:[18,4,8],height:10,colour:'blue'}),P('4740',[18,14,8],'light bluish grey'),P('6141',[18,15,8],'trans yellow'),
 P('87079p50',[8,3,1],'blue'),P('3069b',[8,3,3],'yellow'),P('3069b',[10,3,3],'yellow')
]);