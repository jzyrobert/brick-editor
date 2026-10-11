script({title:'The Last Sun Egg',description:'An emerald dragon cups the last warm sun egg in its claws. Vast black bat wings frame its horned face; a curling tail and broad ivory-clawed feet support the seated guardian.',palette:{scale:'dark green',belly:'tan',ivory:'tan',wing:'black',egg:'pearl gold'},defaults:{interior:'solid'}});
const P=(part,at,colour='scale',turn=0)=>place({part,at,colour,turn});
function leg(x,z,turn){return [floor({at:[x,0,z],size:[5,8],layers:2,colour:'scale',top:'tile'}),...[0,2,4].map(i=>P('3040b',[x+i,2,z],'ivory')), ...[0,2].flatMap(i=>[P('15068',[x+i,2,z+2]),P('15068',[x+i,2,z+6],'scale',180)]),P('11477',[x+4,2,z+2]),P('11477',[x+4,2,z+6],'scale',180),box({at:[x+1,2,z+4],size:[3,10,2],colour:'scale'}),box({at:[x+1,9,z+4],size:[4,10,4],colour:'scale',top:'tile'}),...[4,6].map(k=>P('93606',[x,15,z+k],'scale',turn)),...[4,6].map(k=>P('11477',[x+4,15,z+k]))];}
section('Clawed feet and folded haunches',[...leg(-8,0,90),...leg(3,1,270),box({at:[-5,15,4],size:[10,6,3],colour:'scale',top:'tile'})]);
section('Rounded chest and shoulder girdle',[
box({at:[-3,9,1],size:[6,21,8],colour:'scale',top:'tile'}),
...[12,15,18].flatMap(y=>[-2,0].map(x=>P('3298',[x,y,-1],'belly'))),
...[-2,0].map(x=>P('44126',[x,21,-2],'belly')),
...[2,4].flatMap(z=>[P('93606',[-6,19,z],'scale',90),P('93606',[2,19,z],'scale',270)]),
P('93606',[-5,23,3]),P('93606',[3,23,3]),
P('93606',[-3,21,7],'scale',180),P('93606',[1,21,7],'scale',180),
box({at:[-1,18,8],size:[2,6,3],colour:'scale'}),
...[-1,0].map(x=>P('3040b',[x,24,9],'ivory',180)),
...[-1,0].map(x=>P('3040b',[x,27,7],'ivory',180)),
P('4589',[-1,30,7],'ivory'),
...[-3,-1,1].map(x=>P('15068',[x,30,5],'scale',180)),
floor({at:[-7,26,5],size:[14,3],layers:1,colour:'scale',top:'tile'})]);
section('Wings and grasping thumbs',[
P('2555',[-7,27,6],'black',180),P('2555',[6,27,6],'black'),
P('51342',[-24,29,6],'wing',180),P('51342',[6,29,6],'wing'),
P('4589',[-7,27,5],'ivory'),P('4589',[6,27,5],'ivory')]);
section('Arched neck',[
box({at:[-2,27,-1],size:[4,10,5],colour:'scale',top:'tile'}),box({at:[-2,34,-4],size:[4,10,4],colour:'scale',top:'tile'}),
...[-2,0].flatMap(x=>[P('44126',[x,30,-4],'belly'),P('44126',[x,35,-6],'belly'),P('93606',[x,38,-2],'scale',180)]),
P('3040b',[-1,42,0],'ivory',180),P('3040b',[0,42,0],'ivory',180)]);
section('Horned face and open jaw',[
box({at:[-3,40,-7],size:[6,5,4],colour:'scale'}),box({at:[-3,41,-5],size:[6,6,3],colour:'scale'}),
floor({at:[-3,39,-11],size:[6,8],layers:2,colour:'scale',top:'tile'}),floor({at:[-3,41,-11],size:[6,7],layers:1,colour:'black',top:'tile'}),
P('54200',[-2,42,-10],'white'),P('54200',[1,42,-10],'white'),
box({at:[-3,44,-11],size:[6,3,5],colour:'scale',top:'tile'}),box({at:[-3,44,-6],size:[6,6,4],colour:'scale',top:'tile'}),
...[-3,-1,1].map(x=>P('15068',[x,46,-11])),
floor({at:[-3,46,-9],size:[6,3],layers:1,colour:'scale',top:'tile'}),
P('98138',[-2,49,-10],'black'),P('98138',[1,49,-10],'black'),
P('41748',[-5,43,-4]),P('41747',[3,43,-4]),
P('3941',[-5,46,-7],'yellow'),P('3941',[3,46,-7],'yellow'),
P('10238',[-4,49,-7],'white'),P('10238',[3,49,-7],'white'),
P('11477',[-5,49,-6]),P('11477',[4,49,-6]),P('54200',[-4,49,-6]),P('54200',[3,49,-6]),
...[-3,-1,1].flatMap(x=>[P('15068',[x,50,-6]),P('15068',[x,50,-4],'scale',180)]),
P('40379',[-3,53,-4],'ivory',180),P('40379',[2,53,-4],'ivory',180),
P('54200',[-1,53,-5],'ivory'),P('54200',[0,53,-5],'ivory')]);
function arm(x){return [box({at:[x,21,-4],size:[2,6,8],colour:'scale',top:'tile'}),P('44126',[x,26,-5]),box({at:[x,19,-7],size:[3,3,4],colour:'scale',top:'tile'}),P('15068',[x,22,-7]),P('54200',[x+2,22,-7],'ivory'),P('54200',[x+2,22,-5],'ivory')];}
section('The precious sun egg',[...arm(-5),...arm(3),floor({at:[-4,18,-7],size:[8,3],layers:1,colour:'scale',top:'tile'}),P('3941',[-1,19,-6],'trans yellow'),P('3942c',[-1,22,-6],'egg')]);
section('Curling tail',[
box({at:[-2,3,8],size:[4,6,7],colour:'scale',top:'tile'}),P('93606',[-2,8,9]),P('93606',[0,8,9]),
box({at:[-1,2,14],size:[7,4,4],colour:'scale',top:'tile'}),P('93606',[1,6,14],'scale',270),P('93606',[1,6,16],'scale',270),
box({at:[5,1,13],size:[4,4,4],colour:'scale',top:'tile'}),P('15068',[5,5,13],'scale',270),P('11477',[7,5,13]),P('15068',[5,5,15],'scale',270),P('15068',[7,5,15],'scale',270),
box({at:[8,0,9],size:[2,5,5],colour:'scale',top:'tile'}),P('44126',[8,5,9]),
box({at:[8,0,6],size:[2,3,4],colour:'scale',top:'tile'}),P('40379',[8,3,6],'scale'),
P('4589',[-1,12,12],'ivory'),P('54200',[1,10,16],'ivory',270),P('54200',[8,8,14],'ivory',180)]);