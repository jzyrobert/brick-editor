script({title:'Tour de Fish — Pelican on a Bicycle',description:'A long-billed white pelican pedals a turquoise road bicycle, its sweeping wings gripping the handlebars and a red scarf streaming behind. Real motorcycle wheels, an open diamond frame, staggered webbed feet and a deep golden throat pouch give this character a lively profile.',palette:{bird:'white',bike:'medium azure',bill:'orange',pouch:'yellow'},defaults:{interior:'solid'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const L=(from,to,colour)=>line({from,to,colour});
const front=5,rear=23,crank=14;
function wheel(x){return [P('2903c02',[x-5,0,4],'light bluish grey'),...[2,7].map(z=>P('3700',[x-1,12,z],'light bluish grey')),L([x,13,2],[x,13,7],'light bluish grey')];}
section('Rolling chassis',[
 wheel(front),wheel(rear),
 ...[2,7].map(z=>[
 L([front,14,z],[8,31,z],'bike'),L([8,30,z],[20,30,z],'bike'),
 L([8,30,z],[crank,18,z],'bike'),L([crank,18,z],[20,30,z],'bike'),
 L([20,30,z],[rear,14,z],'bike'),L([rear,14,z],[crank,18,z],'bike')]),
 floor({at:[18,30,2],size:[4,6],colour:'bike'}),
 box({at:[19,31,3],size:[3,1,4],colour:'black'}),
 ...[3,5].map(z=>P('15068',[19,32,z],'black',270)),
 column({at:[7,30,4],height:7,diameter:2,colour:'light bluish grey'}),
 floor({at:[6,37,0],size:[1,10],colour:'black',top:'tile'}),
 ...[0,9].map(z=>floor({at:[6,37,z],size:[8,1],colour:'black'})),
 L([crank,22,1],[crank,22,8],'light bluish grey'),
 L([crank,19,1],[crank,22,1],'light bluish grey'),L([crank,22,8],[crank,26,8],'light bluish grey'),
 floor({at:[11,18,0],size:[4,2],colour:'black'}),floor({at:[11,25,8],size:[4,2],colour:'black'}),
 P('3700',[13,20,2],'light bluish grey'),P('3700',[13,20,7],'light bluish grey')
]);
section('Compact balance stand',[
 P('60474',[13,0,3],'dark bluish grey'),P('60474',[13,1,3],'dark bluish grey'),
 column({at:[14,2,4],diameter:2,height:20,colour:'trans-clear'})
]);
function foot(z,y){return [P('41769a',[11,y,z],'bill',90),P('30363',[11,y+1,z],'bill',90)];}
section('Pedalling webbed feet',[
 foot(0,19),foot(8,26),
 L([14,23,1],[17,27,1],'bill'),L([17,27,1],[19,36,2],'bill'),
 L([14,30,8],[17,30,8],'bill'),L([17,30,8],[20,36,7],'bill'),
 P('3062b',[17,27,1],'bill'),P('3062b',[17,30,8],'bill')
]);
section('Rounded body and feathered tail',[
 box({at:[18,33,3],size:[3,9,4],colour:'bird'}),
 P('45410',[15,35,1],'bird'),
 box({at:[15,41,2],size:[9,7,6],colour:'bird',top:'tile'}),
 floor({at:[18,43,0],size:[5,10],colour:'bird'}),
 P('45411',[15,48,1],'bird'),
 ...[1,3,5,7].map(z=>P('24309',[21,48,z],'bird',270)),
 box({at:[22,41,2],size:[4,3,6],colour:'bird',top:'tile'}),
 ...[2,4,6].map(z=>[P('42022',[23,44,z],'black',270),P('61678',[23,47,z],'bird',270)]),
 ...[3,5].map(z=>P('61678',[23,44,z],'bird',270))
]);
function wing(z,inner){return [
 L([8,37,z],[21,44,z],'bird'),
 ...[[8,35],[13,38],[18,41]].map(([x,y])=>[P('42023',[x,y,z],'bird',90),P('42022',[x,y+3,z],'bird',90)]),
 P('42022',[13,41,inner],'bird',90),P('42022',[18,44,inner],'bird',90),
 P('11477',[6,38,z],'black',90)
];}
section('Wings reaching the grips',[wing(0,1),wing(9,8)]);
section('Sweeping neck and scarf',[
 box({at:[13,49,3],size:[4,9,4],colour:'bird'}),
 box({at:[11,56,3],size:[4,8,4],colour:'bird'}),
 box({at:[11,61,3],size:[4,6,4],colour:'bird'}),
 ...[3,4,5,6].map(z=>[
 P('13547',[11,49,z],'bird',90),P('61678',[10,53,z],'bird',90),
 P('61678',[10,60,z],'bird',90),P('11477',[15,55,z],'bird',270)]),
 floor({at:[11,59,3],size:[4,4],colour:'red',top:'tile'}),
 floor({at:[15,59,5],size:[5,1],colour:'red',top:'tile'}),P('11477',[19,59,5],'red',270)
]);
section('Pelican face and enormous bill',[
 box({at:[9,65,2],size:[6,8,6],colour:'bird',top:'tile'}),
 ...[2,4,6].map(z=>P('32803',[9,65,z],'bird',90)),
 P('3005pe4',[10,70,2],'white'),P('3005pe4',[10,70,7],'white',180),
 ...[9,11,13].map(x=>[P('15068',[x,73,2],'bird'),P('15068',[x,73,6],'bird',180)]),
 P('15068',[9,73,4],'bird',90),P('15068',[13,73,4],'bird',270),
 floor({at:[11,73,4],size:[2,2],colour:'bird',top:'tile'}),
 box({at:[3,63,3],size:[7,4,4],colour:'pouch'}),
 ...[3,4,5,6].map(z=>P('42023',[3,60,z],'pouch',90)),
 P('32803',[1,63,3],'pouch',90),P('32803',[1,63,5],'pouch',90),
 floor({at:[-1,67,3],size:[11,4],colour:'dark orange'}),floor({at:[-3,67,4],size:[2,2],colour:'bill'}),
 ...[3,4,5,6].map(z=>P('42022',[3,68,z],'bill',90)),
 ...[4,5].map(z=>[P('61678',[-1,68,z],'bill',90),P('11477',[-3,68,z],'bill',90)]),
 box({at:[9,68,3],size:[1,3,4],colour:'bill',top:'tile'}),
 P('3070b',[8,71,3],'black'),P('3070b',[8,71,6],'black')
]);