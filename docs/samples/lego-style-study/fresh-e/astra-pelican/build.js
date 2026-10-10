script({title:'The Early Fish — Pelican Express',description:'A great white pelican pedals a scarlet seaside bicycle, wings on the handlebars, enormous golden pouch leading the way and the morning catch in a wicker carrier.',palette:{bike:'red',feather:'white',bill:'yellow',pouch:'orange'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour,extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
const L=(a,b,colour)=>line({from:a,to:b,colour});
section('Spoked wheels and discreet balance stand',[
 P('49295p02',0,0,-1,'white'),P('49295p02',24,0,-1,'white'),
 floor({at:[17,0,-4],size:[6,8],layers:2,colour:'black',top:'tile'}),
 column({at:[19,2,-1],diameter:2,height:12,colour:'trans-clear'}),
 B(18,14,-2,5,3,4,'red',{interior:'solid'})
]);
function frameSide(z){return [L([6,14,z],[11,38,z],'red'),L([23,38,z],[30,14,z],'red'),L([20,16,z],[30,14,z],'red'),B(5,13,z,2,3,1,'light bluish grey',{interior:'solid'}),B(29,13,z,2,3,1,'light bluish grey',{interior:'solid'})];}
section('Scarlet diamond frame',[
 frameSide(-2),frameSide(2),
 B(10,35,-1,14,3,2,'red',{interior:'solid',top:'tile'}),
 L([11,35,0],[20,16,0],'red'),L([12,35,1],[21,16,1],'red'),
 L([20,16,0],[23,39,0],'red'),L([21,16,1],[24,39,1],'red'),
 B(10,34,-2,2,7,5,'red',{interior:'solid'}),
 B(22,37,-1,2,6,2,'light bluish grey',{interior:'solid'}),
 B(20,42,-3,7,2,6,'black',{top:'tile'}),
 range(3).map(i=>P('15068',20+i*2,44,-3,'black')),
 B(10,41,-1,2,3,2,'light bluish grey',{interior:'solid'}),
 B(9,43,-7,2,2,14,'light bluish grey',{interior:'solid',top:'tile'}),
 B(8,43,-8,3,2,2,'black',{interior:'solid',top:'tile'}),B(8,43,6,3,2,2,'black',{interior:'solid',top:'tile'}),
 P('3648b',19,17,-3,'light bluish grey'),
 L([20,20,-4],[17,19,-4],'light bluish grey'),L([21,20,3],[25,25,3],'light bluish grey'),
 B(15,18,-7,5,2,4,'black',{top:'tile'}),B(23,25,3,5,2,4,'black',{top:'tile'}),
 L([22,17,-3],[29,15,-3],'dark bluish grey'),L([22,23,-3],[29,18,-3],'dark bluish grey'),
 P('3062b',9,45,3,'pearl gold'),P('4740',9,48,3,'pearl gold'),
 P('6141',11,41,-2,'trans-clear'),P('6141',29,26,2,'trans red')
]);
section('Pedalling webbed feet',[
 L([23,46,-4],[17,34,-5],'orange'),L([17,34,-5],[19,24,-5],'orange'),
 L([24,46,4],[27,38,5],'orange'),L([27,38,5],[25,30,5],'orange'),
 B(16,20,-7,5,3,4,'orange',{interior:'solid'}),B(23,27,3,5,3,4,'orange',{interior:'solid'}),
 range(4).map(i=>P('61678',15,23,-7+i,'orange',90)),
 range(4).map(i=>P('61678',22,30,3+i,'orange',90)),
 range(3).map(i=>P('54200',15,20,-7+i,'yellow',90)),
 range(3).map(i=>P('54200',22,27,3+i,'yellow',90))
]);
section('Rounded body and rising breast',[
 B(17,46,-4,13,7,8,'white'),B(15,53,-5,17,9,10,'white'),B(17,62,-4,13,5,8,'white'),
 [15,23].map(x=>[-6,0].map(z=>P('45410',x,47,z,'white',90))),
 [15,23].map(x=>[-6,0].map(z=>P('45411',x,61,z,'white',90))),
 range(8).map(i=>P('61678',12,56,-4+i,'white',90)),
 range(8).map(i=>P('13547',12,53,-4+i,'white',90)),
 range(8).map(i=>P('61678',29,56,-4+i,'white',270)),
 B(12,59,-3,6,12,6,'white',{interior:'solid'}),
 B(10,68,-3,6,12,6,'white'),B(9,78,-3,5,9,6,'white'),
 range(6).map(i=>P('4460b',10,59,-3+i,'white',90)),
 range(6).map(i=>P('4460b',8,68,-3+i,'white',90)),
 range(6).map(i=>P('61678',7,80,-3+i,'white',90)),
 range(6).map(i=>P('61678',14,77,-3+i,'white',270)),
 range(6).map(i=>P('13547',15,65,-3+i,'white',270))
]);
function wing(z){const ops=[];for(let k=0;k<4;k++){const x=9+3*k,y=k===0?41:45+4*k;ops.push(B(x+2,y-2,z,4,6,3,'white',{interior:'solid'}));for(let j=0;j<3;j++)ops.push(P('42022',x+(j===1?-1:0),y+4,z+j,k===0?'black':'white',90));}ops.push(B(20,59,z,7,8,3,'white'));for(let j=0;j<3;j++)ops.push(P('42022',21,67,z+j,'white',90));return ops;}
section('Wings reaching for the grips',[wing(-8),wing(5)]);
section('Swept black flight feathers',[
 B(29,52,-4,6,3,8,'white'),
 range(8).map(i=>P('42023',30,55,-4+i,i===0||i===7?'white':'black',270)),
 range(8).map(i=>P('42022',30,58,-4+i,i===0||i===7?'white':'black',270)),
 range(6).map(i=>P('61678',33,61,-3+i,'black',270))
]);
section('Head, attentive eyes and crest',[
 B(5,84,-3,10,7,6,'white'),B(6,88,-4,7,5,8,'white'),
 P('45411',6,93,-4,'white'),
 range(6).map(i=>P('61678',12,88,-3+i,'white',270)),
 P('3003pe2',6,90,-4,'white'),P('3003pe2',6,90,2,'white',180),
 P('11477',5,93,-4,'white',90),P('11477',5,93,3,'white',90),
 P('11477',11,96,-1,'white',270),P('11477',12,96,0,'white',270)
]);
const pouch=[];for(let i=0;i<9;i++){const x=-12+i*2,y=82-Math.min(9,i*2);pouch.push(B(x,y,-2,2,84-y,4,'orange',{interior:'solid'}));pouch.push(P('32803',x,y,-3,'orange'),P('32803',x,y,1,'orange',180));}
section('Long golden bill and deep fishing pouch',[
 pouch,
 floor({at:[-13,84,-3],size:[19,6],colour:'orange'}),
 floor({at:[-13,85,-3],size:[19,6],colour:'dark orange'}),
 floor({at:[-13,86,-3],size:[19,6],layers:2,colour:'yellow',top:'tile'}),
 range(3).map(i=>P('41748',-14,88,-3+i*2,'yellow',90)),
 range(3).map(i=>P('41747',-8,88,-3+i*2,'yellow',90)),
 range(3).map(i=>P('61678',-2,88,-3+i*2,'yellow',90)),
 range(3).map(i=>P('2431',2,88,-3+i*2,'yellow')),
 P('11477',-15,85,-1,'orange',90)
]);
section('Blue scarf streaming behind',[
 B(10,72,-4,6,3,1,'medium azure',{interior:'solid'}),B(10,72,3,6,3,1,'medium azure',{interior:'solid'}),
 B(15,72,-3,2,3,6,'medium azure',{interior:'solid'}),
 B(17,73,1,8,2,2,'medium azure',{interior:'solid',top:'tile'}),
 range(2).map(i=>P('61678',23,73,1+i,'medium azure',270)),
 range(2).map(i=>P('61678',18,71,3+i,'medium azure',270))
]);
section('Morning catch carrier',[
 L([30,15,-2],[35,32,-2],'light bluish grey'),L([30,15,2],[35,32,2],'light bluish grey'),
 floor({at:[32,32,-4],size:[9,8],layers:2,colour:'light bluish grey'}),
 floor({at:[32,34,-4],size:[9,8],colour:'reddish brown'}),
 room({at:[32,35,-4],size:[9,9,8],colour:'tan',texture:'log',openings:[]}),
 floor({at:[32,44,-4],size:[9,8],colour:'dark tan',top:'tile',holes:[{at:[33,-3],size:[7,6]}]}),
 B(34,35,-2,5,6,4,'medium azure',{top:'tile'}),
 P('64648',34,41,-1,'sand green',90),P('64648',36,41,1,'orange',90),
 P('2412b',39,44,-2,'tan',90),P('2412b',39,44,1,'tan',90)
]);