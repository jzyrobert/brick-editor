script({title:'Devastator — Over the Bow',description:'A knife-edged Imperial Star Destroyer with a double armoured hull, recessed equatorial trench, eight twin turbolaser batteries, seven stern engines and twin spherical shield generators. A compact black cradle reveals the sculpted belly and ventral docking recess.',palette:{hull:'light bluish grey',trench:'dark bluish grey',windows:'black'},defaults:{interior:'empty'}});
const band=12;
const guns=[{k:2,x:-8,z:31},{k:2,x:6,z:31},{k:2,x:-8,z:34},{k:2,x:6,z:34},{k:3,x:-11,z:40},{k:3,x:9,z:40},{k:3,x:-11,z:44},{k:3,x:9,z:44}];
const P=(part,at,colour='hull',turn=0)=>place({part,at,colour,turn});
section('Display cradle',[floor({at:[-6,0,26],size:[12,14],layers:2,colour:'black',top:'tile'}),box({at:[-2,2,29],size:[4,9,10],colour:'black',interior:'solid'}),box({at:[-3,2,35],size:[6,9,2],colour:'black',interior:'solid'})]);
function hullBand(k){const z=k*band,a=3*k,ops=[];
for(const y of [14,18])ops.push(P('47397',[-a-3,y,z]),P('47398',[a,y,z]));
if(k){ops.push(floor({at:[-a,14,z],size:[2*a,12],colour:'hull'}),box({at:[-a,15,z],size:[2*a,4,12],colour:'trench',interior:'solid'}));
if(a>3)ops.push(box({at:[-a+3,11,z],size:[2*a-6,3,12],colour:'hull',top:'tile'}));
for(let j=0;j<12;j+=2)ops.push(P('3747b',[-a,11,z+j],'hull',90),P('3747b',[a-3,11,z+j],'hull',270),P('24309',[-a,19,z+j],'hull',90),P('24309',[a-3,19,z+j],'hull',270));
if(a>3)ops.push(box({at:[-a+3,19,z],size:[2*a-6,3,12],colour:'hull',interior:'solid',top:'tile'}));
}else ops.push(box({at:[-1,15,4],size:[2,3,8],colour:'trench',interior:'solid'}),box({at:[-1,19,4],size:[2,3,8],colour:'hull',top:'tile'}),P('60477',[-1,19,0]),P('60477',[0,19,0]));
ops.push(box({at:[-a-3,15,z+10],size:[2*a+6,3,2],colour:'trench',interior:'solid'}),box({at:[-a-1,15,z+4],size:[1,3,6],colour:'trench',interior:'solid'}),box({at:[a,15,z+4],size:[1,3,6],colour:'trench',interior:'solid'}));
for(const s of [-1,1]){const inner=s<0?-a-1:a,mid=s<0?-a-2:a+1,edge=s<0?-a-3:a+2;
if(k<2){if(k)ops.push(P('4162',[inner,19,z+4],'hull',90));ops.push(P('2431',[mid,19,z+8],'hull',90),P('3070b',[edge,19,z+11]));}
else for(let j=4;j<12;j++)for(const x of [inner,j>=8?mid:null,j===11?edge:null]){if(x===null)continue;const zz=z+j,busy=guns.some(g=>x>=g.x&&x<g.x+2&&zz>=g.z&&zz<g.z+2);if(!busy)ops.push(P('3070b',[x,19,zz]));}
if(k)for(const j of [5,8])ops.push(P('2412b',[s<0?-a-1:a-1,16,z+j],'trench',90));
}return ops;}
section('Double wedge hull',range(4).map(hullBand));
section('Ventral docking recess',[box({at:[-2,9,19],size:[4,2,9],colour:'trench',interior:'solid',top:'tile'}),floor({at:[-1,8,20],size:[2,7],colour:'black',top:'tile'}),P('3069b',[-1,7,21],'trans light blue'),P('3069b',[-1,7,25],'trans light blue')]);
function terrace(w,z,end,y){const ops=[box({at:[-w/2,y,z+2],size:[w,3,end-z-2],colour:'hull',top:'tile'})];for(let x=-w/2;x<w/2;x+=2)ops.push(P('3039',[x,y,z]));for(let zz=z+2;zz<end;zz++)ops.push(P('11477',[-w/2,y,zz],'hull',90),P('11477',[w/2-2,y,zz],'hull',270));return ops;}
section('Layered command citadel',[terrace(12,26,46,22),terrace(8,32,45,25),terrace(6,36,44,28),box({at:[-2,31,40],size:[4,7,4],colour:'hull',top:'tile'}),P('3678b',[-2,31,38]),P('3678b',[0,31,38]),P('3957a',[0,31,36],'trench')]);
function battery(g){const {x,z}=g;return [P('4032b',[x,19,z],'trench'),P('3941',[x,20,z]),P('60478',[x,23,z-1],'trench',90),P('60478',[x+1,23,z-1],'trench',90)];}
section('Eight twin turbolasers',guns.map(battery));
function shield(x){return [P('3062b',[x,45,40]),P('20953',[x,48,40]),P('98138',[x,53,40])];}
section('Bridge and shield generators',[floor({at:[-7,38,38],size:[14,6],colour:'hull'}),box({at:[-7,39,38],size:[14,3,6],colour:'hull',top:'tile'}),floor({at:[-6,40,38],size:[12,1],colour:'windows',top:'tile'}),floor({at:[-7,40,39],size:[1,4],colour:'windows',top:'tile'}),floor({at:[6,40,39],size:[1,4],colour:'windows',top:'tile'}),floor({at:[-5,40,43],size:[10,1],colour:'windows',top:'tile'}),box({at:[-7,42,40],size:[14,3,2],colour:'hull',top:'tile'}),range(7).map(i=>[P('15068',[-7+2*i,42,38]),P('15068',[-7+2*i,42,42],'hull',180)]),[-6,-4,2,4].map(x=>P('3660b',[x,35,39])),shield(-6),shield(4),P('3062b',[-1,45,40],'trench'),P('4740',[-1,48,40])]);
section('Seven engine stern',[box({at:[-9,19,46],size:[18,4,2],colour:'trench',interior:'solid',top:'tile'}),floor({at:[-12,23,46],size:[24,5],colour:'hull',top:'tile'}),[-12,-3,6].map(x=>P('43121',[x,14,48],'hull',180)),[-6,-4,2,4].map(x=>P('4229',[x,24,48],'trench',180))]);
section('Deck machinery and armour seams',[...[[ -2,25,30],[1,25,30],[-2,28,33],[1,28,33]].map(at=>P('2412b',at,'trench',90)),P('50943',[-1,25,44],'trench'),P('2431',[-1,22,16],'hull',90),P('2431',[-1,22,20],'hull',90),P('2431',[0,22,18],'hull',90),P('3070b',[0,22,22],'trench')]);