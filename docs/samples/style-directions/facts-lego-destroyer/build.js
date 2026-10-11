script({title:"Devastator — The Capture of Tantive IV",description:"A 144-stud Imperial-class destroyer with a razor-edged armored wedge, recessed machinery trenches, eight twin turbolasers, seven aft engines and the unmistakable T bridge with twin shield globes. The tiny Tantive IV hangs in its tractor beam beneath the illuminated ventral docking bay.",palette:{hull:"light bluish grey",machinery:"dark bluish grey",shadow:"black",glow:"trans light blue"},defaults:{interior:"empty"}});
const p=(part,x,y,z,colour="light bluish grey",turn=0)=>place({part,at:[x,y,z],colour,turn});
const decks=[{w:16,z:72,d:12,top:62},{w:24,z:84,d:12,top:68},{w:32,z:96,d:12,top:74},{w:40,z:108,d:36,top:80}];
const guns=[];for(let j=8;j<12;j++)for(const x of [-25,21])guns.push({x,z:j*12+6,y:38+3*(j-6)});
const intersects=(x,z,w,d,a)=>x<a.x+a.w&&x+w>a.x&&z<a.z+a.d&&z+d>a.z;
const blocked=(x,z,w,d,y)=>decks.some(a=>y+4>a.top-18&&intersects(x,z,w,d,{x:-a.w/2,z:a.z,w:a.w,d:a.d}))||guns.some(a=>intersects(x,z,w,d,{x:a.x,z:a.z,w:4,d:4}));
section("Two discreet flight cradles",[...[[82,22],[128,28]].flatMap(([z,w])=>[box({at:[-w/2,0,z-4],size:[w,3,16],colour:"black",top:"tile"}),box({at:[-4,3,z],size:[8,21,8],colour:"black",interior:"solid"})])]);
const keel=[],trench=[],armor=[];
for(let j=0;j<12;j++){
 const z=j*12,h=4*(j+1);
 keel.push(floor({at:[-h+2,29,z],size:[2*h-4,12],colour:"light bluish grey"}),floor({at:[-h+3,37,z],size:[2*h-6,12],colour:"light bluish grey"}));
 if(h>6)keel.push(box({at:[-h+5,24,z],size:[2*h-10,5,12],colour:"light bluish grey"}));
 for(const xx of [-h+3,h-4])keel.push(wall({from:[xx,z],to:[xx,z+11],y:30,height:7,colour:"dark bluish grey"}));
 for(const side of [-1,1]){
  const wx=side<0?-h:h-3,tx=side<0?-h+2:h-3;
  trench.push(p(side<0?"47397":"47398",wx,30,z),p(side<0?"47397":"47398",wx,37,z));
  for(let q=0;q<6;q++)for(let r=0;r<2;r++)trench.push(p((q+j+r)%3===0?"3700":"2877",tx,31+r*3,z+2*q,(q+j)%4===0?"black":"dark bluish grey",90));
  for(let k=0;k<j;k++){
   const x=side<0?-(4*j+1-4*k):4*j-3-4*k,y=38+3*k,highX=side<0?x+3:x;
   const live=range(12).map(t=>!blocked(x,z+t,4,1,y));
   if(live.some(Boolean)){
    armor.push(wall({from:[highX,z],to:[highX,z+11],y:30,height:y-30,colour:"light bluish grey"}),floor({at:[x,y-1,z],size:[4,12],colour:"light bluish grey"}));
    for(let t=0;t<12;t+=2){if(live[t]&&live[t+1])armor.push(p("30363",x,y,z+t,"light bluish grey",side<0?90:270));else for(let a=t;a<t+2;a++)if(live[a])armor.push(p("60477",x,y,z+a,"light bluish grey",side<0?90:270));}
    for(let t=0;t<12;t+=4){if(live.slice(t,t+4).every(Boolean))armor.push(p("2431",highX,y+3,z+t,"light bluish grey",90));else for(let a=t;a<t+4;a++)if(live[a])armor.push(p("3070b",highX,y+3,z+a));}
   }
  }
 }
 if(j===0)armor.push(floor({at:[-1,37,z],size:[2,12],colour:"light bluish grey",top:"tile"}));
 else if(!blocked(-1,z,2,12,35+3*j))armor.push(box({at:[-1,30,z],size:[2,5+3*j,12],colour:"light bluish grey"}),p("30363",-1,35+3*j,z),floor({at:[-1,37+3*j,z+4],size:[2,8],colour:"light bluish grey",top:"tile"}));
}
section("Connected ventral hull and keel",keel);
section("Layered diagonal rims and recessed service trenches",trench);
section("Individually shaped upper armor panels",armor);
const dorsal=[];
for(const a of decks){
 dorsal.push(box({at:[-3,30,a.z+2],size:[6,a.top-48,a.d-4],colour:"light bluish grey"}),box({at:[-a.w/2,a.top-18,a.z],size:[a.w,18,a.d],colour:"light bluish grey",top:"tile"}));
 for(const side of [-1,1])for(let z=a.z;z<a.z+a.d;z+=4)dorsal.push(p("3039",side<0?-a.w/2:a.w/2-2,a.top-3,z,"light bluish grey",side<0?90:270));
 for(let x=-a.w/2+2;x<a.w/2-2;x+=4)dorsal.push(p("2412b",x,a.top,a.z+2,"dark bluish grey"),p("3069b",x,a.top,a.z+5));
 for(const side of [-1,1])for(let z=a.z+2;z<a.z+a.d-2;z+=4)dorsal.push(p("2877",side<0?-a.w/2:a.w/2-1,a.top-6,z,"dark bluish grey",90));
}
dorsal.push(box({at:[-12,80,104],size:[24,9,34],colour:"light bluish grey",top:"tile"}),box({at:[-8,89,112],size:[16,9,24],colour:"light bluish grey",top:"tile"}),box({at:[-5,98,122],size:[10,16,10],colour:"light bluish grey",top:"tile"}));
for(const [w,z,d,y] of [[24,104,34,89],[16,112,24,98]]){
 for(let x=-w/2;x<w/2;x+=2)dorsal.push(p("3039",x,y-3,z));
 for(const side of [-1,1])for(let zz=z+4;zz<z+d-2;zz+=5)dorsal.push(p("2412b",side<0?-w/2:w/2-2,y,zz,"dark bluish grey"));
}
for(let z=115;z<132;z+=4)dorsal.push(p("3069b",-2,98,z,"dark bluish grey"),p("2412b",1,98,z));
for(const x of [-5,4])for(let y=101;y<113;y+=3)dorsal.push(p("3005",x,y,123,"dark bluish grey"));
section("Raked dorsal terraces and command neck",dorsal);
const bridge=[floor({at:[-16,111,121],size:[32,8],layers:2,colour:"light bluish grey"}),box({at:[-16,113,121],size:[32,7,8],colour:"light bluish grey",top:"tile"})];
for(let x=-16;x<16;x+=2){bridge.push(p("3039",x,117,121),p("3039",x,117,127,"light bluish grey",180),p("3004",x,114,121,(x+16)%6===0?"light bluish grey":"black"));if(x<-6||x>4)bridge.push(p("3660b",x,108,121));}
function globe(x){return [p("3941",x+1,120,125),p("3676",x,123,124,"light bluish grey",90),p("3676",x+2,123,124),p("3676",x,123,126,"light bluish grey",180),p("3676",x+2,123,126,"light bluish grey",270),p("60474",x,126,124),p("86500",x,127,124)];}
bridge.push(...globe(-12),...globe(8),box({at:[-2,120,124],size:[4,5,2],colour:"dark bluish grey",top:"tile"}),p("3039",-1,125,124));
section("Wide T bridge and twin shield-generator globes",bridge);
function turret(g){return [box({at:[g.x,30,g.z],size:[4,g.y-30,4],colour:"light bluish grey"}),p("3031",g.x,g.y,g.z),p("3941",g.x+1,g.y+1,g.z+2,"dark bluish grey"),p("30359b",g.x+1,g.y+4,g.z-4,"dark bluish grey"),p("30359b",g.x+2,g.y+4,g.z-4,"dark bluish grey"),p("3069b",g.x,g.y+1,g.z),p("3069b",g.x+2,g.y+1,g.z)];}
section("Eight twin-barrel heavy turbolasers",guns.flatMap(turret));
component("Main ion drive",{size:[12,9],ops:[box({at:[2,0,0],size:[8,6,9],colour:"dark bluish grey",interior:"solid"}),box({at:[0,6,0],size:[2,15,9],colour:"dark bluish grey",interior:"solid"}),box({at:[10,6,0],size:[2,15,9],colour:"dark bluish grey",interior:"solid"}),box({at:[2,6,0],size:[8,15,7],colour:"black"}),box({at:[2,6,7],size:[8,15,1],colour:"trans light blue",interior:"solid"}),p("18838",0,21,8,"dark bluish grey"),p("3676",0,3,7,"dark bluish grey",90),p("3676",10,3,7,"dark bluish grey"),p("2431",2,30,8,"dark bluish grey"),p("2431",6,30,8,"dark bluish grey"),...range(4).map(i=>p("2412b",2+i*2,6,1,"dark bluish grey",90))]});
const engines=[...[-26,-6,14].map(x=>instance({component:"Main ion drive",at:[x,27,140]}))];
for(const x of [-40,-30,24,34])engines.push(box({at:[x+2,30,136],size:[2,25,12],colour:"dark bluish grey"}),floor({at:[x,55,140],size:[6,8],colour:"light bluish grey"}),p("43121",x,56,143,"light bluish grey",180),p("3004",x+2,56,148,"trans light blue"),p("2412b",x+2,65,143,"dark bluish grey"));
section("Three large ion drives and four auxiliary engines",engines);
const detail=[];
for(const [x,z,w,d,y] of [[-10,91,4,3,68],[5,89,4,5,68],[-13,99,4,6,74],[7,101,6,3,74],[-17,115,5,8,80],[12,119,5,5,80],[-10,133,6,4,89]])detail.push(box({at:[x,y,z],size:[w,3,d],colour:"dark bluish grey",top:"tile"}),...range(Math.floor(d/2)).map(k=>p("2412b",x+1,y+3,z+k*2)));
for(let x=-18;x<=16;x+=2)detail.push(p("2412b",x,80,139,"dark bluish grey"));
section("Localized heat exchangers and machinery clusters",detail);
section("Recessed ventral docking bay",[carve({at:[-6,23,48],size:[12,13,24]}),floor({at:[-6,36,48],size:[12,24],colour:"black"}),...[-6,5].flatMap(x=>range(6).map(k=>p("3024",x,35,49+k*4,"trans light blue"))),box({at:[-7,23,47],size:[14,2,1],colour:"dark bluish grey",top:"tile"}),box({at:[-7,23,72],size:[14,2,1],colour:"dark bluish grey",top:"tile"})]);
const corvette=[box({at:[-5,0,51],size:[10,2,12],colour:"black",top:"tile"}),column({at:[-1,2,55],height:10,diameter:2,colour:"trans-clear"}),box({at:[-1,12,38],size:[2,4,22],colour:"white",top:"tile"}),box({at:[-2,12,40],size:[4,3,5],colour:"dark red",top:"tile"}),p("15068",-2,15,39,"white"),p("15068",0,15,39,"white"),p("3039",-1,16,43,"dark red",180),floor({at:[-5,11,57],size:[10,8],layers:2,colour:"white"}),box({at:[-1,16,54],size:[2,2,2],colour:"white"}),column({at:[-1,18,54],height:18,diameter:2,colour:"trans light blue"}),floor({at:[-3,16,58],size:[6,6],colour:"white"})];
for(let x=-5;x<5;x+=2)corvette.push(p("11477",x,13,61,"white",180),p("11477",x,13,58,"white"),p("3004",x,13,60,"dark red"));
for(const x of [-3,-1,1])corvette.push(p("11477",x,17,61,"white",180),p("11477",x,17,58,"white"));
for(const x of [-2,0,2])corvette.push(p("24201",x,7,61,"white",180));
section("Micro Tantive IV caught in the tractor beam",corvette);
