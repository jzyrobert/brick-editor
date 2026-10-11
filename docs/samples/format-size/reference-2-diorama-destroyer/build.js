script({title:'Opening Shot: Devastator',description:'The Imperial Star Destroyer captures the tiny Tantive IV above Tatooine. A long armoured wedge, recessed belly hangar, eight twin turbolasers, terraced citadel, panoramic command bridge, twin shield-generator globes and seven glowing stern engines form a complete orbital display.',palette:{hull:'light bluish grey',seam:'dark bluish grey',space:'black'},defaults:{interior:'empty'}});
const CX=21,Z0=6,N=8,Y=17;
const p=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
section('Orbital display',[
floor({at:[0,0,0],size:[44,58],layers:3,colour:'space'}),
floor({at:[0,2,0],size:[44,58],colour:'space',top:'tile',holes:[{at:[2,2],size:[40,54]}]}),
cylinder({at:[2,3,2],diameter:14,height:2,colour:'tan'}),
...[[5,6,4],[7,8,6],[9,10,3],[5,12,4]].map(([x,z,w])=>floor({at:[x,4,z],size:[w,1],colour:'dark tan',top:'tile'})),
smooth({region:{at:[2,2],size:[14,14]}}),
p('3960',3,3,18,'yellow'),p('4740',10,3,20,'orange'),
...[[2,29],[6,36],[2,48],[40,7],[36,13],[40,23],[32,4],[24,3],[18,5],[38,36],[41,46],[29,56],[11,55],[3,54],[16,28],[30,18]].map(([x,z],i)=>p('98138',x,3,z,i%4===0?'light bluish grey':'white')),
box({at:[18,3,41],size:[6,14,6],colour:'space',interior:'solid',top:'tile'}),
column({at:[20,3,30],height:14,diameter:2,colour:'trans-clear'}),
column({at:[20,3,18],height:6,diameter:1,colour:'trans-clear'}),
floor({at:[28,3,2],size:[10,4],colour:'seam',top:'tile'}),
p('14769',29,4,3,'light bluish grey'),p('98138',29,5,3,'black'),
p('2431',33,4,3,'light bluish grey'),p('3069b',33,4,4,'light bluish grey')
]);
function hullCourse(k){const z=Z0+6*k,l=18-2*k,r=22+2*k,w=r-l+2;return [
box({at:[l+2,Y,z],size:[w-4,8,6],colour:'hull',top:'tile'}),
p('41765',l,Y,z),p('41764',r,Y,z),
p('78443',l,20,z,'seam'),p('78444',r,20,z,'seam'),
p('78443',l,21,z),p('78444',r,21,z),
p('41748',l,22,z),p('41747',r,22,z),
k>=2&&range(k===7?1:3).map(j=>[p('30363',l+2,22,z+2*j,'hull',90),p('30363',r-4,22,z+2*j,'hull',270)]),
k>=1&&[p('2877',l+2,18,z+1,'seam',90),p('2877',r-1,18,z+1,'seam',90),p('3024',l+2,21,z+4,'trans light blue'),p('3024',r-1,21,z+4,'trans light blue')]
];}
section('Triangular armoured hull',[
...range(N).map(hullCourse),
carve({at:[18,17,20],size:[6,5,8]}),
box({at:[17,16,19],size:[1,2,10],colour:'seam',top:'tile'}),
box({at:[24,16,19],size:[1,2,10],colour:'seam',top:'tile'}),
floor({at:[18,16,19],size:[6,1],colour:'seam',top:'tile'}),
floor({at:[18,16,28],size:[6,1],colour:'seam',top:'tile'}),
floor({at:[19,21,21],size:[4,6],colour:'space',top:'tile'}),
...range(4).map(i=>p('3024',17,18,20+2*i,'trans light blue')),
...[[20,8],[20,16],[20,24]].map(([x,z])=>p('4162',x,24,z,'hull',90)),
p('2412b',20,25,12,'seam',90),p('2412b',20,25,22,'seam',90),
...[[17,26],[23,27],[15,33],[25,33],[13,39],[27,40]].map(([x,z])=>p('2431',x,24,z,'seam',90))
]);
function tier(start,n,core,y){return range(n).map(k=>{const z=start+6*k,w=core+4*(k+1),l=CX-Math.round(w/2),r=l+w-2;return [floor({at:[l+2,y,z],size:[w-4,6],colour:'hull'}),p('78443',l,y,z),p('78444',r,y,z),box({at:[l+2,y+1,z],size:[w-4,3,6],colour:'hull',top:'tile'}),p('41748',l,y+1,z),p('41747',r,y+1,z)];});}
section('Citadel and command tower',[
...tier(30,3,4,25),...tier(36,2,2,29),
box({at:[18,33,40],size:[6,3,8],colour:'hull',top:'tile'}),
p('3298',18,33,40),p('3298',20,33,40),p('3298',22,33,40),
box({at:[19,36,43],size:[4,8,4],colour:'hull',top:'tile'}),
p('3678b',17,38,44,'hull',90),p('3678b',23,38,44,'hull',270),
floor({at:[14,44,42],size:[14,5],colour:'hull'}),
p('3660b',14,41,43,'hull',90),p('3660b',26,41,43,'hull',270),
floor({at:[14,45,42],size:[14,1],colour:'black'}),
...range(4).map(i=>p('3024',14+Math.round(i*13/3),45,42)),
floor({at:[14,46,42],size:[14,1],layers:2,colour:'hull',top:'tile'}),
box({at:[14,45,43],size:[14,3,4],colour:'hull',top:'tile'}),
...[[14,45],[27,45]].map(([x,z])=>p('3070b',x,46,z,'seam')),
...[[15,44],[25,44]].map(([x,z])=>[column({at:[x,48,z],height:3,diameter:2,colour:'hull'}),p('20953',x,51,z)]),
p('4589',21,48,45,'seam'),p('6141',21,51,45,'hull'),
p('2412b',20,48,43,'seam'),
...[[19,33],[22,33],[15,42],[26,42],[15,46],[26,46]].map(([x,z])=>p('2412b',x,29,z,'seam',90)),
...[[19,37],[22,38],[21,44]].map(([x,z])=>p('3069b',x,33,z,'seam',90))
]);
function turret(x,z){return [p('4032b',x,25,z,'seam'),p('15068',x,26,z,'seam'),p('63864',x,29,z-1,'black',90),p('63864',x+1,29,z-1,'black',90)];}
section('Broadside batteries',range(4).map(i=>[turret(13-2*i,30+6*i),turret(27+2*i,30+6*i)]));
section('Seven engine stern',[
box({at:[6,14,49],size:[30,3,8],colour:'seam',top:'tile'}),
...[[10,15,51],[18,15,51],[26,15,51]].map(([x,y,z])=>p('43121',x,y,z,'hull',180)),
...[[7,17,50],[15,17,50],[25,17,50],[33,17,50]].map(([x,y,z])=>p('4868b',x,y,z,'seam',180)),
...[[11,56],[19,56],[27,56]].map(([x,z])=>[p('3004',x,17,z,'trans light blue'),p('3004',x+2,17,z,'trans light blue'),p('3023b',x,20,z,'trans light blue'),p('3023b',x+2,20,z,'trans light blue')]),
...[[7,55],[15,55],[25,55],[33,55]].map(([x,z])=>p('3004',x,17,z,'trans light blue')),
...[[16,51],[24,51]].map(([x,z])=>p('2412b',x,24,z,'seam',90))
]);
function corvette(){return [
floor({at:[19,9,12],size:[4,12],colour:'white'}),
box({at:[20,10,13],size:[2,3,9],colour:'white',top:'tile'}),
floor({at:[19,10,16],size:[4,1],layers:2,colour:'dark red',top:'tile'}),
p('15068',18,10,11,'white'),p('15068',20,10,11,'white'),p('15068',22,10,11,'white'),
p('3069b',20,13,13,'dark red'),p('54200',20,14,14,'white'),
floor({at:[18,10,21],size:[6,3],colour:'dark red'}),
...range(3).map(i=>[p('3039',18+2*i,11,21,'white',180),p('3069b',18+2*i,11,23,'trans light blue')]),
p('4740',20,13,18,'white'),p('6141',20,14,18,'seam')
];}
section('Tantive IV in the tractor beam',corvette());