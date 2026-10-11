script({title:'The Ember Nursery',description:'An obsidian dragon shelters three eggs beneath sweeping garnet wings. Ivory horns, watchful golden eyes, a plated throat and twelve white claws frame her protective pose. Her curling tail encloses the nursery beside lava channels and the broken arch of an ancient mountain forge.',palette:{hide:'black',membrane:'dark red',bone:'tan',rock:'dark bluish grey',ember:'orange'}});
const p=(part,x,y,z,colour='black',turn=0)=>place({part,at:[x,y,z],colour,turn});
const b=(x,y,z,w,h,d,colour='black',extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
const f=(x,y,z,w,d,colour,layers=1,top)=>floor({at:[x,y,z],size:[w,d],colour,layers,...(top?{top}: {})});
const stone='dark bluish grey';
section('Connected volcanic display',[
 f(0,0,0,48,40,'black',2),f(1,2,1,46,38,stone),
 f(0,2,0,48,1,'black',1,'tile'),f(0,2,39,48,1,'black',1,'tile'),f(0,2,1,1,38,'black',1,'tile'),f(47,2,1,1,38,'black',1,'tile'),
 f(4,3,4,29,5,'dark red'),f(4,3,9,9,8,'orange',1,'tile'),f(7,3,19,5,6,'dark red',1,'tile'),
 ...range(10).map(i=>p('3069b',5+i*2,4,5,i%3===0?'yellow':'orange')),
 ...range(2).map(i=>p('2431',6,4,10+i*4,i%2?'trans red':'orange',90)),
 f(17,3,22,15,13,stone,3),f(15,3,18,18,6,stone,3),f(5,3,26,10,9,stone,3),
 f(15,3,14,6,6,stone,4),f(27,3,14,6,6,stone,4),
 ...[[3,21],[7,24],[12,30],[39,27],[40,16],[32,8],[37,35]].flatMap(([x,z])=>[f(x,3,z,4,4,stone),p('3039',x,4,z,stone),p('3039',x+2,4,z+2,stone,180)]),
 ...[[3,19],[13,25],[40,24],[39,12],[33,5],[7,32]].flatMap(([x,z],i)=>[p('3022',x,3,z,stone),p('3942c',x,4,z,i%2?stone:'black')])
]);
section('Warm nursery and abandoned forge',[
 f(17,4,6,12,10,'reddish brown',2),f(18,6,7,10,8,'dark tan'),
 ...range(6).map(i=>p('15068',17+2*i,6,5,stone)),...range(2,5).map(i=>p('15068',17+2*i,6,15,stone,180)),
 ...range(3).flatMap(i=>[p('15068',16,6,7+2*i,stone,90),p('15068',28,6,7+2*i,stone,270)]),
 p('87081',20,7,9,'tan'),dome({at:[20,10,9],diameter:4,colour:'tan'}),
 p('3941',25,7,8,'tan'),p('3942c',25,10,8,'tan'),p('3941',18,7,10,'tan'),p('3942c',18,10,10,'tan'),
 ...[[18,8],[26,13],[23,14],[19,7]].map(([x,z])=>p('98138',x,7,z,'pearl gold')),
 b(6,6,27,2,15,2,stone),b(12,6,27,2,15,2,stone),
 p('3307',7,21,27,stone),p('3307',7,21,28,stone),f(6,27,27,8,2,stone,2,'tile'),
 b(6,29,27,2,6,2,stone,{texture:'masonry',top:'tile'}),b(11,29,27,3,3,2,stone,{texture:'masonry',top:'tile'}),
 p('3660b',8,29,27,stone),p('3004',10,6,32,'light bluish grey'),p('15068',10,9,32,stone),
 p('85861',8,4,13),p('18395',8,5,13,'orange'),p('85861',11,4,17),p('18395',11,5,17,'orange')
]);
function paw(x,z,y,w){return [f(x,y+2,z,w,6,'black',1,'tile'),...range(w).map(i=>p('11477',x+i,y+3,z+1)),...range(3).map(i=>p('49668',x+i+Math.max(0,w-4),y+3,z-1,'white'))];}
function haunch(x,left){const sx=left?x-1:x+5;const t=left?90:270;return [b(x,6,25,6,15,8),...range(3).map(i=>p('42918',x+2*i,21,25)),...range(3).flatMap(k=>[p('4460b',sx,6,26+2*k,'black',t),p('3678b',sx,15,26+2*k,'black',t)])];}
section('Four clawed feet and powerful crouching body',[
 ...paw(15,21,4,5),...paw(29,21,4,5),...haunch(15,true),...haunch(29,false),
 ...paw(16,14,5,4),...paw(28,14,5,4),
 b(17,8,16,3,12,5),b(28,8,16,3,12,5),b(17,20,19,4,7,4),b(27,20,19,4,7,4),
 ...[17,28].flatMap(x=>[p('93606',x,20,17),p('15068',x,11,16),p('15068',x,14,16),p('15068',x,17,16)]),
 b(19,12,21,10,15,10),b(20,27,22,8,6,8),
 ...range(4).flatMap(j=>range(3).map(k=>p('15068',21+2*k,15+3*j,20,'tan'))),
 ...[18,28].flatMap((x,s)=>range(3).map(k=>p('4460b',x,24,24+2*k,'black',s?270:90))),
 ...range(4).flatMap(i=>range(3).map(j=>p('15068',20+2*i,33,24+2*j))),
 b(20,33,22,2,3,2),b(26,33,22,2,3,2),
 ...[25,27,29].map(z=>p('4589',24,36,z,'tan')),
 p('78522',21,24,29,'black',90)
]);
section('Armoured neck and watchful horned head',[
 b(21,27,18,6,12,7),b(21,36,15,6,9,6),
 ...range(3).flatMap(j=>[p('15068',22,27+3*j,17,'tan'),p('15068',24,27+3*j,17,'tan')]),
 ...range(3).flatMap(j=>[p('15068',22,36+3*j,14,'tan'),p('15068',24,36+3*j,14,'tan')]),
 ...[20,26].flatMap((x,s)=>[p('4460b',x,27,18,'black',s?270:90),p('4460b',x,27,20,'black',s?270:90),p('4460b',x,36,16,'black',s?270:90),p('4460b',x,36,18,'black',s?270:90)]),
 ...range(6).map(i=>p('50950',21+i,42,20,'black',180)),
 b(20,49,15,6,9,6),b(20,45,9,6,3,7),f(20,48,9,6,6,'dark red'),b(20,52,9,6,3,7),
 ...range(6).map(i=>p('13547',20+i,42,9)),
 ...range(3).flatMap(i=>[p('15068',20+2*i,45,7),p('15068',20+2*i,52,7),p('15068',20+2*i,55,7)]),
 f(20,55,9,6,6,'black',1,'tile'),p('3024',21,56,10),p('3024',24,56,10),p('98138',21,57,10,stone),p('98138',24,57,10,stone),
 ...[20,22,24].map(x=>p('4589',x,49,9,'white')),
 ...[20,25].flatMap(x=>[p('4589',x,49,12,'white'),p('49668',x,49,14,'white',180)]),
 ...[19,25].flatMap((x,s)=>range(2).flatMap(j=>range(3).map(k=>p('15068',x,49+3*j,15+2*k,'black',s?270:90)))),
 ...range(3).flatMap(i=>range(3).map(j=>p('15068',20+2*i,58,15+2*j))),
 ...[19,26].flatMap(x=>[b(x,55,15,1,3,3),p('3024',x,58,15),p('98138pz4',x,59,15,'yellow'),p('11477',x,59,16)]),
 ...[20,25].flatMap(x=>[p('85861',x,61,20,'tan'),p('11089',x,62,20,'tan',180)]),
 p('4589',23,61,20,'tan')
]);
const tailSegments=[[22,10,29,6,6,6],[28,8,31,8,6,4],[36,6,28,4,6,7],[36,4,22,4,6,6],[34,4,17,6,6,5],[31,4,14,6,3,3],[27,4,12,6,3,2]];
function tailSegment(a,i){const [x,y,z,w,h,d]=a;const top=y+h;const sx=i>3?x+3:x+2;const sz=i>3?z+1:z;return [b(x,y,z,w,h,d,'black',{top:'tile'}),...range(w/2).flatMap(j=>range(Math.floor(d/2)).map(k=>p('15068',x+2*j,top,z+2*k,'black',i>3?90:180))),p('3024',sx,top+3,sz),p('4589',sx,top+4,sz,'tan')];}
section('Long curling nursery guard tail',[
 ...tailSegments.flatMap(tailSegment),b(24,4,11,4,3,1),p('61678',24,7,11,'black',90),p('40379',22,4,10,'black',90)
]);
function wing(left){const bands=left?[[2,16,4],[6,17,8],[10,18,12],[14,19,14],[18,20,12]]:[[43,16,4],[39,17,8],[35,18,12],[31,19,14],[27,20,12]];return [
 ...bands.flatMap(([x,z,d])=>[f(x,36,z,4,d,'dark red',2,'tile'),...(d>4?[p('43720',x,38,z+d-4,'dark red'),p('43721',x+2,38,z+d-4,'dark red')]:[]),...(d===8?[p('11477',x+1,38,z+2)]:[]),...(d>=12?[p('61678',x+1,38,z+3),...(d>=14?[p('11477',x+1,38,z+7)]:[]),p('3069b',x+2,38,z+4,'red'),p('3069b',x+2,38,z+6,'dark red')]:[])]),
 p('42918',left?2:39,38,16,'black',left?90:270),p('42918',left?10:31,38,18,'black',left?90:270),p('61678',left?18:27,38,20,'black',left?90:270),
 p('4589',left?9:39,41,17,'tan')
];}
section('Garnet membranes with sculpted black wing fingers',[
 ...wing(true),...wing(false)
]);