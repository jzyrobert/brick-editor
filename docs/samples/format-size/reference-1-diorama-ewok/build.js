script({title:'Moonwood 1979 — Ewok Canopy Command',description:'A Classic Space outpost grown around living redwoods: a blue radar lodge with amber ports, a timber moon-glider with swept blue wings, and Ewok astronauts collecting lunar samples. The climbing stair, plank bridge and stump landing pad form one playable forest-moon port.',palette:{wood:'reddish brown',bark:'dark brown',space:'blue',metal:'light bluish grey',leaf:'dark green'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const F=(at,size,colour,layers=1)=>floor({at,size,colour,layers,top:'tile'});
const B=(at,size,colour)=>box({at,size,colour,interior:'solid'});
section('Bound forest-moon display',[
 F([0,0,0],[36,30],'black',2),floor({at:[1,2,1],size:[34,28],colour:'olive green',layers:2}),
 F([22,4,2],[12,7],'dark azure'),F([24,5,3],[9,5],'trans light blue'),
 floor({at:[2,4,12],size:[13,16],colour:'dark green'}),floor({at:[15,4,6],size:[7,13],colour:'dark tan'}),
 P('3961',[4,4,3],'light bluish grey'),P('15068',[3,4,2],'dark bluish grey',90),P('15068',[11,4,9],'light bluish grey',270),
 ...[[2,6],[2,10],[13,11],[12,15],[4,20],[15,27],[25,11],[34,13],[27,27]].map(([x,z],i)=>P('32607',[x,5,z],i%3?'dark green':'green',i%4*90)),
 P('2423',[1,5,21],'green'),P('2423',[27,4,9],'dark green',90),
 P('2489',[14,4,5],'reddish brown'),P('3039p34',[14,9,5],'blue'),P('2489',[12,5,11],'dark brown'),
 P('3070b',[1,2,1],'blue'),P('2431',[14,2,0],'blue'),P('2431',[18,2,0],'light bluish grey')
]);
section('Living redwood supports',[
 cylinder({at:[6,4,23],diameter:6,height:9,colour:'wood'}),cylinder({at:[7,13,24],diameter:4,height:45,colour:'wood'}),cylinder({at:[8,58,25],diameter:2,height:10,colour:'wood'}),
 ...[[6,4,21,0],[10,4,21,0],[4,4,25,90],[12,4,25,270],[7,4,28,180],[10,4,28,180]].map(([x,y,z,t])=>P('4460b',[x,y,z],'reddish brown',t)),
 ...[[7,24],[10,25],[8,27]].map(([x,z])=>B([x,13,z],[1,42,1],'dark brown')),
 column({at:[3,5,14],height:19,colour:'wood'}),column({at:[14,5,17],height:19,colour:'wood'}),column({at:[3,5,26],height:19,colour:'wood'}),
 cylinder({at:[29,4,24],diameter:4,height:20,colour:'wood'}),P('4460b',[28,4,22],'reddish brown'),P('4460b',[33,4,25],'reddish brown',270),
 cylinder({at:[31,26,26],diameter:2,height:22,colour:'wood'}),
 B([3,60,24],[6,3,2],'wood'),B([9,61,26],[7,3,2],'wood'),B([7,64,21],[2,3,5],'wood'),
 P('2417',[1,63,22],'dark green'),P('2417',[2,67,19],'green',90),P('2417',[11,64,25],'dark green'),P('2423',[7,67,19],'dark green'),
 B([28,48,26],[5,3,1],'wood'),P('2417',[27,51,24],'green'),P('2423',[32,52,25],'dark green',90)
]);
section('Planks, bridge and climbing route',[
 F([1,24,13],[15,16],'wood'),...range(13,29).map(z=>F([1,25,z],[15,1],z%3===0?'dark tan':'wood')),
 floor({at:[15,23,23],size:[8,2],colour:'wood'}),F([16,24,22],[5,4],'wood',2),...range(16,21).map(x=>F([x,25,22],[1,4],x%2?'dark tan':'wood')),
 F([21,24,17],[14,12],'dark bluish grey',2),F([21,25,17],[14,1],'blue'),F([21,25,28],[14,1],'blue'),F([34,25,18],[1,10],'blue'),
 ...range(8).map(i=>P('3070b',[23+i,26,27],i%2?'black':'yellow')),
 fence({path:[[1,14],[1,26]],y:26,colour:'reddish brown',style:'lattice-low'}),fence({path:[[2,28],[6,28]],y:26,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[16,22],[20,22]],y:26,colour:'reddish brown',style:'lattice-low'}),fence({path:[[16,25],[20,25]],y:26,colour:'reddish brown',style:'lattice-low'}),
 stairs({at:[16,4,12],width:3,steps:11,dir:'+z',rise:2,colour:'wood',top:'tile'}),
 ...range(5).map(i=>column({at:[18,8+4*i,13+2*i],height:5,colour:'wood'})),line({from:[18,13,13],to:[18,29,21],colour:'dark tan'}),
 P('3039p23',[22,26,23],'blue'),P('2489',[12,26,14],'reddish brown'),P('4032b',[12,31,14],'light bluish grey'),P('6141',[12,32,14],'trans green')
]);
section('Blue thatch radar lodge',[
 cylinder({at:[4,26,18],diameter:10,height:12,colour:'wood',texture:'log'}),
 carve({at:[5,26,19],size:[8,12,4]}),carve({at:[7,26,17],size:[4,9,3]}),
 P('3659',[7,35,18],'blue'),P('3004p90',[5,29,18],'blue'),
 P('2437',[4,29,20],'trans yellow',90),P('2437',[11,29,20],'trans yellow',270),
 P('3039p34',[7,26,21],'blue'),P('4079',[10,26,21],'reddish brown'),
 floor({at:[3,36,17],size:[12,2],colour:'wood'}),...[4,6,8,10,12].map(x=>P('3069b',[x,37,17],'dark tan')),
 roof({style:'hip',at:[4,38,18],size:[10,10],colour:'blue',overhang:1,holes:[{at:[7,24],size:[4,4]}]}),
 column({at:[8,68,25],height:3,diameter:2,colour:'light bluish grey'}),P('4285b',[6,71,23],'light bluish grey'),P('3062b',[8,73,25],'blue'),P('3957a',[8,76,25],'light bluish grey'),P('6141',[8,88,25],'trans red'),
 column({at:[14,26,14],height:6,colour:'blue'}),P('6141',[14,32,14],'trans yellow'),
 P('3004p90',[30,39,26],'blue'),P('2335',[31,42,26],'blue')
]);
section('Timber moon-glider',[
 ...[[24,18],[28,18],[24,22],[28,22]].map(([x,z])=>column({at:[x,26,z],height:3,colour:'dark bluish grey'})),
 ...[20,32].flatMap(x=>[P('3941',[x,26,19],'trans red'),P('3941',[x,29,19],'light bluish grey')]),
 B([24,29,9],[6,4,14],'wood'),P('43713',[25,29,6],'light bluish grey'),F([24,33,9],[6,14],'blue'),
 P('50950',[25,32,6],'blue'),P('3298p90',[26,32,6],'blue'),P('50950',[28,32,6],'blue'),
 P('4474',[25,34,10],'trans yellow'),P('3298p90',[26,34,17],'blue',180),P('64225',[25,34,20],'blue',180),
 ...[24,29].flatMap(x=>[P('61678',[x,34,10],'reddish brown'),P('61678',[x,34,14],'reddish brown'),P('61678',[x,34,18],'reddish brown'),P('4460b',[x,37,20],'blue',180)]),
 P('41770a',[22,32,12],'blue'),P('41769a',[30,32,12],'blue'),P('41770a',[20,32,14],'light bluish grey'),P('41769a',[32,32,14],'light bluish grey'),
 P('3022',[22,32,16],'blue'),P('3022',[30,32,16],'blue'),P('3031',[20,32,18],'blue'),P('3031',[30,32,18],'blue'),F([20,33,18],[14,4],'light bluish grey'),
 ...[20,22,30,32].map(x=>P('15068',[x,34,18],'blue')),
 ...[20,30].flatMap(x=>[P('2431',[x,34,20],'dark tan'),P('2431',[x,34,21],'reddish brown')]),
 P('2423',[20,35,20],'dark green'),P('2423',[31,35,20],'green'),P('3957a',[20,37,19],'blue'),P('3957a',[33,37,19],'blue'),
 P('2412b',[26,34,9],'light bluish grey'),P('6141',[24,37,17],'trans red'),P('6141',[29,37,17],'trans green')
]);
function ewok(name,torso,colour){component(name,{size:[4,3],ops:[P('41879a',[0,0,0],'reddish brown'),P(torso,[0,4,0],colour),P('64805',[0,11,0],'reddish brown')]});}
ewok('Scout','76382p90','white');ewok('Commander','76382p6j','red');ewok('Keeper','76382pdg1','reddish brown');
section('Ewok crew at work',[
 instance({component:'Scout',at:[17,4,7],turn:90}),instance({component:'Keeper',at:[3,26,13]}),instance({component:'Commander',at:[21,26,25],turn:90}),
 column({at:[6,26,14],height:3,diameter:2,colour:'light bluish grey'}),P('3960',[5,29,13],'light bluish grey'),P('6141',[6,31,14],'trans yellow'),
 P('3022',[8,26,14],'blue'),P('3039p23',[8,27,14],'blue'),P('32607',[9,30,15],'green'),
 P('3062b',[20,5,4],'blue'),P('4589',[20,8,4],'yellow')
]);