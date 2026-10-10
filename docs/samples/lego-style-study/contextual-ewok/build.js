script({title:'Yub-Nub 1978: Moonwood Space Village',description:'The lunar forest village refined with open timber stairways, irregular leaf crowns, compact forest paths and a swept-wing timber Galaxy Explorer. Yellow-glazed mission control, the Acorn One rocket and woodland astronauts remain connected across the treetops.',palette:{bark:{mix:['reddish brown','reddish brown','dark brown']},rock:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']},wood:'reddish brown',space:'blue',glass:'trans yellow',thatch:{mix:['tan','tan','dark tan']}},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function beam(a,b,colour='bark',thick=1){return range(-thick,thick).map(k=>line({from:[a[0]+k,a[1],a[2]],to:[b[0]+k,b[1],b[2]],colour}));}
function roundDeck(x,y,z,d){const r=d/2;return range(0,d,2).map(k=>{const half=Math.floor(Math.sqrt(r*r-Math.pow(k+1-r,2)));return floor({at:[x+r-half,y,z+k],size:[2*half,2],layers:3,colour:'wood',top:'tile'});});}
function tree(x,z,d,h){const cx=x+Math.round(d/2),cz=z+Math.round(d/2),r=d===4?4:6;return [cylinder({at:[x-1,3,z-1],diameter:d+2,height:6,colour:'bark'}),cylinder({at:[x,3,z],diameter:d,height:h,colour:'bark'}),...[[cx-r,cz-3],[cx+r,cz-3],[cx+r-1,cz+r]].map(q=>beam([cx,15,cz],[q[0],3,q[1]],'bark',1)),P('3747b',cx-1,h,z-3,'reddish brown'),P('3747b',cx-1,h,z+d,'reddish brown',180),P('3747b',x-3,h,cz-1,'reddish brown',90),P('3747b',x+d,h,cz-1,'reddish brown',270),...range(1,Math.floor(h/9)).map(i=>P('3622pz2',cx-1,3+i*9,z,'reddish brown'))];}
function crown(x,y,z,nx,nz,levels){const w=nx*5;return [floor({at:[x-2,y-2,z+3],size:[w+6,2],layers:2,colour:'wood'}),floor({at:[x+3,y-2,z-1],size:[2,nz*6+3],layers:2,colour:'wood'}),...range(nz).map(j=>floor({at:[x+(j%2?2:0),y-2,z+j*6+2],size:[w,2],layers:2,colour:'wood'})),...range(levels).map(l=>range(nx).map(i=>range(nz).map(j=>{const edge=(i===0||i===nx-1)&&(j===0||j===nz-1);if(edge&&l>levels-3&&(i+j)%2===0)return null;const dx=(j%2?2:0)+(l>2?1:0),dz=l>3?1:0;return P('2417',x+i*5+dx,y+l,z+j*6+dz,(i+j+l)%4?'dark green':'green',l%2?180:0);}))),P('2423',x-3,y-1,z+2,'green'),P('2423',x+w+1,y-1,z+2,'dark green',180),P('2423',x+2,y-1,z-3,'dark green'),P('2423',x+2,y-1,z+nz*6,'green',180)];}
component('space-ewok',{size:[4,4],ops:[P('41879a',0,0,1,'reddish brown'),P('76382p90',0,4,0,'white'),P('64805',0,11,0,'reddish brown')]});
function fern(x,z){return [P('3024',x,3,z,'reddish brown'),P('32607',x,4,z,'green')];}
const ground=(x,z,w,d)=>floor({at:[x,0,z],size:[w,d],layers:3,colour:'dark tan'});
section('Compact moon forest paths and workshop',[
ground(5,1,20,18),ground(4,24,21,20),ground(37,24,25,20),ground(53,6,11,16),ground(25,4,12,14),ground(24,6,14,10),ground(40,1,14,14),ground(1,1,4,28),ground(62,1,2,22),ground(20,16,22,8),ground(22,24,18,4),ground(37,40,10,7),
carve({at:[4,0,24],size:[3,3,3]}),carve({at:[4,0,41],size:[3,3,3]}),carve({at:[22,0,41],size:[3,3,3]}),carve({at:[59,0,41],size:[3,3,3]}),carve({at:[53,0,6],size:[2,3,2]}),
floor({at:[5,3,1],size:[15,8],colour:'tan',top:'tile'}),floor({at:[18,3,6],size:[7,4],colour:'tan',top:'tile'}),
box({at:[8,3,11],size:[9,6,5],colour:'rock',top:'tile'}),...range(4).map(i=>P('3039',8+i*2,3,9,'dark bluish grey')),...range(4).map(i=>P('3039',8+i*2,6,15,'light bluish grey',180)),P('3039',6,3,12,'light bluish grey',90),P('3039',17,3,12,'dark bluish grey',270),
cylinder({at:[40,3,1],diameter:14,height:6,colour:'rock',texture:'masonry'}),carve({at:[44,4,5],size:[6,8,6]}),floor({at:[44,3,5],size:[6,6],colour:'black'}),...[[45,6],[48,6],[46,9]].map(q=>[P('3941',q[0],4,q[1],'trans yellow'),P('3062b',q[0],7,q[1],'trans yellow'),P('4589',q[0],10,q[1],'trans yellow'),P('4589',q[0]+1,7,q[1]+1,'trans yellow')]),
...[[6,28],[8,39],[20,40],[22,32],[23,23],[28,20],[29,23],[35,20],[39,26],[41,40],[56,40],[59,29],[60,19],[55,9],[13,18],[6,18],[21,13],[36,25],[37,21],[54,21]].map(q=>fern(q[0],q[1])),
box({at:[16,4,3],size:[8,6,4],colour:'wood',texture:'log',top:'tile'}),P('3039p23',16,10,3,'white'),P('3039p34',19,10,3,'blue'),P('3004p90',22,10,3,'blue'),P('3960',20,13,4,'light bluish grey'),
P('4345b',23,3,18,'blue'),P('4345b',26,3,19,'light bluish grey'),P('2489',19,3,14,'reddish brown'),P('2489',32,3,21,'reddish brown'),
instance({component:'space-ewok',at:[10,4,3]}),instance({component:'space-ewok',at:[36,3,18],turn:90})
]);
section('Living launch trees and layered crowns',[
tree(9,29,8,54),tree(43,29,8,42),tree(56,11,4,42),
...[[4,25],[22,25],[23,41]].map(q=>beam([13,34,33],[q[0],56,q[1]],'bark',1)),
...[[36,26],[59,26],[59,41]].map(q=>beam([47,26,33],[q[0],44,q[1]],'bark',1)),
beam([58,30,13],[62,46,21],'bark',1),beam([58,30,13],[57,44,5],'bark',1),
cylinder({at:[2,60,42],diameter:3,height:39,colour:'bark'}),beam([13,42,33],[3,60,43],'bark',1),beam([3,99,43],[10,103,40],'bark',1),
cylinder({at:[22,60,40],diameter:3,height:30,colour:'bark'}),beam([13,42,33],[23,60,41],'bark',1),beam([23,90,41],[26,93,40],'bark',1),
cylinder({at:[39,48,42],diameter:3,height:33,colour:'bark'}),beam([47,36,33],[40,48,43],'bark',1),beam([40,81,43],[46,83,41],'bark',1),
cylinder({at:[61,48,19],diameter:2,height:27,colour:'bark'}),beam([58,36,13],[62,48,20],'bark',1),beam([62,75,20],[57,77,24],'bark',1),
crown(0,104,36,3,2,4),crown(21,94,35,2,2,4),crown(36,84,36,4,2,5),crown(52,78,19,2,2,3)
]);
section('Yellow-window mission hut',[
roundDeck(1,57,21,24),cylinder({at:[5,60,25],diameter:16,height:3,colour:'blue'}),cylinder({at:[5,63,25],diameter:16,height:12,colour:'wood',texture:'log'}),cylinder({at:[5,75,25],diameter:16,height:3,colour:'blue'}),
box({at:[8,63,25],size:[10,12,2],colour:'blue'}),...[9,12,15].map(x=>window({at:[x,66,25],facing:'front',size:'1x2x2',frame:'blue',glass:'trans yellow'})),floor({at:[8,72,24],size:[10,2],colour:'light bluish grey',top:'tile'}),P('3004p90',12,73,25,'blue'),
window({at:[12,66,40],facing:'back',size:'1x2x2',frame:'blue',glass:'trans yellow'}),window({at:[20,66,32],facing:'right',size:'1x2x2',frame:'blue',glass:'trans yellow'}),door({at:[5,60,31],facing:'left',frame:'blue',colour:'blue',opens:'out'}),
roof({style:'hip',at:[5,78,25],size:[16,16],colour:'thatch'}),column({at:[12,105,32],height:6,diameter:2,colour:'blue'}),P('3961',9,111,29,'light bluish grey'),column({at:[12,114,32],height:6,diameter:2,colour:'blue'}),P('3957a',12,120,32,'black'),
...range(16).filter(i=>![0,7,8,9,11,12,13].includes(i)).map(i=>{const x=13+Math.round(11*Math.cos(i*Math.PI/8)),z=33+Math.round(11*Math.sin(i*Math.PI/8));return [column({at:[x,60,z],height:6,colour:'wood'}),P('6141',x,66,z,'blue')];}),
instance({component:'space-ewok',at:[9,60,21]}),box({at:[17,60,22],size:[4,3,2],colour:'wood',top:'tile'}),P('3039p34',18,63,22,'blue'),P('4345b',18,60,42,'blue')
]);
function openFlight(x,z,width,steps){const guardCount=Math.ceil(steps/4);return [...range(steps).map(k=>{const guard=k>=2&&((k-2)%4===0||k===steps-1);return [P(width===4?'3710':'3023b',x,3+2*k,z+k,'reddish brown'),P(guard?(width===4?'3710':'3023b'):(width===4?'2431':'3069b'),x,4+2*k,z+k,'reddish brown')];}),...[x,x+width-1].map(s=>line({from:[s,3,z],to:[s,3+2*(steps-1),z+steps-1],colour:'dark brown'})),...range(guardCount).map(i=>{const k=Math.min(steps-1,2+i*4),next=Math.min(steps-1,k+4),y=5+2*k,zz=z+k;return [column({at:[x,y,zz],height:6,colour:'wood'}),width>2&&column({at:[x+width-1,y,zz],height:6,colour:'wood'}),i<guardCount-1&&line({from:[x,y+5,zz],to:[x,10+2*next,z+next],colour:'dark brown'}),width>2&&i<guardCount-1&&line({from:[x+width-1,y+5,zz],to:[x+width-1,10+2*next,z+next],colour:'dark brown'})];})];}
const bridgeY=i=>58-Math.round(12*i/10)-Math.round(3*Math.sin(i*Math.PI/10));
section('Open climbing stairs and hanging bridge',[
openFlight(1,1,4,28),floor({at:[1,59,29],size:[5,5],colour:'wood',top:'tile'}),
...range(11).map(i=>floor({at:[24+i,bridgeY(i),33],size:[1,4],layers:2,colour:i%3?'wood':'dark tan',top:'tile'})),
...[33,36].map(z=>range(10).map(i=>line({from:[24+i,bridgeY(i),z],to:[25+i,bridgeY(i+1),z],colour:'dark brown'}))),
...range(4).map(i=>{const k=i*3,y=bridgeY(k)+2,x=24+k;return [column({at:[x,y,33],height:6,colour:'wood'}),column({at:[x,y,36],height:6,colour:'wood'}),i<3&&line({from:[x,y+5,33],to:[x+3,bridgeY(k+3)+7,33],colour:'dark brown'}),i<3&&line({from:[x,y+5,36],to:[x+3,bridgeY(k+3)+7,36],colour:'dark brown'})];}),
openFlight(62,1,2,22),floor({at:[60,47,19],size:[4,4],colour:'wood',top:'tile'})
]);
function wing(){return [...[[45,25,6],[42,31,12],[39,37,18]].map(q=>floor({at:[q[0],49,q[1]],size:[q[2],6],layers:2,colour:'light bluish grey',top:'tile'})),...range(3).map(i=>{const z=25+i*6,l=42-i*3,r=51+i*3;return [...range(2).map(h=>[P('54384',l,49+h,z,'light bluish grey'),P('54383',r,49+h,z,'light bluish grey')]),P('3020',l+1,48,z+4,'light bluish grey'),P('3020',r-2,48,z+4,'light bluish grey'),P(i===0?'3069b':'2431',l+3,51,z+3,'blue'),P(i===0?'3069b':'2431',i===0?r-2:r-4,51,z+3,'blue')];})];}
section('Timber Galaxy Explorer and flight deck',[
floor({at:[38,45,20],size:[20,4],layers:3,colour:'wood',top:'tile'}),floor({at:[34,45,24],size:[28,16],layers:3,colour:'wood',top:'tile'}),floor({at:[38,45,40],size:[20,4],layers:3,colour:'wood',top:'tile'}),
...range(5).map(i=>[column({at:[39+i*4,48,43],height:6,colour:'wood'}),P('6141',39+i*4,54,43,'blue')]),...range(3).map(i=>[column({at:[34,48,25+i*5],height:6,colour:'wood'}),column({at:[61,48,25+i*5],height:6,colour:'wood'})]),
...range(8).map(i=>P('3069b',39+i*2,48,20,i%2?'yellow':'black')),
...[[45,24],[49,24],[45,37],[49,37]].map(q=>column({at:[q[0],48,q[1]],height:3,diameter:1,colour:'light bluish grey'})),wing(),
box({at:[45,51,21],size:[6,6,20],colour:'wood',texture:'log',top:'tile'}),floor({at:[45,57,28],size:[6,12],colour:'blue',top:'tile'}),box({at:[45,51,19],size:[6,3,3],colour:'blue',top:'tile'}),P('3298p90',47,54,18,'blue'),P('4474',46,54,21,'trans yellow'),carve({at:[46,54,27],size:[4,6,1]}),P('4079',47,48,24,'blue'),
...range(2).map(i=>{const x=35+i*20;return [box({at:[x,51,29],size:[4,9,10],colour:'blue',top:'tile'}),P('3039',x,57,27,'blue'),P('3039',x+2,57,27,'blue'),...range(2).map(j=>[P('15068',x+j*2,57,29,'blue'),P('15068',x+j*2,57,33,'blue'),P('2412b',x+j*2,60,30,'light bluish grey'),P('2412b',x+j*2,60,34,'light bluish grey')]),P('4460b',x+1,60,36,'light bluish grey',180),P('54200',x+1,69,36,'blue',180),P('3039',x,57,39,'trans red',180),P('3039',x+2,57,39,'trans red',180)];}),
P('3004p90',47,58,37,'blue'),P('3960',46,61,37,'light bluish grey'),P('3957a',47,63,38,'black'),P('4345b',39,48,37,'blue'),instance({component:'space-ewok',at:[39,48,21],turn:270})
]);
section('Acorn One launch cradle',[
box({at:[26,3,5],size:[10,5,11],colour:'rock',texture:'masonry',top:'tile'}),box({at:[25,3,13],size:[3,5,4],colour:'rock',top:'tile'}),cylinder({at:[28,8,8],diameter:6,height:3,colour:'black'}),cylinder({at:[28,11,8],diameter:6,height:27,colour:'wood'}),P('3622pz2',30,17,8,'reddish brown'),P('3622pz2',30,26,8,'reddish brown'),cylinder({at:[28,38,8],diameter:6,height:6,colour:'blue'}),cylinder({at:[28,44,8],diameter:6,height:6,colour:'light bluish grey'}),floor({at:[28,50,8],size:[6,6],colour:'light bluish grey',top:'tile'}),P('3943b',29,51,9,'light bluish grey'),P('3942c',30,57,10,'blue'),P('4589',30,63,10,'light bluish grey'),
...[[27,10,90],[34,10,270],[30,6,0],[30,14,180]].map(q=>P('4460b',q[0],8,q[1],'blue',q[2])),P('3004p90',30,38,8,'blue'),
column({at:[25,8,15],height:30,diameter:2,colour:'wood'}),floor({at:[25,38,11],size:[3,6],layers:2,colour:'blue',top:'tile'}),P('3039p23',25,40,13,'white'),P('3957a',25,40,16,'black'),...range(5).map(i=>P('3069b',26+i*2,8,5,i%2?'yellow':'black'))
]);
section('Scout nest and rear details',[
roundDeck(52,45,7,12),floor({at:[54,45,4],size:[8,4],layers:3,colour:'wood',top:'tile'}),cylinder({at:[54,48,9],diameter:8,height:9,colour:'wood',texture:'log'}),box({at:[56,48,9],size:[4,9,1],colour:'blue'}),window({at:[57,50,9],facing:'front',size:'1x2x2',frame:'blue',glass:'trans yellow'}),window({at:[57,50,16],facing:'back',size:'1x2x2',frame:'blue',glass:'trans yellow'}),roof({style:'hip',at:[54,57,9],size:[8,8],colour:'tan'}),P('4032b',57,72,12,'blue'),P('3960',56,73,11,'light bluish grey'),P('3957a',57,75,12,'black'),
instance({component:'space-ewok',at:[54,48,4]}),P('3039p34',60,48,5,'blue'),column({at:[54,48,7],height:6,colour:'wood'}),column({at:[61,48,7],height:6,colour:'wood'}),
box({at:[44,3,43],size:[3,6,3],colour:'blue',top:'tile'}),P('3004p90',44,9,43,'blue'),P('3957a',45,9,44,'black'),P('4345b',37,3,44,'blue'),P('2489',40,3,45,'reddish brown')
]);