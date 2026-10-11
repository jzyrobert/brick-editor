script({title:'The Seaside Pedalican',description:'A grand white pelican pedals a coral-red bicycle, its immense golden pouch over a basket of fish. Swept wings grip the handlebars; orange webbed feet pedal at different heights.',palette:{bird:'white',bike:'red',bill:'yellow',pouch:'orange',feather:'black',metal:'light bluish grey'},defaults:{interior:'empty'}});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const b=(at,size,colour,extra={})=>box({at,size,colour,...extra});
const ln=(from,to,colour)=>line({from,to,colour});
section('Compact sea-blue display foot',[
 floor({at:[-6,0,3],size:[12,7],layers:2,colour:'dark blue',top:'tile'}),
 ...[-2,0].map(x=>column({at:[x,2,5],diameter:2,height:18,colour:'trans-clear'})),
 ...[-6,4].map(x=>p('15068',[x,2,3],'medium azure'))
]);
section('Tyres and double diamond bicycle',[
 p('88517c01',[-1,0,-13],'light bluish grey',90),p('88517c01',[-1,0,13],'light bluish grey',90),
 ...[-4,3].flatMap(x=>[
 ln([x,18,6],[x,40,12],'bike'),ln([x,40,12],[x,40,-6],'bike'),ln([x,40,-6],[x,18,6],'bike'),
 ln([x,18,6],[x,18,19],'bike'),ln([x,18,19],[x,40,12],'bike')]),
 ...[-5,4].map(x=>ln([x,18,-7],[x,44,-5],'bike')),
 ln([-5,18,-7],[4,18,-7],'metal'),ln([-4,18,19],[3,18,19],'metal'),
 b([-4,19,5],[8,3,3],'bike'),
 b([-4,39,-6],[8,3,2],'bike'),b([-4,39,11],[8,3,2],'bike'),
 b([-1,42,11],[2,3,3],'metal'),b([-3,45,9],[6,3,7],'dark brown',{top:'tile'}),
 b([-1,42,-6],[2,5,2],'metal'),b([-9,46,-9],[18,1,2],'metal'),
 ...[-9,6].map(x=>b([x,47,-9],[3,2,2],'black',{top:'tile'})),
 p('4740',[3,47,-8],'pearl gold'),
 ln([-6,20,5],[6,32,10],'dark bluish grey'),
 floor({at:[-9,19,3],size:[6,5],layers:1,colour:'black',top:'tile'}),
 floor({at:[3,31,7],size:[6,5],layers:1,colour:'black',top:'tile'}),
 ...[-4,3].map(x=>p('3700',[x,18,6],'light bluish grey',90))
]);
section('Webbed feet in mid pedal stroke',[
 ...[[-8,20,3],[4,32,7]].flatMap(([x,y,z])=>[
 floor({at:[x,y,z],size:[4,4],layers:2,colour:'orange'}),
 ...range(4).map(i=>p('11477',[x+i,y+2,z],'orange')),
 p('15068',[x,y+2,z+2],'orange'),p('15068',[x+2,y+2,z+2],'orange')]),
 ln([-6,24,5],[-6,35,9],'orange'),ln([-6,35,9],[-5,50,14],'orange'),
 ln([6,36,9],[6,42,18],'orange'),ln([6,42,18],[5,50,15],'orange'),
 p('4032b',[-7,34,8],'orange'),p('4032b',[5,41,17],'orange')
]);
section('Rounded breast and pear-shaped body',[
 b([-4,48,8],[8,4,12],'bird',{interior:'solid'}),
 b([-8,55,6],[16,9,17],'bird'),b([-4,64,7],[8,9,14],'bird'),
 ...range(6,23).flatMap(z=>[
 p('13547',[-8,52,z],'bird',90),p('13547',[4,52,z],'bird',270),
 p('61678',[-8,64,z],'bird',90),p('61678',[4,64,z],'bird',270)]),
 ...range(7,21,2).flatMap(z=>[p('3678b',[-6,67,z],'bird',90),p('3678b',[4,67,z],'bird',270)]),
 b([-4,55,3],[8,9,3],'bird'),
 ...range(-4,4).map(x=>p('13547',[x,52,3],'bird')),
 ...range(-4,4,2).map(x=>p('24309',[x,64,3],'bird')),
 ...range(-4,4).flatMap(x=>[p('61678',[x,73,7],'bird'),p('61678',[x,73,17],'bird',180)]),
 floor({at:[-4,73,11],size:[8,6],colour:'bird',top:'tile'}),
 ...range(-4,4).map(x=>p('61678',[x,64,21],'bird',180))
]);
const wing=(x,side)=>[
 ln([x+1,47,-8],[x+1,63,13],'bird'),
 ...range(6).flatMap(i=>{
 const z=-9+i*4,y=47+i*3;
 return [b([x,y-2,z],[3,2,4],'bird',{interior:'solid'}),
 ...range(3).map(j=>p('61678',[x+j,y,z],i>3&&j===(side?2:0)?'feather':'bird'))];
 })
];
section('Swept steering wings',[-9,6].flatMap((x,side)=>wing(x,side)));
section('Black flight-feather tail',[
 b([-4,55,21],[8,4,8],'bird'),
 ...range(-4,4).map(x=>p('93273',[x,59,25],'feather',180)),
 ...range(-2,2).map(x=>p('61678',[x,63,23],'bird',180)),
 p('41769a',[3,63,27],'feather'),p('41770a',[-5,63,27],'feather')
]);
section('Upright flowing neck',[
 b([-3,67,4],[6,12,6],'bird'),b([-2,79,3],[4,12,6],'bird'),b([-2,91,1],[4,12,6],'bird'),
 ...range(4).flatMap(i=>{
 const y=67+i*6,z=i<2?2:1;
 return [...range(-3,3,2).map(x=>p('24309',[x,y,z],'bird')),
 p('11477',[-4,y,5],'bird',90),p('11477',[2,y,5],'bird',270),
 p('11477',[-4,y+3,5],'bird',90),p('11477',[2,y+3,5],'bird',270)];
 }),
 ...range(4).map(i=>p('88930',[-2,79+i*6,8],'bird',180)),
 ...range(-2,2).map(x=>p('13547',[x,97,-3],'bird'))
]);
section('Bright-eyed pelican head',[
 b([-3,100,-3],[6,10,8],'bird'),
 ...[-4,3].flatMap(x=>[
 b([x,101,-3],[1,5,7],'bird'),
 p('3005',[x,106,-1],'black'),p('6141',[x,109,-1],'white'),
 p('11477',[x<0?-5:3,110,-2],'bird',x<0?90:270),
 p('11477',[x,106,1],'bird',180)]),
 ...range(-3,3).map(x=>p('61678',[x,110,-3],'bird')),
 ...range(-3,3).map(x=>p('61678',[x,110,1],'bird',180)),
 p('15068',[-1,113,0],'bird')
]);
section('Great golden bill and hanging throat pouch',[
 b([-2,94,-15],[4,4,12],'pouch',{interior:'solid'}),
 b([-2,98,-19],[4,8,16],'bill'),b([-4,101,-18],[8,5,15],'bill'),
 ...range(-16,-3).flatMap(z=>[p('13547',[-6,98,z],'pouch',90),p('13547',[2,98,z],'pouch',270)]),
 ...range(-18,-3,2).flatMap(z=>[p('15068',[-4,103,z],'bill',90),p('15068',[2,103,z],'bill',270)]),
 b([-3,106,-22],[6,1,19],'dark orange'),
 floor({at:[-3,107,-22],size:[6,19],colour:'bill'}),
 ...range(-3,3).map(x=>p('61678',[x,108,-22],'bill')),
 ...range(-3,3).flatMap(x=>[-18,-12].map(z=>p('6636',[x,108,z],'bill',90))),
 ...range(-3,3).map(x=>p('63864',[x,108,-6],'bill',90)),
 b([-2,105,-25],[4,3,3],'bill',{top:'tile'}),
 p('24309',[-2,108,-25],'pouch'),p('24309',[0,108,-25],'pouch'),
 ...range(-3,3).map(x=>p('11477',[x,108,-3],'bill',180))
]);
section('Wicker catch basket',[
 floor({at:[-4,36,-16],size:[8,6],layers:2,colour:'dark tan'}),
 room({at:[-4,38,-16],size:[8,9,6],colour:'tan',texture:'log',openings:[]}),
 floor({at:[-4,47,-16],size:[8,6],colour:'tan',top:'tile',holes:[{at:[-3,-15],size:[6,4]}]}),
 ...[-1,1].map(x=>column({at:[x,38,-13],diameter:1,height:6,colour:'tan'})),
 floor({at:[-3,44,-15],size:[6,4],colour:'dark tan'}),
 p('64648',[-2,45,-14],'medium azure'),p('64648',[0,45,-14],'orange'),p('8043',[2,45,-14],'white'),
 ln([-4,39,-10],[-1,42,-6],'dark tan'),ln([3,39,-10],[0,42,-6],'dark tan')
]);