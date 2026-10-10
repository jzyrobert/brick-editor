script({title:"Piplup — A Little Royal Wave",description:"A large freestanding Piplup, caught greeting its trainer: round azure hood, sculpted white cheeks, sparkling oval eyes, a tiny smiling beak, two white belly buttons, broad webbed feet and a raised flipper. Its little fan tail finishes the back.",palette:{hood:'dark azure',body:'medium azure',white:'white',beak:'yellow',eye:'black'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function face(x,y,z,part,c,kind){
 if(kind==='head'){
  const white=y>=45&&y<=75&&(y<=60||Math.abs(x+1)>=(y>=75?5:y>=72?4:3));
  c=white?'white':'dark azure';
  const eye=y>=54&&y<=66&&((x>=-6&&x<-2)||(x>=2&&x<6));
  if(eye){
   if(y===63&&(x===-6||x===2))return [P('3004',x,y,z,'white',90),P('3004',x+1,y,z,'black',90)];
   return P(y===54?'3660b':y===66?'15068':'3003',x,y,z,'black');
  }
  if(white&&y>=48&&y<=72)part='3003';
 }
 if(kind==='body'){
  if(y===36||(y===33&&Math.abs(x+1)>=3))c='dark azure';
  const dot=(y===24&&(x===-5||x===-3||x===1||x===3))||((y===21||y===27)&&(x===-3||x===1));
  if(dot){c='white';part=y===21?'3660b':y===27?'15068':'3003';}
 }
 return P(part,x,y,z,c);
}
function band(w,d,y,c,kind,phase){
 const x=-w/2,z=(kind==='head'?1:2)-d/2;
 const part=phase==='grow'?'3660b':phase==='straight'?'3003':'15068';
 const ops=[box({at:[x+4,y,z],size:[w-8,3,d],colour:c,interior:'solid'}),box({at:[x+2,y,z+2],size:[w-4,3,d-4],colour:c,interior:'solid'})];
 if(d>8)ops.push(box({at:[x,y,z+4],size:[w,3,d-8],colour:c,interior:'solid'}));
 for(let a=x+4;a<x+w-4;a+=2){ops.push(face(a,y,z,part,c,kind));ops.push(P(part,a,y,z+d-2,kind==='body'&&y>=33?'dark azure':c,180));}
 for(let b=z+4;b<z+d-4;b+=2){ops.push(P(part,x,y,b,c,90),P(part,x+w-2,y,b,c,270));}
 ops.push(face(x+2,y,z+2,part,c,kind),face(x+w-4,y,z+2,part,c,kind),P(part,x+2,y,z+d-4,kind==='body'&&y>=33?'dark azure':c,180),P(part,x+w-4,y,z+d-4,kind==='body'&&y>=33?'dark azure':c,180));
 return ops;
}
function foot(x,z){return [floor({at:[x,0,z],size:[8,12],layers:2,colour:'yellow'}),box({at:[x,2,z],size:[8,1,4],colour:'yellow',interior:'solid'}),box({at:[x,2,z+4],size:[8,4,8],colour:'yellow',interior:'solid'}),range(8).map(i=>P('61678',x+i,3,z,'yellow'))];}
section('Broad yellow webbed feet',[foot(-9,-8),foot(1,-10)]);
const bw=[10,12,14,16,18,18,18,18,16,14,10],bd=[8,10,12,14,16,16,16,16,14,12,8];
section('Pear-shaped body and white buttons',bw.map((w,i)=>band(w,bd[i],6+3*i,'medium azure','body',i<4?'grow':i<8?'straight':'shrink')));
const hw=[12,16,20,22,24,24,24,24,24,24,24,22,20,18,14,10],hd=[8,12,16,18,20,20,20,20,20,20,20,18,16,14,10,8];
section('Round hood, white cheeks and eyes',hw.map((w,i)=>band(w,hd[i],39+3*i,'dark azure','head',i<4?'grow':i<11?'straight':'shrink')));
section('Smooth crown',[floor({at:[-1,87,-1],size:[2,4],colour:'dark azure',top:'tile'})]);
section('Little smiling beak',[
 box({at:[-3,51,-11],size:[6,3,5],colour:'yellow',interior:'solid'}),range(6).map(i=>P('11477',-3+i,51,-13,'yellow')),
 floor({at:[-3,54,-12],size:[6,5],colour:'black'}),box({at:[-3,55,-11],size:[6,1,4],colour:'yellow',interior:'solid'}),range(6).map(i=>P('50950',-3+i,55,-14,'yellow'))
]);
function flipperRow(x,y,z,w,d,tip=false){return [box({at:[x,y,z],size:[w,3,d],colour:'dark azure',interior:'solid'}),range(w/2).map(i=>P(tip?'15068':'3003',x+2*i,y,z,'dark azure')),range(w/2).map(i=>P(tip?'15068':'3003',x+2*i,y,z+d-2,'dark azure',180))];}
section('Relaxed left flipper',[
 flipperRow(-13,12,0,2,4,true),flipperRow(-14,15,-1,4,6),flipperRow(-14,18,-1,4,6),flipperRow(-14,21,-1,4,6),flipperRow(-14,24,-1,4,6),flipperRow(-13,27,0,4,6),flipperRow(-12,30,1,4,4,true),box({at:[-11,24,1],size:[3,9,3],colour:'dark azure',interior:'solid'})
]);
section('Raised greeting flipper',[
 box({at:[8,27,3],size:[4,3,2],colour:'dark azure',interior:'solid'}),flipperRow(10,27,1,6,6),flipperRow(10,30,1,8,6),flipperRow(12,33,1,8,6),flipperRow(14,36,1,6,6),flipperRow(16,39,1,4,6),flipperRow(16,42,2,4,4),flipperRow(16,45,2,4,4),flipperRow(16,48,2,2,4,true)
]);
section('Three-feather tail',[
 box({at:[-4,9,8],size:[8,3,8],colour:'dark azure',interior:'solid'}),box({at:[-3,12,10],size:[6,3,7],colour:'dark azure',interior:'solid'}),box({at:[-3,15,11],size:[6,3,5],colour:'dark azure',interior:'solid'}),range(6).map(i=>P('61678',-3+i,15,12,'dark azure',180)),range(3).map(i=>P('15068',-3+2*i,15,10,'dark azure'))
]);