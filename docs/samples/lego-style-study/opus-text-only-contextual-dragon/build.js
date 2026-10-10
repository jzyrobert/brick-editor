script({title:'Cinderkeeper — The Last Egg',description:'An obsidian dragon raises crimson-membraned wings over a cracking, glowing egg in a twig nest on a volcanic island. Its forepaws cradle the nest rim, its head bows low with open fanged jaws and amber eyes, and its armoured, spade-tipped tail hooks around the crags and lava pools.',palette:{hide:'black',membrane:'dark red',bone:'tan',spine:'pearl gold',belly:{mix:['tan','dark tan']},rock:{mix:['dark bluish grey','dark bluish grey','black']},twig:{mix:['reddish brown','dark brown']}}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour,extra={})=>box({at,size,colour,...extra});
const S=(at,size,colour)=>box({at,size,colour,interior:'solid'});
const rockRects=[[10,6,28,34],[5,14,5,24],[38,12,5,20],[15,2,18,4],[13,40,22,5]];
const lavaRects=[[2,5,8,8],[10,1,5,5],[38,32,7,12],[5,38,5,6]];
const crag=(x,z,h,t)=>[S([x,2,z],[3,h,3],'rock'),P('3039',[x,2+h,z],'dark bluish grey',t),P('54200',[x+2,2+h,z+2],'black',t)];
const g=i=>i%3?'dark bluish grey':'black';
section('Volcanic island',[
 ...rockRects.map(([x,z,w,d])=>floor({at:[x,0,z],size:[w,d],layers:2,colour:'rock'})),
 ...lavaRects.map(([x,z,w,d])=>floor({at:[x,0,z],size:[w,d],layers:2,colour:'orange',top:'tile'})),
 floor({at:[12,2,12],size:[24,26],layers:3,colour:'rock'}),
 P('3037',[12,2,10],'black',0),P('3039',[16,2,10],'dark bluish grey',0),P('3039',[30,2,10],'black',0),P('3037',[32,2,10],'dark bluish grey',0),
 ...[12,16,20,24].map((z,i)=>P('3037',[10,2,z],g(i),90)),P('3039',[10,2,28],'dark bluish grey',90),
 ...[12,16,20,24,28,32].map((z,i)=>P('3037',[36,2,z],g(i+1),270)),P('3039',[36,2,36],'black',270),
 ...[24,28,32].map((x,i)=>P('3037',[x,2,38],g(i+2),180)),
 crag(39,18,9,270),crag(29,41,6,180),
 ...[[3,6,'trans yellow'],[7,9,'trans red'],[12,2,'trans yellow'],[40,35,'trans red'],[42,39,'trans yellow'],[8,42,'trans red']].map(([x,z,c])=>P('98138',[x,2,z],c))
]);
section('Twig nest and cracking egg',[
 floor({at:[19,2,3],size:[10,8],colour:'dark tan'}),
 wall({from:[18,2],to:[29,2],y:2,height:3,colour:'twig',texture:'log'}),
 wall({from:[18,11],to:[29,11],y:2,height:3,colour:'twig',texture:'log'}),
 wall({from:[18,3],to:[18,10],y:2,height:3,colour:'twig',texture:'log'}),
 wall({from:[29,3],to:[29,10],y:2,height:3,colour:'twig',texture:'log'}),
 P('30136',[20,5,2],'dark brown'),P('30136',[26,5,2],'dark brown'),P('30136',[22,5,11],'reddish brown'),P('30136',[18,5,5],'dark brown',90),P('30136',[29,5,4],'reddish brown',90),
 P('3941',[23,3,5],'white'),
 cylinder({at:[22,6,4],diameter:4,height:9,colour:'white'}),
 P('15068',[22,15,4],'white',0),P('15068',[24,15,4],'white',270),P('15068',[24,15,6],'white',180),P('15068',[22,15,6],'white',90),
 ...[[23,7,4,'black'],[24,8,4,'trans yellow'],[24,9,4,'black'],[23,10,4,'trans yellow'],[23,11,4,'black'],[24,12,4,'black'],[25,10,5,'trans yellow']].map(([x,y,z,c])=>P('3024',[x,y,z],c)),
 P('54200',[20,3,8],'white'),P('54200',[27,3,4],'white',90),P('3070b',[26,3,9],'white'),
 P('98138',[20,3,4],'trans yellow'),P('98138',[27,3,8],'orange'),P('98138',[21,3,9],'trans red')
]);
section('Body',[
 B([19,9,18],[10,15,18],'hide'),
 B([20,24,18],[8,6,10],'hide',{top:'tile'}),
 B([20,24,29],[8,3,6],'hide',{top:'tile',interior:'solid'}),
 box({at:[21,10,15],size:[6,12,3],colour:'belly',pattern:'courses',interior:'solid'}),
 ...[21,23,25].map(x=>P('3660b',[x,7,15],'bone')),
 ...[19,21,23,25].map(z=>[P('15068',[20,30,z],'hide',90),P('15068',[26,30,z],'hide',270)]),P('11477',[20,30,27],'hide',90),P('11477',[26,30,27],'hide',270),
 ...[29,31,33].map(z=>[P('15068',[20,27,z],'hide',90),P('15068',[26,27,z],'hide',270)]),
 ...[[23,30,20],[24,30,23],[23,30,26],[24,27,30],[23,27,33]].map(at=>P('24482',at,'spine'))
]);
function side(s){const X=(x,w=1)=>s?48-x-w:x,T=t=>s&&t%180?360-t:t;return [
 B([X(15,4),14,17],[4,10,7],'hide',{top:'tile'}),
 S([X(15,4),7,13],[4,9,5],'hide'),
 floor({at:[X(14,6),5,10],size:[6,6],layers:2,colour:'hide',top:'tile'}),
 ...[17,19,21].map(z=>P('15068',[X(15,2),24,z],'hide',T(90))),P('11477',[X(15,2),24,23],'hide',T(90)),
 ...[14,16,18].map(x=>[P('15070',[X(x),7,10],'bone'),P('11477',[X(x),7,12],'hide')]),
 B([X(13,6),7,27],[6,13,8],'hide',{top:'tile'}),
 floor({at:[X(12,6),5,22],size:[6,9],layers:2,colour:'hide'}),
 ...[27,29,31,33].map(z=>P('15068',[X(13,2),20,z],'hide',T(90))),
 ...[15,17].map(x=>P('15068',[X(x,2),20,27],'hide')),
 ...[12,14,16].map(x=>[P('15070',[X(x),7,22],'bone'),P('11477',[X(x),7,24],'hide')])
];}
section('Crouching legs',[side(0),side(1)]);
const neck=[[22,15,6,6],[28,13,6,6],[34,12,6,6],[40,12,4,5]];
section('Arched neck and bowed head',[
 ...neck.map(([y,z,h,d],k)=>B([21,y,z],[6,h,d],'hide',k===3?{top:'tile'}:{})),
 ...[22,24].map(x=>[P('3004',[x,22,15],'bone'),P('3004',[x,25,15],'bone'),P('3004',[x,28,13],'bone'),P('3660b',[x,25,13],'bone')]),
 ...range(22,26).map(x=>P('3665a',[x,31,12],'bone')),
 ...[21,22,24,25,26].map(x=>[P('54200',[x,34,18],'hide',180),P('54200',[x,40,17],'hide',180)]),
 ...[21,23,25].map(x=>P('15068',[x,44,15],'hide',180)),
 ...[[23,34,18],[23,40,17],[23,44,13]].map(at=>P('24482',at,'spine')),
 B([20,36,7],[8,5,5],'hide'),
 floor({at:[19,41,7],size:[10,7],layers:2,colour:'hide'}),
 floor({at:[20,43,7],size:[8,5],colour:'hide',top:'tile'}),
 S([21,34,2],[6,5,5],'hide'),
 S([21,31,7],[6,5,5],'hide'),
 floor({at:[21,29,1],size:[6,11],layers:2,colour:'hide'}),
 ...[21,23,25].map(x=>P('93606',[x,39,3],'hide')),
 ...[21,23,24,26].map(x=>P('54200',[x,39,2],'hide')),P('98138',[22,39,2],'dark red'),P('98138',[25,39,2],'dark red'),
 P('3004',[20,38,8],'trans yellow',90),P('3004',[27,38,8],'trans yellow',90),
 ...[19,28].map(x=>[P('3069b',[x,43,7],'hide',90),P('4589',[x,43,9],'bone'),P('3069b',[x,43,10],'hide',90)]),
 ...[20,27].map(x=>[P('3062b',[x,44,11],'bone'),P('11089',[x,47,11],'bone',180)]),
 P('4589',[23,44,8],'spine'),
 P('49668',[21,33,1],'bone'),P('49668',[26,33,1],'bone'),
 ...[[22,1],[25,1],[21,3],[26,3],[21,5],[26,5]].map(([x,z])=>P('4589',[x,31,z],'bone')),
 P('3068b',[23,31,3],'dark red'),P('3069b',[23,31,5],'dark red'),
 P('3004',[22,31,7],'dark red'),P('3004',[24,31,7],'dark red')
]);
const WM=[33,33,36,39,42,45,48,51,54,57,60,63,60,57,54,51,48,45,45];
const WB=[24,24,24,27,30,30,27,24,27,30,33,30,27,30,33,36,33,36,39];
const WF=[1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1];
function wing(s){
 const ops=[],usedB={},usedO={},X=i=>s?28+i:19-i;
 const dir=(part,xa,xb,y,z,c)=>P(part,[Math.min(xa,xb),y,z],c,xb<xa?90:270);
 WM.forEach((M,i)=>{const b=WB[i],x=X(i);
  if(WF[i]) ops.push(S([x,b,25],[1,M-b,2],'hide'));
  else {const band=Math.max(b,M-6); if(band>b) ops.push(S([x,b,26],[1,band-b,1],'membrane')); ops.push(S([x,band,25],[1,M-band,2],'hide'));}
  const lo=i>=1&&i<=11?i-1:(i>=12&&i<=17?i+1:-1);
  if(lo>=0) for(const z of [25,26]) ops.push(dir('3040b',x,X(lo),M,z,'hide'));
 });
 for(let i=0;i<18;i++){const d=WB[i+1]-WB[i]; if(Math.abs(d)!==3) continue; const back=d>0?i:i+1,over=d>0?i+1:i; if(usedB[back]||usedO[over]) continue; usedB[back]=1; usedO[over]=1; const dark=WF[back]||WB[back]>=WM[back]-6; ops.push(dir('3665a',X(back),X(over),WB[back],26,dark?'hide':'membrane'));}
 ops.push(P('11089',[X(11),66,25],'bone'));
 return ops;}
section('Raised sheltering wings',[wing(0),wing(1)]);
const tail=[[20,9,35,8,12,5],[11,2,38,13,12,6],[6,2,30,6,8,9],[5,2,22,4,6,9],[6,2,15,3,4,8]];
section('Hooked armoured tail',[
 ...tail.map(([x,y,z,w,h,d],k)=>B([x,y,z],[w,h,d],'hide',k===0?{top:'tile'}:{})),
 ...[20,22,24,26].map(x=>P('15068',[x,21,36],'hide',180)),
 ...[[23,21,38],[19,14,40],[15,14,41],[21,14,42],[8,10,33],[8,10,36],[6,8,25],[7,8,28],[7,6,18]].map(at=>P('4589',at,'spine')),
 P('41770a',[5,6,12],'membrane'),P('41769a',[7,6,12],'membrane')
]);