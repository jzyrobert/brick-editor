script({title:'Devastator — The Capture of Tantive IV',description:'A huge armoured Imperial wedge with continuous machinery trenches, eight heavy turbolaser batteries, seven recessed ion engines and twin faceted shield generators. The eleven-engine Tantive IV is suspended beneath the open ventral docking bay. Compact black cradles leave the pointed bow floating over the captured corvette.',palette:{hull:'light bluish grey',machinery:'dark bluish grey',shadow:'black',exhaust:'trans light blue'},defaults:{interior:'empty'}});
const B=26,L=B*6;
const P=(part,x,y,z,colour='hull',turn=0)=>place({part,at:[x,y,z],colour,turn});
const bounds=[0,4,8,12,16,24,32,40,48,56],bayHole=[{at:[-8,42],size:[16,24]}];
const structure=[],upper=[],lower=[],edge=[];
function rib(x,y,z,w,h,d){
 if(h<=0)return [];
 if(z>=42&&z<66&&x<8&&x+w>-8&&y<36){const ops=[];if(x<-8)ops.push(box({at:[x,y,z],size:[-8-x,h,d],colour:'hull'}));if(x+w>8)ops.push(box({at:[8,y,z],size:[x+w-8,h,d],colour:'hull'}));const xx=Math.max(x,-8),ww=Math.min(x+w,8)-xx,yy=Math.max(y,36);if(y+h>yy)ops.push(box({at:[xx,yy,z],size:[ww,y+h-yy,d],colour:'hull'}));return ops;}
 return [box({at:[x,y,z],size:[w,h,d],colour:'hull'})];
}
structure.push(floor({at:[-1,26,0],size:[2,36],layers:1,colour:'hull'}));
for(let b=0;b<B;b++){
 const z=6*b,w=2*(b+1),H=w-2,n=Math.floor(H/8),rem=H%8;
 for(let q=0;q<bounds.length-1&&bounds[q]<H;q++){
  const d=bounds[q],a=Math.min(bounds[q+1],H)-d,base=36+3*Math.floor(d/8),bottom=d<8?33-3*Math.floor(d/4):27;
  for(let s=0;s<2;s++){
   const x=s===0?-w+2+d:w-2-d-a,xx=s===0?x+a-1:x;
   structure.push(floor({at:[x,base-2,z],size:[a,6],layers:2,colour:'hull'}),floor({at:[x,bottom,z],size:[a,6],layers:2,colour:'hull',holes:bayHole}));
   if(b%3===0)structure.push(...rib(xx,bottom+2,z,1,base-bottom-4,6));
  }
 }
 if(H>8)lower.push(floor({at:[-(H-8),24,z],size:[2*(H-8),6],layers:3,colour:'hull',holes:bayHole}));
 for(let d=0;d<Math.min(8,H);d+=4){
  const a=Math.min(4,H-d),yy=30-3*Math.floor(d/4);
  for(let s=0;s<2;s++){
   const x=s===0?-w+2+d:w-2-d-a,turn=s===0?90:270,part=a===4?'13547':'3660b',dz=a===4?1:2;
   for(let k=0;k<6;k+=dz)if(!(z<66&&z+6>42&&x<8&&x+a>-8))lower.push(P(part,x,yy,z+k,'hull',turn));
  }
 }
 for(let j=0;j<n;j++)for(let s=0;s<2;s++){
  const x=s===0?-w+2+8*j:w-10-8*j,yy=36+3*j,turn=s===0?90:270,high=s===0?x+7:x;
  for(let k=0;k<6;k+=2)upper.push(P('42918',x,yy,z+k,'hull',turn));
  if(b>=20&&j===0){for(let k=0;k<6;k+=2)upper.push(P('2412b',high,yy+3,z+k,k===2?'machinery':'hull',90));}
  else upper.push(P('6636',high,yy+3,z,(b+j)%11===0?'machinery':'hull',90));
 }
 const peak=36+3*n;
 if(rem>0)upper.push(floor({at:[-rem,peak,z],size:[2*rem,6],layers:1,colour:'hull',top:'tile'}));
 if(b<2)edge.push(P(b===0?'3710':'3460',-w,33,z+5));
 for(let s=0;s<2;s++){
  const x=s===0?-w:w-2,wing=s===0?'78443':'78444',inv=s===0?'41765':'41764',wedge=s===0?'41748':'41747';
  edge.push(P(inv,x,27,z),P(wing,x,34,z,'machinery'),P(wing,x,35,z),P(wedge,x,36,z));
  if(b>=2)edge.push(P('3666',s===0?x:x-4,33,z+5));
  edge.push(P('3004',x,30,z+5,'machinery'));
  const xx=s===0?x+1:x;
  edge.push(P('4070',xx,30,z+2,'hull',s===0?90:270),P('3062b',xx,30,z+3,'machinery'),P('87087',xx,30,z+4,'hull',s===0?90:270));
 }
}
section('Connected hull ribs and interlocking decks',structure);
section('Curved dorsal armour and panel seams',upper);
section('Bevelled ventral armour',lower);
section('Diagonal rim and machinery trench',edge);
section('Ventral docking bay',[
 box({at:[-10,24,42],size:[2,12,24],colour:'machinery'}),box({at:[8,24,42],size:[2,12,24],colour:'machinery'}),floor({at:[-10,24,40],size:[20,2],layers:2,colour:'hull',top:'tile'}),floor({at:[-10,24,66],size:[20,2],layers:2,colour:'hull',top:'tile'}),floor({at:[-8,35,42],size:[16,24],layers:1,colour:'shadow'}),
 ...range(6).flatMap(i=>[P('2412b',-10,33,43+i*4,'machinery',90),P('2412b',9,33,43+i*4,'machinery',90)]),...range(5).flatMap(i=>[P('3023b',-8,34,44+i*4,'trans light blue',90),P('3023b',7,34,44+i*4,'trans light blue',90)])
]);
function terrace(x,y,z,w,h,d,hole){return [box({at:[x,y,z],size:[w,h+1,d],colour:'hull',open:['top']}),floor({at:[x,y+h-1,z],size:[w,d],layers:1,colour:'hull',top:'tile',holes:hole?[hole]:[]}),...range(w/2).map(i=>P('30363',x+2*i,y+h-3,z-2)),...range(Math.floor((d-4)/4)).flatMap(i=>[P('2412b',x,y+h,z+4+4*i,'machinery',90),P('2412b',x+w-1,y+h,z+4+4*i,'machinery',90)])];}
section('Stepped command citadel',[
 box({at:[-6,39,66],size:[12,10,30],colour:'hull',top:'tile'}),...range(6).map(i=>P('30363',-6+2*i,46,64)),
 ...terrace(-18,44,96,36,16,54,{at:[-12,109],size:[24,36]}),...terrace(-13,60,108,26,9,38,{at:[-8,121],size:[16,23]}),...terrace(-9,69,120,18,8,25,{at:[-5,126],size:[10,9]}),
 box({at:[-6,77,125],size:[12,17,11],colour:'hull',texture:'grille',top:'tile'}),...range(6).map(i=>P('3678b',-6+2*i,77,123)),...range(5).flatMap(i=>[P('3004',-7,79+i*3,128,'machinery',90),P('3004',6,79+i*3,128,'machinery',90)]),...range(4).map(i=>P('2412b',-4+2*i,94,128,'machinery')),
 box({at:[-19,42,94],size:[1,12,50],colour:'hull'}),box({at:[18,42,94],size:[1,12,50],colour:'hull'})
]);
function machineryTray(x,y,z,w,d,variant){const ops=[floor({at:[x,y,z],size:[w,d],layers:1,colour:'machinery'})];for(let zz=1;zz<d-1;zz+=3)for(let xx=1;xx<w-1;xx+=3){const t=(xx+zz+variant)%4;ops.push(P(t===0?'3941':t===1?'4070':t===2?'3004':'2877',x+xx,y+1,z+zz,t===0?'machinery':'hull'));ops.push(P(t===0?'14769':'2412b',x+xx,y+4,z+zz,t===2?'shadow':'hull'));}return ops;}
section('Reactor housings, conduits and service decks',[
 ...machineryTray(-16,60,112,5,30,0),...machineryTray(11,60,109,5,33,1),...machineryTray(-11,69,121,5,20,2),...machineryTray(6,69,123,5,19,3),...machineryTray(-8,77,137,16,7,1),
 ...range(10).flatMap(i=>[P('3004',-19,54,94+5*i,'machinery',90),P('3004',18,54,94+5*i,'machinery',90),P('2412b',-19,57,94+5*i,'hull',90),P('2412b',18,57,94+5*i,'hull',90)]),...range(8).map(i=>P('2877',-8+2*i,49,79,'machinery')),...range(8).map(i=>P('2412b',-8+2*i,52,79,'hull'))
]);
const bridge=[];
bridge.push(box({at:[-20,94,122],size:[40,3,18],colour:'hull',top:'tile'}),box({at:[-18,97,124],size:[36,3,14],colour:'hull'}),box({at:[-20,100,122],size:[40,3,18],colour:'hull'}),floor({at:[-20,103,124],size:[40,14],layers:1,colour:'hull',top:'tile'}));
for(const z of [123,138]){bridge.push(wall({from:[-18,z],to:[17,z],y:97,height:3,colour:'shadow'}));for(let x=-17;x<18;x+=3)bridge.push(P('3005',x,97,z));}
for(const x of [-20,19])bridge.push(wall({from:[x,124],to:[x,137],y:97,height:3,colour:'shadow'}));
for(let x=-20;x<20;x+=2)bridge.push(P('3039',x,101,122),P('15068',x,101,138,'hull',180));
for(let z=124;z<138;z+=2)bridge.push(P('15068',-20,101,z,'hull',90),P('15068',18,101,z,'hull',270));
section('Faceted bridge and continuous observation slit',bridge);
component('shield',{size:[5,5],ops:[column({at:[2,0,2],height:3,diameter:1,colour:'machinery'}),cylinder({at:[0,3,0],diameter:5,height:3,colour:'hull'}),P('30208',0,6,0)]});
section('Shield generators and communications array',[
 instance({component:'shield',at:[-15,104,128]}),instance({component:'shield',at:[10,104,128]}),box({at:[-3,104,130],size:[6,3,4],colour:'hull',top:'tile'}),P('3960',-2,107,130),P('3957a',0,109,131,'machinery'),P('2412b',-5,104,125,'machinery'),P('2412b',3,104,125,'machinery')
]);
component('heavyTurret',{size:[4,8],ops:[cylinder({at:[0,0,4],diameter:4,height:3,colour:'machinery'}),P('30359b',1,3,0,'hull'),P('30359b',2,3,0,'hull')]});
section('Eight twin barrel turbolaser batteries',range(4).flatMap(i=>[-28,24].flatMap(x=>[box({at:[x+1,43,103+12*i],size:[2,7,4],colour:'hull'}),floor({at:[x,50,99+12*i],size:[4,8],layers:1,colour:'hull',top:'tile'}),instance({component:'heavyTurret',at:[x,51,99+12*i]})])));
const spans=[6,10,12,12,12,12,12,10,6],inside=[0,4,8,10,10,10,8,4,0],blue=[0,2,6,8,8,8,6,2,0],nozzle=[];
for(let i=0;i<9;i++){const o=spans[i],a=Math.round((12-o)/2),hole=inside[i],side=Math.round((o-hole)/2),y=3*i;nozzle.push(box({at:[a,y,0],size:[o,3,5],colour:'machinery',interior:'solid'}));if(hole===0)nozzle.push(box({at:[a,y,5],size:[o,3,3],colour:'hull',interior:'solid'}));else{nozzle.push(box({at:[a,y,5],size:[side,3,3],colour:'hull',interior:'solid'}),box({at:[12-a-side,y,5],size:[side,3,3],colour:'hull',interior:'solid'}),box({at:[a+side,y,5],size:[hole,3,1],colour:'shadow',interior:'solid'}));const bw=blue[i];if(bw)nozzle.push(box({at:[Math.round((12-bw)/2),y,6],size:[bw,3,1],colour:'exhaust',interior:'solid'}));}}
for(let x=3;x<9;x++)nozzle.push(P('11477',x,27,5,'hull',180));
component('mainEngine',{size:[12,8],ops:nozzle});
section('Three ion drives and four auxiliary engines',[
 ...[-30,-6,18].map(x=>instance({component:'mainEngine',at:[x,24,L]})),...[-44,-36,34,42].flatMap(x=>[box({at:[x-1,31,L-2],size:[4,3,4],colour:'machinery'}),P('4868b',x,34,L,'hull',180)]),...range(12).flatMap(i=>[P('2877',-12+2*i,33,L-1,'machinery'),P('2412b',-12+2*i,36,L-1,'hull')])
]);
const corvette=[box({at:[4,3,3],size:[4,6,14],colour:'white',top:'tile'}),box({at:[1,3,0],size:[10,3,4],colour:'white',top:'tile'}),wall({from:[2,0],to:[9,0],y:5,height:1,colour:'shadow'}),wall({from:[4,3],to:[4,15],y:6,height:1,colour:'dark red'}),wall({from:[7,3],to:[7,15],y:6,height:1,colour:'dark red'}),box({at:[0,0,16],size:[12,6,3],colour:'white'})];
for(let x=1;x<11;x+=2)corvette.push(P('3039',x,6,0,'white'));
for(let i=0;i<6;i++)corvette.push(P('4868b',2*i,0,16,'white',180));
for(let i=0;i<5;i++)corvette.push(P('4868b',1+2*i,6,16,'white',180));
component('TantiveIV',{size:[12,21],ops:corvette});
section('Captured eleven engine Tantive IV',[cylinder({at:[-1,0,54],diameter:2,height:15,colour:'trans-clear'}),instance({component:'TantiveIV',at:[-6,12,43]})]);
function cradle(z){return [floor({at:[-7,0,z],size:[14,8],layers:2,colour:'shadow',top:'tile'}),box({at:[-1,2,z+2],size:[2,22,4],colour:'shadow'}),P('3678b',-3,2,z+2,'shadow',90),P('3678b',1,2,z+2,'shadow',270)];}
section('Two compact display cradles',[...cradle(78),...cradle(130)]);