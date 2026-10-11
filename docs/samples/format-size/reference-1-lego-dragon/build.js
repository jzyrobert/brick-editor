script({title:'The Last Ember — a dragon guarding its egg',description:'A crimson dragon lowers its horned head over one glowing egg. Great black bat wings, a golden throat, muscular clawed feet and a curling spined tail make a freestanding guardian.',palette:{hide:'dark red',belly:'tan',horn:'tan',wing:'black',ember:'trans yellow'},defaults:{interior:'solid'}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const b=(at,size,colour='hide')=>box({at,size,colour,interior:'solid',top:'tile'});
const f=(at,size,layers,colour)=>floor({at,size,layers,colour,top:'tile'});
function paw(x,z,rear){const w=rear?5:4;return [f([x,0,z],[w,rear?8:6],2,'hide'),b([x+1,2,z+2],[w-1,3,4]),[0,2,w-1].map(k=>p('15070',[x+k,2,z],'horn')),rear?[p('93606',[x+1,5,z+1],'hide'),p('93606',[x+3,5,z+1],'hide')]:[p('15068',[x+1,5,z+2],'hide'),p('11477',[x+3,5,z+2],'hide')]];}
section('Four planted feet and powerful limbs',[
 paw(-7,-7,false),paw(3,-7,false),paw(-9,6,true),paw(4,6,true),
 [-6,4].map(x=>[b([x,2,-4],[2,7,5]),b([x,8,0],[2,12,4]),b([x===-6?-6:3,17,3],[3,6,3]),p('93606',[x,8,-4],'hide'),p('93606',[x,20,0],'hide')]),
 [-8,4].map((x,i)=>[b([x,5,9],[4,11,6]),b([i===0?-5:3,12,9],[2,6,5]),[9,11,13].map(z=>p('93606',[x,16,z],'hide',i===0?90:270))])
]);
section('Rounded torso and arched golden throat',[
 b([-3,7,5],[6,8,7]),b([-4,13,3],[8,12,10]),b([-5,10,5],[10,10,8]),
 [5,7,9,11].map(z=>[p('3660b',[-5,10,z],'hide',90),p('3660b',[3,10,z],'hide',270)]),
 range(4,13).map(z=>[p('11477',[-5,20,z],'hide',90),p('11477',[3,20,z],'hide',270)]),
 [3,5,7,9,11].map(z=>[p('93606',[-4,25,z],'hide',90),p('93606',[0,25,z],'hide',270),p('3022',[-1,29,z],'hide')]),
 [5,8,11].map(z=>p('3942c',[-1,30,z],'horn')),
 b([-2,8,2],[4,12,1],'belly'),range(-2,2).map(x=>p('11477',[x,18,1],'belly')),
 b([-3,20,0],[6,10,5]),b([-2,28,-1],[4,13,4]),
 range(-2,2).map(x=>[p('4460b',[x,21,0],x===-1||x===0?'belly':'hide'),p('4460b',[x,30,-2],x===-1||x===0?'belly':'hide')]),
 [0,1,2].map(z=>[p('11477',[-3,30,z],'hide',90),p('11477',[1,30,z],'hide',270)]),
 [-3,-1,1].map(x=>p('15068',[x,30,3],'hide',180)),
 f([-2,41,-1],[4,4],2,'hide'),p('4589',[0,43,2],'horn')
]);
section('Great black wings',[
 b([-6,22,7],[3,4,1],'wing'),b([3,22,7],[3,4,1],'wing'),
 p('3941',[-6,22,6],'wing'),p('3941',[4,22,6],'wing'),
 p('4032b',[-6,25,6],'wing'),p('4032b',[4,25,6],'wing'),
 p('51342',[-23,26,7],'wing'),p('51342',[5,26,7],'wing',180)
]);
section('Long muzzle, bright eyes and swept horns',[
 b([-3,38,-7],[6,4,7]),range(-3,3).map(x=>p('24201',[x,38,-8],'hide')),
 f([-3,42,-7],[6,6],1,'black'),
 [-3,2].map(x=>[-6,-4].map(z=>p('54200',[x,43,z],'white'))),
 [-4,3].map(x=>b([x,42,-3],[1,5,4])),
 f([-3,45,-8],[6,8],1,'hide'),f([-4,46,-4],[8,5],1,'hide'),
 [-3,-1,1].map(x=>p('93606',[x,46,-8],'hide')),
 [-2,0].map(x=>[p('15068',[x,47,-3],'hide'),p('15068',[x,47,-1],'hide')]),
 [-4,3].map(x=>p('11477',[x,47,-3],'hide')),
 [-3,2].map(x=>[p('3062b',[x,47,-4],'dark orange'),p('10238',[x,50,-4],'white'),b([x,47,-3],[1,3,2]),p('54200',[x,50,-3],'hide'),p('3062b',[x,47,0],'horn'),p('4589',[x,50,0],'horn'),p('11089',[x,53,0],'horn',180)]),
 [-2,1].map(x=>p('98138',[x,50,-5],'black'))
]);
section('Tail curling back around the guardian',[
 b([-3,5,12],[6,7,5]),b([-2,2,16],[4,6,5]),b([0,0,20],[4,5,5]),b([3,0,22],[7,3,4]),b([9,0,19],[4,3,5]),b([10,0,15],[2,3,5]),
 [-3,-1,1].map(x=>p('93606',[x,12,13],'hide',180)),
 [-2,0].map(x=>p('93606',[x,8,17],'hide',180)),
 [0,2].map(x=>p('93606',[x,5,21],'hide',180)),
 [22,24].map(z=>p('93606',[4,3,z],'hide',270)),
 [9,11].map(x=>p('93606',[x,3,19],'hide')),
 p('11477',[8,3,24],'hide',270),p('50950',[10,3,15],'hide'),p('50950',[11,3,15],'hide'),p('3069b',[10,3,18],'hide'),
 [[-1,16,13],[-1,12,17],[1,9,21],[4,7,23],[10,7,22]].map(at=>p('4589',at,'horn'))
]);
section('One precious ember egg',[
 p('60474',[-2,0,-6],'black'),p('4032b',[-1,1,-5],'pearl gold'),p('3941',[-1,2,-5],'ember'),p('3942c',[-1,5,-5],'pearl gold'),p('98138',[-1,11,-5],'ember'),
 [[-2,1,-6],[1,1,-6],[-2,1,-3],[1,1,-3]].map(at=>p('98138',at,'pearl gold'))
]);