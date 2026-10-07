script({title:'The Embercrest Dragon',description:'An emerald dragon guarding a golden hoard, with four clawed feet, open toothed jaws, swept ivory horns, a curling spiked tail and two towering crimson bat wings.',palette:{skin:'dark green',scale:'green',belly:'tan',bone:'black',membrane:'dark red',horn:'tan',spine:'pearl gold',rock:'dark bluish grey'},defaults:{interior:'empty'}});
const W=48;
const shell=(at,size,colour='skin')=>box({at,size,colour});
const solid=(at,size,colour='skin')=>box({at,size,colour,interior:'solid'});
const p=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const mx=(x,w,s)=>s?W-x-w:x;
function ps(part,at,colour,turn,s){const widths={'11477':turn===90||turn===270?2:1,'15068':2,'4460b':1,'4589':1,'54200':1,'3040b':1};return p(part,[mx(at[0],widths[part],s),at[1],at[2]],colour,s?(360-turn)%360:turn);}
function bs(at,size,colour,s){return solid([mx(at[0],size[0],s),at[1],at[2]],size,colour);}
function scaleRow(x,y,z,n,turn=0,colour='skin'){return range(n).map(i=>p('11477',[x+i,y,z],colour,turn));}
section('Rocky display and treasure',[
baseplate({at:[0,0],size:[W,W],colour:'light bluish grey'}),floor({at:[1,0,1],size:[W-2,W-2],colour:'rock'}),
shell([17,1,20],[14,6,15],'rock'),shell([38,1,8],[6,6,10],'rock'),shell([39,7,10],[4,3,6],'light bluish grey'),shell([18,1,3],[12,3,2],'black'),
range(5).map(i=>range(4).map(j=>p('6141',[5+i,1,5+j],'spine'))),range(4).map(i=>range(2).map(j=>p('6141',[6+i,2,6+j],'spine'))),range(4).map(i=>p('54200',[8+i,1,11],'spine')),p('3960',[7,3,6],'spine')
]);
function foot(x,z){return [solid([x,1,z],[6,6,8]),range(3).map(i=>p('3040b',[x+i*2,7,z],'white')),range(3).map(i=>p('15068',[x+i*2,7,z+2],'skin'))];}
function legs(s){return [bs([16,7,15],[4,12,5],'skin',s),bs([18,19,17],[4,6,6],'skin',s),bs([13,7,27],[6,15,6],'skin',s),bs([13,22,29],[6,3,2],'skin',s),
range(3).map(i=>ps('15068',[13+i*2,22,27],'skin',0,s)),range(3).map(i=>ps('15068',[13+i*2,22,31],'skin',180,s)),range(3).map(i=>ps('15068',[13+i*2,25,29],i%2?'skin':'scale',0,s)),range(2).map(i=>ps('15068',[16+i*2,19,15],'skin',0,s)),range(2).map(i=>ps('15068',[18+i*2,25,17],'skin',0,s))];}
section('Four powerful legs',[foot(15,11),foot(27,11),foot(11,24),foot(31,24),legs(0),legs(1)]);
section('Rounded torso and plated breast',[
shell([19,9,19],[10,6,14],'belly'),shell([17,15,18],[14,9,15]),shell([18,24,19],[12,6,13]),shell([20,30,21],[8,3,10]),shell([21,15,17],[6,15,2],'belly'),
range(3).map(i=>floor({at:[21,15+i*6,17],size:[6,3],colour:'belly'})),range(2).map(s=>range(10).map(i=>ps('11477',[18,30,21+i],'skin',90,s))),scaleRow(20,30,19,8),scaleRow(20,30,31,8,180),
range(5).map(j=>range(4).map(i=>p('15068',[20+i*2,33,21+j*2],j%2?'skin':'scale'))),range(3).map(i=>[p('4589',[23,36,22+i*4],'spine'),p('3040b',[24,36,21+i*4],'black')])
]);
section('Rising neck',[
shell([21,24,15],[6,9,8]),shell([21,33,12],[6,6,8]),shell([21,39,10],[6,3,8]),shell([22,27,14],[4,6,2],'belly'),shell([22,33,11],[4,6,2],'belly'),scaleRow(22,33,14,4),scaleRow(22,39,11,4),p('4589',[23,39,19],'spine'),p('3040b',[24,39,18],'black')
]);
function cheek(s){return [range(5).map(i=>ps('11477',[20,45,11+i],'skin',90,s)),ps('4460b',[21,48,13],'horn',0,s),ps('4589',[21,57,14],'horn',0,s),ps('4589',[21,48,16],'horn',0,s),ps('54200',[20,48,11],'skin',0,s)];}
section('Expressive horned head and open jaws',[
shell([20,39,10],[8,9,7]),shell([21,39,4],[6,3,7],'belly'),shell([21,45,3],[6,3,8]),floor({at:[23,42,4],size:[2,5],colour:'red'}),floor({at:[20,42,9],size:[8,2],colour:'skin'}),
range(2).map(i=>range(2).map(j=>p('3665a',[21+i*5,42,4+j*3],'white'))),range(2).map(i=>range(2).map(j=>p('54200',[22+i*3,42,5+j*3],'white'))),scaleRow(21,48,3,6),shell([21,48,5],[6,3,5]),p('3070b',[22,51,4],'black'),p('3070b',[25,51,4],'black'),
p('3005',[20,43,9],'yellow'),p('3005',[21,43,9],'black'),p('3005',[26,43,9],'black'),p('3005',[27,43,9],'yellow'),scaleRow(20,46,9,2),scaleRow(26,46,9,2),cheek(0),cheek(1),range(4).map(i=>p('54200',[22+i,48,15],'spine',180))
]);
const tailSegments=[{at:[21,9,31],size:[6,12,6]},{at:[22,6,35],size:[5,12,5]},{at:[24,3,38],size:[5,12,5]},{at:[27,1,41],size:[6,9,4]},{at:[32,1,42],size:[5,6,3]},{at:[36,1,41],size:[4,6,3]},{at:[39,1,38],size:[3,6,5]},{at:[40,1,35],size:[2,3,4]},{at:[40,1,32],size:[1,3,4]}];
function tailSegment(s,i){const [x,y,z]=s.at,[w,h,d]=s.size;return [solid(s.at,s.size),range(w).map(j=>p('11477',[x+j,y+h,z+d-2],i%2?'skin':'scale',180)),p('4589',[x+Math.floor(w/2),y+h+3,z+d-2],'spine')];}
section('Long curling spiked tail',tailSegments.map(tailSegment));
const wingStrips=[{x:2,b:57,t:60},{x:4,b:54,t:63},{x:6,b:48,t:66},{x:8,b:42,t:69},{x:10,b:36,t:66},{x:12,b:33,t:60},{x:14,b:30,t:54},{x:16,b:30,t:48},{x:18,b:27,t:39}];
function wing(s){const L=(a,b)=>line({from:[mx(a[0],1,s),a[1],a[2]],to:[mx(b[0],1,s),b[1],b[2]],colour:'bone'});return [bs([18,27,21],[4,9,4],'bone',s),wingStrips.map(t=>[bs([t.x,t.b,22],[2,t.t-t.b,2],'membrane',s),range(2).map(i=>ps('3040b',[t.x+i,t.t,22],'bone',0,s)),floor({at:[mx(t.x,2,s),t.b,21],size:[2,3],colour:'bone'})]),L([19,30,21],[9,68,21]),L([9,68,21],[3,59,21]),ps('4589',[8,72,23],'spine',0,s)];}
section('Two towering bat wings',[wing(0),wing(1)]);