script({title:'LL-979 • The Moonwood Treeport',description:'Ewok engineers have rebuilt a 1979 blue-and-grey Galaxy Explorer as a timber-podded forest shuttle. Yellow bubble glazing, original space insignia and rocket fins meet bark, thatch and a suspended log bridge. A forest control hut fuels the shuttle while an Ewok radio operator calls the next moon.',palette:{bark:{mix:['reddish brown','reddish brown','dark brown']},stone:{mix:['light bluish grey','light bluish grey','dark bluish grey']},thatch:{mix:['dark tan','tan','dark tan','reddish brown']}},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
component('ewok',{size:[4,3],ops:[P('41879a',1,0,1,'reddish brown'),P('76382p90',0,4,0,'white'),P('64805',1,11,0,'reddish brown')]});
component('blueEwok',{size:[4,3],ops:[P('41879a',1,0,1,'dark tan'),P('76382p91',0,4,0,'blue'),P('64805',1,11,0,'dark tan')]});
function leafCrown(){const a=[floor({at:[2,0,4],size:[8,4],layers:2,colour:'reddish brown'}),floor({at:[4,0,2],size:[4,8],layers:2,colour:'reddish brown'})];const corners=[[0,0,3],[6,0,2],[0,6,2],[6,6,3]];for(const [x,z,n] of corners){for(let j=0;j<n;j++)a.push(P('2417',x,2+j,z,j%2?'green':'dark green'));}a.push(P('2417',3,5,2,'dark green'),P('2417',1,6,7,'green'),P('2417',7,7,6,'dark green'));for(const [x,y,z]of [[0,5,1],[8,5,2],[3,6,0],[8,6,9],[3,7,3],[4,8,8],[1,8,4],[7,9,4]])a.push(P('2423',x,y,z,'dark green'));return a;}
component('crown',{size:[12,12],ops:leafCrown()});
section('Connected display and forest landing clearing',[
 floor({at:[0,0,0],size:[64,48],layers:3,colour:'black'}),floor({at:[1,3,1],size:[62,46],colour:'dark bluish grey'}),
 floor({at:[1,3,1],size:[22,28],colour:'olive green'}),floor({at:[1,3,27],size:[27,20],colour:'dark green'}),floor({at:[23,3,33],size:[40,14],colour:'olive green'}),
 floor({at:[25,4,3],size:[37,31],colour:'light bluish grey',top:'tile'}),
 ...range(8).map(i=>P('2431',28+i*4,5,3,'blue')),...range(7).map(i=>P('2431',28+i*4,5,33,'blue')),
 ...range(6).map(i=>P('3069b',26,5,7+i*4,'yellow',90)),...range(6).map(i=>P('3069b',60,5,7+i*4,'yellow',90)),
 floor({at:[18,4,12],size:[7,18],colour:'dark tan',top:'tile'}),
 box({at:[3,4,34],size:[5,6,8],colour:'stone',top:'tile'}),box({at:[42,4,39],size:[5,9,7],colour:'stone',top:'tile'}),
 ...range(3).map(i=>P('3678b',3+i*2,4,43,'dark bluish grey',180)),...range(4).map(i=>P('15068',43+i*2,13,41,'light bluish grey')),
 ...range(16).map(i=>P('3069b',i*4,3,0,'black')),...range(16).map(i=>P('3069b',i*4,3,47,'black')),
 P('87079p50',29,4,0,'blue'),P('3004p90',5,4,0,'blue'),
]);
const mainBark=[];for(const x of[10,12,14,16,18])for(const z of[34,44]){for(let j=0;j<13;j++)if(z!==34||j<7)mainBark.push(P('60481a',x,4+6*j,z,j%4===0?'dark brown':'reddish brown',z===34?0:180));mainBark.push(P('11477',x,82,z,'reddish brown',z===34?0:180));}for(const z of[36,38,40,42])for(const x of[8,18]){for(let j=0;j<13;j++)mainBark.push(P('60481a',x,4+6*j,z,j%3===0?'dark brown':'reddish brown',x===8?90:270));mainBark.push(P('11477',x,82,z,'reddish brown',x===8?90:270));}
function root(x,z,t){return[box({at:[x,4,z],size:t%180?[5,6,2]:[2,6,5],colour:'dark brown'}),P('3678b',x,10,z,'reddish brown',t),P('50950',x,4,z,t===180?'dark brown':'reddish brown',t)];}
section('The ancient launch tree',[
 cylinder({at:[9,4,35],diameter:10,height:81,colour:'bark',texture:'log'}),mainBark,
 root(7,31,0),root(18,31,0),root(5,38,90),root(21,39,270),
 box({at:[9,39,27],size:[10,3,17],colour:'dark brown'}),box({at:[5,39,37],size:[20,3,4],colour:'reddish brown'}),
 cylinder({at:[13,85,39],height:24,diameter:4,colour:'reddish brown'}),cylinder({at:[6,82,41],height:15,diameter:2,colour:'dark brown'}),cylinder({at:[21,82,41],height:15,diameter:2,colour:'reddish brown'}),
 box({at:[4,82,37],size:[22,3,4],colour:'reddish brown'}),box({at:[6,94,41],size:[19,3,4],colour:'reddish brown'}),
 instance({component:'crown',at:[0,85,34]}),instance({component:'crown',at:[14,85,34],turn:90}),instance({component:'crown',at:[2,97,40],turn:180}),instance({component:'crown',at:[15,97,40],turn:270}),instance({component:'crown',at:[9,109,34]}),
]);
const hutWindows=[];for(const side of['front','back'])for(const x of[1,4,12,15])hutWindows.push({side,at:x,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'});for(const side of['left','right'])for(const z of[1,5])hutWindows.push({side,at:z,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'});
section('Thatch roof mission control',[
 floor({at:[2,42,25],size:[24,19],layers:2,colour:'reddish brown',top:'tile',holes:[{at:[9,35],size:[10,10]}]}),
 room({at:[4,44,27],size:[18,18,8],colour:'reddish brown',texture:'log',openings:[...hutWindows,{side:'front',at:7,width:4,height:15,fill:'none'}]}),
 floor({at:[5,44,28],size:[16,6],colour:'tan'}),P('3659',11,59,27,'blue'),
 ...[4,8,18,21].map(x=>range(6).map(j=>P('3062b',x,44+j*3,26,'dark brown'))),
 wall({from:[4,26],to:[21,26],y:47,height:1,colour:'blue'}),wall({from:[4,26],to:[21,26],y:60,height:1,colour:'blue'}),
 floor({at:[3,62,26],size:[20,10],layers:2,colour:'blue',top:'tile'}),
 roof({style:'hip',at:[4,64,27],size:[18,8],colour:'thatch',holes:[{at:[9,35],size:[10,10]}]}),
 P('3039p23',6,45,31,'blue'),P('3039p34',8,45,31,'blue'),P('3039pc5',10,45,31,'light bluish grey'),
 instance({component:'ewok',at:[16,45,29]}),
 column({at:[12,79,30],height:6,diameter:2,colour:'blue'}),P('3960',11,85,29,'light bluish grey'),P('3957a',12,87,30,'black'),
 P('3004p90',6,57,26,'blue'),P('3004p90',19,57,26,'blue'),
 ...range(6).map(i=>P(i===1?'63864':'2431',3+i*4,44,25,'dark tan')),
 ...[3,24].map(x=>[27,31,35,39].map(z=>column({at:[x,44,z],height:3,diameter:1,colour:'reddish brown'}))),
 fence({path:[[3,27],[3,40],[7,40]],y:47,style:'lattice-low',colour:'reddish brown'}),fence({path:[[24,27],[24,35]],y:47,style:'lattice-low',colour:'reddish brown'}),
]);
section('Suspended log bridge and root stair',[
 stairs({at:[11,4,7],width:4,steps:20,dir:'+z',rise:2,colour:'dark brown',top:'tile'}),
 ...range(20).map(i=>P('2431',11,6+2*i,7+i,i%3===0?'dark tan':'reddish brown')),
 ...range(7).map(i=>[column({at:[10,4,7+3*i],height:6+6*i,colour:'reddish brown'}),P('6141',10,10+6*i,7+3*i,'trans red')]),
 floor({at:[25,41,38],size:[22,4],layers:3,colour:'dark brown'}),
 ...range(22).map(i=>P('3710',25+i,44,38,i%5===0?'dark tan':'reddish brown',90)),
 ...range(6).map(i=>[column({at:[25+4*i,44,37],height:6,colour:'reddish brown'}),column({at:[25+4*i,44,42],height:6,colour:'reddish brown'}),P('6141',25+4*i,50,37,'trans yellow')]),
 wall({from:[25,37],to:[46,37],y:48,height:1,colour:'dark tan'}),wall({from:[25,42],to:[46,42],y:48,height:1,colour:'dark tan'}),
]);
const smallBark=[];for(const[x,z,t]of[[51,35,0],[54,35,0],[50,38,90],[50,41,90],[57,38,270],[57,41,270],[51,43,180],[54,43,180]])for(let j=0;j<6;j++)smallBark.push(P('60481a',x,4+6*j,z,j%2?'dark brown':'reddish brown',t));
section('Radar nest',[
 cylinder({at:[50,4,36],diameter:8,height:38,colour:'bark',texture:'log'}),smallBark,
 floor({at:[46,42,32],size:[16,15],layers:2,colour:'reddish brown',top:'tile'}),
 ...[46,60].map(x=>range(4).map(j=>column({at:[x,44,32+j*4],height:3,colour:'reddish brown'}))),
 fence({path:[[46,32],[60,32],[60,45],[46,45]],y:47,colour:'reddish brown',style:'lattice-low'}),
 cylinder({at:[52,44,38],diameter:6,height:6,colour:'blue'}),column({at:[54,50,40],height:9,diameter:2,colour:'light bluish grey'}),P('3961',51,59,37,'light bluish grey'),P('4032b',54,62,40,'blue'),P('3957a',54,63,40,'black'),
 P('3039p34',47,44,34,'blue'),instance({component:'blueEwok',at:[47,44,39],turn:90}),
 ...range(3).map(j=>[P('2423',46,38,33+j*4,j%2?'green':'dark green'),P('2423',59,39,33+j*4,'dark green')]),
 box({at:[48,35,35],size:[14,3,4],colour:'reddish brown'}),
]);
const shuttle=[];
for(const[x,z]of[[13,7],[4,23],[24,23]])shuttle.push(floor({at:[x,0,z],size:[4,4],colour:'dark bluish grey',top:'tile'}),column({at:[x+1,1,z+1],height:6,diameter:2,colour:'light bluish grey'}));
shuttle.push(box({at:[12,5,8],size:[8,4,21],colour:'light bluish grey'}),floor({at:[14,5,2],size:[4,10],colour:'light bluish grey'}),P('43713',14,6,2,'light bluish grey'),P('43712',14,9,2,'blue'));
for(let k=0;k<5;k++){let x=9-2*k,z=8+4*k;shuttle.push(floor({at:[x+2,7,z],size:[12-x,4],layers:2,colour:'light bluish grey',top:'tile'}),floor({at:[18,7,z],size:[12-x,4],layers:2,colour:'light bluish grey',top:'tile'}));for(let j=0;j<2;j++)shuttle.push(P('41770a',x,7+j,z,'blue'),P('41769a',30-x,7+j,z,'blue'));for(let dz=0;dz<4;dz++)shuttle.push(P('11477',x+2,9,z+dz,'blue',90),P('11477',28-x,9,z+dz,'blue',270));for(let dx=0;dx<Math.floor((10-x)/2);dx++)shuttle.push(P('3069b',x+4+2*dx,9,z+2,dx%3?'light bluish grey':'dark bluish grey'),P('3069b',18+2*dx,9,z+2,dx%3?'light bluish grey':'dark bluish grey'));}
shuttle.push(floor({at:[12,9,8],size:[8,21],layers:1,colour:'blue'}),box({at:[12,10,8],size:[2,3,20],colour:'blue',top:'tile'}),box({at:[18,10,8],size:[2,3,20],colour:'blue',top:'tile'}),floor({at:[13,10,16],size:[4,3],layers:2,colour:'light bluish grey'}),P('4474',14,12,8,'trans yellow'),instance({component:'ewok',at:[13,12,16]}),P('3039p23',16,10,19,'blue'));
for(const x of[3,25]){shuttle.push(floor({at:[x,8,25],size:[4,7],colour:'light bluish grey'}),box({at:[x,9,17],size:[4,6,9],colour:'reddish brown',texture:'log'}),P('4616b',x,10,26,'blue',180),P('4746',x+1,17,26,'blue'),P('3298p90',x+1,15,17,'blue'));for(let j=0;j<3;j++){shuttle.push(P('15068',x,15,20+j*2,'blue'),P('15068',x+2,15,20+j*2,'blue'));}for(let j=0;j<4;j++)shuttle.push(P('3069b',x+1,18,21+j,'light bluish grey'));shuttle.push(P('6141',x+1,23,26,'trans red'));}
shuttle.push(box({at:[13,10,21],size:[6,8,8],colour:'blue',top:'tile'}),P('2340p90',13,18,23,'blue'),P('2340',18,18,23,'blue'),P('87079p50',14,18,21,'blue'),P('2412b',14,18,27,'black'),P('2412b',16,18,27,'black'),P('3957a',19,13,20,'black'),P('3957a',12,13,20,'black'));
for(const x of[1,29])shuttle.push(P('3062b',x,9,27,'blue'),P('6141',x,12,27,'trans red'));
component('shuttle',{size:[32,32],ops:shuttle});
section('LL-979 timber Galaxy Explorer',[instance({component:'shuttle',at:[27,5,4]})]);
component('buggy',{size:[6,9],ops:[place({part:'4600',at:[1,2,1],colour:'light bluish grey',wheels:'light bluish grey'}),place({part:'4600',at:[1,2,5],colour:'light bluish grey',wheels:'light bluish grey'}),floor({at:[1,3,1],size:[2,6],layers:2,colour:'light bluish grey'}),floor({at:[0,5,0],size:[5,7],colour:'blue'}),box({at:[0,6,1],size:[4,3,4],colour:'blue'}),P('6238b',0,9,1,'trans yellow'),P('3039p34',1,6,2,'blue'),box({at:[0,6,5],size:[4,3,2],colour:'reddish brown'}),P('3957a',4,6,6,'black'),instance({component:'blueEwok',at:[0,9,5]}),P('3004p90',1,6,0,'blue')]});
section('Acorn fuel and expedition equipment',[
 cylinder({at:[20,4,22],diameter:6,height:9,colour:'blue'}),P('3942c',22,13,24,'tan'),P('3960',21,19,23,'light bluish grey'),P('3957a',22,21,24,'black'),P('3004p90',22,7,21,'blue'),
 P('3039p23',20,4,20,'blue'),instance({component:'blueEwok',at:[21,5,16]}),
 floor({at:[25,5,26],size:[10,1],colour:'dark bluish grey'}),P('27328',25,6,26,'black'),column({at:[34,8,26],height:4,colour:'black'}),
 ...range(3).map(j=>P('3941',18,4+j*3,28,'light bluish grey')),P('4740',18,13,28,'blue'),
 instance({component:'buggy',at:[4,4,5]}),
 ...[2,6,18].map(x=>[P('4345b',x,4,17,'light bluish grey'),P('3068b',x,10,17,'blue')]),
]);
const undergrowth=[];for(const[x,z]of[[2,29],[5,25],[8,30],[22,34],[27,44],[32,43],[37,45],[43,35],[60,38],[57,45],[2,44]]){undergrowth.push(P('32607',x,4,z,'green'),P('32607',x,6,z,'dark green'),P('2423',x+1,4,z+2,'dark green'));}for(const[x,z]of[[2,3],[19,6],[23,9],[40,36],[31,38],[60,44]]){undergrowth.push(P('3039',x,4,z,'dark bluish grey'),P('15068',x+2,4,z+1,'light bluish grey'));}section('Life reclaiming the moonscape',undergrowth);