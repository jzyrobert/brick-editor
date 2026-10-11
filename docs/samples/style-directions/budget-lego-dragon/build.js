script({title:'Emberwing and the Last Egg',description:'A protective crimson dragon with swept bat wings, an open toothed muzzle, ivory horns and a hooked tail sheltering its precious egg.',palette:{hide:'dark red',scale:'red',belly:'tan',bone:'white',membrane:'dark red'},defaults:{interior:'solid'}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function haunch(x,turn){return [floor({at:[x,0,1],size:[4,6],colour:'hide'}),box({at:[x,1,3],size:[4,6,4],colour:'hide',top:'tile'}),...range(4).map(i=>p('11477',[x+i,1,1],'hide')),...[3,5].map(z=>p('93606',[x,7,z],'scale',turn)),...[0,1,3].map(i=>p('49668',[x+i,1,0],'bone'))];}
section('Powerful haunches',[haunch(-6,90),haunch(2,270)]);
section('Torso and breast',[
floor({at:[-3,4,2],size:[6,8],layers:2,colour:'hide',top:'tile'}),box({at:[-2,6,3],size:[4,12,6],colour:'hide',top:'tile'}),
...[-2,0].map(x=>p('32803',[x,6,1],'belly')),...[-2,0].map(x=>p('3678b',[x,10,1],'belly')),...[-2,0].map(x=>p('15068',[x,16,2],'belly')),
...[-2,0].map(x=>p('93606',[x,7,8],'hide',180)),...[-2,0].map(x=>p('93606',[x,11,7],'hide',180)),...[-2,0].map(x=>p('15068',[x,15,7],'scale',180)),
floor({at:[-2,18,1],size:[4,5],colour:'scale',top:'tile'}),box({at:[-1,19,1],size:[2,8,4],colour:'scale',top:'tile'}),
...[-2,1].map(x=>p('60481a',[x,19,2],'hide')),...[-2,1].map(x=>p('11477',[x,25,2],'scale')),
p('3039',[-1,21,0],'belly'),p('15068',[-1,24,0],'belly'),
box({at:[-4,10,-2],size:[2,6,6],colour:'hide',top:'tile'}),box({at:[2,10,-2],size:[2,6,6],colour:'hide',top:'tile'}),
floor({at:[-4,16,3],size:[8,2],colour:'scale',top:'tile'}),...[-4,2].map(x=>p('24309',[x,16,-2],'scale')),
...[-4,-3,2,3].map(x=>p('49668',[x,10,-3],'bone')),
...[-3,2].map(x=>p('11477',[x,17,5],'hide',180)),
...range(2).map(i=>p('54200',[0,18,6+i],'belly',180))
]);
section('Curled supporting tail',[
box({at:[-2,0,7],size:[4,4,3],colour:'hide',top:'tile'}),box({at:[-2,0,9],size:[4,3,4],colour:'hide',top:'tile'}),
...[-2,0].map(x=>p('93606',[x,3,9],'hide',180)),
floor({at:[0,0,12],size:[6,2],layers:2,colour:'hide',top:'tile'}),p('93606',[0,2,12],'scale',270),p('15068',[4,2,12],'hide',270),
floor({at:[4,0,11],size:[4,2],colour:'hide',top:'tile'}),p('40379',[6,1,11],'hide',270),p('54200',[0,6,12],'belly',270)
]);
function wing(left,y){const x=left?-14:2;const finger=left?[-12,-8,-4]:[2,6,10];return [
p(left?'30355':'30356',[x,y,5],'membrane',left?90:270),
...range(3).map(i=>p('61678',[x+4*i,y+1,5],'scale',left?90:270)),
...finger.map(f=>p(left?'41770a':'41769a',[f,y+1,9],'membrane',180)),
...finger.map(f=>p('61678',[f,y+2,9],'scale',180)),
...finger.map(f=>p('3069b',[f,y+1,7],'hide')),
p('4589',[left?-3:2,y+4,5],'bone')];}
section('Swept sheltering wings',[
box({at:[-4,16,5],size:[2,4,3],colour:'hide',top:'tile'}),box({at:[2,16,5],size:[2,6,3],colour:'hide',top:'tile'}),wing(true,20),wing(false,22)
]);
section('Expressive horned head',[
box({at:[-2,26,0],size:[4,9,4],colour:'scale',top:'tile'}),
...range(4).map(i=>p('13547',[-2+i,23,-4],'hide')),
floor({at:[-2,26,-5],size:[4,6],colour:'hide',top:'tile'}),
p('3023b',[-1,27,-4],'red'),p('3023b',[-1,28,-3],'red'),
p('4589',[-2,27,-4],'bone'),p('4589',[1,27,-4],'bone'),
floor({at:[-2,30,-5],size:[4,6],colour:'black'}),floor({at:[-2,31,-5],size:[4,6],colour:'scale'}),
...[-2,0].map(x=>p('93606',[x,32,-5],'scale')),
...[-3,2].map(x=>box({at:[x,30,-2],size:[1,5,3],colour:'hide',top:'tile'})),
...[-3,2].map(x=>p('10238',[x,35,-2],'white')),
floor({at:[-3,35,0],size:[6,4],colour:'hide',top:'tile'}),
...[-3,2].map(x=>p('11477',[x,36,-1],'scale')),
...[-3,2].map(x=>p('40379',[x,36,1],'bone')),
p('54200',[-1,36,2],'belly',180),p('54200',[0,36,2],'belly',180),
p('3070b',[-2,36,-2],'black'),p('3070b',[1,36,-2],'black')
]);
section('The last egg',[
floor({at:[-1,0,-4],size:[3,3],layers:2,colour:'dark brown',top:'tile'}),p('24946',[0,2,-3],'tan'),p('25269',[-1,2,-4],'reddish brown'),p('25269',[1,2,-2],'reddish brown',180)
]);