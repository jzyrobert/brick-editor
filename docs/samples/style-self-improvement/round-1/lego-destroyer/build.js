script({title:'Imperial Star Destroyer — The Capture',description:'A monumental Imperial dagger with faceted armor, recessed machinery trenches, eight twin turbolasers, a T-shaped command bridge and twin shield generators. Seven glowing ion engines dominate the stern. Beneath its ventral hangar, an eleven-engine blockade runner is being drawn aboard.',palette:{hull:'light bluish grey',shadow:'dark bluish grey',glow:'trans light blue'},defaults:{interior:'empty'}});
const L=144,S=6,N=L/S;
const radius=z=>2*(Math.floor(z/S)+1);
const deck=(x,z)=>54+3*Math.min(5,Math.floor((radius(z)-Math.abs(x))/8));
const hangar=(x,z,w,d)=>x<8&&x+w>-8&&z<102&&z+d>78;
const guns=[100,110,120,130];
const gunFoot=(x,z,w,d)=>guns.some(t=>z<t+4&&z+d>t&&[-21,21].some(c=>x<c+2&&x+w>c-2));
const bodyRadius=z=>z>=84&&z<132?[10,12,14,16,16,16][Math.floor((z-84)/8)]:0;
const buried=(x,z,w)=>{const r=Math.min(bodyRadius(z),bodyRadius(z+5));return r>0&&x>=-r&&x+w<=r;};
function pillar(x,y,z,h){const ops=[];for(const [height,part] of [[15,'2454b'],[9,'22886'],[6,'3245c'],[3,'3004'],[1,'3023b']])while(h>=height){ops.push(place({part,at:[x,y,z],colour:'hull'}));y+=height;h-=height;}return ops;}
const cradle=[floor({at:[-10,0,48],size:[20,82],colour:'black'}),box({at:[-4,2,54],size:[8,33,8],colour:'black'}),box({at:[-3,2,122],size:[6,24,8],colour:'black'})];
for(let x=-10;x<8;x+=6)for(let z=48;z<126;z+=6)cradle.push(place({part:'10202',at:[x,1,z],colour:'black'}));
for(let z=48;z<128;z+=4)cradle.push(place({part:'87079',at:[8,1,z],turn:90,colour:'black'}));
cradle.push(place({part:'3068b',at:[8,1,128],colour:'black'}));
for(let x=-10;x<6;x+=4)for(const z of [126,128])cradle.push(place({part:'87079',at:[x,1,z],colour:'black'}));
for(const z of [126,128])cradle.push(place({part:'3068b',at:[6,1,z],colour:'black'}));
section('Compact exhibition cradle',cradle);
const frame=[box({at:[-2,42,0],size:[4,9,L],colour:'hull',interior:'solid'})],skin=[];
for(let i=0;i<N;i++){
 const z=i*S,r=2*(i+1);
 frame.push(floor({at:[-r,51,z+2],size:[2*r,2],colour:'hull'}));
 for(let k=0;k<=5;k++){
  const a=r-8*k;if(a<=0)continue;
  const bands=a<=8?[[-a,2*a]]:[[-a,8],[a-8,8]];
  for(const [bx,bw] of bands)for(let offset=0;offset<bw;offset+=8){
   const x=bx+offset,w=Math.min(8,bw-offset),up=52+3*k,lo=41-3*k;
   const px=Math.max(-r+1,Math.min(x+Math.min(3,w-2),r-3)),pz=z+2;
   const hidden=k>=2&&buried(x,z,w);
   if(k>0&&!hidden)skin.push(place({part:w===8?'3460':'3710',at:[x,up-1,z+2],colour:'hull'}));
   if(!hangar(x,z+2,w,1))skin.push(place({part:w===8?'3460':'3710',at:[x,lo+1,z+2],colour:'hull'}));
   if(hangar(px,pz,2,1))frame.push(...pillar(px,40,pz,11));
   else frame.push(...pillar(px,lo+2,pz,2),...pillar(px,lo+4,pz,6+3*k));
   if(k>0&&!hidden)frame.push(...pillar(px,52,pz,3*k-1));
   if(!hangar(x,z,w,6))skin.push(floor({at:[x,lo,z],size:[w,6],colour:'hull'}));
   else for(let dx=0;dx<w;dx+=4)if(!hangar(x+dx,z,4,6))skin.push(place({part:'3032',at:[x+dx,lo,z],turn:90,colour:'hull'}));
   for(let dx=0;dx<w;dx+=4){
    const xx=x+dx;
    if(k>=2&&buried(xx,z,4))continue;
    skin.push(place({part:'3032',at:[xx,up,z],turn:90,colour:'hull'}));
    skin.push(place({part:'1751',at:[xx,up+1,z],colour:'hull'}),place({part:'87079',at:[xx,up+1,z+4],colour:'hull'}));
   }
  }
 }
}
for(const z of guns)for(const cx of [-21,21])frame.push(box({at:[cx-2,51,z],size:[4,deck(cx,z)+3-51,4],colour:'hull'}));
for(const z of [92,110,128])for(const x of [-4,2])frame.push(...pillar(x,52,z,20));
section('Keel, transverse beams and connected armor supports',frame);
section('Laminated plate and tile armor',skin);
const bevel=[];
for(let i=0;i<N;i++){
 const z=i*S,r=2*(i+1);
 for(let k=0;k<5;k++){
  const a=r-8*k;if(a<=8)continue;
  for(let j=0;j<3;j++)for(const side of [-1,1]){
   const zz=z+2*j,x=side<0?-a+4:a-8;
   if(!gunFoot(x,zz,4,2)&&!(k>=2&&buried(x,z,4)))bevel.push(place({part:'30363',at:[x,54+3*k,zz],turn:side<0?90:270,colour:'hull'}));
   const bx=side<0?-a+5:a-8;
   if(!hangar(bx,zz,3,2))bevel.push(place({part:'3747b',at:[bx,38-3*k,zz],turn:side<0?90:270,colour:'hull'}));
  }
 }
}
section('Shallow dorsal facets and inverted ventral chines',bevel);
const trench=[];
for(let i=1;i<N;i++){
 const z=i*S,r=2*(i+1);
 for(const side of [-1,1]){
  const x=side<0?-r:r-1;
  for(let j=0;j<3;j++){
   const zz=z+2*j;
   if(j===1)trench.push(place({part:'3023b',at:[x,43,zz],turn:90,colour:'shadow'}),place({part:'3023b',at:[x,44,zz],turn:90,colour:'hull'}));
   else trench.push(place({part:(i+j)%4===0?'3700':'2877',at:[x,42,zz],turn:90,colour:(i+j)%5===0?'light bluish grey':'dark bluish grey'}));
   trench.push(place({part:(i+j)%3===0?'3004':'2877',at:[x,45,zz],turn:90,colour:(i+j)%3===0?'black':'light bluish grey'}));
  }
  trench.push(place({part:'3009',at:[x,48,z],turn:90,colour:'hull'}));
 }
}
section('Exposed perimeter machinery and armored edge beams',trench);
const panels=[];
for(let i=1;i<N;i++){
 if(i%2===1)continue;
 const z=i*S,r=2*(i+1);
 for(let k=0;k<=5;k++){
  const a=r-8*k;if(a<4)continue;
  for(const side of [-1,1]){
   const x=side<0?-a+1:a-3,y=54+3*k;
   if(z>=78&&Math.abs(x)<19)continue;
   if(z>=96&&Math.abs(x)>=18&&Math.abs(x)<=23)continue;
   const h=(i*7+k*3+(side>0?1:0))%5;
   if(h===0)panels.push(place({part:'3020',at:[x,y,z+1],turn:90,colour:'hull'}),place({part:'2412b',at:[x,y+1,z+2],turn:90,colour:'shadow'}),place({part:'3069b',at:[x+1,y+1,z+2],turn:90,colour:'hull'}));
   else if(h===1)panels.push(place({part:'6636',at:[x,y,z],turn:90,colour:'shadow'}));
   else{panels.push(place({part:'3068b',at:[x,y,z+2],colour:h===2?'shadow':'hull'}));if(h===3)panels.push(place({part:'3070b',at:[x+1,y,z+5],colour:'hull'}));}
  }
 }
}
section('Panel seams, ventilation covers and service patches',panels);
const terraces=[];
const terrace=(start,y,height,radii)=>radii.flatMap((r,i)=>[box({at:[-r,y,start+8*i],size:[2*r,height,8],colour:'hull',open:['top']}),floor({at:[-r,y+height-2,start+8*i],size:[2*r,8],layers:2,colour:'hull',top:'tile'}),...[-1,1].flatMap(side=>{const x=side<0?-r+1:r-3;return[place({part:'3022',at:[x,y+height,start+8*i+4],colour:'hull'}),place({part:'2412b',at:[x,y+height+1,start+8*i+4],colour:'shadow'}),place({part:'3069b',at:[x,y+height+1,start+8*i+5],colour:'hull'})];})]);
terraces.push(...terrace(84,57,17,[10,12,14,16,16,16]),...terrace(96,74,7,[6,8,10,12,12]),box({at:[-8,81,110],size:[16,7,28],colour:'hull',open:['top']}),floor({at:[-8,86,110],size:[16,28],layers:2,colour:'hull',top:'tile'}));
for(const [z,y,w] of [[84,71,20],[96,78,12],[110,85,16]])for(let x=-w/2;x<w/2;x+=2)terraces.push(place({part:'30363',at:[x,y,z],colour:'hull'}));
for(let z=112;z<136;z+=4)for(const x of [-7,6])terraces.push(place({part:'2412b',at:[x,88,z],turn:90,colour:'shadow'}));
for(let z=92;z<132;z+=8)for(const side of [-1,1]){const r=[10,12,14,16,16,16][Math.floor((z-84)/8)];terraces.push(place({part:'2877',at:[side<0?-r:r-1,68,z],turn:90,colour:'shadow'}));}
section('Ascending command superstructure',terraces);
const bridge=[box({at:[-5,88,120],size:[10,14,10],colour:'hull'}),box({at:[-8,96,120],size:[16,6,10],colour:'hull'}),box({at:[-16,102,118],size:[32,9,10],colour:'hull'}),box({at:[-14,111,119],size:[28,2,8],colour:'hull',top:'tile'}),...range(16).map(i=>place({part:'3004',at:[-16+2*i,105,118],colour:'black'})),...range(8).map(i=>place({part:'3004',at:[-8+2*i,105,127],colour:'black'})),...range(4).flatMap(i=>[place({part:'3039',at:[-16,108,120+2*i],turn:90,colour:'hull'}),place({part:'3039',at:[14,108,120+2*i],turn:270,colour:'hull'})]),...range(14).map(i=>place({part:'30363',at:[-14+2*i,111,118],colour:'hull'})),place({part:'3957a',at:[0,88,135],colour:'light bluish grey'}),place({part:'3062b',at:[-1,88,132],colour:'shadow'}),place({part:'4589',at:[-1,91,132],colour:'hull'})];
const shield=cx=>[place({part:'3031',at:[cx-2,113,122],colour:'hull'}),place({part:'3941',at:[cx-1,114,123],colour:'hull'}),place({part:'3941',at:[cx-1,117,123],colour:'hull'}),place({part:'3960',at:[cx-2,120,122],colour:'hull'}),place({part:'30208',at:[cx-2,122,122],colour:'hull'})];
bridge.push(...shield(-10),...shield(10));
for(const x of [-5,4])for(const y of [90,93])bridge.push(place({part:'2877',at:[x,y,120],turn:90,colour:'shadow'}));
section('T bridge, observation slit and twin shield generators',bridge);
const turret=(cx,z)=>{const y=deck(cx,z)+3,x=cx-2;return[place({part:'60474',at:[x,y,z],colour:'shadow'}),place({part:'3941',at:[cx-1,y+1,z+1],colour:'hull'}),place({part:'4032b',at:[cx-1,y+4,z+1],colour:'hull'}),place({part:'15068',at:[cx-1,y+5,z+1],turn:180,colour:'hull'}),...[-1,0].flatMap(dx=>[place({part:'3666',at:[cx+dx,y+8,z-4],turn:90,colour:'hull'}),place({part:'3070b',at:[cx+dx,y+9,z-4],colour:'black'}),place({part:'2431',at:[cx+dx,y+9,z-3],turn:90,colour:'hull'})])];};
section('Eight twin barrel heavy turbolasers',guns.flatMap(z=>[-21,21].flatMap(x=>turret(x,z))));
const engines=[];
function engine(cx,bottom,w,rows){
 const zone=(u,v)=>{const a=(2*u+1-w)/w,b=(2*v+1-rows)/rows,q=a*a+b*b;return q>1?-1:q>.82?3:q>.68?2:q>.38?1:0;};
 const colours=['trans light blue','medium azure','dark bluish grey','light bluish grey'];
 for(let u=0;u<w;u++){
  let first=-1,last=-1;
  for(let v=0;v<rows;v++)if(zone(u,v)>=0){if(first<0)first=v;last=v;}
  if(first>=0)engines.push(box({at:[cx-Math.floor(w/2)+u,bottom+3*first,142],size:[1,3*(last-first+1),3],colour:'shadow',interior:'solid'}));
 }
 for(let v=0;v<rows;v++)for(let u=0;u<w;){
  const band=zone(u,v);if(band<0){u++;continue;}
  const pair=u+1<w&&zone(u+1,v)===band,edge=band>=2;
  engines.push(place({part:pair?(edge?'3003':'3004'):(edge?'3004':'3005'),at:[cx-Math.floor(w/2)+u,bottom+3*v,145],turn:!pair&&edge?90:0,colour:colours[band]}));
  u+=pair?2:1;
 }
}
engine(-28,33,12,10);engine(0,30,14,12);engine(28,33,12,10);engine(-40,48,6,5);engine(-14,63,6,5);engine(14,63,6,5);engine(40,48,6,5);
for(const cx of [-28,0,28])for(const dx of [-3,2])engines.push(place({part:'2412b',at:[cx+dx,66,142],turn:90,colour:'hull'}));
section('Seven glowing ion engines and stepped nozzle collars',engines);
section('Open tractor beam hangar',[floor({at:[-8,39,78],size:[16,24],colour:'black'}),box({at:[-8,27,78],size:[1,12,24],colour:'shadow',interior:'solid'}),box({at:[7,27,78],size:[1,12,24],colour:'shadow',interior:'solid'}),box({at:[-8,30,78],size:[16,3,1],colour:'hull',interior:'solid'}),box({at:[-8,30,101],size:[16,3,1],colour:'hull',interior:'solid'}),...[82,86,90,94,98].flatMap(z=>[-8,7].map(x=>place({part:'3005',at:[x,30,z],colour:'trans light blue'}))),...range(4).map(i=>place({part:'3003',at:[-1,26+3*i,88],colour:'trans-clear'})),place({part:'3022',at:[-1,38,88],colour:'trans-clear'})]);
section('Captured eleven engine blockade runner',[box({at:[-2,20,79],size:[4,6,18],colour:'white',top:'tile'}),box({at:[-1,21,74],size:[2,4,8],colour:'white'}),box({at:[-5,21,71],size:[10,5,4],colour:'white',top:'tile'}),box({at:[-5,23,72],size:[10,1,2],colour:'dark red'}),box({at:[-5,17,94],size:[10,10,5],colour:'white',top:'tile'}),...[[-2,18],[0,18],[2,18],[-4,21],[-2,21],[0,21],[2,21],[4,21],[-2,24],[0,24],[2,24]].map(([x,y])=>place({part:'3005',at:[x,y,98],colour:'trans light blue'})),...[80,84,92].map(z=>place({part:'3069b',at:[-1,26,z],colour:'dark red'})),place({part:'3069b',at:[-1,26,71],colour:'black'}),place({part:'3039',at:[-1,27,94],colour:'white'})]);