script({title:'Catch of the Day — Pelican Pedal Express',description:'A great white pelican pedals a cobalt bicycle, wings clasping the handlebars, webbed feet on opposite pedals and a fish peeking from its enormous orange bill. Spoked wheels, a brass bell, a rear luggage rack and a compact transparent parking support finish the sculpture.',palette:{bird:'white',bike:'blue',bill:'orange',pouch:'bright light orange',metal:'light bluish grey'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const tube=(a,b,c='bike',w=2)=>range(w).map(i=>range(2).map(j=>line({from:[a[0]+i,a[1]+j,a[2]],to:[b[0]+i,b[1]+j,b[2]],colour:c})));
section('Compact parking support',[
 floor({at:[-5,0,-1],size:[10,8],layers:2,colour:'dark bluish grey',top:'tile'}),
 ...[-2,0].map(x=>column({at:[x,2,1],diameter:2,height:18,colour:'trans-clear'})),
 P('2431',-4,2,5,'white'),P('2431',0,2,5,'white')
]);
const front=-12,rear=14;
section('Spoked wheels and fork dropouts',[front,rear].map(z=>[
 place({part:'71720c01',at:[0,21,z],colour:'black',turn:90,anchor:'origin'}),
 ...[-3,2].map(x=>box({at:[x,18,z-2],size:[1,6,4],colour:'bike',interior:'solid'}))
]));
section('Open diamond bicycle frame',[
 tube([-1,20,2],[-1,45,7]),tube([-1,20,2],[-1,43,-9]),tube([-1,44,7],[-1,43,-9]),
 ...[-3,2].map(x=>[tube([x,21,14],[x,44,7],'bike',1),tube([x,21,14],[x,20,2],'bike',1),tube([x,21,-12],[x,44,-9],'bike',1)]),
 floor({at:[-3,44,-10],size:[6,3],layers:2,colour:'bike'}),
 box({at:[-1,43,6],size:[2,4,3],colour:'metal',interior:'solid'}),
 floor({at:[-3,47,4],size:[6,6],layers:1,colour:'reddish brown'}),
 floor({at:[-3,48,6],size:[6,2],layers:1,colour:'reddish brown'}),
 ...range(3).map(i=>P('15068',-3+2*i,48,4,'reddish brown')),
 ...range(3).map(i=>P('15068',-3+2*i,48,8,'reddish brown',180)),
 box({at:[-1,46,-9],size:[2,2,2],colour:'metal',interior:'solid'}),
 floor({at:[-9,47,-11],size:[18,2],layers:1,colour:'metal'}),
 ...[-9,6].map(x=>[P('3039',x,48,-11,'black'),P('3023b',x,47,-9,'black')]),
 P('4032b',2,48,-10,'pearl gold'),P('4740',2,49,-10,'pearl gold'),
 box({at:[-3,22,1],size:[6,3,2],colour:'metal',interior:'solid'}),
 tube([-6,24,1],[-3,24,1],'metal',1),tube([3,18,4],[6,18,4],'metal',1),
 floor({at:[-8,27,-1],size:[5,3],layers:1,colour:'black',top:'tile'}),
 floor({at:[3,21,3],size:[5,3],layers:1,colour:'black',top:'tile'}),
 floor({at:[-3,44,14],size:[6,9],layers:1,colour:'metal'}),
 ...[-3,2].map(x=>tube([x,24,16],[x,44,20],'metal',1)),
 ...range(3).map(i=>P('2431',-2+2*i,45,15,'metal',90)),
 P('3022',-1,45,21,'black'),P('15068',-1,46,21,'red',180)
]);
function foot(x,y,z){return [floor({at:[x,y,z],size:[5,5],layers:1,colour:'bill'}),P('41747',x,y+1,z-1,'bill'),P('41748',x+3,y+1,z-1,'bill'),P('2431',x+2,y+1,z,'bill',90)];}
section('Opposite pedals and webbed feet',[
 foot(-8,28,-2),foot(3,22,2),
 tube([-6,32,1],[-5,45,7],'bill',2),tube([4,26,5],[5,45,9],'bill',2),
 ...range(2).map(i=>P('4460b',-6+i,33,1,'bill')),
 ...range(2).map(i=>P('4460b',4+i,30,5,'bill')),
 P('15068',-6,44,6,'bill'),P('15068',4,44,8,'bill')
]);
section('Rounded white body and black tipped tail',[
 box({at:[-5,49,3],size:[10,6,12],colour:'bird'}),
 box({at:[-3,49,6],size:[6,5,2],colour:'bird',interior:'solid'}),
 box({at:[-6,54,1],size:[12,21,16],colour:'bird'}),
 floor({at:[-4,75,1],size:[8,16],layers:4,colour:'bird',top:'tile'}),
 ...range(8).map(i=>[P('93606',-8,75,1+2*i,'bird',90),P('93606',4,75,1+2*i,'bird',270)]),
 ...range(6).map(i=>[P('3660b',-7,51,3+2*i,'bird',90),P('3660b',5,51,3+2*i,'bird',270)]),
 ...range(6).map(i=>[P('3684a',-6+2*i,54,-1,'bird'),P('3684a',-6+2*i,63,-1,'bird')]),
 ...range(6).map(i=>P('24309',-6+2*i,72,-2,'bird')),
 ...range(6).map(i=>P('24309',-6+2*i,72,17,'bird',180)),
 floor({at:[-4,55,15],size:[8,10],layers:2,colour:'bird'}),
 P('41747',-4,57,19,'black',180),P('41748',2,57,19,'black',180),
 ...range(4).map(i=>[P('61678',-2+i,57,17,'bird',180),P('61678',-2+i,57,21,'black',180)]),
 ...range(6).map(i=>P('3660b',-6+2*i,54,15,'bird',180))
]);
function wing(left){const x=left?-9:6,outer=left?-10:8,t=left?90:270;return [
 box({at:[x,57,0],size:[3,15,14],colour:'bird'}),
 box({at:[x,48,-11],size:[3,6,11],colour:'bird'}),
 box({at:[x,54,-3],size:[3,3,3],colour:'bird',interior:'solid'}),
 ...range(7).map(i=>[P('3684a',outer,57,2*i,'bird',t),P('3684a',outer,66,2*i,'bird',t)]),
 ...range(7).map(i=>P('15068',outer,75,2*i,'bird',t)),
 ...range(3).map(i=>range(3).map(j=>P('61678',x+i,54,-11+4*j,'bird'))),
 ...range(3).map(i=>[P('61678',x+i,63,14,'bird',180),P('61678',x+i,63,18,'black',180)]),
 ...range(7).map(i=>P('24201',outer,53,2*i,'bird',t)),
 ...range(3).map(i=>P('11477',x+i,48,-12,'bird'))
];}
section('Wings curled around the handlebars',[wing(true),wing(false)]);
function neckBand(y,z){return [
 ...range(2).map(i=>P('3684a',-2+2*i,y,z-2,'bird')),
 ...range(2).map(i=>P('3684a',-2+2*i,y,z+5,'bird',180)),
 ...range(2).map(i=>[P('3684a',-4,y,z+2*i,'bird',90),P('3684a',2,y,z+2*i,'bird',270)])
];}
section('Long swept pelican neck',[
 box({at:[-2,78,-1],size:[4,15,5],colour:'bird'}),
 box({at:[-2,93,-4],size:[4,18,5],colour:'bird'}),
 neckBand(78,-1),neckBand(87,-1),neckBand(96,-4),neckBand(105,-4),
 floor({at:[-2,92,-4],size:[4,8],layers:1,colour:'bird'})
]);
section('Expressive head with two printed eyes',[
 box({at:[-4,110,-9],size:[8,10,8],colour:'bird'}),
 ...range(4).map(i=>[P('3660b',-4+2*i,107,-9,'bird'),P('3660b',-4+2*i,107,-3,'bird',180)]),
 ...[-5,3].map((x,k)=>[
 ...[-6,-4,-2].map(z=>P('3684a',x,110,z,'bird',k?270:90)),
 P('6091',x,110,-8,'bird',k?270:90),P('6091',x,110,-7,'bird',k?270:90),
 P('6091',x,114,-8,'bird',k?270:90),
 P('3005pe4',k?4:-5,114,-7,'bird',k?270:90),
 P('11477',x,117,-7,'bird',k?270:90),
 ...range(4).map(i=>P('15068',x,120,-9+2*i,'bird',k?270:90))]),
 floor({at:[-3,120,-9],size:[6,8],layers:1,colour:'bird'}),
 ...range(6).map(i=>[P('61678',-3+i,121,-9,'bird'),P('61678',-3+i,121,-5,'bird',180)]),
 P('54200',-4,113,-10,'bill',90),P('54200',3,113,-10,'bill',270)
]);
function pouchSide(x,t){return [
 ...range(7).map(i=>[P('32803',x,100,-23+2*i,'pouch',t),P('3684c',x,104,-23+2*i,'bill',t)]),
 P('24201',x,100,-9,'pouch',t),P('4460b',x,104,-9,'bill',t)
];}
section('Deep throat pouch and long tapered bill',[
 P('54091',-4,98,-21,'orange'),
 box({at:[-3,101,-23],size:[6,10,15],colour:'pouch'}),
 pouchSide(-5,90),pouchSide(3,270),
 ...range(6).map(i=>P('4460b',-3+i,102,-25,'pouch')),
 floor({at:[-3,111,-30],size:[6,22],layers:1,colour:'bill',top:'tile'}),
 floor({at:[-3,112,-29],size:[6,20],layers:1,colour:'black',top:'tile'}),
 box({at:[-3,113,-10],size:[6,2,2],colour:'bill',interior:'solid'}),
 floor({at:[-3,115,-32],size:[6,24],layers:1,colour:'bill'}),
 floor({at:[-4,115,-28],size:[8,20],layers:1,colour:'bill'}),
 box({at:[-2,116,-28],size:[4,2,20],colour:'bill',interior:'solid'}),
 ...range(10).map(i=>[P('15068',-4,116,-28+2*i,'bill',90),P('15068',2,116,-28+2*i,'bill',270)]),
 ...range(4).map(i=>range(5).map(j=>P('2431',-2+i,118,-28+4*j,i===1||i===2?'yellow':'bill',90))),
 P('41747',-2,115,-36,'bill'),P('41748',0,115,-36,'bill'),
 ...range(3).map(i=>P('2431',-2+i,116,-32,'bill',90)),
 P('64648',-4,113,-27,'medium azure',90)
]);