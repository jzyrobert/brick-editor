script({title:'The Last Ember — Guardian of the Stormglass Nest',description:'An emerald dragon shelters a glowing egg among the drowned ruins of an ancient sanctuary. Copper bat wings, ivory horns, a plated throat and a long curling tail frame the nest; four clawed feet brace against the basalt shore.',palette:{hide:'dark green',web:'dark red',belly:'tan',rock:{mix:['dark bluish grey','dark bluish grey','light bluish grey']}}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const baseW=44,baseD=36;
section('Connected stormglass shore',[
 floor({at:[-22,0,-18],size:[baseW,baseD],layers:2,colour:'black'}),
 floor({at:[-20,2,-12],size:[40,28],colour:'dark bluish grey'}),
 floor({at:[-22,2,-18],size:[44,6],colour:'dark turquoise',top:'tile'}),
 ...range(11).flatMap(i=>[P('2431',[-22+4*i,2,-18],'black'),P('2431',[-22+4*i,2,17],'black')]),
 ...range(8).flatMap(i=>[P('2431',[-22,2,-15+4*i],'black',90),P('2431',[21,2,-15+4*i],'black',90)]),
 box({at:[-10,3,-7],size:[20,6,20],colour:'rock',supports:6}),
 box({at:[-13,3,-15],size:[10,3,9],colour:'rock'}),
 ...range(7).map(i=>P('3039',[-10+3*i,3,13],'dark bluish grey',180)),
 ...range(6).map(i=>P('3678b',[10,3,-5+3*i],'dark bluish grey',270)),
 ...range(4).map(i=>P('3039',[-12,3,2+3*i],'dark bluish grey',90)),
 ...[[-18,-14],[-16,-11],[-18,-3],[-15,0]].map(([x,z])=>floor({at:[x,3,z],size:[2,2],colour:'light bluish grey',top:'tile'})),
 ...[[-18,-17],[-15,-16],[-3,-17],[2,-17],[17,-14],[19,-10]].map(([x,z])=>P('2431',[x,3,z],'trans light blue'))
]);
section('The ruined sanctuary and ember egg',[
 box({at:[-19,3,-6],size:[2,12,2],colour:'light bluish grey',texture:'masonry',open:['top']}),
 box({at:[-15,3,-6],size:[2,12,2],colour:'light bluish grey',texture:'masonry',open:['top']}),
 P('3307',[-19,15,-6],'light bluish grey'),
 floor({at:[-20,21,-7],size:[8,3],colour:'dark bluish grey',top:'tile'}),
 P('54200',[-19,22,-6],'sand green'),P('54200',[-14,22,-6],'sand green',180),
 box({at:[-12,6,-14],size:[8,3,8],colour:'reddish brown',texture:'log',open:['top']}),
 floor({at:[-11,6,-13],size:[6,6],colour:'tan'}),
 cylinder({at:[-11,7,-13],diameter:6,height:6,colour:'bright light orange'}),
 dome({at:[-11,13,-13],diameter:6,colour:'bright light orange'}),
 P('15070',[-12,9,-13],'white',270),P('15070',[-5,9,-11],'white',90),
 P('49668',[-10,9,-14],'white'),P('49668',[-8,9,-7],'white',180),
 ...[[-17,3,4],[-19,3,9],[-16,3,12]].map(at=>P('54200',at,'sand green'))
]);
function hindFoot(x){return [box({at:[x,9,-5],size:[6,3,9],colour:'hide',interior:'solid',top:'tile'}),...range(3).map(i=>P('93606',[x+2*i,12,-3],'hide')),...range(3).map(i=>P('15070',[x+2*i,12,-5],'white'))];}
function foreFoot(x){return [box({at:[x,9,-9],size:[3,3,5],colour:'hide',interior:'solid',top:'tile'}),...range(3).map(i=>P('11477',[x+i,12,-7],'hide')),...range(3).map(i=>P('15070',[x+i,12,-9],'white'))];}
function haunch(x,outer,turn){return [box({at:[outer,9,3],size:[2,3,9],colour:'hide',interior:'solid'}),box({at:[x,12,3],size:[4,12,9],colour:'hide'}),...range(2).flatMap(a=>range(2).map(b=>P('93606',[x+2*a,24,4+4*b],'hide'))),...range(4).flatMap(a=>range(4).map(b=>P('15068',[outer,12+3*a,4+2*b],'hide',turn)))];}
section('Four braced legs and muscular body',[
 box({at:[-4,9,-1],size:[8,3,13],colour:'hide',interior:'solid'}),
 box({at:[-4,12,-1],size:[8,18,13],colour:'hide'}),
 box({at:[-3,30,-1],size:[6,12,7],colour:'hide'}),
 box({at:[-2,36,-5],size:[4,9,8],colour:'hide'}),
 box({at:[-6,27,5],size:[12,6,4],colour:'hide'}),
 ...hindFoot(-10),...hindFoot(4),...foreFoot(-7),...foreFoot(4),
 ...haunch(-8,-10,90),...haunch(4,8,270),
 ...[-6,4].flatMap(x=>[
 box({at:[x,12,0],size:[2,3,4],colour:'hide',interior:'solid'}),
 box({at:[x,12,-5],size:[2,18,3],colour:'hide',interior:'solid'}),
 box({at:[x,27,-4],size:[2,6,7],colour:'hide'}),
 ...range(5).flatMap(i=>range(2).map(j=>P('11477',[x+j,15+3*i,-6],'hide'))),
 ...range(2).map(i=>P('61678',[x+i,33,-4],'hide'))
 ]),
 ...range(5).flatMap(i=>[-2,0].map(x=>P('15068',[x,15+3*i,-1],'belly'))),
 ...range(4).flatMap(i=>[-2,0].map(x=>P('15068',[x,30+3*i,-2-i],'belly'))),
 ...[-6,4].flatMap((x,s)=>range(5).flatMap(i=>[0,2].map(z=>P('15068',[x,15+3*i,z],'hide',s===0?90:270)))),
 ...[-6,4].flatMap((x,s)=>(s===0?[8,10]:[4,6,8,10]).map(z=>P('15068',[x,27,z],'hide',s===0?90:270))),
 P('42918',[-4,30,4],'hide'),P('42918',[2,30,4],'hide'),
 floor({at:[-2,30,4],size:[4,8],colour:'hide'}),
 ...[-2,1].flatMap(x=>range(4).map(i=>P('11477',[x,31,4+2*i],'hide'))),
 ...[4,7,10].flatMap(z=>[P('4032b',[-1,31,z],'hide'),P('3942c',[-1,32,z],'tan')]),
 P('3069b',[-1,31,6],'hide'),P('3069b',[-1,31,9],'hide')
]);
function wing(side,y,z){const out=[];const low=[0,3,9,12,9,3,6,0],high=[15,21,30,36,36,30,21,12];for(let j=0;j<8;j++){const x=side>0?5+2*j:-7-2*j;const rise=j<4;const cap=(side>0)==rise?90:270;out.push(P('3660b',[x,y+low[j],z],'hide',side>0?90:270));out.push(wall({from:[x,z],to:[x+1,z],y:y+low[j]+3,height:high[j]-low[j]-3,thickness:2,colour:'web'}));out.push(P('3039',[x,y+high[j],z],'hide',cap));if(j%2===0){for(let h=low[j]+3;h<high[j];h+=3)out.push(P('3004',[side>0?x:x+1,y+h,z],'hide',90));}if(j===3||j===6)out.push(P('4589',[x+(cap===90?1:0),y+high[j]+3,z+1],'tan'));}return out;}
section('Two copper storm wings',[
 floor({at:[-7,29,6],size:[14,2],layers:2,colour:'hide'}),
 ...wing(1,27,7),...wing(-1,24,5)
]);
const tailCells=new Map();
function tailPatch(x,z,w,d,top,turn){for(let a=x;a<x+w;a+=2)for(let b=z;b<z+d;b+=2){const k=a+','+b;const old=tailCells.get(k);if(!old||top>old.top)tailCells.set(k,{x:a,z:b,top,turn});}}
tailPatch(0,12,6,4,15,180);tailPatch(6,12,4,4,12,90);tailPatch(10,6,4,8,9,90);tailPatch(12,-4,4,10,7,0);tailPatch(10,-10,4,6,6,0);tailPatch(4,-14,8,4,5,270);tailPatch(0,-14,4,2,5,270);
section('The tail encircles the nest',[...Array.from(tailCells.values()).flatMap((c,i)=>[box({at:[c.x,3,c.z],size:[2,c.top-3,2],colour:'hide',interior:'solid'}),P('15068',[c.x,c.top,c.z],'hide',c.turn),i%5===0&&P('4589',[c.x+(c.turn===90?1:0),c.top+3,c.z+(c.turn===0?1:0)],'tan')])]);
section('Watchful horned face',[
 floor({at:[-3,41,-12],size:[6,8],layers:2,colour:'hide',top:'tile'}),
 ...[-3,-1,1].map(x=>P('15068',[x,43,-12],'hide')),
 P('15070',[-3,43,-9],'white'),P('15070',[2,43,-9],'white'),
 box({at:[-3,47,-12],size:[6,3,8],colour:'hide',interior:'solid'}),
 box({at:[-4,45,-7],size:[8,6,7],colour:'hide'}),
 P('3710',[-6,47,-3],'hide'),P('3710',[2,47,-3],'hide'),
 ...[-3,-1,1].map(x=>P('93606',[x,50,-12],'hide')),
 ...[-4,2].flatMap(x=>[P('15068',[x,45,-7],'hide'),P('15068',[x,48,-7],'hide'),P('4032b',[x,51,-6],'yellow'),P('3023b',[x+(x>0?1:0),52,-6],'black',90),P('15068',[x,53,-4],'hide')]),
 P('93606',[-2,51,-6],'hide'),P('93606',[0,51,-6],'hide'),
 P('15068',[-2,51,-2],'hide'),P('15068',[0,51,-2],'hide'),
 P('41748',[-6,48,-5],'hide'),P('41747',[4,48,-5],'hide'),
 P('3062b',[-4,51,-1],'tan'),P('3062b',[3,51,-1],'tan'),
 P('11089',[-4,54,-1],'tan'),P('11089',[3,54,-1],'tan'),
 P('4589',[-1,54,-1],'tan'),P('4589',[0,54,-1],'tan'),
 P('98138',[-3,54,-9],'black'),P('98138',[2,54,-9],'black')
]);