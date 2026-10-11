script({title:'Piplup — Bubble Maestro',description:'A proud Piplup conducts its first Bubble attack from a sculpted snow floe. Three translucent bubbles rise beside its lifted flipper, curling surf frames its golden webbed feet, and a fish swims beneath a clear viewing patch in the tide.',palette:{head:'blue',body:'medium azure',hood:'dark blue',snow:'white',sea:'dark turquoise'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const strip=(part,n,x,y,z,dx,dz,c,t=0)=>range(n).map(i=>P(part,x+i*dx,y,z+i*dz,c,t));
section('Connected gallery plinth and tidal pool',[
 floor({at:[0,0,0],size:[36,28],layers:3,colour:'black'}),floor({at:[0,3,0],size:[36,28],colour:'dark blue',top:'tile'}),floor({at:[1,3,1],size:[34,26],colour:'sea',top:'tile'}),
 ...strip('2431',9,0,4,0,4,0,'black'),...strip('2431',9,0,4,27,4,0,'black'),...strip('2431',6,0,4,2,0,4,'black',90),...strip('2431',6,35,4,2,0,4,'black',90),
 ...[[4,2,5],[11,5,5],[27,25,4],[3,26,6]].map(([x,z,n])=>strip('3069b',n,x,4,z,2,0,'trans light blue')),
 floor({at:[5,4,8],size:[5,4],layers:3,colour:'trans-clear',holes:[{at:[6,9],size:[3,1]}]}),P('64648',6,4,9,'medium azure',90),floor({at:[5,7,8],size:[5,4],colour:'trans light blue',top:'tile'})
]);
section('Faceted drifting snow floe',[
 box({at:[9,4,10],size:[19,3,15],colour:'white',top:'tile'}),box({at:[11,4,8],size:[14,3,3],colour:'white',top:'tile'}),box({at:[7,4,14],size:[3,3,8],colour:'white',top:'tile'}),
 ...strip('3039',7,11,4,8,2,0,'white'),...strip('3039',7,11,4,23,2,0,'white',180),...strip('3039',5,7,4,12,0,2,'white',90),...strip('3039',5,26,4,13,0,2,'white',270),
 ...strip('3023b',7,11,5,10,2,0,'trans light blue'),
 ...[[2,19,4,5],[3,21,5,4],[29,22,4,3],[5,4,4,3]].map(([x,z,w,d])=>[box({at:[x,4,z],size:[w,3,d],colour:'trans light blue',top:'tile'}),...strip('15068',Math.floor(w/2),x,7,z,2,0,'white')]),
 ...strip('11477',6,9,7,21,2,0,'white',180)
]);
const foot=x=>[
 floor({at:[x,7,8],size:[4,8],colour:'yellow'}),...strip('93606',2,x,8,9,2,0,'yellow'),...strip('3069b',2,x,8,13,2,0,'yellow'),...strip('3003',2,x,8,14,2,0,'yellow'),
 ...strip('54200',4,x,8,8,1,0,'yellow'),floor({at:[x,11,14],size:[4,2],colour:'yellow'})
];
section('Golden webbed feet and round little body',[
 foot(12),foot(20),box({at:[13,11,14],size:[10,4,8],colour:'body',interior:'empty'}),box({at:[12,15,12],size:[12,15,11],colour:'body',interior:'empty'}),
 ...strip('24201',12,12,11,11,1,0,'body'),...strip('24201',12,12,11,22,1,0,'body',180),
 ...[15,19,23].map(y=>[...strip('6091',8,11,y,14,0,1,'body',90),...strip('6091',8,23,y,14,0,1,'body',270)]),
 ...strip('88930',3,12,27,11,4,0,'body'),...strip('88930',3,12,27,22,4,0,'body',180),
 ...[14,20].map(x=>[P('3660b',x,21,11,'white'),P('15068',x,24,11,'white')]),
 box({at:[14,30,14],size:[8,4,8],colour:'hood',interior:'empty'}),...strip('15068',6,12,30,11,2,0,'hood'),...strip('15068',6,12,30,22,2,0,'hood',180),floor({at:[11,33,9],size:[14,17],colour:'hood',top:'tile'}),
 P('3795',16,11,21,'body',90),P('3795',18,11,21,'body',90),P('93606',16,12,24,'body',180),P('93606',18,12,24,'body',180)
]);
section('One flipper conducts; the other balances',[
 box({at:[9,19,16],size:[4,8,4],colour:'body'}),...strip('24201',4,9,15,16,0,1,'body',90),P('3678b',8,19,16,'body',90),P('3678b',8,19,18,'body',90),P('93606',9,27,16,'body'),
 floor({at:[22,24,16],size:[10,4],colour:'body'}),...range(4).map(i=>[P('3660b',24+2*i,25,16,'body',270),P('3660b',24+2*i,25,18,'body',270)]),...range(2).map(i=>[P('93606',24+4*i,28,16,'body',270),P('93606',24+4*i,28,18,'body',270)])
]);
section('Sculpted oversized blue hood',[
 box({at:[11,34,11],size:[14,6,15],colour:'head',interior:'empty'}),box({at:[11,34,9],size:[14,6,3],colour:'head',interior:'empty'}),box({at:[11,40,11],size:[14,12,14],colour:'head',interior:'empty'}),floor({at:[11,36,10],size:[14,16],colour:'head'}),floor({at:[10,36,9],size:[16,3],colour:'head'}),
 ...strip('3660b',7,11,37,24,2,0,'head',180),...strip('3660b',6,10,37,12,0,2,'head',90),...strip('3660b',6,24,37,12,0,2,'head',270),
 ...[40,43,46,49].map(y=>[...strip('3622',4,10,y,12,0,3,'head',90),...strip('3622',4,25,y,12,0,3,'head',90),...strip('3004',8,10,y,25,2,0,'head')]),
 ...range(5).map(i=>[P('41766',10,52,13+2*i,'head',90),P('41766',18,52,13+2*i,'head',270)]),...strip('93606',8,10,52,9,2,0,'hood'),...strip('93606',8,10,52,23,2,0,'head',180),
 ...strip('3069b',10,17,58,13,0,1,'head'),...strip('3069b',8,10,56,12,2,0,'hood')
]);
section('White face lobes, bright eyes and smiling bill',[
 ...[10,20].map(x=>[...strip('24201',6,x,37,8,1,0,'white'),...[40,43,46].map(y=>strip('3004',3,x,y,10,2,0,'white')),...strip('15068',3,x,49,10,2,0,'white')]),
 ...[46,49].map(y=>strip('3004',2,16,y,10,2,0,'hood')),
 ...[12,22].map(x=>[P('24201',x,41,8,'black'),P('24201',x+1,41,8,'black'),P('3005',x,45,8,'white'),P('3005',x+1,45,8,'black'),P('3004',x,45,9,'black'),P('15068',x,48,8,'black')]),
 P('3795',16,39,6,'yellow',90),P('3795',18,39,6,'yellow',90),P('3660b',16,40,6,'yellow'),P('3660b',18,40,6,'yellow'),P('3004',16,40,8,'yellow'),P('3004',16,40,9,'yellow'),P('3020',16,43,6,'black'),P('3020',16,43,8,'black'),P('93606',16,44,6,'yellow'),P('93606',18,44,6,'yellow')
]);
function wave(x,z,h){return group({at:[x,4,z],ops:[box({at:[0,0,0],size:[4,h,6],colour:'dark azure',interior:'empty'}),...range(Math.floor(h/3)).map(i=>strip('3004',3,0,3*i,0,0,2,i%2?'medium azure':'trans light blue',90)),P('93606',0,h,0,'medium azure'),P('93606',2,h,0,'medium azure'),...strip('13547',4,0,h,4,1,0,'white',180),...strip('11477',4,0,h+3,6,1,0,'white',180)]});}
section('Breaking tide wraps the floe',[wave(27,1,12),wave(1,12,6),...[[1,3],[16,2],[33,22],[16,25]].map(([x,z],i)=>[P('3039',x,4,z,'medium azure',i%2?90:0),P('11477',x,7,z+1,'white')])]);
function bubble(x,z,y){return [column({at:[x+1,4,z+1],height:y-4,diameter:1,colour:'trans-clear'}),P('4032b',x+1,y,z+1,'trans-clear'),P('30342',x,y+1,z,'trans light blue'),P('30286',x,y+7,z,'trans light blue')];}
section('Rising Bubble attack',[bubble(29,11,34),bubble(31,5,22),bubble(23,2,10),P('60474',21,4,4,'medium azure'),P('86500',21,5,4,'trans light blue'),P('60474',29,4,18,'medium azure'),P('86500',29,5,18,'trans light blue')]);