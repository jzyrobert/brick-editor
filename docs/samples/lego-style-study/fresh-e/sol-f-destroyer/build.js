script({title:"Imperial Star Destroyer — Devastator",description:"A grand Imperial dagger with continuous diagonal armor, recessed equatorial machinery, eight twin turbolaser batteries, layered command decks, a hammerhead bridge with paired shield generators, an open ventral docking aperture and seven deep axial engine bells. Compact black cradles leave the ship's silhouette unobstructed."});
const C=48,N=26,L=N*6,B=18,EDGE=26,MAX=5,TOP=41;
const P=(part,x,y,z,colour="light bluish grey",turn=0)=>place({part,at:[x,y,z],colour,turn});
const gunStations=range(4).map(i=>90+i*12);
function cradle(z,w){return [box({at:[C-w/2,0,z-5],size:[w,3,10],colour:"black",top:"tile"}),box({at:[C-4,3,z-3],size:[8,B-3,6],colour:"black"}),range(3).map(i=>P("3039",C-w/2+2+i*2,3,z-5,"black"))];}
section("Display cradles",[cradle(36,20),cradle(114,26)]);
const hull=[];
for(let k=0;k<N;k++){
 const z=k*6,h=(k+1)*2,left=C-h+2,w=2*h-4,n=Math.min(MAX,Math.floor((h-2)/4)),flat=w-8*n;
 if(w>0)hull.push(box({at:[left,B,z],size:[w,8,6],colour:"light bluish grey",supports:8}));
 for(const side of [0,1]){
  const x=side?C+h-2:C-h,wing=side?"78444":"78443";
  hull.push(P(wing,x,B,z),P(wing,x,EDGE-1,z));
  if(k>0){const px=side?x:x+1;hull.push(P("2877",px,B+1,z+4,"dark bluish grey",90),P("3004",px,B+4,z+4,"dark bluish grey",90));}
 }
 if(w>0)hull.push(floor({at:[left,B-1,z+4],size:[w,2],colour:"light bluish grey"}));
 for(let j=0;j<n;j++)for(const side of [0,1]){
  const x=side?C+h-2-(j+1)*4:left+j*4;
  if(j)hull.push(box({at:[side?x:x+3,EDGE,z],size:[1,j*3,6],colour:"light bluish grey",interior:"solid"}));
  for(let q=0;q<6;q+=2)if(!(j===4&&x>=33&&x+4<=63&&z+q>=82&&z+q+2<=138))hull.push(P("30363",x,EDGE+j*3,z+q,"light bluish grey",side?270:90));
 }
 if(flat>0){
  const x=left+n*4,y=EDGE+n*3;
  if(n)hull.push(box({at:[x,EDGE,z],size:[flat,n*3,6],colour:"light bluish grey",supports:8}));
  hull.push(floor({at:[x,y-1,z],size:[flat,6],colour:"light bluish grey"}));
  for(let q=0;q<6;q+=2)for(let a=0;a<flat;a+=2){
   const xx=x+a,zz=z+q;
   const citadel=y===TOP&&xx>=33&&xx+2<=63&&zz>=82&&zz+2<=138;
   const stern=y===TOP&&zz>=L-6;
   const gallery=y===TOP&&((xx+2>23&&xx<29)||(xx+2>67&&xx<73))&&gunStations.some(t=>zz+2>t-1&&zz<t+5);
   if(!citadel&&!stern&&!gallery)hull.push(P("3068b",xx,y,zz,(a%14===0&&q===2&&k%5===0)?"dark bluish grey":"light bluish grey"));
  }
 }
}
hull.push(box({at:[44,B,12],size:[8,6,L-18],colour:"light bluish grey"}),P("3031",46,B-1,4),box({at:[47,B+1,4],size:[2,6,2],colour:"light bluish grey",interior:"solid"}),carve({at:[42,B,54],size:[12,7,24]}));
section("Faceted dagger hull and equatorial trench",hull);
const hangar=[];
for(let a=0;a<3;a++)for(let b=0;b<4;b++)hangar.push(P("3032",42+a*4,B+6,54+b*6,"black",90));
hangar.push(box({at:[40,B-3,52],size:[16,3,2],colour:"dark bluish grey"}),box({at:[40,B-3,78],size:[16,3,2],colour:"dark bluish grey"}),box({at:[40,B-3,54],size:[2,3,24],colour:"light bluish grey"}),box({at:[54,B-3,54],size:[2,3,24],colour:"light bluish grey"}));
section("Recessed ventral docking aperture",hangar);
function tier(x,y,z,w,height,d,hole){
 const top=y+height,o=[room({at:[x,y,z],size:[w,height-3,d],colour:"light bluish grey",openings:[]}),floor({at:[x,top-4,z],size:[w,d],colour:"light bluish grey"}),floor({at:[x+4,top-3,z+3],size:[w-8,d-6],layers:3,colour:"light bluish grey",top:"tile",holes:hole?[{at:[hole[0],hole[1]],size:[hole[2],hole[3]]}]:[]})];
 if(hole)o.push(room({at:[hole[0],top-3,hole[1]],size:[hole[2],3,hole[3]],colour:"light bluish grey",openings:[]}));
 for(let a=4;a+4<=w-4;a+=4)o.push(P("3297",x+a,top-3,z),P("3297",x+a,top-3,z+d-3,"light bluish grey",180));
 for(let b=3;b+2<=d-3;b+=2)o.push(P("30363",x,top-3,z+b,"light bluish grey",90),P("30363",x+w-4,top-3,z+b,"light bluish grey",270));
 return o;
}
section("Terraced dorsal command decks",[tier(33,37,82,30,11,56,[36,96,24,38]),tier(36,48,96,24,8,38,[39,110,18,26]),tier(39,56,110,18,7,26,[44,119,8,8]),box({at:[44,63,119],size:[8,21,8],colour:"light bluish grey",texture:"grille"}),floor({at:[42,63,117],size:[12,12],colour:"light bluish grey",top:"tile"})]);
const bridge=[box({at:[34,81,117],size:[28,5,8],colour:"light bluish grey",supports:8}),box({at:[32,86,116],size:[32,8,10],colour:"light bluish grey",top:"tile"})];
for(let z=117;z<125;z+=2)bridge.push(P("3660b",32,83,z,"light bluish grey",90),P("3660b",62,83,z,"light bluish grey",270));
for(let x=34;x<62;x++){
 bridge.push(P("3005",x,86,116,x%6===3?"light bluish grey":"black"),P("3005",x,86,125,x%6===3?"light bluish grey":"black"));
 if(x%2===0)bridge.push(P("30363",x,91,113));
}
for(const x of [35,56])bridge.push(box({at:[x,94,119],size:[5,6,5],colour:"light bluish grey"}),P("30208",x,100,119));
bridge.push(P("4032b",47,94,121),P("3941",47,95,121),P("3957a",47,98,121),P("4740",47,94,117,"dark bluish grey"));
section("Hammerhead bridge and paired shield generators",bridge);
function battery(x,z){return [box({at:[x-1,EDGE,z-1],size:[6,20,6],colour:"light bluish grey",supports:4,top:"tile"}),P("4032b",x+1,46,z+1,"dark bluish grey"),P("3941",x+1,47,z+1),P("3031",x,50,z),P("3666",x+1,51,z-4,"dark bluish grey",90),P("3666",x+3,51,z-4,"dark bluish grey",90),P("63864",x+1,52,z-4,"light bluish grey",90),P("63864",x+3,52,z-4,"light bluish grey",90),P("3069b",x,51,z+3),P("3069b",x+2,51,z+3)];}
section("Eight twin heavy turbolaser batteries",gunStations.map(z=>[battery(24,z),battery(68,z)]));
function machinery(x,y,z,w,d,seed){
 const ops=[floor({at:[x,y-1,z],size:[w,d],colour:"light bluish grey"})];
 for(let a=0;a<w;a+=2)for(let b=0;b<d;b+=2){
  const t=(a*3+b+seed)%7;
  ops.push(P(t<3?"2412b":t===3?"3023b":"3069b",x+a,y,z+b,t===1?"dark bluish grey":"light bluish grey"));
  if(t===3)ops.push(P("3069b",x+a,y+1,z+b,"dark bluish grey"));
  if(t===4)ops.push(P("6141",x+a,y,z+b+1,"dark bluish grey"));
 }
 return ops;
}
const city=[];
for(const x of [38,46,56])city.push(machinery(x,48,88,2,6,x));
for(const x of [41,53])city.push(machinery(x,56,103,2,6,x));
for(const x of [44,50])city.push(machinery(x,63,129,2,4,x));
for(let i=0;i<8;i++){const z=86+i*6;city.push(P("2877",34,41,z,"dark bluish grey",90),P("2877",60,41,z,"dark bluish grey",90));}
for(let i=0;i<5;i++){const z=99+i*6;city.push(P("2877",37,50,z,"dark bluish grey",90),P("2877",58,50,z,"dark bluish grey",90));}
city.push(P("3960",40,56,99,"dark bluish grey"),P("3960",52,56,99,"dark bluish grey"),P("3942c",45,63,113),P("3942c",49,63,113));
section("Dorsal machinery and communications sensors",city);
function engine(x,y,z,large){
 const D=large?12:6,outer=large?[3,1,0,0,0,0,0,0,1,3]:[2,0,0,0,2],inner=large?[0,4,3,2,2,2,2,3,4,0]:[0,2,1,2,0],depth=large?10:8,ops=[];
 for(let r=0;r<outer.length;r++){
  const a=outer[r],b=inner[r],yy=y+r*3;
  if(!b)ops.push(box({at:[x+a,yy,z],size:[D-2*a,3,depth],colour:"light bluish grey",interior:"solid"}));
  else ops.push(box({at:[x+a,yy,z],size:[b-a,3,depth],colour:"light bluish grey",interior:"solid"}),box({at:[x+D-b,yy,z],size:[b-a,3,depth],colour:"light bluish grey",interior:"solid"}),box({at:[x+b,yy,z],size:[D-2*b,3,1],colour:"black",interior:"solid"}));
 }
 const gw=large?4:2,bx=x+(D-gw)/2;
 ops.push(box({at:[bx,y+3,z+1],size:[gw,3,1],colour:"black",interior:"solid"}));
 for(let r=0;r<(large?5:2);r++)ops.push(P(large?"3010":"3004",bx,y+6+r*3,z+1,"trans light blue"));
 for(let q=2;q<depth-2;q+=2)ops.push(P("3069b",x+D/2-1,y+outer.length*3,z+q,"dark bluish grey"));
 ops.push(box({at:[bx,y+outer.length*3-(large?5:3),z-3],size:[gw,large?5:3,7],colour:"light bluish grey",interior:"solid"}));
 return ops;
}
const aft=[box({at:[8,B,L-6],size:[80,23,6],colour:"dark bluish grey",supports:8})];
for(const x of [18,42,66])aft.push(engine(x,13,L,true));
for(const x of [10,32,58,80])aft.push(engine(x,22,L,false));
for(let x=12;x<84;x+=4)aft.push(P("3039",x,41,L-4,"light bluish grey",180),P("3039",x+2,41,L-4,"light bluish grey",180),P("2412b",x,41,L-6,"dark bluish grey"));
section("Seven recessed axial engine bells and stern armor",aft);