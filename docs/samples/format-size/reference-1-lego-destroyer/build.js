script({title:'Opening Shot: Devastator',description:'A broad, knife-edged Imperial Star Destroyer overtakes a tiny Tantive IV beneath its recessed docking bay. Double wedge armour, a dark equatorial trench, three main engines and four auxiliary engines, terraced citadel, twin shield generators and eight twin-barrel batteries define the silhouette.',palette:{hull:'light bluish grey',shadow:'dark bluish grey',void:'black'},defaults:{interior:'empty'}});
const P=(part,at,colour='hull',turn=0)=>place({part,at,colour,turn});
const L=60,N=L/6;
section('Two compact display supports',[
 floor({at:[-6,0,30],size:[12,20],layers:2,colour:'black',top:'tile'}),
 ...[33,44].map(z=>box({at:[-2,2,z],size:[4,13,4],colour:'black',interior:'solid'})),
 floor({at:[-3,0,17],size:[6,6],layers:2,colour:'black',top:'tile'}),
 box({at:[-1,2,18],size:[2,5,3],colour:'black',interior:'solid'})
]);
function hullBand(k){const z=6*k,a=2*k;return [
 k>0&&box({at:[-a,16,z],size:[2*a,7,6],colour:'hull',top:'tile'}),
 P('41765',[-a-2,16,z]),P('41764',[a,16,z]),
 P('3666',[-a-1,19,z],'shadow',90),P('3666',[a,19,z],'shadow',90),
 P('41748',[-a-2,20,z]),P('41747',[a,20,z]),
 k>=3&&box({at:[-a+4,23,z],size:[2*a-8,3,6],colour:'hull',top:'tile'}),
 k>=3&&range(6).map(j=>[P('60477',[-a,23,z+j],'hull',90),P('60477',[a-4,23,z+j],'hull',270)])
];}
section('Dagger hull and docking aperture',[
 floor({at:[-1,15,0],size:[2,L],layers:1,colour:'shadow'}),
 ...range(N).map(hullBand),
 ...[-4,-2,0,2].map(x=>P('30363',[x,23,14])),
 carve({at:[-3,15,18],size:[6,5,12]}),
 floor({at:[-3,20,18],size:[6,12],colour:'black',layers:1}),
 floor({at:[-4,15,17],size:[8,1],colour:'hull'}),
 floor({at:[-4,15,30],size:[8,1],colour:'hull'}),
 ...[-4,3].map(x=>floor({at:[x,15,18],size:[1,12],colour:'hull'}))
]);
function terrace(w,d,z,y){const x=-w/2;return [
 box({at:[x+2,y,z+4],size:[w-4,3,d-4],colour:'hull',top:'tile'}),
 P('43721',[x,y,z]),P('43720',[x+w-2,y,z]),
 ...range(x+2,x+w-2,2).map(a=>P('30363',[a,y,z])),
 ...range(z+4,z+d).map(b=>[P('3040b',[x,y,b],'hull',90),P('3040b',[x+w-2,y,b],'hull',270)])
];}
section('Stepped armoured citadel',[
 ...terrace(20,24,32,26),...terrace(14,18,38,29),...terrace(8,12,44,32),
 box({at:[-3,35,49],size:[6,9,4],colour:'hull',top:'tile'}),
 ...range(-3,3).map(x=>P('4460b',[x,35,47])),
 ...[-5,3].map(x=>P('3660b',[x,41,49],'hull',x<0?90:270)),
 floor({at:[-9,44,46],size:[18,6],layers:1,colour:'hull'}),
 box({at:[-9,45,46],size:[18,4,6],colour:'hull',top:'tile'}),
 ...[-8,-5,-2,1,4,7].map(x=>[P('3069b',[x,46,46],'black'),P('3069b',[x,46,51],'black')]),
 P('3069b',[-9,46,48],'black',90),P('3069b',[8,46,48],'black',90),
 ...range(-9,9,2).map(x=>P('85984',[x,47,46])),
 ...[-7,4].map(x=>[P('3941',[x,49,48]),P('44359',[x,52,48])]),
 P('3004',[-1,49,48]),P('4589',[-1,52,48]),P('3070b',[0,52,48],'shadow')
]);
function battery(x,z){return [P('4032b',[x,26,z],'shadow'),P('3941',[x,27,z]),P('4032b',[x,30,z]),...[0,1].map(dx=>[P('3710',[x+dx,31,z-2],'shadow',90),P('2431',[x+dx,32,z-2],'hull',90)])];}
section('Turbolasers and hull machinery',[
 ...[42,47,52,57].map(z=>[-12,10].map(x=>battery(x,z))),
 ...[24,28].map(z=>[-3,1].map(x=>[P('2412b',[x,26,z],'shadow'),P('3069b',[x,26,z+1])])),
 ...[-12,10].map(x=>[P('2412b',[x,26,54],'shadow'),P('3069b',[x,26,55])]),
 ...[-8,7].map(x=>[P('2412b',[x,29,44],'shadow',90),P('2412b',[x,29,48],'shadow',90)]),
 P('2412b',[-1,32,42],'shadow'),P('2412b',[-1,35,54],'shadow'),
 ...[-10,-3,4].map(x=>P('43121',[x,14,58],'hull',180)),
 ...[-16,-13,11,14].map(x=>P('4868b',[x,17,58],'hull',180))
]);
section('Tantive IV beneath the hangar',[
 floor({at:[-1,7,10],size:[2,13],layers:1,colour:'white'}),
 box({at:[-1,8,12],size:[2,3,5],colour:'white',interior:'solid',top:'tile'}),
 box({at:[-1,8,17],size:[2,3,2],colour:'dark red',interior:'solid',top:'tile'}),
 box({at:[-1,8,19],size:[2,3,4],colour:'white',interior:'solid',top:'tile'}),
 P('15068',[-1,8,10],'white'),
 box({at:[-1,8,13],size:[2,3,2],colour:'white',interior:'solid'}),
 P('15068',[-3,8,13],'white',90),P('15068',[1,8,13],'white',270),
 ...[-3,-1,1].map(x=>P('4868b',[x,6,22],'white',180)),
 P('3069b',[-1,11,15],'dark red'),P('54200',[-1,11,12],'black')
]);