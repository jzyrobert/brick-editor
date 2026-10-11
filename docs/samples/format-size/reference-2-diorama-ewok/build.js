script({title:'Yub-Nub 1979: Canopy Spaceport',description:'Classic blue-and-grey space exploration reinvented by Ewoks: a yellow-glazed saucer hut lashed to a redwood, a timber catwalk to the listening dish, and a leaf-wing survey glider charging from the village. Three suited Ewoks run the forest moon outpost.',palette:{space:'blue',metal:'light bluish grey',wood:'reddish brown',bark:'dark brown',leaf:'dark green'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const F=(at,size,colour,layers=1,top)=>floor({at,size,colour,layers,...(top?{top}: {})});
section('Connected forest-moon display',[
 F([0,0,0],[40,32],'black',2,'tile'),F([1,2,1],[38,30],'dark green'),
 F([1,3,1],[5,13],'trans light blue',1,'tile'),F([2,3,14],[3,4],'trans light blue',1,'tile'),
 box({at:[6,3,3],size:[2,3,11],colour:'dark tan',top:'tile'}),
 box({at:[6,3,12],size:[5,3,9],colour:'dark tan',top:'tile'}),
 box({at:[1,3,19],size:[11,3,11],colour:'dark tan',top:'tile'}),
 F([12,3,2],[16,16],'light bluish grey',1,'tile'),
 ...[[12,2],[26,2],[12,16],[26,16]].map(([x,z])=>carve({at:[x,3,z],size:[2,1,2]})),
 ...[14,18,22].map(x=>P('3069b',[x,4,2],'yellow')),
 ...[5,9,13].map(z=>P('2431',[6,6,z],'dark tan',90)),
 stairs({at:[1,3,9],width:3,steps:7,dir:'+z',rise:3,colour:'reddish brown',top:'tile'}),
 ...[[9,6,3],[12,15,3],[15,24,3],[16,24,6]].map(([z,y,height])=>column({at:[1,y,z],height,colour:'dark brown'})),
 line({from:[1,9,9],to:[1,30,16],colour:'dark brown'}),
 ...[[7,6,3],[9,3,8],[35,3,14],[36,3,22],[16,3,25],[22,3,28]].map(([x,y,z],i)=>P('3298',[x,y,z],i%2?'dark bluish grey':'dark tan',i%2?90:0)),
 ...[[8,3,2],[10,6,16],[4,6,27],[18,3,28],[24,3,27],[37,3,4]].map(([x,y,z],i)=>P('2423',[x,y,z],i%2?'green':'dark green',i%2?90:0))
]);
function redwood(x,z,height){return [
 cylinder({at:[x,3,z],diameter:4,height,colour:'dark brown',texture:'log'}),
 P('3684a',[x-2,3,z],'reddish brown',90),P('3684a',[x+4,3,z+1],'reddish brown',270),
 P('3684a',[x+1,3,z-2],'reddish brown'),P('3684a',[x+1,3,z+4],'reddish brown',180),
 ...range(4).map(i=>box({at:[x+(i%2?3:0),12+i*9,z+(i%2?1:2)],size:[1,6,1],colour:'reddish brown',interior:'solid'}))
];}
section('Load-bearing redwoods',[
 ...redwood(6,25,57),...redwood(31,25,49),
 cylinder({at:[5,19,24],diameter:6,height:3,colour:'light bluish grey'}),
 cylinder({at:[30,19,24],diameter:6,height:3,colour:'light bluish grey'}),
 box({at:[6,17,20],size:[3,5,7],colour:'reddish brown',texture:'log'}),
 box({at:[31,17,20],size:[3,5,7],colour:'reddish brown',texture:'log'}),
 line({from:[6,49,26],to:[1,55,25],colour:'reddish brown'}),
 line({from:[9,50,26],to:[15,55,25],colour:'reddish brown'}),
 line({from:[7,49,25],to:[7,55,23],colour:'reddish brown'}),
 F([1,56,24],[15,2],'reddish brown'),
 line({from:[31,43,26],to:[27,48,27],colour:'reddish brown'}),
 line({from:[34,43,26],to:[38,48,27],colour:'reddish brown'}),
 F([27,49,26],[12,2],'reddish brown')
]);
section('Timber orbital platforms and catwalk',[
 F([1,22,15],[13,12],'reddish brown',2,'tile'),
 F([28,22,19],[10,10],'reddish brown',2,'tile'),
 box({at:[13,20,22],size:[16,3,1],colour:'dark brown',interior:'solid'}),
 F([13,22,21],[16,3],'reddish brown'),
 ...range(13,29).map(x=>P('63864',[x,23,21],x%3?'dark tan':'reddish brown',90)),
 ...[13,20,28].flatMap(x=>[column({at:[x,24,20],height:5,colour:'reddish brown'}),column({at:[x,24,24],height:5,colour:'reddish brown'})]),
 ...[20,24].flatMap(z=>[line({from:[13,29,z],to:[20,27,z],colour:'dark brown'}),line({from:[20,27,z],to:[28,29,z],colour:'dark brown'})]),
 fence({path:[[1,26],[4,26]],y:24,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[34,19],[37,19]],y:24,colour:'blue',style:'lattice-low'}),
 P('87079p50',[5,24,15],'blue'),P('3069bp25',[29,24,24],'blue'),
 P('4345b',[34,24,21],'light bluish grey'),P('3068bp5e',[34,30,21],'white')
]);
section('Octagonal saucer tree-hut',[
 box({at:[3,24,17],size:[8,21,8],colour:'blue',open:['top']}),
 F([4,24,18],[6,6],'reddish brown',1,'tile'),
 ...[[3,17],[10,17],[3,24],[10,24]].map(([x,z])=>carve({at:[x,24,z],size:[1,21,1]})),
 ...[[3,17,0],[9,17,270],[3,23,90],[9,23,180]].flatMap(([x,z,t])=>[24,27,39,42].map(y=>P('3063b',[x,y,z],'blue',t))),
 P('2437',[3,32,17],'trans yellow'),P('2437',[7,32,17],'trans yellow'),P('2437',[3,33,20],'trans yellow',90),
 carve({at:[9,24,21],size:[2,18,2]}),
 column({at:[10,24,20],height:18,colour:'reddish brown'}),column({at:[10,24,22],height:18,colour:'reddish brown'}),
 P('4490',[10,42,20],'blue',90),
 ...[2,11].map(x=>column({at:[x,24,20],height:21,colour:'reddish brown'})),
 ...[2,11].map(x=>P('11477',[x,45,20],'reddish brown')),
 P('3961',[3,45,17],'blue'),P('44375a',[4,48,18],'blue'),P('3960',[5,50,19],'blue'),
 P('3957a',[6,52,20],'light bluish grey'),P('6141',[6,64,20],'trans red')
]);
section('Listening dish in a branch nest',[
 column({at:[32,24,19],height:8,diameter:2,colour:'light bluish grey'}),
 P('3961',[29,32,16],'light bluish grey'),
 P('3957a',[32,35,19],'black'),P('6141',[32,47,19],'trans red'),
 ...[[29,18],[36,18],[29,23],[36,23]].map(([x,z])=>column({at:[x,24,z],height:7,colour:'reddish brown',cap:'tile'})),
 P('3068bp5e',[34,24,25],'white')
]);
function skid(x,z){return [P('4032b',[x,4,z],'light bluish grey'),P('4032b',[x,5,z],'light bluish grey')];}
section('Leaf-wing timber survey glider',[
 ...[[16,9],[23,9],[16,14],[23,14]].flatMap(([x,z])=>skid(x,z)),
 P('3035',[16,6,8],'light bluish grey'),P('3020',[18,6,4],'light bluish grey'),F([18,6,12],[4,8],'light bluish grey'),
 ...[12,20].flatMap(x=>[P('3460',[x,6,12],'reddish brown'),P('3460',[x,6,14],'reddish brown')]),
 box({at:[18,7,6],size:[4,3,14],colour:'blue',top:'tile'}),
 P('41770a',[18,7,2],'blue'),P('41769a',[20,7,2],'blue'),
 P('15068',[18,8,4],'blue'),P('15068',[20,8,4],'blue'),
 P('4474',[18,10,6],'trans yellow'),
 P('87079p50',[18,10,13],'blue'),P('2340',[19,10,15],'blue'),
 P('3933',[14,7,8],'blue'),P('3934',[22,7,8],'blue'),
 P('2431',[17,8,12],'light bluish grey',90),P('2431',[22,8,12],'light bluish grey',90),
 P('63864',[16,8,13],'dark tan',90),P('63864',[23,8,13],'dark tan',90),
 P('3068bp5e',[24,8,13],'white'),
 ...[12,27].flatMap(x=>[P('4477',[x,7,8],'reddish brown',90),P('61678',[x,8,8],'reddish brown'),P('61678',[x,8,12],'reddish brown'),P('11477',[x,8,16],'reddish brown')]),
 P('2423',[12,11,14],'dark green'),P('2423',[25,11,14],'dark green'),
 ...[15,24].flatMap(x=>[P('3941',[x,9,16],'light bluish grey'),P('3942c',[x,12,16],'light bluish grey'),P('3941',[x,18,16],'trans red')]),
 P('3020',[14,8,16],'light bluish grey'),P('3020',[22,8,16],'light bluish grey'),
 ...[18,21].map(x=>P('6141',[x,8,2],'trans red'))
]);
section('Wood-fired recharge station',[
 box({at:[28,3,17],size:[2,9,2],colour:'blue',texture:'log'}),
 P('3069bp25',[28,12,17],'blue'),P('3062b',[29,12,18],'trans red'),P('98138',[29,15,18],'red'),
 line({from:[27,8,17],to:[28,8,18],colour:'dark bluish grey'}),
 P('4345b',[30,3,11],'light bluish grey'),P('3068b',[30,9,11],'yellow')
]);
component('Ewok space ranger',{size:[3,3],ops:[P('41879a',[1,0,1],'reddish brown'),P('76382p6g',[0,4,0],'blue'),P('64805',[1,11,0],'reddish brown')]});
component('Ewok red ranger',{size:[3,3],ops:[P('41879a',[1,0,1],'reddish brown'),P('76382p6j',[0,4,0],'red'),P('64805',[1,11,0],'dark tan')]});
component('Ewok mechanic',{size:[3,3],ops:[P('41879a',[1,0,1],'reddish brown'),P('76382p3z',[0,4,0],'reddish brown'),P('64805',[1,11,0],'reddish brown')]});
section('Three forest astronauts at work',[
 instance({component:'Ewok space ranger',at:[22,24,21]}),instance({component:'Ewok mechanic',at:[8,3,5],turn:270}),instance({component:'Ewok red ranger',at:[32,3,7]}),
 column({at:[36,3,8],height:12,colour:'reddish brown'}),P('4589',[36,15,8],'trans yellow'),
 P('3069bp25',[10,3,5],'white')
]);
section('Connected layered forest canopy',[
 P('2423',[1,57,22],'dark green'),P('6141',[5,57,25],'reddish brown'),P('2423',[4,58,24],'green'),
 P('2423',[7,60,25],'green'),P('2423',[10,57,23],'dark green'),P('2423',[13,57,24],'green'),
 P('2417',[0,58,22],'dark green'),P('2417',[9,58,23],'green'),P('2417',[4,61,25],'dark green'),P('2417',[5,62,21],'green'),
 P('2423',[27,50,24],'dark green'),P('2423',[30,52,25],'green'),P('2423',[34,50,25],'dark green'),P('2423',[37,50,26],'green'),
 P('2417',[26,51,23],'green'),P('2417',[34,51,24],'dark green'),P('2417',[29,53,26],'green')
]);