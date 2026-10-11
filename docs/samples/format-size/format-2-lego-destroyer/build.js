script({title:'Devastator — Capture over Tatooine',description:'A 48-stud Imperial-class destroyer with a layered dagger hull, equatorial machinery trench, terraced command citadel, twin shield generators, seven aft engines and a tiny blockade runner caught beneath the bow. Two compact black cradles leave the underside visible.',palette:{hull:'light bluish grey',machinery:'dark bluish grey',shadow:'black',beam:'trans light blue'},defaults:{interior:'empty'}});
const P=(part,at,colour='hull',turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour='hull',extra={})=>box({at,size,colour,...extra});
const F=(at,size,colour='hull',layers=1,top='tile')=>floor({at,size,colour,layers,top});
const L=48,Y=16;
function cradle(z){return [F([-4,0,z],[8,8],'black',2),B([-1,2,z+3],[2,Y-2,2],'black',{interior:'solid'}),F([-2,Y-1,z+2],[4,4],'black')];}
section('Discrete display cradles',[cradle(24),cradle(39)]);
function armourCourse(i,y,c){const z=i*12,inner=i===0?0:6+3*(i-1),w=i===0?6:3;return [P(i===0?'30355':'47397',[-inner-w,y,z],c),P(i===0?'30356':'47398',[inner,y,z],c),i>0&&B([-inner,y,z],[2*inner,1,12],c,{interior:'solid'})];}
section('Continuous wedge and machinery trench',[
 range(5).map(k=>range(4).map(i=>armourCourse(i,Y+k,k===1||k===2?'machinery':'hull'))),
 B([-2,21,4],[4,3,8],'hull',{top:'tile',interior:'solid'}),F([-1,21,0],[2,4]),
 P('30363',[-2,21,4]),P('30363',[0,21,4]),
 range(1,4).map(i=>{const inner=6+3*(i-1);return B([-inner,21,i*12],[2*inner,3,12],'hull',{top:'tile',interior:'solid'});}),
 [12,24,36].map((z,i)=>{const inner=6+3*i;return [range(6).map(j=>[P('30363',[-inner-1,21,z+j*2],'hull',90),P('30363',[inner-3,21,z+j*2],'hull',270)]),P('2431',[-inner-2,21,z+8],'hull',90),P('2431',[inner+1,21,z+8],'hull',90)];}),
 range(3).map(i=>P('30363',[-3+i*2,21,12])),F([-2,21,10],[4,4],'hull',1)
]);
section('Terraced armoured citadel',[
 B([-4,24,24],[8,2,4],'hull',{interior:'solid'}),range(4).map(i=>P('30363',[-4+2*i,26,24])),
 B([-7,24,30],[14,2,14],'hull',{top:'tile',interior:'solid'}),B([-4,24,28],[8,5,16],'hull',{top:'tile'}),
 range(7).map(i=>[P('3298',[-7,26,30+i*2],'hull',90),P('3298',[4,26,30+i*2],'hull',270)]),
 F([-5,29,34],[10,10],'hull'),B([-3,29,32],[6,1,2],'hull',{interior:'solid'}),range(3).map(i=>P('3039',[-3+2*i,30,32])),
 B([-3,29,34],[6,4,10],'hull',{top:'tile'}),range(5).map(i=>[P('15068',[-5,30,34+i*2],'hull',90),P('15068',[3,30,34+i*2],'hull',270)]),
 B([-2,33,38],[4,6,5],'hull',{top:'tile'}),B([-7,39,37],[14,3,4],'hull',{interior:'solid'}),
 range(7).map(i=>[P('3660b',[-7+i*2,39,36]),P('3660b',[-7+i*2,39,40],'hull',180)]),
 F([-7,42,36],[14,6],'hull',1,'studs'),
 B([-7,43,36],[14,1,1],'black',{interior:'solid'}),B([-7,43,41],[14,1,1],'black',{interior:'solid'}),B([-7,43,37],[1,1,4],'black',{interior:'solid'}),B([6,43,37],[1,1,4],'black',{interior:'solid'}),
 B([-6,43,37],[12,4,4],'hull',{top:'tile',interior:'solid'}),range(7).map(i=>[P('3039',[-7+i*2,44,36]),P('3039',[-7+i*2,44,40],'hull',180)]),
 F([-7,47,37],[14,4]),[-6,3].map(x=>[P('3941',[x,48,38]),P('44359',[x,51,38])]),P('4740',[-1,48,38],'machinery'),P('3062b',[0,49,39]),P('98138',[0,52,39],'machinery')
]);
function battery(x,z){return [P('4032b',[x,24,z],'machinery'),P('3941',[x,25,z]),P('30162',[x+(x>0?1:0),28,z],'machinery')];}
section('Turbolasers and technical detail',[
 range(4).map(i=>[battery(-9,36+i*3),battery(7,36+i*3)]),[28,30].map(z=>[P('2412b',[-3,29,z],'machinery'),P('2412b',[1,29,z],'machinery')]),
 P('3068b',[-1,29,28]),P('3069b',[-2,33,35],'machinery'),P('3069b',[0,33,35],'machinery'),P('2412b',[-3,33,43],'machinery'),P('2412b',[1,33,43],'machinery'),
 P('3069b',[-2,24,18],'machinery'),P('3069b',[0,24,20]),P('2431',[-2,24,22]),P('3070b',[-3,24,20])
]);
section('Seven ion drives',[
 F([-14,22,46],[28,4],'hull',1),[-11,-3,5].map(x=>P('43121',[x,13,L],'hull',180)),[-14,-5,3,12].map(x=>[P('4229',[x,16,L],'machinery',180),B([x,21,L],[2,1,2],'machinery',{interior:'solid'})]),
 F([-12,23,47],[24,3],'hull'),P('2412b',[-4,24,48],'machinery'),P('2412b',[2,24,48],'machinery')
]);
section('Captured blockade runner',[
 B([-2,4,6],[4,2,4],'white',{top:'tile',interior:'solid'}),P('15068',[-2,6,6],'white'),P('15068',[0,6,6],'white'),B([-1,5,8],[2,3,6],'white',{top:'tile',interior:'solid'}),B([-1,5,14],[2,3,2],'dark red',{top:'tile',interior:'solid'}),B([-1,5,16],[2,3,2],'white',{top:'tile',interior:'solid'}),
 [-4,-2,0,2].map(x=>P('4229',[x,3,15],'white',180)),F([-4,8,15],[8,2],'white'),P('3023b',[-1,8,11],'white'),[-1,0].map(x=>column({at:[x,9,11],height:7,diameter:1,colour:'beam'}))
]);