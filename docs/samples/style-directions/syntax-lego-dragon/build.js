script({title:'Emberheart — Guardian of the Last Egg',description:'A crimson mother dragon crouches over a pearl egg. Vast scalloped bat wings frame her watchful face; ivory horns, a toothed open jaw, throat shields and a curling armored tail complete the silhouette.',palette:{hide:'dark red',armor:'red',bone:'tan',membrane:'black',belly:'dark tan'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function foot(x,z,h){const a=[floor({at:[x,0,z],size:[6,8],layers:2,colour:'dark red'}),box({at:[x+1,2,z+3],size:[4,h,5],colour:'dark red',interior:'solid'})];for(let i=0;i<3;i++)a.push(P('15068',x+2*i,2,z+1,'red'),P('54200',x+2*i,2,z,'tan'));for(let k=0;k<Math.floor(h/6);k++)a.push(P('11477',x,2+6*k,z+4,'dark red',90),P('11477',x+4,2+6*k,z+4,'dark red',270));a.push(P('44126',x+1,h+2,z+2,'red'),P('44126',x+3,h+2,z+2,'dark red'));return a;}
section('Four planted taloned feet',[...foot(20,8,18),...foot(34,10,15),...foot(19,26,15),...foot(35,27,18)]);
const body=[box({at:[25,12,15],size:[10,18,18],colour:'dark red'}),box({at:[24,18,12],size:[12,12,9],colour:'dark red'}),box({at:[23,27,21],size:[14,9,4],colour:'dark red',interior:'solid'}),box({at:[23,12,28],size:[4,6,5],colour:'dark red',interior:'solid'}),box({at:[33,12,28],size:[4,9,6],colour:'dark red',interior:'solid'})];
for(const y of [12,18,24])for(let k=0;k<9;k++){const z=15+2*k;body.push(P('24309',24,y,z,y===24&&k%3===0?'red':'dark red',90),P('24309',33,y,z,y===18&&k%4===0?'red':'dark red',270));}
for(let z=16;z<32;z+=2){for(const x of [26,28,32])body.push(P('15068',x,30,z,(z+x)%6===0?'red':'dark red'));body.push(P('3003',30,30,z,'dark red'),P('3040b',30,33,z,'black'),P('54200',31,33,z,'tan'));}
for(let j=0;j<4;j++){body.push(box({at:[27,15+3*j,10-j],size:[6,3,4+j],colour:'dark red',interior:'solid'}));for(let i=0;i<3;i++)body.push(P('15068',27+2*i,18+3*j,10-j,'dark tan'));}
section('Rounded armored torso',body);
function wing(left){const tops=left?[45,51,57,63,69,69,66,60,54,48,42,36]:[36,45,51,57,63,69,72,69,63,57,51,45];const lows=left?[42,39,33,36,39,30,24,27,24,27,27,30]:[30,30,33,30,27,30,39,36,42,45,45,42];const start=left?0:36,z=left?22:23,a=[];for(let i=0;i<12;i++){const x=start+2*i,lo=lows[i],hi=tops[i];a.push(box({at:[x,lo,z],size:[2,hi-lo,1],colour:'black',interior:'solid'}),P('11477',x,hi,z,'red',left?90:270),P('3665a',x,lo-3,z,'dark red',left?90:270));if(i%3===2&&i<11){a.push(box({at:[x,lo,z+1],size:[1,hi-lo,1],colour:'dark red',interior:'solid',top:'tile'}));for(let y=lo+3;y<hi;y+=9)a.push(P('3005',x,y,z+1,'dark tan'));a.push(P('54200',x+(left?1:0),hi+3,z,'tan'));}}a.push(floor({at:[left?20:36,30,z],size:[4,3],layers:2,colour:'dark red'}));return a;}
section('Swept scalloped wings',[...wing(true),...wing(false)]);
const neck=[box({at:[26,27,9],size:[8,9,9],colour:'dark red'}),box({at:[27,33,7],size:[6,9,9],colour:'dark red'}),box({at:[27,39,4],size:[6,9,9],colour:'dark red'}),box({at:[29,30,12],size:[2,18,4],colour:'dark red',interior:'solid'}),box({at:[27,24,6],size:[6,9,4],colour:'dark red',interior:'solid'}),box({at:[27,30,5],size:[6,9,4],colour:'dark red',interior:'solid'})];
for(const j of [0,2,4,5]){const y=27+j*3,z=8-Math.floor(j/2);for(let i=0;i<3;i++)neck.push(P('15068',27+2*i,y,z-2,'dark tan'));neck.push(P('24309',25,y,z,'red',90),P('24309',32,y,z,'dark red',270));}
for(let j=1;j<4;j++){const y=30+6*j,z=15-Math.floor(j/2);neck.push(P('3003',29,y,z,'dark red'),P('3040b',29,y+3,z,'black'),P('54200',30,y+3,z,'tan'));}
section('Arched neck and throat shields',neck);
const head=[box({at:[25,45,1],size:[10,9,10],colour:'dark red'}),box({at:[26,45,-5],size:[8,6,7],colour:'dark red'}),box({at:[26,36,-4],size:[8,3,12],colour:'dark red',top:'tile'}),box({at:[26,39,7],size:[8,6,4],colour:'dark red'}),floor({at:[28,39,-3],size:[4,6],colour:'red',top:'tile'}),P('3005',25,45,0,'dark red'),P('3005',34,45,0,'dark red'),P('3005',25,48,0,'yellow'),P('3005',34,48,0,'yellow'),P('54200',25,48,-1,'black'),P('54200',34,48,-1,'black'),P('11477',25,51,-1,'red'),P('11477',34,51,-1,'red')];
for(const x of [26,33])for(const z of [-3,0,3])head.push(P('4589',x,39,z,'white'),P('3665a',x,42,z,'white'));
for(let x=26;x<34;x+=2)head.push(P('15068',x,51,-5,'red'),P('15068',x,51,-3,'dark red'));
head.push(P('98138',27,54,-4,'black'),P('98138',32,54,-4,'black'));
for(let x=25;x<35;x+=2)for(const z of [1,3,5])head.push(P('15068',x,54,z,'dark red'));
for(const x of [26,32])head.push(P('3003',x,54,7,'tan'),P('40379',x,57,6,'tan'));
head.push(P('3023b',24,57,6,'dark red'),P('64847',24,58,6,'tan'),P('3023b',34,57,6,'dark red'),P('64847',35,58,6,'tan'));
for(const x of [25,33])head.push(P('43721',x,45,7,'red'),P('11477',x,48,9,'dark red'));
section('Alert face, open jaw and swept ivory horns',head);
const tail=[],segs=[[28,9,30,6,9,8],[30,6,36,6,9,7],[34,3,40,8,9,6],[40,2,39,6,6,6],[44,1,33,5,6,9],[45,1,27,3,3,8]];
for(let n=0;n<segs.length;n++){const [x,y,z,w,h,d]=segs[n];tail.push(box({at:[x,y,z],size:[w,h,d],colour:'dark red',interior:'solid'}));for(let dx=0;dx<w-1;dx+=2)for(let dz=0;dz<d-1;dz+=2)tail.push(P('15068',x+dx,y+h,z+dz,n%2?'red':'dark red'));for(let dz=1;dz<d;dz+=3)if(n!==5||z+dz<33)tail.push(P('3040b',x+Math.floor(w/2),y+h+3,z+dz,'black'));}
tail.push(box({at:[45,1,22],size:[5,3,6],colour:'dark red',interior:'solid'}),P('41747',45,4,21,'dark red'),P('41748',47,4,21,'dark red'));
section('Long curling spined tail',tail);
const nest=[floor({at:[27,0,-12],size:[12,10],layers:2,colour:'dark bluish grey'}),cylinder({at:[28,2,-11],diameter:10,height:3,colour:'dark bluish grey'}),cylinder({at:[30,5,-9],diameter:6,height:6,colour:'white'}),dome({at:[30,11,-9],diameter:6,colour:'white'})];
for(const [x,z,t] of [[27,-11,0],[37,-10,90],[28,-3,180],[35,-3,180]])nest.push(P('3039',x,2,z,'dark bluish grey',t));
section('The pearl egg in its small volcanic nest',nest);