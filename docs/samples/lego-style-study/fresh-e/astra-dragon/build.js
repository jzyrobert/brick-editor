script({title:'The Last Ember — a dragon and its egg',description:'A crimson dragon shelters its glowing egg beneath towering, scalloped copper wings. Ivory horns, golden eyes, a plated throat, four clawed feet and a curling tail complete the freestanding guardian.',palette:{hide:'dark red',light:'red',membrane:'dark orange',bone:'tan'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour='dark red')=>box({at:[x,y,z],size:[w,h,d],colour,interior:'solid',top:'tile'});
function foot(x,z,w){return [B(x,0,z,w,3,8),...range(w).map(i=>P('61678',x+i,3,z+3,'dark red')),...range(3).map(i=>[P('3023b',x+i*2,3,z,'dark red',90),P('4286',x+i*2,4,z-1,'tan')])];}
section('Four planted feet and powerful haunches',[
foot(-12,7,6),foot(6,8,6),
...[-11,6].map(x=>[B(x,3,12,5,15,6),B(x+1,18,12,4,6,5),...range(3).map(i=>P('93606',x,18,12+i*2,'dark red',90)),...range(2).map(i=>P('15068',x+1+i*2,24,12,'dark red'))]),
...[-10,6].map(x=>[B(x,0,-7,4,3,8),...range(2).map(i=>P('93606',x+i*2,3,-5,'dark red')),...range(3).map(i=>P('4286',x+i,3,-9,'tan')),B(x,3,-1,4,12,4),B(x+(x<0?1:-1),12,0,4,12,4),...range(3).map(i=>P('15068',x,6+i*6,-2,'dark red'))])
]);
const widths=[8,10,12,14,14,14,12,10,8],tops=[27,33,36,36,33,30,27,24,21],bots=[15,12,9,9,6,6,6,6,6];
section('Sculpted torso and overlapping scales',range(9).map(i=>{const w=widths[i],t=tops[i],lo=bots[i],z=i*2;return [B(-w/2,lo,z,w,t-lo,2),...range(w/2).map(j=>{const x=-w/2+j*2;return (x<=-3||x>=1)&&P('15068',x,t-3,z,(i+j)%5===0?'red':'dark red',j<w/4?90:270);}),i%2===0&&range(lo+3,t-5,6).map(y=>[P('15068',-w/2,y,z,'dark red',90),P('15068',w/2-2,y,z,'dark red',270)]),i%2===0&&P('3942c',-1,t,z,'tan')];}));
section('Arched neck and segmented ivory throat',[
B(-4,21,-2,8,9,7),B(-4,30,-4,8,9,7),B(-3,39,-5,6,9,7),
...range(6).map(i=>{const y=21+i*3,z=i<3?-3:-5;return range(3).map(j=>P('3039',-3+j*2,y,z,'tan'));}),
...[-5,3].map(x=>range(4).map(i=>P('15068',x,24+i*6,i<2?-1:-3,'dark red',x<0?90:270)))
]);
function wing(side){const a=[],bottom=[21,24,27,30,33,30,24,21,27,36],top=[39,45,51,57,63,66,63,60,54,54],dy=side<0?3:0,dz=side<0?1:0;const X=(x,w)=>side<0?-x-w:x;for(let i=0;i<10;i++){const x=8+i*2,z=8+Math.floor(i/3)+dz,l=bottom[i]+dy,h=top[i]+dy;const out=side<0?90:270,up=side<0?270:90;a.push(box({at:[X(x,2),l+3,z],size:[2,h-l-12,2],colour:'dark orange',interior:'solid'}),P('3660b',X(x,2),l,z,'dark red',out),P('3684a',X(x,2),h-9,z,'dark red',i<6?up:out));if(i<9){const zz=8+Math.floor((i+1)/3)+dz,yy=Math.max(bottom[i],bottom[i+1])+dy+3+i%2;a.push(P('3710',X(x,4),yy,zz,'dark red'));}if(i===5)a.push(P('3942c',X(x,2),h,z,'tan'));if(i===2||i===5||i===8){a.push(B(X(x,1),l+3,z+2,1,h-l-12,1),floor({at:[X(x,2),l+3,z],size:[2,3],colour:'dark red'}));}}return a;}
section('Copper bat wings with scalloped edges',[
B(4,24,7,6,9,4),B(-10,24,8,6,12,4),wing(1),wing(-1)
]);
const tailData=[[-3,18,6,4,18],[-2,22,6,4,15],[0,26,6,4,12],[6,26,6,4,9],[12,24,4,6,6],[16,20,4,6,6],[16,14,4,6,6]];
section('Long hooked tail',tailData.map(([x,z,w,d,h],i)=>[B(x,0,z,w,h,d),...range(w/2).map(a=>range(d/2).map(b=>P('15068',x+a*2,h-3,z+b*2,'dark red',i<3?180:i<5?270:0))),P('4589',x,h,z,'tan')]));
section('Watchful head, jaws and crown',[
B(-5,39,-15,10,3,12),floor({at:[-4,42,-14],size:[8,9],colour:'black',top:'tile'}),B(-4,42,-5,8,7,5),
...[-4,3].map(x=>[-13,-10].map(z=>P('4589',x,43,z,'white'))),
B(-5,46,-12,10,6,10),B(-4,46,-17,8,3,7),
...range(4).map(i=>P('93606',-4+i*2,49,-17,'dark red')),
...[-5,3].map(x=>[P('3004',x,49,-12,'black'),P('3005',x,49,-13,'yellow'),P('3005',x+1,49,-13,'black'),P('15068',x,52,-13,'dark red')]),
...[-6,4].map(x=>[P('3684a',x,44,-5,'dark red',x<0?90:270),P('15068',x,50,-8,'red')]),
...range(4).map(i=>P('15068',-4+i*2,52,-8,'dark red',180)),
...[-4,2].map(x=>[P('3941',x,52,-3,'dark red'),P('3942c',x,55,-3,'tan'),P('64847',x,61,-3,'white',180)]),
...[-3,2].map(x=>P('6141',x,53,-15,'black')),
...range(4).map(i=>P('11477',-4+i*2,39,-16,'tan')),
P('3003',-1,52,-6,'red'),P('3942c',-1,55,-6,'tan')
]);
section('The precious ember egg',[
floor({at:[-3,0,-14],size:[6,4],layers:2,colour:'dark brown',top:'tile'}),floor({at:[-2,0,-15],size:[4,6],layers:2,colour:'dark brown',top:'tile'}),
cylinder({at:[-2,2,-13],diameter:4,height:6,colour:'orange'}),dome({at:[-2,8,-13],diameter:4,colour:'white'}),
...[-2,1].map(x=>[P('3005',x,5,-11,'trans yellow'),P('54200',x,8,-11,'white')]),
...range(2).map(i=>P('3069b',-2+i*2,2,-15,'dark tan'))
]);