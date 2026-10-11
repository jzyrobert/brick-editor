script({title:'Catch of the Day — Pelican Pedal Express',description:'A white pelican pedals a scarlet bicycle along the harbour boardwalk, steering with its wings and carrying the morning fish in a wicker creel. Its long golden bill and pendulous pouch lead the silhouette; black flight feathers trail over the rear carrier.',palette:{bird:'white',bike:'red',bill:'yellow',feather:'black',wood:'dark tan'},defaults:{interior:'empty'}});
const W=38,D=22,ground=4;
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const tube=(a,b,colour='bike')=>[line({from:a,to:b,colour}),line({from:[a[0],a[1],a[2]+1],to:[b[0],b[1],b[2]+1],colour})];
section('Connected harbour display',[
 floor({at:[0,0,0],size:[W,D],layers:3,colour:'black',top:'tile'}),
 floor({at:[1,3,1],size:[W-2,6],colour:'dark azure',top:'tile'}),
 ...range(10).map(i=>floor({at:[1,3,7+i],size:[W-2,1],colour:i%3===0?'tan':'dark tan',top:'tile'})),
 floor({at:[1,3,17],size:[W-2,4],colour:'reddish brown',top:'tile'}),
 ...[[3,2,4],[10,4,6],[20,2,4],[28,5,5]].map(([x,z,n])=>floor({at:[x,4,z],size:[n,1],colour:'medium azure',top:'tile'})),
 ...[[5,1],[13,5],[23,3],[31,1]].map(([x,z])=>p('2431',[x,4,z],'white')),
 ...[3,10,17,24].map(x=>p('3069b',[x,4,8],'white')),
 fence({path:[[2,19],[30,19]],y:4,style:'lattice-low',colour:'white'}),
 ...[2,10,22,30].map(x=>column({at:[x,7,19],height:5,colour:'white',cap:'tile'})),
 p('4032b',[34,4,18],'dark bluish grey'),column({at:[34,5,18],height:18,colour:'white'}),p('3062b',[34,23,18],'trans yellow'),p('4589',[34,26,18],'black'),
 p('4032b',[2,4,9],'dark bluish grey'),p('3941',[2,5,9],'dark bluish grey'),p('14769',[2,8,9],'black'),
 p('64648',[17,4,4],'medium azure',90),
 floor({at:[14,3,0],size:[10,1],colour:'black',top:'tile'}),p('2412b',[16,4,0],'pearl gold'),p('2412b',[20,4,0],'pearl gold')
]);
const rear=[8,16,13],seat=[14,31,13],crank=[18,15,13],head=[26,30,13],front=[28,16,13];
section('Scarlet bicycle and working carrier',[
 ...[3,23].map(x=>p('88517',[x,ground,10],'black')),
 box({at:[17,4,13],size:[2,11,2],colour:'trans-clear',interior:'solid'}),
 ...tube(rear,seat),...tube(seat,crank),...tube(crank,rear),...tube(seat,head),...tube(head,crank),...tube(head,front),
 line({from:[8,16,13],to:[8,16,15],colour:'light bluish grey'}),line({from:[28,16,13],to:[28,16,15],colour:'light bluish grey'}),
 column({at:[14,31,13],height:5,colour:'light bluish grey'}),
 floor({at:[12,36,10],size:[7,5],colour:'black'}),
 column({at:[26,30,13],height:10,colour:'light bluish grey'}),
 floor({at:[26,40,7],size:[2,10],colour:'light bluish grey',top:'tile'}),
 p('15068',[26,41,7],'black',270),p('15068',[26,41,15],'black',270),
 line({from:[18,16,13],to:[20,19,8],colour:'light bluish grey'}),line({from:[18,16,14],to:[17,24,16],colour:'light bluish grey'}),
 floor({at:[19,19,7],size:[4,2],colour:'black',top:'tile'}),floor({at:[16,24,15],size:[4,2],colour:'black',top:'tile'}),
 column({at:[7,16,13],height:14,colour:'light bluish grey'}),column({at:[11,20,14],height:10,colour:'light bluish grey'}),
 floor({at:[4,30,9],size:[8,6],colour:'light bluish grey',top:'tile'}),
 box({at:[4,31,9],size:[6,6,6],colour:'tan',texture:'log',open:['top']}),
 floor({at:[5,32,10],size:[4,4],colour:'tan'}),
 floor({at:[4,36,9],size:[6,6],holes:[{at:[5,10],size:[4,4]}],colour:'reddish brown',top:'tile'}),
 p('64648',[6,33,10],'medium azure'),p('64648',[8,33,10],'orange'),
 p('3069b',[5,37,9],'dark blue'),p('3070b',[8,37,9],'white')
]);
section('Pelican: belly, black flight feathers and pedalling feet',[
 line({from:[17,40,10],to:[21,22,8],colour:'orange'}),line({from:[18,40,13],to:[17,27,15],colour:'orange'}),
 p('15068',[19,20,7],'orange',270),p('15068',[21,20,7],'orange',270),p('15068',[16,25,15],'orange',270),p('15068',[18,25,15],'orange',270),
 p('45410',[11,37,9],'white',90),
 box({at:[12,43,10],size:[8,6,4],colour:'white',interior:'solid'}),
 ...[10,12].map(z=>p('24309',[19,43,z],'white',270)),
 ...[10,12].map(z=>p('24309',[9,43,z],'white',90)),
 p('78522',[12,49,10],'white',90),...[10,12].map(z=>p('15068',[18,49,z],'white',270)),
 floor({at:[6,46,10],size:[7,4],colour:'white',top:'tile'}),
 ...range(10,14).map(z=>p('61678',[6,47,z],'black',90)),
 ...[10,12].map(z=>p('15068',[10,47,z],'white',90))
]);
function steeringWing(z,tipZ){return [floor({at:[17,44,z],size:[9,4],colour:'white',top:'tile'}),...range(3).map(i=>p('42022',[17,45,z+i],'white',270)),p('24309',[23,44,tipZ],'white',270),p('15068',[26,44,tipZ],'white',270)];}
section('Wings clasp the handlebars', [...steeringWing(7,7),...steeringWing(13,15)]);
section('Long neck, bright eyes and unmistakable pelican bill',[
 box({at:[20,46,10],size:[3,15,4],colour:'white',interior:'solid',top:'tile'}),
 ...range(10,14).map(z=>p('4460b',[22,50,z],'white',270)),
 ...range(10,14).map(z=>p('4460b',[19,50,z],'white',90)),
 floor({at:[20,61,10],size:[5,4],colour:'white'}),
 p('32803',[23,59,10],'white'),p('32803',[23,59,12],'white'),
 floor({at:[22,62,9],size:[5,6],colour:'white'}),
 box({at:[23,63,10],size:[3,3,4],colour:'white',interior:'solid'}),
 p('3005pe4',[25,63,9],'white'),p('3005pe4',[25,63,14],'white',180),
 ...[9,13].map(z=>p('24309',[22,63,z],'white',90)),
 p('78522',[22,66,10],'white',90),p('54200',[25,66,9],'white'),p('54200',[25,66,14],'white',180),
 ...range(10,14).map(z=>p('13547',[28,54,z],'yellow',270)),
 p('45410',[26,57,9],'yellow',90),
 floor({at:[24,63,9],size:[12,6],colour:'orange'}),
 floor({at:[26,64,10],size:[10,4],colour:'yellow'}),
 p('88930',[26,65,10],'yellow',270),p('78522',[28,65,10],'yellow',270),
 p('24309',[34,65,11],'yellow',270)
]);