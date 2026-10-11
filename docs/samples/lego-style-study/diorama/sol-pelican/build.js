script({title:'Pelican Express — Fish for the Road',description:'A white pelican pedals a turquoise delivery bicycle along a timber fishing pier. Its enormous golden bill leads the way, feathered wings grasp the handlebars, webbed feet work opposite pedals, and a rear hamper carries the morning catch.',palette:{sea:'dark azure',bike:'dark turquoise'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const L=(from,to,colour)=>line({from,to,colour});
section('Connected tidal display',[
 floor({at:[0,0,0],size:[46,26],layers:2,colour:'black'}),
 ...[[1,1,44,7],[1,20,44,5],[1,8,1,12],[44,8,1,12]].map(([x,z,w,d])=>floor({at:[x,2,z],size:[w,d],colour:'sea',top:'tile'})),
 floor({at:[2,2,8],size:[42,12],colour:'reddish brown'}),
 box({at:[2,3,8],size:[42,3,12],colour:'reddish brown',supports:8}),
 ...range(12).flatMap(r=>range(11).map(i=>{const attach=r>=10&&[0,5,8,9].includes(i);return P(i===10?'3069b':attach?'3710':'2431',[2+4*i,6,8+r],['dark tan','tan','reddish brown'][((r*7+i*3)%11===0)?2:r%2]);})),
 box({at:[2,3,20],size:[8,3,5],colour:'reddish brown'}),floor({at:[2,6,20],size:[8,5],colour:'dark tan',top:'tile'}),
 ...[3,15,29,41].flatMap(x=>[P('3003',[x,3,6],'reddish brown'),P('3068b',[x,6,6],'dark tan'),P('3003',[x,3,20],'reddish brown'),P('3068b',[x,6,20],'dark tan')]),
 ...[4,16,30,40].map(x=>P('2431',[x,3,5],'white')),
 ...[8,23,35].map(x=>P('3069b',[x,3,3],'medium azure')),
 ...[18,33].map(x=>P('2431',[x,3,23],'medium azure'))
]);
const bollard=(x,z)=>[P('3022',[x,7,z],'dark bluish grey'),P('3941',[x,8,z],'black'),P('3941',[x,11,z],'black'),P('4032b',[x,14,z],'yellow'),P('14769',[x,15,z],'black')];
section('Pier furniture',[
 ...bollard(3,18),...bollard(22,18),...bollard(40,18),
 box({at:[3,7,22],size:[6,6,3],colour:'dark tan',texture:'log',open:['top']}),
 floor({at:[3,13,22],size:[6,3],colour:'tan',top:'tile'}),
 P('64648',[4,14,22],'medium azure',90),P('64648',[6,14,24],'orange',90),
 column({at:[36,7,18],height:18,colour:'dark turquoise'}),
 box({at:[34,25,18],size:[6,7,1],colour:'white',top:'tile'}),
 P('3004',[36,27,17],'dark turquoise'),P('54200',[38,27,17],'dark turquoise',270),
 P('64648',[36,7,9],'sand green',90)
]);
section('Bicycle — open diamond frame',[
 P('2903c01',[6,7,12],'light bluish grey'),P('2903c01',[26,7,12],'light bluish grey'),
 box({at:[19,7,12],size:[2,17,2],colour:'trans-clear',interior:'solid'}),
 floor({at:[19,24,11],size:[4,6],colour:'trans-clear'}),
 ...[[[11,20,11],[17,36,11]],[[17,36,11],[21,21,11]],[[21,21,11],[11,20,11]],[[17,36,11],[29,36,11]],[[29,36,11],[21,21,11]],[[29,36,11],[31,20,11]],[[11,20,15],[17,36,15]],[[29,36,15],[31,20,15]],[[21,21,11],[21,21,17]],[[17,36,11],[17,36,15]]].map(a=>L(a[0],a[1],'bike')),
 L([17,36,13],[17,41,13],'light bluish grey'),
 floor({at:[15,41,11],size:[6,5],colour:'black'}),
 ...[11,14].map(z=>P('88930',[15,42,z],'black')),
 L([29,36,13],[29,45,13],'light bluish grey'),L([29,45,7],[29,45,20],'light bluish grey'),
 L([29,45,6],[29,45,9],'black'),L([29,45,18],[29,45,21],'black'),
 P('4032b',[28,46,12],'light bluish grey'),P('4740',[28,47,12],'pearl gold'),
 L([21,21,11],[22,24,8],'light bluish grey'),L([21,21,15],[17,32,18],'light bluish grey'),
 floor({at:[20,23,6],size:[4,3],colour:'black'}),floor({at:[15,31,17],size:[4,3],colour:'black'}),
 floor({at:[4,35,10],size:[9,6],layers:2,colour:'light bluish grey'}),
 L([7,20,11],[6,35,11],'light bluish grey'),L([7,20,15],[6,35,15],'light bluish grey')
]);
section('Rear fish hamper',[
 box({at:[3,37,10],size:[7,9,6],colour:'tan',texture:'log',open:['top']}),
 box({at:[4,37,11],size:[5,4,4],colour:'medium azure',interior:'solid'}),
 ...[4,6,8].map(x=>P('64648',[x,41,11],'medium azure')),
 P('64648',[5,41,14],'orange',90),
 ...[10,15].map(z=>P('6636',[3,46,z],'reddish brown')),
 ...[3,9].map(x=>P('2431',[x,46,11],'reddish brown',90)),
 P('3070b',[9,46,10],'reddish brown'),P('3070b',[9,46,15],'reddish brown')
]);
section('Pelican — belly and feathered back',[
 P('45410',[13,39,10],'white',90),
 box({at:[13,45,11],size:[11,12,6],colour:'white',interior:'solid'}),
 ...range(11).flatMap(i=>[P('13547',[13+i,43,8],'white'),P('13547',[13+i,43,14],'white',180),P('61678',[13+i,50,8],'white'),P('61678',[13+i,50,14],'white',180)]),
 ...range(5).flatMap(i=>[P('15068',[13+2*i,56,9],'white'),P('15068',[13+2*i,56,15],'white',180)]),
 floor({at:[13,57,11],size:[10,4],colour:'white',top:'tile'}),
 floor({at:[9,44,11],size:[6,2],colour:'white'}),
 ...[10,12,14,16].flatMap((z,i)=>[P(i%2?'41769a':'41770a',[8,44,z],i===0||i===3?'black':'white',90),P('61678',[8,45,z],i===0||i===3?'black':'white',90)]),
 L([22,43,10],[25,33,8],'orange'),L([25,33,8],[22,25,8],'orange'),
 L([21,43,17],[15,37,18],'orange'),L([15,37,18],[17,33,18],'orange'),
 P('51739',[20,24,6],'orange'),P('51739',[15,32,17],'orange'),
 ...[6,7,8].map(z=>P('11477',[22,25,z],'yellow',270)),
 ...[17,18,19].map(z=>P('11477',[17,33,z],'yellow',270))
]);
const wing=(zs)=>zs.flatMap((z,i)=>[L([17,51,z],[29,45,z],'white'),P('42022',[14+i%2,52,z],'white',270),P('42022',[20+i%2,49,z],'white',270),P('42022',[26+i%2,46,z],i===0?'light bluish grey':'white',270)]);
section('Wings holding the handlebars',[...wing([6,7,8,9]),...wing([17,18,19,20])]);
section('S neck, bright eyes and enormous fishing bill',[
 box({at:[23,52,11],size:[4,9,4],colour:'white',interior:'solid'}),
 box({at:[24,61,11],size:[4,13,4],colour:'white',interior:'solid'}),
 ...range(7).flatMap(i=>{const y=53+i*3;const x=i<3?23:24;return [P('11477',[x,y,9],'white'),P('11477',[x+1,y,9],'white'),P('11477',[x+2,y,9],'white'),P('11477',[x+3,y,9],'white'),P('11477',[x,y,15],'white',180),P('11477',[x+1,y,15],'white',180),P('11477',[x+2,y,15],'white',180),P('11477',[x+3,y,15],'white',180)];}),
 P('3684a',[26,52,11],'white',270),P('3684a',[26,52,13],'white',270),
 box({at:[25,73,10],size:[7,8,6],colour:'white',interior:'solid'}),
 P('3005pe4',[29,77,9],'white'),P('3005pe4',[29,77,16],'white',180),
 P('11477',[29,80,9],'white'),P('11477',[29,80,15],'white',180),
 ...[25,27,29].flatMap(x=>[P('15068',[x,81,10],'white'),P('15068',[x,81,14],'white',180)]),
 floor({at:[25,81,12],size:[6,2],colour:'white',top:'tile'}),
 ...[11,13].flatMap(z=>[P('32803',[33,65,z],'orange'),P('32803',[35,65,z],'orange'),P('32803',[37,65,z],'orange')]),
 box({at:[31,69,11],size:[9,5,4],colour:'orange',interior:'solid'}),
 ...[11,12,13,14].map(z=>P('61678',[38,70,z],'orange',270)),
 floor({at:[31,74,11],size:[13,4],colour:'black',top:'tile'}),
 floor({at:[31,75,11],size:[13,4],colour:'yellow'}),
 box({at:[31,76,11],size:[2,3,4],colour:'yellow',interior:'solid'}),
 P('42918',[33,76,11],'yellow',270),P('42918',[33,76,13],'yellow',270),
 ...[11,12,13,14].map(z=>P('11477',[41,76,z],'yellow',270)),
 P('54200',[43,73,12],'yellow',270),P('54200',[43,73,13],'yellow',270)
]);