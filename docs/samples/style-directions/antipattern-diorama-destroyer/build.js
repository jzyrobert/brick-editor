script({title:'Imperial Star Destroyer — Kuat departure',description:'A dagger-shaped Imperial Star Destroyer rises above an orbital drydock while two TIE escorts emerge beneath its open ventral hangar. Eight heavy batteries, sloped armour, a recessed hull trench, triangular command terraces, the broad T bridge, twin shield generators and seven blue aft exhausts define the warship.',palette:{hull:'light bluish grey',shadow:'dark bluish grey',void:'black',drive:'trans light blue'}});
const C=56,N=60,Z=10,Y=33;
const half=r=>1+Math.floor(r*38/(N-1));
function strip(x,y,z,w,colour,tile=false){const a=[];while(w>0){const n=!tile&&w>=8?8:w>=4?4:w>=2?2:1;a.push(place({part:tile?(n===4?'87079':n===2?'3068b':'3069b'):(n===8?'3034':n===4?'3020':n===2?'3022':'3023b'),at:[x,y,z],colour,turn:n===1?90:0}));x+=n;w-=n;}return a;}
const gunPlots=[[41,82],[36,94],[32,106],[28,118]];
const guns=gunPlots.flatMap(([x,z])=>[[x,z],[2*C-x-4,z]]);
const vents=[[37,111],[71,111]];
function tierHalf(z,start,end,max){return z>=start&&z<end?2+Math.floor((z-start)*(max-2)/(end-start-2)):0;}
function occupied(x,z){const h=tierHalf(z,62,120,18);return (h&&x>=C-h&&x<C+h)||guns.some(([gx,gz])=>x<gx+4&&x+4>gx&&z<gz+4&&z+2>gz)||vents.some(([vx,vz])=>x<vx+4&&x+4>vx&&z<vz+6&&z+2>vz);}
section('Connected orbital drydock',[
 floor({at:[0,0,0],size:[112,144],layers:2,colour:'black'}),
 ...[[0,0,112,2],[0,142,112,2],[0,2,2,140],[110,2,2,140]].map(([x,z,w,d])=>floor({at:[x,2,z],size:[w,d],colour:'dark bluish grey',top:'tile'})),
 ...[4,100].map(x=>floor({at:[x,2,40],size:[8,88],layers:2,colour:'dark bluish grey',top:'tile'})),
 floor({at:[12,2,136],size:[88,4],layers:2,colour:'dark bluish grey',top:'tile'}),
 floor({at:[36,2,98],size:[40,10],colour:'dark bluish grey',top:'tile'}),
 ...[44,106].flatMap(z=>[48,60].map(x=>column({at:[x,2,z],height:31,diameter:4,colour:'black'})))
]);
function dockArm(x,z,right){const beamX=right?68:8;return [column({at:[x,4,z],height:21,diameter:2,colour:'dark bluish grey'}),box({at:[beamX,22,z],size:[36,3,2],colour:'light bluish grey',interior:'solid'}),floor({at:[beamX,25,z],size:[36,2],colour:'dark bluish grey'}),...range(6).map(i=>place({part:'3069b',at:[right?96-i*4:12+i*4,26,z],colour:i%2?'black':'yellow'})),place({part:'6141',at:[x,26,z],colour:'trans red'})];}
section('Dock service arms',[...[64,104].flatMap(z=>[dockArm(8,z,false),dockArm(102,z,true)]),...range(18).flatMap(i=>[4,106].map(x=>place({part:'3069b',at:[x,4,44+i*4],colour:i%3===0?'trans light blue':'light bluish grey',turn:90}))),...[16,92].map(x=>box({at:[x,4,136],size:[4,9,4],colour:'dark bluish grey',texture:'grille',interior:'solid'}))]);
const lower=[],upper=[],edges=[],ribs=[];
for(let r=0;r<N;r++){
 const h=half(r),x=C-h,z=Z+2*r,w=2*h;
 if(z>=62&&z<80)lower.push(...strip(x,Y,z,52-x,'hull'),...strip(60,Y,z,C+h-60,'hull'));
 else lower.push(...strip(x,Y,z,w,'hull'));
 upper.push(...strip(x,41,z,w,'hull'),...strip(x,42,z,w,'hull'));
 if(h>=5){
  upper.push(floor({at:[x+4,43,z],size:[w-8,2],layers:2,colour:'hull'}));
  let xx=x+4,ww=w-8;
  while(ww>0){const n=ww>=4?4:ww>=2?2:1;upper.push(place({part:occupied(xx,z)?(n===4?'3020':n===2?'3022':'3023b'):(n===4?'87079':n===2?'3068b':'3069b'),at:[xx,45,z],colour:'hull',turn:n===1?90:0}));xx+=n;ww-=n;}
  edges.push(place({part:'30363',at:[x,43,z],colour:'hull',turn:90}),place({part:'30363',at:[C+h-4,43,z],colour:'hull',turn:270}));
 }else upper.push(...strip(x,43,z,w,'hull',true));
 if(h>=3)for(const xx of [x,C+h-1])edges.push(place({part:'2877',at:[xx,34,z],colour:r%7===0?'light bluish grey':'dark bluish grey',turn:90}),place({part:'2877',at:[xx,37,z],colour:'light bluish grey',turn:90}),place({part:'3023b',at:[xx,40,z],colour:'hull',turn:90}));
 if(r%5===0&&h>=5)ribs.push(box({at:[x+1,34,z],size:[w-2,7,2],colour:'dark bluish grey',interior:'solid'}));
}
ribs.push(box({at:[52,34,24],size:[8,7,104],colour:'dark bluish grey',interior:'solid'}),carve({at:[52,34,62],size:[8,6,18]}));
section('Lower triangular hull',lower);
section('Internal keel and cross frames',ribs);
section('Upper dagger hull',upper);
section('Sloped armour and recessed flank trench',edges);
function terrace(start,end,max,y,height){const a=[];for(let z=start;z<end;z+=2){const h=tierHalf(z,start,end,max);a.push(box({at:[C-h,y,z],size:[2*h,height,2],colour:'hull',interior:'empty',top:'tile'}));}return a;}
section('Triangular command terraces',[terrace(62,120,18,46,6),terrace(80,118,13,52,9),terrace(96,116,8,61,9),box({at:[52,70,106],size:[8,18,8],colour:'hull',texture:'grille',interior:'empty'}),...range(4).map(i=>place({part:'2412b',at:[55,88,106+i*2],colour:'dark bluish grey'}))]);
function bridgeBand(y,height,colour){return range(4).map(r=>{const widths=[24,32,32,24],w=widths[r];return box({at:[C-Math.round(w/2),y,108+2*r],size:[w,height,2],colour,interior:'solid'});});}
function shield(x){return [cylinder({at:[x,98,110],diameter:6,height:3,colour:'hull'}),dome({at:[x,101,110],diameter:6,colour:'hull'})];}
section('Wide T bridge and twin shield generators',[bridgeBand(88,3,'hull'),bridgeBand(91,1,'black'),bridgeBand(92,6,'hull'),shield(43),shield(63),box({at:[55,98,115],size:[2,12,2],colour:'light bluish grey',interior:'solid'}),place({part:'3957a',at:[55,110,115],colour:'light bluish grey'}),...range(10).map(i=>place({part:'3069b',at:[46+i*2,98,109],colour:i%3===0?'dark bluish grey':'light bluish grey'}))]);
function battery(x,z){return [box({at:[x,46,z],size:[4,3,4],colour:'dark bluish grey',interior:'solid'}),box({at:[x,49,z+1],size:[4,3,2],colour:'hull',interior:'solid'}),...[0,3].map(dx=>box({at:[x+dx,50,z-5],size:[1,2,7],colour:'dark bluish grey',interior:'solid'})),place({part:'3068b',at:[x+1,52,z+1],colour:'hull'})];}
section('Eight heavy turbolaser batteries',guns.map(([x,z])=>battery(x,z)));
function exhaust(x,y,big){const widths=big?[4,6,8,8,6,4]:[2,4,2],max=big?8:4,a=[];widths.forEach((w,r)=>{const left=x+Math.round((max-w)/2);for(let j=0;j<w;j++){const shell=r===0||r===widths.length-1||j===0||j===w-1;a.push(box({at:[left+j,y+3*r,128],size:[1,3,6],colour:shell?'dark bluish grey':'black',interior:'solid'}),place({part:'3005',at:[left+j,y+3*r,134],colour:shell?'hull':'drive'}));}});return a;}
section('Seven illuminated aft engine bells',[...[25,52,79].map(x=>exhaust(x,30,true)),...[42,68].flatMap(x=>[exhaust(x,48,false),exhaust(x,27,false)]),box({at:[39,42,125],size:[6,9,3],colour:'hull',interior:'solid'}),box({at:[67,42,125],size:[6,9,3],colour:'hull',interior:'solid'})]);
function vent(x,z){return [floor({at:[x,46,z],size:[4,6],colour:'dark bluish grey'}),...range(6).map(i=>place({part:'2412b',at:[x,47,z+i],colour:'light bluish grey'})),...range(6).map(i=>place({part:'2412b',at:[x+2,47,z+i],colour:'light bluish grey'}))];}
section('Concentrated aft engineering details',[...vents.map(([x,z])=>vent(x,z)),...range(8).flatMap(i=>[place({part:'3069b',at:[46,58,96+i*2],colour:'light bluish grey'}),place({part:'3069b',at:[64,58,96+i*2],colour:'light bluish grey'})])]);
section('Open ventral launch bay',[floor({at:[52,40,62],size:[8,18],colour:'black'}),...[51,60].map(x=>box({at:[x,34,62],size:[1,6,18],colour:'dark bluish grey',interior:'solid'})),...range(8).flatMap(i=>[53,58].map(x=>place({part:'6141',at:[x,39,64+i*2],colour:'trans light blue'})))]);
function tie(){return [...[0,7].flatMap(x=>[box({at:[x,0,0],size:[1,9,6],colour:'black',interior:'solid'}),floor({at:[x,0,0],size:[1,6],colour:'light bluish grey'}),floor({at:[x,8,0],size:[1,6],colour:'light bluish grey'})]),floor({at:[0,2,2],size:[8,2],colour:'light bluish grey'}),place({part:'3941',at:[3,3,2],colour:'light bluish grey'}),dome({at:[3,6,2],diameter:2,colour:'light bluish grey'}),box({at:[3,3,1],size:[2,3,1],colour:'black',interior:'solid'})];}
component('TIE escort',{size:[8,6],ops:tie()});
section('Escorts emerging beneath the prow',[column({at:[55,2,46],height:17,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[52,16,44]}),column({at:[68,2,31],height:11,diameter:1,colour:'trans-clear'}),instance({component:'TIE escort',at:[65,10,29]})]);