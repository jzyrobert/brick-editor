script({title:"Piplup at the meltwater pool",description:"A bright-eyed Piplup spreads its flippers on an ice floe above a blue meltwater pool. Its oversized hooded head, pale face, yellow bill, paired chest spots and broad yellow feet define the silhouette. A broken glacier frames the back of the shared black display base.",palette:{hood:"dark blue",face:"medium azure",ice:"white",water:"dark azure"}});
const W=32,D=28;
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function brickRow(x,y,z,n,colour){const a=[];while(n>0){const k=n>=2?2:1;a.push(p(k===2?'3004':'3005',x,y,z,colour));x+=k;n-=k;}return a;}
function iceSpan(z){if(z<11||z>25)return null;const cut=z===11||z===25?4:z===12||z===24?2:0;return [8+cut,28-cut];}
section('Connected display foundation',[box({at:[0,0,0],size:[W,4,D],colour:'black',interior:'empty',supports:8}),floor({at:[0,4,0],size:[W,D],colour:'water'})]);
const water=[];const pads=[[6,5,4,2],[20,4,5,2],[7,7,2,1],[22,6,2,1],[3,15,2,1]];
for(let z=0;z<D;z++){const span=iceSpan(z);for(let x=0;x<W;x+=2){if(span&&x<span[1]&&x+2>span[0])continue;const c=z<4?'dark blue':z<11?'dark azure':'blue';const stud=pads.some(r=>x<r[0]+r[2]&&x+2>r[0]&&z>=r[1]&&z<r[1]+r[3]);water.push(p(stud?'3023b':'3069b',x,5,z,c));}}
section('Meltwater surface',water);
const ice=[];for(let z=11;z<=25;z++){const s=iceSpan(z);ice.push(...brickRow(s[0],5,z,s[1]-s[0],'white'));}
section('Chamfered ice floe',ice);
function foot(x){return [p('3020',x,8,8,'yellow'),p('3020',x,8,10,'yellow'),p('3020',x,8,12,'yellow'),...range(4).map(i=>p('61678',x+i,9,8,'yellow')),box({at:[x,9,12],size:[4,3,2],colour:'yellow',interior:'solid'})];}
section('Broad webbed feet',[...foot(12),...foot(20)]);
function sculptureLayer(kind,c,w,d,x,z,y,cap){const cells=new Map();const put=(xx,zz,colour)=>cells.set(xx+','+zz,{x:xx,z:zz,colour});for(let j=0;j<d;j++){const cut=(j===0||j===d-1)?2:((j===1||j===d-2)?1:0);const lo=x+cut,hi=x+w-cut;for(let xx=lo;xx<hi;xx++){if(!cap&&j>=2&&j<d-2&&xx>=lo+2&&xx<hi-2)continue;if(kind==='head'&&c===2&&j===0&&xx>=16&&xx<=19)continue;let colour=kind==='head'?'dark blue':'medium azure';if(kind==='head'&&j<3&&c<6){colour='medium azure';if((xx===17||xx===18)&&c>=4)colour='dark blue';if(j===0&&c>=3&&c<=5&&((xx>=12&&xx<=14)||(xx>=21&&xx<=23))){colour='white';if(c===3&&(xx===14||xx===21))colour='black';if(c===4&&((xx>=13&&xx<=14)||(xx>=21&&xx<=22)))colour='black';if(c===5&&(xx===14||xx===22))colour='black';}if(c===3&&j===0&&xx>=16&&xx<=19)colour='yellow';}
if(kind==='body'){if(c>=4&&j>=d-2)colour='dark blue';if(j===0&&(c===3||c===4)&&((xx>=15&&xx<=16)||(xx>=20&&xx<=21)))colour='white';}put(xx,z+j,colour);}}
if(kind==='body'){const wings={3:[[10,12,15,18],[24,26,15,18]],4:[[8,12,15,18],[24,28,15,18]],5:[[8,10,16,18],[26,29,16,18]]};for(const r of wings[c]||[]){for(let xx=r[0];xx<r[1];xx++)for(let zz=r[2];zz<r[3];zz++)put(xx,zz,'medium azure');}}
const out=[];const order=[...cells.values()].sort((a,b)=>a.z-b.z||a.x-b.x);const done=new Set();for(const v of order){const key=v.x+','+v.z;if(done.has(key))continue;const next=cells.get((v.x+1)+','+v.z);if(next&&next.colour===v.colour&&!done.has((v.x+1)+','+v.z)){out.push(p('3004',v.x,y,v.z,v.colour));done.add((v.x+1)+','+v.z);}else out.push(p('3005',v.x,y,v.z,v.colour));done.add(key);}return out;}
const body=[];const bodyDims=[[8,6],[10,8],[12,9],[12,9],[12,9],[10,8],[8,6]];bodyDims.forEach(([w,d],c)=>body.push(...sculptureLayer('body',c,w,d,18-Math.round(w/2),17-Math.round(d/2),12+c*3,c===0||c===6)));
body.push(p('15068',8,30,16,'medium azure',90),p('15068',27,30,16,'medium azure',270));
section('Piplup body and expressive flippers',body);
const head=[];const headDims=[[12,8],[14,10],[16,12],[16,12],[16,12],[16,12],[14,10],[12,8]];headDims.forEach(([w,d],c)=>head.push(...sculptureLayer('head',c,w,d,18-Math.round(w/2),16-Math.round(d/2),33+c*3,c===0||c===7)));
head.push(p('3660b',16,39,9,'yellow'),p('3660b',18,39,9,'yellow'),p('15068',16,42,8,'yellow'),p('15068',18,42,8,'yellow'));
for(let x=14;x<22;x+=2){head.push(p('15068',x,57,12,'dark blue'));head.push(p('15068',x,57,18,'dark blue',180));}
head.push(floor({at:[14,57,14],size:[8,4],colour:'dark blue',top:'tile'}));
section('Oversized hooded head and bill',head);
function glacier(x,z,w,d,h){const ops=[box({at:[x,6,z],size:[w,h,d],colour:'white',interior:'empty'}),box({at:[x+1,6+h,z+1],size:[w-2,3,d-2],colour:'white',interior:'solid'})];for(let xx=x;xx<x+w;xx+=2)ops.push(p('3039',xx,6+h,z,'white'));return ops;}
section('Broken glacier backdrop',[...glacier(1,21,6,6,9),...glacier(25,22,6,4,6),p('3039',2,18,23,'white',90),p('3039',4,18,23,'white',270)]);
function wave(x,z,n){return range(n).map(i=>p('11477',x+i,6,z,'trans light blue'));}
section('Pool ripples and snow highlights',[...wave(6,5,4),...wave(20,4,5),p('3069b',7,6,7,'white'),p('3069b',22,6,6,'white'),p('3069b',3,6,15,'white'),p('3068b',10,8,20,'white'),p('3068b',23,8,21,'white'),p('3068b',17,8,23,'white')]);