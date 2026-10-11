script({title:'LL-978 Yub-Nub Forest Explorer',description:'A 1978 blue-and-grey Galaxy Explorer rebuilt by Ewoks: a hooded yellow-glass command mask, radar ears, strapped log engine nacelles, woven wing membranes and a living-tree communications mast. Two hooded space scouts and their timber survey buggy unload through the rear ramp.',palette:{metal:'light bluish grey',blue:'blue',bark:'reddish brown',hood:'dark orange',canvas:'tan',glass:'trans yellow'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour,extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
const F=(x,y,z,w,d,colour,layers=1,extra={})=>floor({at:[x,y,z],size:[w,d],colour,layers,...extra});
function landing(x,z){return [F(x-4,0,z-4,8,8,'metal',2,{top:'tile'}),B(x-3,2,z-3,6,3,6,'blue',{top:'tile'}),cylinder({at:[x-2,5,z-2],diameter:4,height:11,colour:'bark',texture:'log'}),P('87081',x-2,16,z-2,'blue'),...[-3,2].map(dx=>P('15068',x+dx,2,z-4,'metal'))];}
section('Four timber landing struts',[...landing(-12,16),...landing(12,16),...landing(-12,38),...landing(12,38)]);
section('Interlocking hull and cargo access',[
B(-10,16,8,20,16,36,'bark',{texture:'log',open:['back'],top:'tile'}),F(-9,16,27,18,16,'metal'),
B(-8,16,0,16,6,8,'blue',{top:'tile'}),...range(16).map(i=>P('61678',-8+i,22,0,'blue')),
B(-4,22,-1,8,6,6,'canvas',{top:'tile'}),...[-4,-2,0,2].map(x=>P('15068',x,28,-1,x===0?'black':'canvas')),
F(-10,32,28,20,16,'blue',1,{top:'tile'}),
stairs({at:[-4,0,60],width:8,steps:17,dir:'-z',rise:1,run:1,colour:'metal',top:'tile'}),
F(-10,32,44,20,4,'bark',2,{top:'tile'}),fence({path:[[-10,47],[-5,47]],y:34,colour:'blue',style:'lattice-low'}),fence({path:[[5,47],[9,47]],y:34,colour:'blue',style:'lattice-low'}),
...[-8,6].map(x=>B(x,17,43,2,13,1,'blue',{top:'tile'})),B(-8,30,43,16,2,1,'blue',{top:'tile'}),
...[-8,6].map(x=>P('3004p90',x,26,44,'blue')),
...range(8).map(i=>P('2412b',-8+i*2,33,28,'black')),
...[-8,-5].map(x=>P('2489',x,33,37,'bark')),
B(-7,33,31,6,5,4,'metal',{texture:'grille',top:'tile'}),P('3298p90',-5,38,31,'blue'),
...[-9,8].map(x=>P('3957a',x,33,42,'black'))
]);
section('Ewok hood command cockpit',[
room({at:[-9,28,8],size:[18,15,18],colour:'bark',texture:'log',openings:[{side:'front',at:1,width:4,y:3,height:9,frame:'blue',glass:'trans yellow'},{side:'front',at:12,width:4,y:3,height:9,frame:'blue',glass:'trans yellow'},{side:'left',at:7,width:4,y:3,height:9,frame:'blue',glass:'trans yellow'},{side:'right',at:7,width:4,y:3,height:9,frame:'blue',glass:'trans yellow'}]}),
B(-12,28,9,3,15,17,'hood',{top:'tile'}),B(9,28,9,3,15,17,'hood',{top:'tile'}),B(-10,40,4,20,5,4,'hood'),
F(-10,43,8,20,18,'hood',2,{top:'tile',holes:[{at:[-8,8],size:[16,8]}]}),F(-8,43,8,16,8,'glass'),
...[-8,-4,0,4].map(x=>P('4474',x,44,9,'glass')),
...range(20).map(i=>P('61678',-10+i,45,4,'hood')),
...range(20).map(i=>P('61678',-10+i,45,22,'hood',180)),
...range(8).flatMap(i=>[P('15068',-12,43,9+i*2,'hood',90),P('15068',10,43,9+i*2,'hood',270)]),
B(-2,28,5,4,7,3,'canvas',{top:'tile'}),P('15068',-1,35,5,'black'),
...[-4,3].map(x=>P('4070',x,29,7,'bark')),
...range(6).map(i=>P('3069b',-6+i*2,45,19,i%3===0?'dark tan':'hood'))
]);
function radarEar(x){return [column({at:[x+2,21,18],height:19,diameter:2,colour:'blue'}),cylinder({at:[x,40,16],diameter:6,height:9,colour:'bark',texture:'log'}),P('44375b',x,49,16,'metal'),P('4740',x+2,51,18,'glass'),P('3957a',x+2,52,18,'black')];}
section('Twin round radar ears',[...radarEar(-17),...radarEar(11)]);
const wingWidths=[32,40,48,56,64,64];
section('Swept timber and alloy wings',[
...wingWidths.map((w,i)=>F(-w/2,18,14+i*6,w,6,'metal',3,{top:'tile',holes:[{at:[-5,40],size:[10,10]}]})),
...[[32,18],[48,26],[64,38]].map(([w,z])=>B(-w/2,15,z,w,3,2,'bark',{texture:'log'})),
...wingWidths.flatMap((w,i)=>[P('43721',-w/2,21,14+i*6,'blue'),P('43720',w/2-2,21,14+i*6,'blue')]),
...[-1,1].flatMap(side=>{
const x=side<0?-24:12; const ops=[];
for(let iz=0;iz<18;iz++)for(let ix=0;ix<6;ix++){
const px=x+ix*2,pz=30+iz;
const logo=ix===1&&iz>=8&&iz<=10;
ops.push(P(logo?'3023b':iz%5===0?'2412b':'3069b',px,21,pz,logo?'blue':iz%5===0?'dark bluish grey':(ix+iz)%7===0?'dark tan':'canvas'));
}
ops.push(P('3298p90',x+2,22,38,'blue'));
for(let z=32;z<48;z+=4)ops.push(P('2431',side<0?-26:24,21,z,'blue',90));
for(let z=32;z<48;z+=4)ops.push(P('2431',side<0?-12:10,21,z,'blue',90));
for(let xx=x;xx<x+12;xx+=4)ops.push(P('2431',xx,21,48,'blue'));
return ops;
}),
...[-1,1].flatMap(side=>range(5).map(i=>P('6141',side<0?-27:26,21,34+i*3,i%2?'red':'glass')))
]);
function engine(x){const a=[B(x,21,30,8,12,26,'bark',{texture:'log',top:'tile'}),B(x+2,33,30,4,3,26,'bark',{top:'tile'}),B(x,21,28,8,12,2,'blue',{top:'tile'}),window({at:[x+2,24,28],facing:'front',size:'1x4x3',frame:'blue',glass:'trans yellow'}),B(x,24,56,8,6,4,'metal',{top:'tile'})];
for(let z=30;z<56;z+=2){a.push(P('15068',x,33,z,'bark',90),P('15068',x+6,33,z,'bark',270));}
for(const z of [35,47]){
for(let y=21;y<33;y+=3){a.push(P('3004',x,y,z,'blue',90),P('3004',x+7,y,z,'blue',90));}
for(let xx=x;xx<x+8;xx+=2)a.push(P('3023b',xx,36,z,'blue'));
}
for(let xx=x;xx<x+8;xx+=2){a.push(P('15068',xx,33,28,'blue'));for(let y=24;y<30;y+=3)a.push(P('2877',xx,y,59,'black'));a.push(P('2412b',xx,30,56,'black'));}
a.push(B(x+3,36,40,2,15,12,'blue',{top:'tile'}),...range(6).map(i=>P('3039',x+3,51,40+i*2,'blue',90)),P('3004p90',x+3,44,39,'blue'));
return a;}
section('Strapped log fusion nacelles',[...engine(-36),...engine(28)]);
section('Living tree communications array',[
cylinder({at:[4,33,34],diameter:4,height:21,colour:'bark',texture:'log'}),F(-2,50,35,14,2,'bark',2),P('3024',-1,52,35,'bark'),P('3024',9,52,35,'bark'),P('2417',-2,53,32,'dark green'),P('2417',8,53,34,'green'),column({at:[5,54,35],height:4,diameter:2,colour:'blue'}),P('44375b',3,58,33,'metal'),P('4589',5,60,35,'metal'),P('3957a',5,63,35,'black'),
P('3298p90',4,33,29,'blue'),...range(5).map(i=>P('2412b',2+i*2,33,40,'black'))
]);
component('Ewok space scout',{size:[8,8],ops:[
B(0,0,2,3,3,4,'black',{top:'tile'}),B(5,0,2,3,3,4,'black',{top:'tile'}),B(1,3,3,6,6,3,'white',{top:'tile'}),B(1,9,2,6,6,6,'white',{top:'tile'}),B(2,9,1,4,2,1,'blue'),P('3004p90',3,11,1,'blue'),column({at:[0,3,3],height:12,colour:'bark'}),column({at:[7,3,3],height:12,colour:'bark'}),
B(1,15,0,6,9,7,'bark',{texture:'log'}),B(0,14,1,1,10,6,'hood'),B(7,14,1,1,10,6,'hood'),F(0,24,1,8,6,'hood'),
...range(4).flatMap(i=>[P('15068',i*2,25,1,'hood'),P('15068',i*2,25,5,'hood',180)]),F(0,25,3,8,2,'hood',1,{top:'tile'}),
...[0,6].flatMap(x=>[P('3941',x,25,3,'bark'),P('4740',x,28,3,'canvas')]),
B(2,15,-1,4,3,2,'canvas'),P('15068',2,18,-1,'canvas'),P('15068',4,18,-1,'canvas'),B(3,15,-3,2,3,2,'bark'),P('15068',3,18,-3,'black'),P('4070',2,22,0,'black'),P('4070',5,22,0,'black'),
B(2,9,6,4,6,2,'blue',{top:'tile'}),P('3062b',2,15,6,'metal'),P('3062b',5,15,6,'metal'),P('3070b',2,18,6,'metal'),P('3070b',5,18,6,'metal')
]});
section('Hooded classic space crew',[instance({component:'Ewok space scout',at:[42,0,5]}),instance({component:'Ewok space scout',at:[46,0,23],turn:270,palette:{hood:'dark tan'}}),B(39,0,6,2,3,2,'metal',{top:'tile'}),column({at:[39,3,6],height:21,colour:'bark'}),P('4589',39,24,6,'metal'),P('4740',39,27,6,'glass')]);
const axles=[[46,2,41],[52,2,41],[46,2,51],[52,2,51]];
section('Timber moon survey buggy',[
...axles.map(at=>place({part:'4600',at,colour:'black',wheels:'light bluish grey'})),...axles.map(([x,y,z])=>B(x,3,z,2,3,2,'black')),
F(44,6,39,12,16,'metal',2),B(44,8,39,12,5,8,'blue',{top:'tile'}),P('4474',46,13,40,'glass'),P('4474',50,13,40,'glass'),
F(44,8,47,12,8,'bark',2,{top:'tile'}),...range(6).map(i=>P('15068',44+i*2,10,53,'bark',180)),B(44,10,47,1,4,6,'bark',{texture:'log',top:'tile'}),B(55,10,47,1,4,6,'bark',{texture:'log',top:'tile'}),P('2489',47,10,49,'bark'),P('2489',51,10,50,'bark'),
P('3298p90',48,8,37,'blue'),B(46,6,37,8,2,2,'metal',{top:'tile'}),P('4740',44,13,39,'glass'),P('4740',54,13,39,'glass'),column({at:[54,14,50],height:9,colour:'bark'}),P('3960',53,23,49,'metal'),P('3957a',54,25,50,'black')
]);