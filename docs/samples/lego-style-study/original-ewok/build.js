script({title:'Yub-Nub 1978: Moonwood Space Village',description:'Ewok engineers have turned a lunar forest into a Classic Space launch village: yellow-glazed treetop mission control, a timber Galaxy Explorer, an acorn rocket and woodland astronauts connected by climbing stairs and a hanging bridge.',palette:{bark:{mix:['reddish brown','reddish brown','dark brown']},rock:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']},wood:'reddish brown',space:'blue',glass:'trans yellow',thatch:{mix:['tan','tan','dark tan']}},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function beam(a,b,colour='bark',thick=1){return range(-thick,thick).map(k=>line({from:[a[0]+k,a[1],a[2]],to:[b[0]+k,b[1],b[2]],colour}));}
function roundDeck(x,y,z,d){const r=d/2;return range(0,d,2).map(k=>{const half=Math.floor(Math.sqrt(r*r-Math.pow(k+1-r,2)));return floor({at:[x+r-half,y,z+k],size:[2*half,2],layers:3,colour:'wood',top:'tile'});});}
function tree(x,z,d,h){const cx=x+Math.round(d/2),cz=z+Math.round(d/2);return [cylinder({at:[x-2,3,z-2],diameter:d+4,height:9,colour:'bark'}),cylinder({at:[x,3,z],diameter:d,height:h,colour:'bark'}),...[[cx-9,cz-6],[cx+9,cz-7],[cx+10,cz+7]].map(q=>beam([cx,18,cz],[Math.max(1,Math.min(62,q[0])),3,Math.max(1,Math.min(46,q[1]))],'bark',1)),...range(1,Math.floor(h/9)).map(i=>P('3622pz2',cx-1,3+i*9,z,'reddish brown'))];}
function crown(x,y,z,nx,nz,levels){return [floor({at:[x+1,y-1,z+3],size:[nx*5-2,2],colour:'wood'}),floor({at:[x+2,y-1,z+2],size:[2,nz*6-3],colour:'wood'}),...range(levels).map(l=>range(nx).map(i=>range(nz).map(j=>l<levels-(i+j)%3&&P('2417',x+i*5,y+l,z+j*6,(i+j+l)%3?'dark green':'green',l%2?180:0))))];}
component('space-ewok',{size:[4,4],ops:[P('41879a',0,0,1,'reddish brown'),P('76382p90',0,4,0,'white'),P('64805',0,11,0,'reddish brown')]});
function fern(x,z){return [P('3024',x,3,z,'reddish brown'),P('32607',x,4,z,'green')];}
section('Moon forest and workshop',[
baseplate({at:[0,0],size:[64,48],colour:'green'}),floor({at:[0,0,0],size:[64,48],layers:3,colour:'dark tan'}),
floor({at:[5,3,1],size:[15,8],colour:'tan',top:'tile'}),floor({at:[18,3,6],size:[7,4],colour:'tan',top:'tile'}),
box({at:[7,3,10],size:[11,6,7],colour:'rock',texture:'masonry'}),box({at:[9,9,12],size:[7,3,4],colour:'rock',texture:'masonry'}),box({at:[25,3,40],size:[8,9,8],colour:'rock'}),box({at:[48,3,40],size:[14,6,8],colour:'rock'}),
cylinder({at:[40,3,1],diameter:14,height:6,colour:'rock',texture:'masonry'}),carve({at:[44,4,5],size:[6,8,6]}),floor({at:[44,3,5],size:[6,6],colour:'black'}),...[[45,6],[48,6],[46,9]].map(q=>[P('3941',q[0],4,q[1],'trans yellow'),P('3062b',q[0],7,q[1],'trans yellow'),P('4589',q[0],10,q[1],'trans yellow'),P('4589',q[0]+1,7,q[1]+1,'trans yellow')]),
...[[7,19],[11,21],[20,18],[21,23],[26,28],[29,34],[33,20],[37,8],[37,15],[43,17],[51,3],[54,5],[51,24],[57,31],[60,35],[34,46],[20,45],[4,42],[4,35],[17,40],[30,2],[34,3],[22,9],[22,13]].map(q=>fern(q[0],q[1])),
box({at:[16,4,3],size:[8,6,4],colour:'wood',texture:'log'}),P('3039p23',16,10,3,'white'),P('3039p34',19,10,3,'blue'),P('3004p90',22,10,3,'blue'),P('3960',20,13,4,'light bluish grey'),
P('4345b',23,3,18,'blue'),P('4345b',26,3,19,'light bluish grey'),P('2489',19,3,14,'reddish brown'),P('2489',32,3,21,'reddish brown'),
instance({component:'space-ewok',at:[10,4,3]}),instance({component:'space-ewok',at:[36,3,18],turn:90}),
...range(6).map(i=>P('3039',7+i*2,3,17,'dark bluish grey',180))
]);
section('Living launch trees',[
tree(9,29,8,54),tree(43,29,8,42),tree(56,11,4,42),
...[[4,25],[22,25],[23,41]].map(q=>beam([13,34,33],[q[0],56,q[1]],'bark',1)),
...[[36,26],[59,26],[59,41]].map(q=>beam([47,26,33],[q[0],44,q[1]],'bark',1)),
beam([58,30,13],[62,46,21],'bark',1),beam([58,30,13],[57,44,5],'bark',1),
cylinder({at:[2,60,42],diameter:3,height:39,colour:'bark',texture:'log'}),beam([13,42,33],[3,60,43],'bark',1),beam([3,99,43],[10,103,40],'bark',1),
cylinder({at:[22,60,40],diameter:3,height:30,colour:'bark',texture:'log'}),beam([13,42,33],[23,60,41],'bark',1),beam([23,90,41],[26,93,40],'bark',1),
cylinder({at:[39,48,42],diameter:3,height:33,colour:'bark',texture:'log'}),beam([47,36,33],[40,48,43],'bark',1),beam([40,81,43],[46,83,41],'bark',1),
cylinder({at:[61,48,19],diameter:2,height:27,colour:'bark',texture:'log'}),beam([58,36,13],[62,48,20],'bark',1),beam([62,75,20],[57,77,24],'bark',1),
crown(0,104,36,3,2,6),crown(21,94,35,2,2,6),crown(36,84,36,4,2,6),crown(52,78,19,2,2,4)
]);
section('Yellow-window mission hut',[
roundDeck(1,57,21,24),cylinder({at:[5,60,25],diameter:16,height:3,colour:'blue'}),cylinder({at:[5,63,25],diameter:16,height:12,colour:'wood',texture:'log'}),cylinder({at:[5,75,25],diameter:16,height:3,colour:'blue'}),
box({at:[8,63,25],size:[10,12,2],colour:'blue'}),... [9,12,15].map(x=>window({at:[x,66,25],facing:'front',size:'1x2x2',frame:'blue',glass:'trans yellow'})),floor({at:[8,72,24],size:[10,2],colour:'light bluish grey'}),P('3004p90',12,73,25,'blue'),
window({at:[12,66,40],facing:'back',size:'1x2x2',frame:'blue',glass:'trans yellow'}),window({at:[20,66,32],facing:'right',size:'1x2x2',frame:'blue',glass:'trans yellow'}),door({at:[5,60,31],facing:'left',frame:'blue',colour:'blue',opens:'out'}),
roof({style:'hip',at:[5,78,25],size:[16,16],colour:'thatch'}),column({at:[12,105,32],height:6,diameter:2,colour:'blue'}),P('3961',9,111,29,'light bluish grey'),column({at:[12,114,32],height:6,diameter:2,colour:'blue'}),P('3957a',12,120,32,'black'),
...range(16).filter(i=>![0,7,8,9,11,12,13].includes(i)).map(i=>{const x=13+Math.round(11*Math.cos(i*Math.PI/8)),z=33+Math.round(11*Math.sin(i*Math.PI/8));return [column({at:[x,60,z],height:6,colour:'wood'}),P('6141',x,66,z,'blue')];}),
instance({component:'space-ewok',at:[9,60,21]}),box({at:[17,60,22],size:[4,3,2],colour:'wood'}),P('3039p34',18,63,22,'blue'),P('4345b',18,60,42,'blue')
]);
section('Climbing stairs and hanging bridge',[
stairs({at:[1,3,1],width:4,steps:28,dir:'+z',rise:2,colour:'wood'}),floor({at:[1,59,29],size:[5,5],colour:'wood'}),
...range(7).map(i=>{const k=2+i*4,y=3+2*(k+1),z=1+k;return [column({at:[1,y,z],height:9,colour:'wood'}),column({at:[4,y,z],height:9,colour:'wood'}),i<6&&line({from:[1,y+8,z],to:[1,y+16,z+4],colour:'dark brown'}),i<6&&line({from:[4,y+8,z],to:[4,y+16,z+4],colour:'dark brown'})];}),
...range(11).map(i=>floor({at:[24+i,58-Math.round(12*i/10),33],size:[1,4],layers:2,colour:i%3?'wood':'dark tan'})),
...range(4).map(i=>{const k=i*3,y=60-Math.round(12*k/10),x=24+k;return [column({at:[x,y,33],height:6,colour:'wood'}),column({at:[x,y,36],height:6,colour:'wood'}),i<3&&line({from:[x,y+5,33],to:[x+3,65-Math.round(12*(k+3)/10),33],colour:'dark brown'}),i<3&&line({from:[x,y+5,36],to:[x+3,65-Math.round(12*(k+3)/10),36],colour:'dark brown'})];}),
stairs({at:[62,3,1],width:2,steps:22,dir:'+z',rise:2,colour:'wood'}),floor({at:[60,47,19],size:[4,4],colour:'wood'}),...range(6).map(i=>column({at:[63,7+i*8,2+i*4],height:6,colour:'wood'}))
]);
section('Timber Galaxy Explorer and flight deck',[
floor({at:[38,45,20],size:[20,4],layers:3,colour:'wood',top:'tile'}),floor({at:[34,45,24],size:[28,16],layers:3,colour:'wood',top:'tile'}),floor({at:[38,45,40],size:[20,4],layers:3,colour:'wood',top:'tile'}),
...range(5).map(i=>[column({at:[39+i*4,48,43],height:6,colour:'wood'}),P('6141',39+i*4,54,43,'blue')]),...range(3).map(i=>[column({at:[34,48,25+i*5],height:6,colour:'wood'}),column({at:[61,48,25+i*5],height:6,colour:'wood'})]),
...range(8).map(i=>P('3069b',39+i*2,48,20,i%2?'yellow':'black')),
...[[45,24],[49,24],[45,37],[49,37]].map(q=>column({at:[q[0],48,q[1]],height:3,diameter:1,colour:'light bluish grey'})),
...range(8).map(i=>floor({at:[45-i,49,24+i*2],size:[6+i*2,2],layers:2,colour:'light bluish grey'})),
box({at:[45,51,21],size:[6,6,20],colour:'wood',texture:'log'}),floor({at:[45,57,28],size:[6,12],colour:'blue'}),box({at:[45,51,19],size:[6,3,3],colour:'blue'}),P('3298p90',47,54,18,'blue'),P('4474',46,54,21,'trans yellow'),carve({at:[46,54,27],size:[4,6,1]}),P('4079',47,48,24,'blue'),
...range(2).map(i=>{const x=35+i*20;return [box({at:[x,51,29],size:[4,9,10],colour:'blue'}),P('3039',x,57,27,'blue'),P('3039',x+2,57,27,'blue'),P('2412b',x,60,30,'light bluish grey'),P('2412b',x+2,60,30,'light bluish grey'),P('2412b',x,60,33,'light bluish grey'),P('2412b',x+2,60,33,'light bluish grey'),P('4460b',x+1,60,36,'light bluish grey',180),P('54200',x+1,69,37,'blue',180),P('3039',x,57,39,'trans red',180),P('3039',x+2,57,39,'trans red',180)];}),
...range(7).map(i=>[P('3069b',38+i,51,27+i*2,'blue',90),P('3069b',56-i,51,27+i*2,'blue',90)]),
P('3004p90',47,58,37,'blue'),P('3960',46,61,37,'light bluish grey'),P('3957a',47,63,38,'black'),P('4345b',39,48,37,'blue'),instance({component:'space-ewok',at:[39,48,21],turn:270})
]);
section('Acorn One launch cradle',[
box({at:[25,3,5],size:[12,5,12],colour:'rock',texture:'masonry',top:'tile'}),cylinder({at:[28,8,8],diameter:6,height:3,colour:'black'}),cylinder({at:[28,11,8],diameter:6,height:27,colour:'wood'}),P('3622pz2',30,17,8,'reddish brown'),P('3622pz2',30,26,8,'reddish brown'),cylinder({at:[28,38,8],diameter:6,height:6,colour:'blue'}),cylinder({at:[28,44,8],diameter:6,height:6,colour:'light bluish grey'}),floor({at:[28,50,8],size:[6,6],colour:'light bluish grey'}),P('3943b',29,51,9,'light bluish grey'),P('3942c',30,57,10,'blue'),P('4589',30,63,10,'light bluish grey'),
...[[27,10,90],[34,10,270],[30,6,0],[30,14,180]].map(q=>P('4460b',q[0],8,q[1],'blue',q[2])),P('3004p90',30,38,8,'blue'),
column({at:[25,8,15],height:30,diameter:2,colour:'wood'}),floor({at:[25,38,11],size:[3,6],layers:2,colour:'blue'}),P('3039p23',25,40,13,'white'),P('3957a',25,40,16,'black'),...range(5).map(i=>P('3069b',26+i*2,8,5,i%2?'yellow':'black'))
]);
section('Scout nest and rear details',[
roundDeck(52,45,7,12),floor({at:[54,45,4],size:[8,4],layers:3,colour:'wood',top:'tile'}),cylinder({at:[54,48,9],diameter:8,height:9,colour:'wood',texture:'log'}),box({at:[56,48,9],size:[4,9,1],colour:'blue'}),window({at:[57,50,9],facing:'front',size:'1x2x2',frame:'blue',glass:'trans yellow'}),window({at:[57,50,16],facing:'back',size:'1x2x2',frame:'blue',glass:'trans yellow'}),roof({style:'hip',at:[54,57,9],size:[8,8],colour:'tan'}),P('4032b',57,72,12,'blue'),P('3960',56,73,11,'light bluish grey'),P('3957a',57,75,12,'black'),
instance({component:'space-ewok',at:[54,48,4]}),P('3039p34',60,48,5,'blue'),column({at:[54,48,7],height:6,colour:'wood'}),column({at:[61,48,7],height:6,colour:'wood'}),
box({at:[44,3,43],size:[3,6,3],colour:'blue'}),P('3004p90',44,9,43,'blue'),P('3957a',45,9,44,'black'),P('4345b',37,3,44,'blue'),P('2489',40,3,45,'reddish brown')
]);