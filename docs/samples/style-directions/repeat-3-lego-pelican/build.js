script({title:'Special Delivery: The Pelican Pedaller',description:'A long-billed white pelican leans into a scarlet bicycle. Black-tipped wings hold the handlebars, orange webbed feet work the pedals, and a turquoise scarf streams behind. A fresh fish peeks out beside its capacious throat pouch.',palette:{bird:'white',frame:'red',bill:'yellow',pouch:'orange',feather:'black',scarf:'dark turquoise'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const L=(a,b,c)=>line({from:a,to:b,colour:c});
section('Spoked wheels and discreet display support',[
 P('71720c01',-1,0,-23,'black',90),P('71720c01',-1,0,12,'black',90),
 floor({at:[-7,0,-1],size:[14,10],layers:2,colour:'dark bluish grey',top:'tile'}),
 box({at:[-2,2,1],size:[4,24,4],colour:'trans-clear',interior:'solid'})
]);
const frame=[];
for(const x of [-4,4])frame.push(
 L([x,21,20],[x,27,1],'frame'),L([x,49,10],[x,21,20],'frame'),L([x,21,-15],[x,48,-13],'frame'),
 L([x,21,20],[x,42,23],'light bluish grey')
);
frame.push(L([0,27,1],[0,49,10],'frame'),L([0,27,1],[0,48,-13],'frame'),L([0,48,-13],[0,49,10],'frame'),L([-4,49,10],[4,49,10],'frame'),L([-4,48,-13],[4,48,-13],'frame'),
 L([-4,21,-15],[4,21,-15],'light bluish grey'),L([-4,21,20],[4,21,20],'light bluish grey'),L([-5,27,1],[5,27,1],'light bluish grey'),L([0,47,-13],[0,60,-14],'frame'),L([-12,60,-14],[12,60,-14],'light bluish grey'),
 box({at:[-3,49,7],size:[6,3,8],colour:'black',top:'tile'}),floor({at:[-4,42,18],size:[8,9],layers:2,colour:'light bluish grey',top:'tile'}),
 L([-5,27,1],[-5,31,-2],'light bluish grey'),L([5,27,1],[5,37,4],'light bluish grey'),
 floor({at:[-8,30,-4],size:[5,5],colour:'black'}),floor({at:[3,36,3],size:[5,5],colour:'black'}),
 P('3062b',-12,61,-14,'black'),P('3062b',12,61,-14,'black'),P('4740',4,61,-14,'pearl gold'),P('6141',4,62,-14,'pearl gold'),
 P('3003',-1,45,-16,'red'),P('15068',-1,48,-16,'yellow'),
 L([-4,29,1],[-4,24,19],'dark bluish grey')
);
section('Scarlet diamond bicycle',frame);
const legs=[];
for(const s of [-1,1]){
 const x=s<0?-6:4,footY=s<0?31:37,footZ=s<0?-4:3;
 legs.push(L([s*3,58,9],[x,46,4],'pouch'),L([x,46,4],[x,footY,footZ+2],'pouch'));
 legs.push(P('3020',s<0?-8:4,footY,footZ,'orange'));
 for(let k=0;k<4;k++)legs.push(P('11477',(s<0?-8:4)+k,footY+1,footZ,'orange'));
}
section('Orange pedalling legs and webbed feet',legs);
const body=[
 box({at:[-3,52,8],size:[6,4,6],colour:'bird'}),
 floor({at:[-4,56,2],size:[8,12],colour:'bird',layers:3}),
 box({at:[-4,59,2],size:[8,15,12],colour:'bird',interior:'empty'}),
 box({at:[-6,62,0],size:[12,12,16],colour:'bird',interior:'empty'}),
 box({at:[-4,74,2],size:[8,3,12],colour:'bird',top:'tile'}),
 floor({at:[-3,64,15],size:[6,10],colour:'bird',top:'tile'})
];
for(let x=-6;x<6;x++)body.push(P('13547',x,59,-3,'white'),P('13547',x,59,15,'white',180));
for(let z=0;z<16;z++)body.push(P('13547',-8,59,z,'white',90),P('13547',4,59,z,'white',270));
for(let x=-6;x<6;x+=2)body.push(P('24309',x,74,-2,'white'),P('24309',x,74,15,'white',180));
for(let z=2;z<14;z++)body.push(P('61678',-8,74,z,'white',90),P('61678',4,74,z,'white',270));
for(let y=62;y<74;y+=6)for(let x=-6;x<6;x+=2)body.push(P('3678b',x,y,-1,'white'),P('3678b',x,y,15,'white',180));
for(let k=0;k<3;k++)body.push(P('44126',-3+2*k,65,19,k===1?'white':'black',180));
section('Rounded belly, breast and feathered tail',body);
const neck=[
 box({at:[-3,73,-2],size:[6,18,6],colour:'bird',interior:'empty'}),
 box({at:[-3,88,-5],size:[6,18,6],colour:'bird',interior:'empty'}),
 box({at:[-4,101,-9],size:[8,9,8],colour:'bird',interior:'empty'}),
 floor({at:[-5,105,-8],size:[10,3],colour:'bird',top:'tile'})
];
for(let x=-3;x<3;x++)neck.push(P('4460b',x,76,-3,'white'),P('50950',x,85,-4,'white'),P('4460b',x,91,-6,'white'),P('50950',x,100,-7,'white'));
for(let y=79;y<103;y+=3){const z=y<88?1:-2;neck.push(P('15068',-5,y,z,'white',90),P('15068',3,y,z,'white',270));}
for(let x=-4;x<4;x+=2)neck.push(P('24309',x,110,-9,'white'),P('24309',x,110,-4,'white',180));
neck.push(P('3062b',-5,106,-7,'black'),P('3062b',4,106,-7,'black'),P('6141',-5,109,-7,'white'),P('6141',4,109,-7,'white'),P('11477',-5,110,-7,'white',90),P('11477',3,110,-7,'white',270));
section('S neck and alert round eyes',neck);
const bill=[
 box({at:[-2,91,-23],size:[4,10,14],colour:'pouch',interior:'empty'}),
 box({at:[-2,95,-27],size:[4,6,4],colour:'pouch',top:'tile'}),
 floor({at:[-4,101,-21],size:[8,14],layers:2,colour:'dark orange'}),
 floor({at:[-3,101,-27],size:[6,6],layers:2,colour:'dark orange'}),
 floor({at:[-4,103,-21],size:[8,14],colour:'bill',top:'tile'}),
 floor({at:[-3,103,-27],size:[6,6],colour:'bill',top:'tile'}),
 floor({at:[-2,101,-31],size:[4,4],layers:3,colour:'bill'}),
 P('30363',-2,104,-31,'yellow'),P('30363',0,104,-31,'yellow')
];
for(let x=-2;x<2;x++)bill.push(P('42023',x,88,-25,'orange'));
for(let z=-23;z<-9;z+=2)bill.push(P('32803',-4,94,z,'orange',90),P('32803',2,94,z,'orange',270));
for(let z=-23;z<-9;z+=2)bill.push(P('15068',-4,98,z,'orange',90),P('15068',2,98,z,'orange',270));
bill.push(P('3023b',3,101,-16,'orange'),P('64648',4,102,-16,'medium azure'),P('6141',4,105,-15,'black'));
section('Long golden bill and pendulous fish pouch',bill);
function wing(s){const a=[];const left=s<0;
 a.push(L([s*5,69,9],[s*10,66,0],'bird'),L([s*10,66,0],[s*8,61,-13],'bird'));
 a.push(floor({at:[left?-11:7,65,0],size:[4,10],layers:2,colour:'bird',top:'tile'}));
 for(let k=0;k<2;k++)a.push(P('44126',(left?-11:7)+2*k,67,0,'white'));
 a.push(floor({at:[left?-11:7,62,-8],size:[4,8],layers:2,colour:'bird',top:'tile'}));
 for(let k=0;k<4;k++)a.push(P('61678',(left?-11:7)+k,64,-8,'white'));
 a.push(floor({at:[left?-10:6,60,-14],size:[4,6],colour:'black',top:'tile'}));
 for(let k=0;k<4;k++)a.push(P('61678',(left?-10:6)+k,61,-14,k===0?'white':'black'));
 return a;}
section('Wings curled forward around the grips',[wing(-1),wing(1)]);
const scarf=[box({at:[-3,90,-5],size:[6,3,6],colour:'scarf',top:'tile'}),P('15068',-4,90,-6,'dark turquoise'),P('15068',2,90,-6,'dark turquoise'),
 floor({at:[2,91,1],size:[3,10],layers:2,colour:'scarf',top:'tile'}),floor({at:[3,89,10],size:[3,7],layers:2,colour:'scarf',top:'tile'}),
 floor({at:[-2,90,2],size:[2,10],layers:2,colour:'scarf',top:'tile'}),P('11477',-2,92,10,'dark turquoise',180),P('11477',-1,92,10,'dark turquoise',180)];
section('Windblown turquoise neckerchief',scarf);