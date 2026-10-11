script({title:'The Stormbrood Sanctuary',description:'An emerald dragon shelters her ivory clutch in the ruins of a river watchtower. Vast black storm wings, a curling armoured tail, ivory horns and a watchful open jaw turn an abandoned crossing into a nursery.',palette:{hide:'dark green',belly:'tan',stone:{mix:['light bluish grey','light bluish grey','dark bluish grey']},water:'dark blue'}});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
section('Connected river display',[
 floor({at:[0,0,0],size:[48,32],layers:3,colour:'black'}),floor({at:[0,3,0],size:[48,10],colour:'water',top:'tile'}),
 box({at:[3,3,11],size:[42,6,19],colour:'dark bluish grey',supports:8}),box({at:[33,3,4],size:[12,6,12],colour:'stone'}),box({at:[10,3,9],size:[19,6,4],colour:'stone'}),
 ...range(11).map(i=>p('3298',4+i*3,4,9,i%3?'dark bluish grey':'light bluish grey')),...range(7).map(i=>p('3298',5+i*5,4,29,'dark bluish grey',180)),
 ...[[3,6],[7,4],[12,7],[17,3],[24,6],[29,4],[33,2],[42,2]].map(([x,z],i)=>p('2431',x,4,z,i%2?'trans light blue':'white')),
 ...[[2,15],[2,22],[45,19],[45,25]].map(([x,z])=>p('3039',x,3,z,'dark bluish grey'))
]);
function foot(x,z,w){return [box({at:[x,9,z],size:[w,3,6],colour:'hide'}),...range(w).map(i=>p('49668',x+i,12,z,'tan')),...range(w).map(i=>p('11477',x+i,12,z+2,'hide')),...range(w).map(i=>p('11477',x+i,12,z+4,'hide',180))];}
section('Four planted feet and muscular haunches',[
 ...foot(17,7,4),...foot(28,8,4),...foot(14,20,6),...foot(31,21,6),
 cylinder({at:[18,12,11],diameter:3,height:15,colour:'hide'}),cylinder({at:[28,12,12],diameter:3,height:15,colour:'hide'}),cylinder({at:[15,12,22],diameter:6,height:15,colour:'hide'}),cylinder({at:[29,12,23],diameter:6,height:15,colour:'hide'}),
 ...[15,29].flatMap((x,j)=>range(3).filter(i=>j?i>0:i===0).flatMap(i=>[p('15068',x+i*2,27,22+j,'hide'),p('15068',x+i*2,27,25+j,'hide',180)])),
 ...[14,35].flatMap((x,j)=>range(3).map(i=>p('15068',x,18+i*3,23+j,'hide',j?270:90))),...[17,31].flatMap((x,j)=>range(3).map(i=>p('11477',x,15+i*3,12+j,'hide',j?270:90)))
]);
section('Connected torso and sculpted emerald armour',[
 box({at:[20,21,16],size:[8,12,12],colour:'hide'}),box({at:[18,27,18],size:[14,6,7],colour:'hide'}),
 ...[18,28].flatMap((x,s)=>range(4).flatMap(k=>range(6).map(j=>p('15068',x,21+k*3,16+j*2,'hide',s?270:90)))),
 ...[20,22,26,28].flatMap(x=>range(6).map(j=>p('15068',x,33,16+j*2,'hide',j<3?0:180))),
 ...range(4).flatMap(i=>[p('3003',24,33,17+i*3,'hide'),p('3942c',24,36,17+i*3,'tan')]),
 ...range(3).flatMap(k=>[p('15068',22,24+k*3,14,'tan'),p('15068',24,24+k*3,14,'tan')]),
 ...range(4).map(i=>p('3660b',20+i*2,18,16,'hide')),...range(4).map(i=>p('3660b',20+i*2,18,26,'hide',180))
]);
section('Rising throat',[
 box({at:[22,27,9],size:[6,15,9],colour:'hide'}),box({at:[22,42,9],size:[6,3,4],colour:'hide'}),
 ...range(5).flatMap(k=>[p('15068',23,27+k*3,9,'tan'),p('15068',25,27+k*3,9,'tan')]),
 ...[20,28].flatMap((x,s)=>range(4).flatMap(k=>range(2).map(j=>p('15068',x,30+k*3,11+j*2,'hide',s?270:90)))),
 ...[22,26].flatMap(x=>[p('15068',x,36,16,'hide',180),p('15068',x,39,16,'hide',180)])
]);
section('Open jaw, nostrils, watching eyes and swept horns',[
 box({at:[22,39,0],size:[8,3,10],colour:'hide',top:'tile'}),floor({at:[23,42,1],size:[6,7],colour:'dark red',top:'tile'}),
 box({at:[20,45,4],size:[12,9,9],colour:'hide'}),box({at:[22,46,0],size:[8,3,8],colour:'hide'}),
 ...[22,26].flatMap(x=>range(4).map(i=>p('88930',x,49,i*2,'hide'))),...[22,24,26,28].flatMap(x=>[p('15068',x,54,4,'hide'),p('15068',x,54,10,'hide',180)]),
 ...[19,31].flatMap((x,s)=>range(3).flatMap(k=>range(3).map(j=>p('15068',x,45+k*3,4+j*2,'hide',s?270:90)))),
 ...[22,29].flatMap(x=>[p('4589',x,42,2,'tan'),p('4589',x,42,5,'tan')]),p('98138',23,52,1,'black'),p('98138',28,52,1,'black'),
 p('3022',20,54,8,'yellow'),p('3022',30,54,8,'yellow'),p('98138',21,55,8,'black'),p('98138',30,55,8,'black'),p('11477',20,55,9,'hide',270),p('11477',30,55,9,'hide',90),
 p('40379',20,54,11,'tan'),p('40379',31,54,11,'tan'),p('3942c',25,54,8,'tan')
]);
section('Great sheltering storm wings',[
 box({at:[18,27,19],size:[3,4,4],colour:'hide'}),box({at:[28,27,19],size:[3,4,4],colour:'hide'}),p('51342',2,31,21,'black',180),p('51342',28,31,21,'black'),
 p('15068',18,31,18,'hide'),p('15068',29,31,18,'hide'),p('40379',18,34,17,'tan'),p('40379',30,34,17,'tan')
]);
section('Tail curled around the sanctuary',[
 box({at:[21,18,26],size:[8,9,5],colour:'hide'}),box({at:[18,15,28],size:[6,9,4],colour:'hide'}),box({at:[12,12,27],size:[7,6,5],colour:'hide'}),box({at:[8,9,24],size:[6,6,5],colour:'hide'}),box({at:[5,9,20],size:[4,3,5],colour:'hide'}),
 ...[21,23,25,27].map(x=>p('15068',x,27,28,'hide',180)),...[18,20,22].map(x=>p('15068',x,24,30,'hide',180)),...[12,14,16].flatMap(x=>[p('15068',x,18,27,'hide'),p('15068',x,18,30,'hide',180)]),
 ...[8,10,12].map(x=>p('61678',x,15,24,'hide',180)),...[6,7,8].map(x=>p('61678',x,12,20,'hide',180)),p('40379',5,12,17,'tan',180),
 p('4589',24,30,30,'tan'),p('4589',20,27,31,'tan'),p('4589',15,21,29,'tan'),p('4589',10,18,26,'tan')
]);
section('The abandoned crossing becomes a nursery',[
 cylinder({at:[34,9,5],diameter:10,height:3,colour:'reddish brown'}),carve({at:[35,10,6],size:[8,2,8]}),p('24946',37,10,8,'white'),p('24946',40,10,8,'tan'),p('24946',38,10,11,'white'),
 box({at:[37,9,15],size:[3,18,3],colour:'stone',texture:'masonry',open:['top']}),box({at:[42,9,15],size:[3,18,3],colour:'stone',texture:'masonry',open:['top']}),
 p('3307',37,27,15,'light bluish grey'),p('3307',37,27,17,'light bluish grey'),floor({at:[37,33,15],size:[8,3],colour:'stone',top:'tile'}),
 box({at:[37,34,17],size:[2,6,1],colour:'stone',texture:'masonry',top:'tile'}),box({at:[43,34,16],size:[2,3,2],colour:'stone',texture:'masonry',top:'tile'}),p('3039',37,40,17,'light bluish grey'),p('3039',43,37,16,'dark bluish grey'),
 ...[[4,15],[7,18],[41,28]].map(([x,z])=>p('32607',x,9,z,'dark green')),...[[34,17],[39,20],[42,23],[6,12]].map(([x,z])=>p('54200',x,9,z,'dark tan')),p('2489',42,9,27,'reddish brown')
]);