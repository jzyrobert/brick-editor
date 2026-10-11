script({title:'Yub Nub! The 1978 Forest-Moon Explorer',description:'Classic blue-and-grey Space has grown into an Ewok launch village: an amber acorn observatory, tree-mounted radar, timber skybridge and a leaf-wing scout carrying an acorn fuel cell. Three short forest astronauts prepare the next expedition.',palette:{wood:'reddish brown',bark:'dark brown',space:'blue',metal:'light bluish grey',leaf:'dark green'},defaults:{interior:'empty'}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
section('Connected forest moon display',[
 floor({at:[0,0,0],size:[36,28],layers:2,colour:'black'}),floor({at:[0,2,0],size:[36,1],colour:'dark bluish grey',top:'tile'}),
 floor({at:[1,2,1],size:[34,26],colour:'dark tan'}),
 floor({at:[2,3,18],size:[16,9],colour:'dark green'}),
 floor({at:[27,3,19],size:[8,8],colour:'dark green'}),
 floor({at:[4,3,4],size:[8,12],colour:'tan',top:'tile'}),
 floor({at:[15,3,2],size:[19,16],colour:'light bluish grey',top:'tile'}),
 ...[2,7,12].map(x=>p('2431',[x,3,0],'dark bluish grey')),
 p('87079p50',[16,3,0],'blue'),
 ...[18,28].map(x=>p('2431',[x,4,2],'yellow')),
 ...[[2,4,6,90],[2,4,21,90],[24,3,25,180],[33,4,23,270]].map(([x,y,z,t])=>p('32607',[x,y,z],'green',t))
]);
function roots(x,z,y){return [cylinder({at:[x,y,z],diameter:4,height:5,colour:'wood'}),...[[x-2,z+1,90],[x+4,z+1,270],[x+1,z-2,0],[x+1,z+4,180]].map(([a,b,t])=>p('3298',[a,y,b],'reddish brown',t))];}
function tree(x,z,h){return [
 ...roots(x,z,4),cylinder({at:[x,9,z],diameter:4,height:h-5,colour:'wood'}),
 ...range(5).map(i=>p('30136',[x,12+i*9,z],'dark brown')),
 box({at:[x-3,h-3,z+1],size:[10,3,2],colour:'wood',interior:'solid'}),
 box({at:[x+1,h,z-3],size:[2,3,10],colour:'wood',interior:'solid'}),
 p('2417',[x-4,h,z-2],'dark green'),p('2417',[x+3,h,z],'green',90),
 p('2417',[x-1,h+3,z-5],'green',90),p('2417',[x-1,h+3,z+4],'dark green',90),
 floor({at:[x,h+3,z],size:[4,4],colour:'wood'}),p('2417',[x-1,h+4,z-1],'dark green'),
 p('2423',[x,h+5,z],'green')
 ];}
section('Living launch towers',[
 ...tree(12,22,60),...tree(29,21,48),
 box({at:[4,3,17],size:[2,22,2],colour:'wood',texture:'log',interior:'solid'}),
 box({at:[4,3,24],size:[2,22,2],colour:'wood',texture:'log',interior:'solid'}),
 box({at:[4,22,16],size:[12,3,2],colour:'wood',interior:'solid'}),
 box({at:[4,22,24],size:[12,3,2],colour:'wood',interior:'solid'}),
 floor({at:[2,25,14],size:[16,12],layers:2,colour:'wood',top:'tile',holes:[{at:[12,22],size:[4,4]}]}),
 floor({at:[26,25,17],size:[8,10],layers:2,colour:'wood',top:'tile',holes:[{at:[29,21],size:[4,4]}]}),
 floor({at:[18,25,20],size:[8,3],layers:2,colour:'tan',top:'tile'}),
 ...range(8).map(i=>p('63864',[18+i,27,20],i%2?'reddish brown':'dark tan',90)),
 fence({path:[[18,19],[25,19]],y:27,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[18,23],[25,23]],y:27,colour:'reddish brown',style:'lattice-low'}),
 fence({path:[[2,14],[5,14]],y:27,colour:'blue',style:'lattice-low'}),
 fence({path:[[12,14],[15,14]],y:27,colour:'blue',style:'lattice-low'}),
 fence({path:[[2,25],[9,25]],y:27,colour:'reddish brown',style:'lattice-low'}),
 stairs({at:[8,3,2],width:3,steps:12,rise:2,run:1,dir:'+z',colour:'reddish brown',top:'tile'}),
 ...[4,12].map(x=>p('3004p90',[x,24,14],'blue'))
]);
section('Amber acorn flight control',[
 cylinder({at:[3,27,16],diameter:8,height:3,colour:'blue'}),
 p('92580',[4,30,17],'trans yellow'),
 floor({at:[3,37,16],size:[8,8],colour:'blue'}),
 p('3961',[3,38,16],'reddish brown'),p('3960',[5,41,18],'light bluish grey'),
 p('3942c',[6,43,19],'blue'),p('3957a',[6,49,19],'light bluish grey'),
 p('6141',[6,61,19],'trans red'),
 p('3004p90',[6,27,16],'blue'),
 box({at:[12,27,17],size:[3,3,2],colour:'blue',interior:'solid'}),
 p('3039p34',[12,30,17],'blue'),p('3062b',[15,27,17],'light bluish grey'),p('6141',[15,30,17],'trans red'),
 p('2489',[3,27,23],'reddish brown')
]);
section('Treetop tracking dish',[
 cylinder({at:[27,27,18],diameter:2,height:9,colour:'blue'}),
 p('44375b',[25,36,16],'light bluish grey'),
 p('3941',[27,38,18],'blue'),p('4740',[27,41,18],'light bluish grey'),
 p('3957a',[27,42,18],'white'),
 box({at:[27,27,25],size:[2,3,2],colour:'blue',interior:'solid'}),p('3039p23',[27,30,25],'blue'),
 p('3957a',[33,27,25],'light bluish grey'),p('6141',[33,39,25],'trans red')
]);
section('Leaf-wing acorn scout',[
 floor({at:[23,4,4],size:[4,12],colour:'dark bluish grey'}),
 box({at:[23,5,4],size:[4,3,12],colour:'blue',interior:'solid'}),
 floor({at:[17,6,8],size:[16,6],colour:'light bluish grey',top:'tile'}),
 ...[18,31].map(x=>column({at:[x,4,10],height:2,colour:'dark bluish grey'})),
 p('4474',[23,8,5],'trans yellow'),
 p('15068',[23,5,4],'blue'),p('15068',[25,5,4],'blue'),
 box({at:[24,4,1],size:[2,1,3],colour:'blue',interior:'solid'}),p('3298p90',[24,5,1],'blue'),
 p('41747',[17,7,8],'blue',90),p('41748',[27,7,8],'blue',270),
 p('43721',[18,7,11],'light bluish grey',90),p('43720',[28,7,11],'light bluish grey',270),
 ...[17,27].map(x=>p('6636',[x,7,13],'reddish brown')),
 ...[19,29].map(x=>[floor({at:[x,6,14],size:[2,5],colour:'light bluish grey'}),p('4746',[x,7,14],'blue')]),
 p('3941',[24,8,13],'reddish brown'),p('4740',[24,11,13],'tan'),p('6141',[24,12,13],'trans yellow'),
 p('3710',[23,8,15],'reddish brown'),
 ...[18,31].map(x=>p('54200',[x,7,8],'trans red'))
]);
function ewok(x,y,z,suit,fur,t=0){return group({at:[x,y,z],turn:t,ops:[p('41879a',[1,0,0],fur),p(suit,[0,4,0],suit==='76382p90'?'white':'blue'),p('64805',[1,11,0],fur)]});}
section('Forest astronaut crew and cargo',[
 ewok(14,27,19,'76382p90','reddish brown'),
 ewok(31,27,18,'76382p91','dark tan'),
 ewok(12,3,7,'76382p91','reddish brown'),
 box({at:[4,4,6],size:[3,2,3],colour:'light bluish grey',top:'tile',interior:'solid'}),
 p('3941',[4,6,6],'reddish brown'),p('4740',[4,9,6],'tan'),
 ...[[3,3,12],[5,3,13],[23,3,24]].map(([x,y,z])=>p('2489',[x,y,z],'reddish brown')),
 ...[[1,3,16],[25,3,23],[21,3,22]].map(([x,y,z])=>p('3039',[x,y,z],'dark bluish grey'))
]);