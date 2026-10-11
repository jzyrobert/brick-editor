script({title:'The Cinder Mother',description:'A ruby dragon shelters her precious egg beneath copper sail wings. Four planted claws, amber eyes, an open toothy jaw, ivory horns, curved armour and a curled spiked tail.',palette:{hide:'dark red',membrane:'orange',belly:'tan',horn:'tan',claw:'tan'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function skin(x,y,z,w,d,c='hide',front=c,trim=0){const a=[box({at:[x,y,z],size:[w,3,d],colour:c,interior:'solid'})];for(let u=0;u<w;u+=2){if((trim<0&&u===0)||(trim>0&&u===w-2))continue;a.push(P('15068',[x+u,y,z],front),P('15068',[x+u,y,z+d-2],c,180));}for(let v=2;v<d-2;v+=2){if(trim>=0)a.push(P('15068',[x,y,z+v],c,90));if(trim<=0)a.push(P('15068',[x+w-2,y,z+v],c,270));}return a;}
function foot(x,trim){return [floor({at:[x,0,-7],size:[6,14],layers:2,colour:'black'}),floor({at:[x,2,-7],size:[6,14],colour:'hide'}),...range(3).map(k=>[P('93606',[x+2*k,3,-6],'hide'),P('54200',[x+2*k,3,-7],'claw')]),box({at:[x+1,3,-1],size:[4,9,7],colour:'hide',interior:'solid'}),...skin(x,6,1,6,8),...skin(x-1,9,2,8,10),...skin(x-1,12,2,8,10,'hide','hide',trim),...skin(x,15,3,6,8,'hide','hide',trim),...skin(x+1,18,4,4,6),P('15068',[x+1,21,4],'hide'),P('15068',[x+3,21,4],'hide'),floor({at:[x+1,21,6],size:[4,4],colour:'hide',top:'tile'})];}
section('Planted claws and powerful haunches',[...foot(-11,1),...foot(5,-1)]);
const body=[];const profiles=[[9,4,2,12],[12,5,1,14],[15,6,0,14],[18,6,0,14],[21,6,0,14],[24,5,0,14],[27,5,0,12],[30,4,0,12]];
for(const [y,r,z,d] of profiles)body.push(...skin(-r,y,z,2*r,d,'hide','belly'));
body.push(box({at:[-8,30,6],size:[16,9,6],colour:'hide',interior:'solid',top:'tile'}),box({at:[-3,9,12],size:[6,6,8],colour:'hide',interior:'solid'}));
for(const z of [5,9,11])body.push(P('3003',[-1,33,z],'hide'),P('3942c',[-1,36,z],'horn'));
section('Armoured chest and wing shoulders',body);
function foreleg(x,dz){const a=[box({at:[x,0,-13+dz],size:[4,3,6],colour:'hide',interior:'solid'})];for(let j=0;j<4;j++){const y=3+4*j,z=-13+3*j+dz;a.push(floor({at:[x,y,z],size:[4,6],colour:'hide'}));if(j<3)a.push(...skin(x,y+1,z,4,6,'hide',j===0?'claw':'hide'));else a.push(box({at:[x,y+1,z],size:[4,3,6],colour:'hide',interior:'solid',top:'tile'}),P('15068',[x,y+1,z],'hide'),P('15068',[x+2,y+1,z],'hide'));}return a;}
section('Foreclaws sheltering the egg',[...foreleg(-8,0),...foreleg(4,2)]);
const neck=[];for(let j=0;j<5;j++){const y=36+4*j,z=-2-2*j;neck.push(floor({at:[-3,y,z],size:[6,8],colour:'hide'}),...skin(-3,y+1,z,6,8,'hide','belly'));}
section('Forward arching neck',neck);
const head=[box({at:[-4,53,-19],size:[8,3,12],colour:'hide',interior:'solid'}),floor({at:[-4,56,-22],size:[8,13],colour:'black',top:'tile'}),box({at:[-4,57,-10],size:[8,6,4],colour:'hide',interior:'solid'}),box({at:[-5,60,-17],size:[10,6,11],colour:'hide',interior:'solid'}),box({at:[-4,60,-22],size:[8,3,6],colour:'hide',interior:'solid'}),floor({at:[-4,63,-22],size:[8,5],colour:'hide'}),floor({at:[-2,57,-17],size:[4,5],colour:'dark red',top:'tile'})];
for(let x=-4;x<4;x+=2)head.push(P('24309',[x,64,-22],'hide'),P('15068',[x,66,-17],'hide'),P('15068',[x,66,-8],'hide',180),P('3747b',[x,53,-22],'hide'));
for(const x of [-5,3])head.push(box({at:[x,60,-16],size:[2,3,3],colour:'yellow',interior:'solid'}),P('3005',[x+1,60,-16],'black'),P('15068',[x,63,-16],'hide'),P('15068',[x,66,-14],'hide',x<0?90:270));
for(const x of [-5,4])for(const z of [-12,-10])head.push(P('11477',[x,63,z],'hide',x<0?90:270));
for(const x of [-3,2])head.push(floor({at:[x,69,-8],size:[1,4],colour:'hide'}),P('40379',[x,70,-8],'horn',180));
for(const x of [-3,3])head.push(P('98138',[x,67,-20],'black'));
for(const x of [-4,3])for(const z of [-19,-16,-13])head.push(P('4589',[x,57,z],'horn'));
head.push(P('3069b',[-1,58,-19],'red'),floor({at:[-2,66,-13],size:[4,5],colour:'hide',top:'tile'}));
section('Watchful eyes ivory horns and open jaws',head);
function tailSegment(x,y,z,w,d,h){const a=[box({at:[x,y,z],size:[w,h,d],colour:'hide',interior:'solid',top:'tile'})];for(let k=0;k<d;k+=2)a.push(P('15068',[x,y+h-3,z+k],'hide',90),P('15068',[x+w-2,y+h-3,z+k],'hide',270));for(let k=2;k<w-2;k+=2)a.push(P('15068',[x+k,y+h-3,z],'hide'),P('15068',[x+k,y+h-3,z+d-2],'hide',180));return a;}
const tail=[...tailSegment(-3,3,15,6,8,12),...tailSegment(-2,2,23,4,8,9),...tailSegment(-8,1,31,10,6,6),...tailSegment(-14,0,29,6,8,6),...tailSegment(-18,0,21,4,14,6),...tailSegment(-20,0,13,4,8,3),floor({at:[-18,0,19],size:[4,6],colour:'hide'})];
for(const [x,y,z] of [[-1,15,18],[-1,11,25],[-5,7,33],[-11,6,33],[-17,6,29],[-17,6,23]])tail.push(P('3003',[x,y,z],'hide'),P('3942c',[x,y+3,z],'horn'));
tail.push(P('43720',[-20,3,9],'hide'),P('43721',[-18,3,9],'hide'),floor({at:[-20,1,9],size:[4,6],layers:2,colour:'hide'}));
section('Tail curled around the brood',tail);
const bottoms=[33,33,30,33,36,42,45,39,30,33,42,51],tops=[45,51,57,63,69,75,75,72,69,66,63,60];
function wing(sign,dy,z){const a=[];const X=i=>sign>0?5+2*i:-7-2*i;const active=(i,y)=>i>=0&&i<12&&y>=bottoms[i]&&y<tops[i];const col=(i,y)=>y===bottoms[i]||y>=tops[i]-6||i===0||i===6||i===6+Math.floor((72-y)/9)||i===6+Math.floor((72-y)/3)?'hide':'membrane';for(let y=30;y<75;y+=3){for(let i=0;i<12;){if(!active(i,y)){i++;continue;}const c=col(i,y),pair=active(i+1,y)&&col(i+1,y)===c&&((i+Math.round(y/3))%2===0);const n=pair?2:1;const x=sign>0?X(i):X(i+n-1);if(Math.round(y/3)%4===0){for(let p=0;p<3;p++)a.push(P(pair?'3020':'3022',[x,y+dy+p,z],c));}else a.push(P(pair?'3001':'3003',[x,y+dy,z],c));i+=n;}}
for(let i=0;i<12;i++){const t=i<6?(sign>0?90:270):(sign>0?270:90);a.push(P('3039',[X(i),tops[i]+dy,z],'hide',t));if(i===5||i===11)a.push(P('4589',[X(i)+(t===90?1:0),tops[i]+dy+3,z+1],'horn'));}return a;}
section('Copper sail wings with interlocking spars',[...wing(-1,-6,10),...wing(1,0,7)]);
section('One precious egg',[cylinder({at:[-2,0,-15],diameter:8,height:3,colour:'dark bluish grey'}),cylinder({at:[-1,3,-14],diameter:6,height:6,colour:'white'}),dome({at:[-1,9,-14],diameter:6,colour:'white'}),...[[-2,-12],[5,-12],[0,-8],[3,-8]].map(([x,z])=>[P('3024',[x,3,z],'dark bluish grey'),P('54200',[x,4,z],'dark tan')])]);