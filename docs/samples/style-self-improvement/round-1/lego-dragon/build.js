script({title:'Cinderwing — Keeper of the Last Egg',description:'A great crimson dragon crouches protectively over its golden egg, roaring beneath enormous flame-coloured, scalloped wings. Ivory horns, a plated gold throat, grasping claws and a curling grounded tail complete the creature.',palette:{hide:'dark red',hot:'red',membrane:'orange',bone:'black',ivory:'tan',belly:'pearl gold'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour='hide',extra={})=>box({at,size,colour,interior:'solid',...extra});
function foot(x,z,w){return [floor({at:[x,0,z+2],size:[w,7],layers:3,colour:'hide'}),floor({at:[x,3,z+1],size:[w,8],colour:'hide',top:'tile'}),range(w/2).map(i=>P('3039',[x+2*i,0,z],'ivory')),range(w/2).map(i=>P('15068',[x+2*i,4,z+2],'hide'))];}
function hind(x,z,left){const a=left?x+1:x;const t=left?x+2:x-1;return [foot(x,z,6),B([a,4,z+5],[5,6,4]),B([t,10,z+4],[5,12,6]),B([left?x+3:x-1,22,z+4],[4,5,5]),P('3941',[x+2,16,z+6],'bone'),range(3).map(i=>P('15068',[left?x:x+4,10,z+4+2*i],'hot',left?90:270)),range(2).map(i=>P('15068',[left?x+1:x+3,22,z+5+2*i],'hide',left?90:270))];}
function fore(x,z,left){return [foot(x,z,4),B([left?x+1:x,4,z+5],[3,12,4]),B([left?x+2:x-1,16,z+7],[3,12,5]),P('3941',[x+1,13,z+6],'bone'),range(3).map(i=>P('11477',[left?x:x+2,7+3*i,z+5],'hot',left?90:270)),P('15068',[x+1,25,z+8],'hide',left?90:270)];}
section('Four braced legs and ten ivory claws',[hind(-10,6,true),hind(4,7,false),fore(-8,-8,true),fore(4,-6,false)]);
section('Compact torso and rising serpentine neck',[
 B([-4,12,1],[8,6,15]),B([-6,18,0],[12,6,17]),B([-5,24,1],[10,9,15]),B([-3,33,3],[6,3,12]),
 B([-4,24,-4],[8,9,8]),floor({at:[-4,32,-6],size:[8,9],colour:'hide'}),B([-3,33,-6],[6,9,7]),floor({at:[-3,41,-8],size:[6,7],colour:'hide'}),B([-3,42,-8],[6,9,7]),floor({at:[-4,50,-12],size:[8,9],colour:'hide'}),
 floor({at:[-1,27,7],size:[8,2],colour:'bone'}),floor({at:[-7,27,11],size:[8,2],colour:'bone'}),
 range(3).map(i=>P('3010',[-2,24+3*i,-4],'belly')),range(3).map(i=>P('3010',[-2,33+3*i,-6],'belly')),range(3).map(i=>P('3004',[-1,42+3*i,-8],'belly'))
]);
const bottoms=[0,1,2,3,3,2,1,1,2,3,4,5,5,5,4,3,3,4,5,6,7,7,7,7,7];
const tops=[3,5,7,9,11,13,15,17,18,17,17,16,15,15,14,13,13,12,11,11,10,9,9,8,8];
function wing(left){const z=left?11:7,Y=28,T=tops.map((v,u)=>left&&u>3?Math.max(bottoms[u]+1,v-2):v);const X=(u,w=1)=>left?-6-u-w+1:5+u;const out=[];const valid=(u,k)=>u>=0&&u<25&&k>=bottoms[u]&&k<T[u];const bone=(u,k)=>k===T[u]-1||Math.abs(u-k/2)<=1||u===8||Math.abs(u-(16-Math.round((k-3)*8/14)))<1||Math.abs(u-(24-Math.round((k-7)*16/10)))<1;const col=(u,k,back)=>k<bottoms[u]+2||k>T[u]-3?'dark red':back?(u>13&&k>8?'orange':'red'):'orange';
 for(let k=0;k<18;k++){
  for(let u=0;u<25;){if(!valid(u,k)||!bone(u,k)){u++;continue;}let n=1;while(u+n<25&&valid(u+n,k)&&bone(u+n,k)&&n<3)n++;const w=n===3&&k%2===0?3:Math.min(2,n);out.push(P(w===3?'3002':w===2?'3003':'3004',[X(u,w),Y+3*k,z],'bone',w===1?90:0));u+=w;}
  for(let back=0;back<2;back++)for(let u=0;u<25;){if(!valid(u,k)||bone(u,k)){u++;continue;}const c=col(u,k,back);let n=1;while(u+n<25&&valid(u+n,k)&&!bone(u+n,k)&&col(u+n,k,back)===c&&n<3)n++;const w=n===3&&(k+back)%3===0?3:Math.min(2,n);out.push(P(w===3?'3622':w===2?'3004':'3005',[X(u,w),Y+3*k,z+back],c));u+=w;}
 }
 for(let u=0;u<25;u++){const yy=Y+3*T[u];if(u===8)out.push(P('3062b',[X(u),yy,z],'tan'),P('11089',[X(u),yy+3,z],'tan',180),P('3024',[X(u),yy,z+1],'bone'));else out.push(P('3044b',[X(u),yy,z],u===24?'tan':'bone'));}
 for(const u of [7,16,24])out.push(P('3665a',[X(u),Y+3*bottoms[u]-3,z],'tan'));
 return out;
}
section('Flame membranes with load-bearing black finger bones',[wing(false),wing(true)]);
section('Armour along the back, shoulders and neck',[
 range(8).map(i=>[P('15068',[-6,24,2*i],'hide',90),P('15068',[4,24,2*i],'hide',270)]),
 range(7).map(i=>[P('15068',[-5,33,1+2*i],'hide',90),P('15068',[3,33,1+2*i],'hide',270)]),
 range(6).map(i=>[P('15068',[-3,36,3+2*i],'hot',90),P('15068',[1,36,3+2*i],'hide',270)]),
 floor({at:[-1,36,3],size:[2,12],colour:'bone'}),range(4).map(i=>P('3040b',[0,37,3+3*i],'tan',180)),
 range(3).map(i=>[P('11477',[-4,27+3*i,-2],'hide',90),P('11477',[2,27+3*i,-2],'hide',270)]),
 range(3).map(i=>[P('11477',[-3,36+3*i,-4],'hot',90),P('11477',[1,36+3*i,-4],'hide',270)]),
 range(3).map(i=>[P('11477',[-3,45+3*i,-6],'hide',90),P('11477',[1,45+3*i,-6],'hide',270)]),
 range(3).map(i=>P('3040b',[0,33+9*i,2-2*i],'tan',180))
]);
section('Roaring face, split jaws and a crown of horns',[
 floor({at:[-3,42,-16],size:[6,10],layers:3,colour:'hide',top:'tile'}),floor({at:[-2,45,-15],size:[4,7],colour:'bone',top:'tile'}),P('15068',[-1,46,-13],'hot'),
 range(3).map(i=>[P('4589',[-3,45,-15+3*i],'ivory'),P('4589',[2,45,-15+3*i],'ivory')]),
 B([-4,51,-12],[8,6,9]),B([-3,51,-16],[6,3,7]),B([-3,54,-10],[6,6,6]),
 [-3,2].map(x=>P('3665a',[x,48,-15],'ivory')),
 [-3,1].map(x=>P('15068',[x,54,-16],'hide')),range(3).map(i=>P('15068',[-3+2*i,54,-14],'hide')),
 P('3069b',[-1,54,-16],'bone'),P('3069b',[-1,54,-15],'hide'),
 [-4,3].map(x=>[P('3024',[x,54,-12],'yellow'),P('3024',[x,55,-12],'bone'),P('3024',[x,56,-12],'yellow')]),
 P('11477',[-4,57,-12],'hide',90),P('11477',[2,57,-12],'hide',270),
 [-9,-7].map(z=>[P('15068',[-5,54,z],'hide',90),P('15068',[3,54,z],'hide',270)]),
 range(3).map(i=>[P('15068',[-3+2*i,60,-10],'hot'),P('15068',[-3+2*i,60,-8],'hide',180)]),
 [-3,2].map(x=>[P('3062b',[x,60,-5],'tan'),P('11089',[x,63,-5],'tan',180)]),P('4589',[0,63,-8],'tan')
]);
const tail=[{at:[-3,12,15],size:[6,9,7]},{at:[-2,9,21],size:[5,6,7]},{at:[0,6,27],size:[4,6,6]},{at:[2,3,32],size:[4,6,5]},{at:[5,0,35],size:[6,5,3]},{at:[10,0,35],size:[6,4,2]},{at:[14,0,32],size:[3,3,4]},{at:[15,0,29],size:[2,3,4]},{at:[15,0,27],size:[1,3,3]}];
section('Long hooked tail with an ivory sawtooth crest',[
 tail.map(t=>B(t.at,t.size)),
 range(3).map(i=>[P('15068',[-3,21,16+2*i],'hide',90),P('15068',[1,21,16+2*i],'hide',270)]),
 range(3).map(i=>P('3040b',[0,21,16+2*i],'tan',180)),
 range(3).map(i=>[P('11477',[-2,15,22+2*i],'hide',90),P('11477',[2,15,22+2*i],'hide',270)]),
 range(3).map(i=>P('54200',[0,15,22+2*i],'tan',180)),
 range(3).map(i=>[P('15068',[0,12,27+2*i],'hide',90),P('15068',[2,12,27+2*i],'hide',270)]),
 range(2).map(i=>P('54200',[1,15,28+3*i],'tan',180)),
 range(2).map(i=>[P('15068',[2,9,32+2*i],'hide',90),P('15068',[4,9,32+2*i],'hide',270)]),
 range(3).map(i=>P('15068',[5+2*i,5,35],'hide')),
 range(2).map(i=>P('11477',[11+2*i,4,35],'hide',270)),
 P('11477',[15,3,32],'hide'),P('11477',[15,3,29],'hide'),P('54200',[15,3,27],'tan')
]);
section('The precious egg sheltered between the foreclaws',[cylinder({at:[-2,0,-9],diameter:4,height:6,colour:'belly'}),dome({at:[-2,6,-9],diameter:4,colour:'belly'})]);