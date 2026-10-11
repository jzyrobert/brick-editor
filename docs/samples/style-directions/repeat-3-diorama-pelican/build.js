script({title:'Pelican Express — the catch of the day',description:'A determined pelican pedals a turquoise fish-delivery bicycle along a seaside timber jetty. An enormous golden bill and deep throat pouch lead the way, white wings grip the handlebars, webbed feet work opposite pedals, and the morning catch rides in a wicker carrier.',palette:{bike:'dark turquoise',stone:{mix:['light bluish grey','dark bluish grey']}},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
section('Connected seaside display',[
 floor({at:[0,0,0],size:[40,26],layers:2,colour:'dark blue'}),
 floor({at:[0,2,0],size:[40,8],colour:'medium azure',top:'tile'}),
 floor({at:[0,2,8],size:[40,13],layers:2,colour:'reddish brown'}),
 floor({at:[0,2,21],size:[40,5],layers:3,colour:'tan',top:'tile'}),
 ...range(20).flatMap(i=>[8,12,16].map(z=>P('87079',i*2,4,z,(i%7===0?'reddish brown':i%3===0?'tan':'dark tan'),90))),
 ...range(10).map(i=>P('2431',i*4,4,20,'reddish brown')),
 ...range(10).map(i=>P('2431',i*4,2,0,'dark blue')),
 ...range(8).flatMap(i=>[P('15068',2+i*5,3,3,'white',i%2?180:0),P('11477',i*5,3,6,'trans light blue',90)]),
 ...[1,9,19,29,38].flatMap(x=>[box({at:[x,2,7],size:[1,6,1],colour:'reddish brown',interior:'solid'}),P('3070b',x,8,7,'dark tan')]),
 ...[1,9,19,29,38].map(x=>box({at:[x,5,22],size:[1,9,1],colour:'reddish brown',interior:'solid',top:'tile'})),
 wall({from:[1,22],to:[38,22],y:11,height:2,colour:'tan'}),
 ...range(9).map(i=>P('2431',2+i*4,13,22,'dark tan'))
]);
const rock=(x,z,w,h)=>[box({at:[x,5,z],size:[w,h,2],colour:'stone',interior:'solid'}),...range(w).map(k=>P('11477',x+k,5+h,z,'light bluish grey',180))];
section('Tide line and route marker',[
 ...rock(2,24,4,3),...rock(11,24,3,3),...rock(22,24,4,6),...rock(30,24,3,3),
 column({at:[36,5,24],height:18,colour:'white'}),
 box({at:[34,17,23],size:[5,9,1],colour:'dark blue',interior:'solid'}),
 ...range(5).map(x=>P(x===1?'3024':'3070b',34+x,26,23,'white')),
 P('64648',35,27,23,'orange',90),
 P('3062b',5,3,1,'red'),P('3062b',5,6,1,'white'),P('4589',5,9,1,'red'),
 P('64648',19,3,1,'medium azure',90),
 ...[[17,1],[21,1],[18,4]].map(([x,z])=>P('6141',x,3,z,'trans-clear'))
]);
section('Spoked wheels and diamond frame',[
 P('88517',5,5,13,'black'),P('88517',25,5,13,'black'),
 ...[11,17].flatMap(z=>[
 line({from:[10,17,z],to:[14,34,z],colour:'bike'}),
 line({from:[14,34,z],to:[23,34,z],colour:'bike'}),
 line({from:[14,34,z],to:[21,18,z],colour:'bike'}),
 line({from:[21,18,z],to:[23,34,z],colour:'bike'}),
 line({from:[23,34,z],to:[30,17,z],colour:'bike'}),
 line({from:[21,18,z],to:[30,17,z],colour:'bike'}),
 line({from:[10,17,z],to:[10,17,14],colour:'light bluish grey'}),
 line({from:[30,17,z],to:[30,17,14],colour:'light bluish grey'})]),
 line({from:[21,18,10],to:[21,18,20],colour:'light bluish grey'}),
 box({at:[19,19,8],size:[4,2,2],colour:'black',interior:'solid',top:'tile'}),
 box({at:[23,14,19],size:[4,2,2],colour:'black',interior:'solid',top:'tile'}),
 line({from:[21,19,19],to:[24,15,19],colour:'light bluish grey'}),
 box({at:[23,34,12],size:[2,3,4],colour:'bike',interior:'solid'}),
 floor({at:[22,37,10],size:[7,6],layers:1,colour:'black',top:'tile'}),
 column({at:[13,34,14],height:9,colour:'bike'}),
 line({from:[13,42,7],to:[13,42,20],colour:'light bluish grey'}),
 P('11477',12,43,7,'black'),P('11477',12,43,19,'black',180),
 box({at:[13,43,7],size:[1,1,1],colour:'white',interior:'solid'}),box({at:[13,43,19],size:[1,1,1],colour:'white',interior:'solid'}),
 P('4740',13,43,13,'pearl gold'),
 box({at:[30,17,11],size:[1,14,1],colour:'light bluish grey',interior:'solid'}),
 box({at:[33,17,17],size:[1,14,1],colour:'light bluish grey',interior:'solid'}),
 floor({at:[29,31,10],size:[10,8],layers:2,colour:'black'}),
 box({at:[31,33,10],size:[7,9,8],colour:'reddish brown',texture:'log',open:['top']}),
 floor({at:[32,34,11],size:[5,6],layers:6,colour:'white',top:'tile'}),
 P('64648',33,40,12,'orange'),P('64648',35,40,14,'sand green'),P('8043',34,40,13,'white'),
 ...[31,37].flatMap(x=>range(4).map(i=>P('3069b',x,42,10+i*2,'dark tan',90))),
 ...[10,17].flatMap(z=>[P('2431',32,42,z,'dark tan'),P('3070b',36,42,z,'dark tan')])
]);
section('Working webbed feet',[
 line({from:[25,39,10],to:[22,29,9],colour:'orange'}),
 line({from:[22,29,9],to:[20,21,9],colour:'orange'}),
 floor({at:[18,21,8],size:[5,3],colour:'orange'}),
 ...range(3).flatMap(z=>[P('50950',18,22,8+z,'orange',90),P('3069b',21,22,8+z,'orange')]),
 line({from:[26,39,17],to:[28,28,19],colour:'orange'}),
 line({from:[28,28,19],to:[25,16,20],colour:'orange'}),
 floor({at:[23,16,19],size:[5,3],colour:'orange'}),
 ...range(3).flatMap(z=>[P('50950',23,17,19+z,'orange',90),P('3069b',26,17,19+z,'orange')])
]);
section('Round body and swept tail',[
 box({at:[23,38,12],size:[4,6,4],colour:'white',interior:'solid'}),
 box({at:[20,41,9],size:[10,12,9],colour:'white'}),
 ...range(8).flatMap(i=>[P('13547',20,38,10+i,'white',90),P('13547',24,38,10+i,'white',270)]),
 ...range(9).flatMap(i=>[P('42023',18,41,9+i,'white',90),P('42023',24,41,9+i,'white',270)]),
 ...range(9).flatMap(i=>[P('61678',20+i,50,7,'white'),P('61678',20+i,50,15,'white',180)]),
 ...range(5).flatMap(i=>[P('93606',18,53,9+i*2,'white',90),P('93606',26,53,9+i*2,'white',270),P('87079',22,53,9+i*2,'white')]),
 floor({at:[28,43,11],size:[7,6],colour:'white'}),
 ...range(6).map(i=>P('42022',29,44,11+i,i===0||i===5?'white':'black',270))
]);
function wing(z){return [
 box({at:[14,44,z],size:[13,3,3],colour:'white'}),
 ...range(3).flatMap(i=>[P('42022',14+i,47,z+i,'white',90),P('42022',20+i,47,z+i,'white',270),P('42022',26+i,47,z+i,'black',270)]),
 P('15068',13,44,z,'white',90)
];}
section('Wings holding the handlebars',[...wing(6),...wing(18)]);
section('Curving neck and expressive head',[
 box({at:[18,53,11],size:[5,16,5],colour:'white'}),
 ...range(5).map(i=>P('4460b',17,57,11+i,'white',90)),
 ...range(5).map(i=>P('4460b',23,57,11+i,'white',270)),
 box({at:[15,65,10],size:[8,10,6],colour:'white'}),
 ...range(4).flatMap(i=>[P('50950',14,75,10+i*2,'white',90),P('50950',20,75,10+i*2,'white',270)]),
 ...range(6).map(i=>P('3069b',17,75,10+i,'white')),
 ...[8,16].map(z=>P('15068',18,68,z,'white',z===8?0:180)),
 P('11477',17,71,8,'yellow'),P('11477',17,71,16,'yellow',180),
 P('11477',17,74,8,'black'),P('11477',17,74,16,'black',180),
 P('15068',17,77,8,'white'),P('15068',17,77,16,'white',180)
]);
section('Golden bill and deep throat pouch',[
 ...range(6).flatMap(i=>[P('42023',5,59,10+i,'tan',90),P('42023',11,59,10+i,'tan',270)]),
 box({at:[8,62,10],size:[9,7,6],colour:'tan'}),
 ...range(7).flatMap(i=>[P('11477',8+i,66,9,'tan'),P('11477',8+i,66,15,'tan',180)]),
 floor({at:[5,69,10],size:[12,6],colour:'bright light orange'}),
 floor({at:[1,69,12],size:[4,2],colour:'bright light orange'}),
 floor({at:[5,70,10],size:[12,6],colour:'black'}),
 floor({at:[1,70,12],size:[4,2],colour:'black'}),
 P('93606',1,71,12,'orange',90),
 P('41748',5,71,10,'orange',90),P('41747',5,71,14,'orange',90),
 P('44126',5,71,12,'orange',90),
 ...range(3).map(i=>P('44126',11,71,10+i*2,'orange',90))
]);