script({title:'The Emberkeeper — Dragon of the Last Egg',description:'A crimson mother dragon shelters a single ivory egg with vast scalloped wings. Her curling tail embraces a ruined basalt hatchery; a glowing volcanic seam keeps the nest warm. Sculpted scales, ivory fangs, swept horns and four planted claws frame the precious egg.',palette:{hide:'dark red',bone:'tan',membrane:'tan',rock:{mix:['dark bluish grey','dark bluish grey','light bluish grey']}}});
const DROP=3;
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y-DROP,z],colour,turn});
const solid=(at,size,colour)=>box({at:[at[0],at[1]-DROP,at[2]],size,colour,interior:'solid'});
const site=[floor({at:[0,0,4],size:[46,28],layers:2,colour:'black'}),floor({at:[4,0,0],size:[38,36],layers:2,colour:'black'}),floor({at:[2,2,6],size:[42,24],colour:'dark bluish grey'}),floor({at:[5,2,3],size:[36,30],colour:'dark bluish grey'}),floor({at:[20,2,1],size:[9,7],colour:'dark orange',top:'tile'}),floor({at:[22,3,1],size:[4,3],colour:'bright light orange',top:'tile'}),...[21,26,29].map(x=>p('30385',x,6,2,'trans red'))];
for(const x of [0,45]){for(const z of [4,12,20])site.push(p('4162',x,5,z,'black',90));site.push(p('2431',x,5,28,'black',90));}
for(const z of [0,35]){for(const x of [4,12,20,28])site.push(p('4162',x,5,z,'black'));site.push(p('6636',36,5,z,'black'));}
for(const x of [1,42])for(const z of [4,31])site.push(p('63864',x,5,z,'black'));
for(const x of [4,41])for(const z of [1,32])site.push(p('63864',x,5,z,'black',90));
site.push(floor({at:[10,2,1],size:[8,2],colour:'light bluish grey',top:'tile'}),floor({at:[13,3,3],size:[6,2],colour:'light bluish grey',top:'tile'}),floor({at:[18,3,5],size:[2,2],colour:'dark tan',top:'tile'}),p('2431',14,6,4,'dark tan'),p('3039',3,6,25,'dark bluish grey',90),p('15068',4,6,28,'light bluish grey',180),p('3039',39,6,28,'dark bluish grey',270),p('15068',41,6,25,'light bluish grey',180));
section('Chamfered display, cracked processional path and volcanic seam',site);
section('Basalt sanctuary',[
 box({at:[4,3,8],size:[4,6,4],colour:'rock',texture:'masonry',top:'tile'}),p('3039',4,12,8,'dark bluish grey'),p('3039',6,12,10,'light bluish grey',180),
 box({at:[38,3,10],size:[4,12,4],colour:'rock',texture:'masonry',top:'tile'}),carve({at:[40,9,10],size:[2,6,2]}),p('3678b',38,18,10,'dark bluish grey',90),p('3039',40,18,12,'light bluish grey',180),
 wall({from:[8,4],to:[12,4],height:6,y:3,colour:'rock',texture:'masonry',top:'tile'}),wall({from:[34,6],to:[38,6],height:9,y:3,colour:'rock',texture:'masonry',top:'tile'}),
 p('15068',10,6,9,'dark bluish grey',90),p('15068',35,6,16,'dark bluish grey',270),p('3039',40,6,18,'dark bluish grey'),
 column({at:[36,3,3],height:6,diameter:2,colour:'dark bluish grey'}),p('4740',36,12,3,'pearl gold'),p('85861',36,13,3,'black'),p('18395',36,14,3,'orange')
]);
section('The warm nest and ivory egg',[
 floor({at:[20,3,4],size:[9,8],colour:'dark brown',holes:[{at:[22,6],size:[4,4]}]}),
 ...[20,22,24,26].flatMap(x=>[p('15068',x,7,4,'dark bluish grey'),p('15068',x,7,10,'dark bluish grey',180)]),
 ...[6,8].flatMap(z=>[p('11477',20,7,z,'reddish brown',90),p('11477',27,7,z,'reddish brown',270)]),
 solid([22,7,6],[4,5,4],'white'),...[22,24].flatMap(x=>[p('32803',x,8,6,'white'),p('32803',x,8,8,'white',180)]),
 p('87081',22,12,6,'white'),dome({at:[22,12,6],diameter:4,colour:'white'})
]);
const body=[solid([20,9,17],[8,17,12],'hide'),solid([21,6,21],[6,3,6],'hide')];
for(let z=17;z<29;z+=2)for(const [x,t] of [[18,90],[28,270]])body.push(p('32803',x,10,z,'hide',t),p('3678b',x,14,z,'hide',t),p('15068',x,20,z,'hide',t));
for(let z=17;z<29;z++)body.push(p('61678',16,23,z,'hide',90),p('61678',28,23,z,'hide',270));
body.push(floor({at:[20,23,19],size:[8,8],colour:'hide'}),floor({at:[22,24,19],size:[4,8],colour:'hide',top:'tile'}));
for(let z=19;z<27;z++)body.push(p('11477',20,27,z,'hide',90),p('11477',26,27,z,'hide',270));
for(let x=20;x<28;x+=2)body.push(p('15068',x,26,17,'hide'),p('15068',x,26,27,'hide',180));
for(const z of [19,22,25])body.push(p('3942c',23,28,z,'bone'));
section('Rounded torso and dorsal crest',body);
const neck=[solid([21,13,12],[6,17,7],'hide'),solid([22,30,11],[4,9,6],'hide'),solid([21,38,10],[6,7,5],'hide')];
for(const y of [15,18,21,24,27])for(const x of [22,24])neck.push(p('24309',x,y,10,'tan'));
for(const y of [30,33,36])for(let x=22;x<26;x++)neck.push(p('11477',x,y,10,'tan'));
for(let z=13;z<17;z++)neck.push(p('61678',18,27,z,'hide',90),p('61678',26,27,z,'hide',270));
for(let z=12;z<17;z++)for(const y of [30,34])neck.push(p('24201',20,y,z,'hide',90),p('24201',26,y,z,'hide',270));
neck.push(p('15068',22,36,15,'hide',180),p('15068',24,36,15,'hide',180),p('3942c',24,39,15,'bone'),p('4589',24,45,15,'bone'));
section('Arched neck and ribbed throat',neck);
const head=[solid([20,41,9],[8,6,6],'hide'),solid([21,38,4],[6,3,9],'hide'),floor({at:[21,38,4],size:[6,7],colour:'black',top:'tile'}),solid([20,45,3],[8,3,10],'hide'),floor({at:[18,42,10],size:[12,4],colour:'hide'}),floor({at:[20,44,8],size:[8,7],colour:'hide'}),solid([20,48,11],[8,3,4],'hide')];
for(let x=21;x<27;x++)head.push(p('13547',x,38,4,'hide'));
for(const x of [22,24])head.push(p('93606',x,48,3,'hide'));
for(const x of [21,26])head.push(p('61678',x,48,3,'hide'));
for(const x of [20,27])head.push(solid([x,38,8],[1,7,2],'hide'),p('3005',x,45,8,'yellow'),p('98138',x,48,8,'black'),p('3023b',x,48,9,'hide',90),p('11477',x,49,9,'hide'),p('40379',x,51,11,'tan'),p('11477',x,48,4,'hide'),p('11477',x,48,6,'hide'),p('54200',x,48,3,'black'));
head.push(p('41748',18,46,10,'hide'),p('41747',28,46,10,'hide'));
for(const x of [22,24])head.push(p('15068',x,51,11,'hide',180));
for(const x of [20,27])head.push(p('3665a',x,42,4,'white'));
for(const x of [22,24,26])head.push(p('4589',x,42,5,'white'));
section('Long muzzle, open jaws, alert eyes and swept horns',head);
function foreleg(x,right){const ops=[floor({at:[x,3,7],size:[6,8],layers:2,colour:'hide',top:'tile'}),solid([x+2,8,11],[2,15,6],'hide'),solid([right?27:17,20,15],[5,3,3],'hide')];for(let k=0;k<3;k++)ops.push(p('15070',x+2*k,8,7,'tan'),p('15068',x+2*k,8,9,'hide'));ops.push(p('3678b',x+1,11,11,'hide',90),p('3678b',x+3,11,11,'hide',270),p('15068',x+1,17,11,'hide'),p('15068',x+3,17,11,'hide'));for(let z=13;z<17;z++)ops.push(p('61678',x+1,20,z,'hide',right?270:90));return ops;}
function hindleg(x,right){const thigh=right?x:x+2;const ops=[floor({at:[x,3,21],size:[6,8],layers:2,colour:'hide',top:'tile'}),solid([thigh,8,23],[4,10,6],'hide'),solid([right?26:16,9,23],[6,6,5],'hide'),solid([right?x+4:x,8,24],[2,4,5],'hide')];for(let k=0;k<3;k++)ops.push(p('15070',x+2*k,8,21,'tan'));for(let z=23;z<29;z+=2)for(const a of [thigh,thigh+2])ops.push(p('15068',a,18,z,'hide'));for(let z=24;z<29;z++)ops.push(p('60481a',right?x+4:x,12,z,'hide',right?270:90));return ops;}
section('Four planted limbs with ivory claws',[foreleg(14,false),foreleg(29,true),hindleg(12,false),hindleg(30,true)]);
const tail=[];
function tailBlock(x,z,w,d,h){tail.push(solid([x,6,z],[w,h,d],'hide'));}
tailBlock(20,27,8,6,9);tailBlock(14,29,6,4,6);tailBlock(10,27,4,6,5);tailBlock(7,23,3,8,4);tailBlock(6,18,2,5,3);tailBlock(7,14,3,4,2);tailBlock(9,11,2,3,1);
tail.push(p('42918',20,15,29,'hide',90));for(let x=20;x<28;x+=2)tail.push(p('15068',x,15,27,'hide'),p('15068',x,15,31,'hide',180));
for(let z=29;z<33;z++)tail.push(p('61678',14,12,z,'hide',90));for(const z of [29,31])tail.push(p('15068',18,12,z,'hide',90));
for(let z=27;z<33;z++)tail.push(p('61678',10,11,z,'hide',90));for(let z=23;z<31;z++)tail.push(p('50950',7,10,z,'hide',90));
for(const z of [18,20])tail.push(p('15068',6,9,z,'hide'));tail.push(p('11477',6,9,22,'hide'));
for(let z=14;z<18;z++)tail.push(p('50950',7,8,z,'hide',270));tail.push(p('40379',10,7,9,'hide',180));
section('Coiling tail embracing the hatchery',tail);
const bottom=[9,3,6,12,9,0,3,0],top=[12,18,24,30,30,24,18,12];
function batWing(right){const ops=[];const put=(part,x,y,z,c,t,w)=>p(part,right?48-x-w:x,y,z+(right?2:0),c,right?(360-t)%360:t);const block=(x,y,z,w,h,d,c)=>solid([right?48-x-w:x,y,z+(right?2:0)],[w,h,d],c);for(let i=0;i<8;i++){const x=4+2*i,t=i<4?90:270;ops.push(block(x,26+bottom[i],22,2,top[i]-bottom[i],2,'membrane'));for(const z of [22,23])ops.push(put('60481a',x,26+top[i],z,'hide',t,2));if(i<7)ops.push(put('3660b',x,23+bottom[i],22,'hide',t,2));if(i%2===1)ops.push(block(x,26+bottom[i],21,1,top[i]-bottom[i]+3,2,'hide'),put('54200',x,29+top[i],21,'hide',t,1));}return ops;}
section('Spread sheltering bat wings',[floor({at:[18,23,22],size:[12,4],layers:2,colour:'hide'}),batWing(false),batWing(true)]);