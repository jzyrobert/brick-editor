script({title:"Piplup — A Royal Little Wave",description:"A large, bright-eyed Piplup greeting you with a raised flipper: a sculpted navy hood, white cheek masks, smiling yellow beak, paired chest buttons, webbed feet and a pointed tail. Interlocking plate diaphragms and hollow cores support the curved shell.",palette:{a:"medium azure",b:"dark blue",w:"white",k:"black",y:"yellow"},defaults:{interior:"empty"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function band(x,y,z,w,d,c,kind='curve',front=true){if(c==='b'&&y>=42&&w>8){x++;z++;w-=2;d-=2;}const inv=kind==='inv',tall=kind==='tall',h=tall?6:3,part=inv?'3660b':tall?'3678b':'15068';const o=tall||w===8?[box({at:[x+2,y,z+2],size:[w-4,h,d-4],colour:c,...(w===8?{top:'tile'}:{})})]:[floor({at:[x+Math.round(w/2)-2,y,z+Math.round(d/2)-2],size:[4,4],layers:1,colour:c}),floor({at:[x+2,y+1,z+2],size:[w-4,d-4],layers:2,colour:c})];for(let q=2;q<w-2;q+=2){if(front)o.push(P(part,[x+q,y,z],c));o.push(P(part,[x+q,y,z+d-2],c,180));}for(let q=2;q<d-2;q+=2){o.push(P(part,[x,y,z+q],c,90),P(part,[x+w-2,y,z+q],c,270));}for(const [xx,zz,t]of [[x,z,0],[x+w-2,z,270],[x,z+d-2,90],[x+w-2,z+d-2,180]]){if(tall||(inv&&c==='a'))o.push(box({at:[xx,y,zz],size:[2,h,2],colour:c,...(tall?{}:{top:'tile'})}));else o.push(P(inv?'3676':'3045',[xx,y,zz],c,t));}return o;}
function foot(x){const w=6;let o=[floor({at:[x,0,-6],size:[w,8],layers:2,colour:'y'}),box({at:[x,2,-4],size:[w,3,4],colour:'y',top:'tile'}),box({at:[x+1,5,-2],size:[4,4,4],colour:'y'})];for(let i=0;i<3;i++){let xx=x+i*2;o.push(P('3020',[xx,0,-10],'y',90),P('3020',[xx,1,-10],'y',90),P('15068',[xx,2,-10],'y'));}for(let i=0;i<w;i++)o.push(P('61678',[x+i,2,-8],'y'));for(let i=0;i<w;i+=2)o.push(P('15068',[x+i,2,0],'y',180));return o;}
section('Webbed yellow feet',[foot(-9),foot(3)]);
section('Rounded azure body',[
 band(-7,6,-4,14,12,'a','inv'),band(-9,9,-6,18,16,'a','inv'),band(-11,12,-7,22,18,'a','inv'),
 box({at:[-9,15,-5],size:[18,6,14],colour:'a'}),
 ...range(9).map(i=>P('3678b',[-9+i*2,15,-7],'a')),...range(9).map(i=>P('3678b',[-9+i*2,15,9],'a',180)),
 ...range(7).map(i=>P('3678b',[-11,15,-5+i*2],'a',90)),...range(7).map(i=>P('3678b',[9,15,-5+i*2],'a',270)),
 ...[[-11,-7],[9,-7],[-11,9],[9,9]].map(([x,z])=>box({at:[x,15,z],size:[2,6,2],colour:'a'})),
 band(-11,21,-7,22,18,'a'),band(-8,24,-4,16,12,'b'),band(-7,27,-3,14,10,'b'),box({at:[-6,30,-2],size:[12,6,8],colour:'b'}),
 box({at:[-3,23,-7],size:[6,6,2],colour:'b',top:'tile'}),...range(3).map(i=>P('15068',[-3+2*i,21,-8],'b'))
]);
function button(x){return [...range(3).map(i=>P('24201',[x+i,17,-8],'w')),...range(3).map(i=>P('11477',[x+i,21,-8],'w'))];}
section('Piplup chest buttons',[button(-6),button(3)]);
const headShift=ops=>group({at:[0,-6,0],ops});
section('Navy rounded head',[headShift([
 band(-10,42,-7,20,16,'b','inv'),band(-12,45,-9,24,20,'b','inv'),band(-14,48,-11,28,24,'b','tall',false),
 band(-14,54,-11,28,24,'b'),band(-12,57,-9,24,20,'b'),band(-10,60,-7,20,16,'b'),band(-8,63,-5,16,12,'b'),band(-4,66,-3,8,8,'b')
])]);
const eyes=[-8,5];
function cheek(x){let o=[box({at:[x,48,-13],size:[10,12,4],colour:'w',top:'tile'})];for(let i=0;i<10;i++){let xx=x+i;if(!eyes.some(e=>xx>=e&&xx<e+3))o.push(P('4460b',[xx,48,-14],'w'));o.push(P('11477',[xx,57,-14],'w'));}for(let i=2;i<8;i++)o.push(P('11477',[x+i,60,-13],'w'));return o;}
section('White cheek masks and forehead',[headShift([
 box({at:[-10,45,-12],size:[20,3,3],colour:'w'}),...range(10).map(i=>P('15068',[-10+2*i,45,-14],'w')),
 cheek(-12),cheek(2),box({at:[-1,48,-13],size:[2,6,4],colour:'b'}),box({at:[-2,54,-13],size:[4,3,4],colour:'b'}),box({at:[-3,57,-13],size:[6,3,4],colour:'b'}),box({at:[-4,60,-12],size:[8,3,4],colour:'b',top:'tile'}),P('15068',[-1,51,-14],'b')
])]);
function eye(x){let o=[];for(let i=0;i<3;i++){o.push(P('24201',[x+i,50,-15],'k'),P('3005',[x+i,54,-14],'k'),P('3005',[x+i,54,-15],i===0?'w':'k'),P('11477',[x+i,57,-15],'k'));}return o;}
section('Sparkling eyes',[headShift(eyes.map(eye))]);
section('Smiling golden beak',[headShift([
 box({at:[-2,47,-16],size:[4,3,4],colour:'y'}),...range(4).map(i=>P('13547',[-2+i,47,-17],'y')),
 floor({at:[-3,50,-18],size:[6,6],layers:1,colour:'k'}),...range(6).map(i=>P('61678',[-3+i,51,-16],'y')),
 P('15068',[-2,51,-18],'y'),P('15068',[0,51,-18],'y'),P('54200',[-3,51,-18],'y'),P('54200',[2,51,-18],'y'),P('3070b',[-3,51,-17],'y'),P('3070b',[2,51,-17],'y')
])]);
section('Flippers — one raised in greeting',[
 box({at:[-11,22,-1],size:[5,7,4],colour:'a',top:'tile'}),box({at:[-12,28,-1],size:[3,5,4],colour:'a',top:'tile'}),box({at:[-15,16,-2],size:[4,12,5],colour:'a',top:'tile'}),
 ...range(5).map(i=>P('60481a',[-16,22,-2+i],'a',90)),...range(4).map(i=>P('11477',[-15+i,28,-2],'a')),
 ...range(4).map(i=>P('24201',[-15+i,12,-2],'a')),...range(2).map(i=>P('15068',[-15+i*2,16,1],'a',180)),
 box({at:[8,22,-1],size:[5,7,5],colour:'a',top:'tile'}),box({at:[10,25,-1],size:[6,6,5],colour:'a',top:'tile'}),box({at:[14,28,-1],size:[5,8,5],colour:'a',top:'tile'}),box({at:[17,34,-1],size:[4,8,5],colour:'a',top:'tile'}),
 ...range(5).map(i=>P('60481a',[19,36,-1+i],'a',270)),...range(4).map(i=>P('11477',[17+i,42,-1],'a')),
 ...range(4).map(i=>P('11477',[17+i,42,2],'a',180)),...range(3).map(i=>P('15068',[11+i*2,31,-1],'a')),
 ...range(2).map(i=>P('15068',[14+i*2,36,-1],'a'))
]);
section('Little pointed tail',[
 box({at:[-3,12,9],size:[6,4,7],colour:'a',top:'tile'}),...range(6).map(i=>P('61678',[-3+i,16,12],'a',180)),
 P('41769a',[-4,15,13],'b'),P('41770a',[2,15,13],'b'),...range(3).map(i=>P('15068',[-3+2*i,16,10],'a'))
]);