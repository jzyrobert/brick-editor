script({title:"The Pelican Fish Express",description:"A white pelican pedals an azure delivery roadster down a seaside boardwalk: pouch bulging, basket overflowing with fish, wingtips on the grips, while a gull on a bollard eyes the catch."});
const K=(x,y,z)=>x+","+y+","+z;
const put=(m,x,y,z,c)=>m.set(K(x,y,z),c);
const run=(m,x,y,z,w,c)=>{for(let i=0;i<w;i++)put(m,x+i,y,z,c);};
function emit(map){const g=new Map();for(const [k,c] of map){const p=k.split(",").map(Number);const gk=p[1]+"|"+p[2]+"|"+c;if(!g.has(gk))g.set(gk,[]);g.get(gk).push(p[0]);}const ops=[];for(const [gk,xs] of g){const q=gk.split("|");const y=+q[0],z=+q[1],c=q[2];xs.sort((a,b)=>a-b);let s=xs[0],p=xs[0];for(let i=1;i<=xs.length;i++){if(i<xs.length&&xs[i]===p+1){p=xs[i];continue;}ops.push(line({from:[s,y,z],to:[p,y,z],colour:c}));if(i<xs.length){s=xs[i];p=xs[i];}}}return ops;}
function hollow(map){const out=new Map();const N=[[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0],[0,-1,0]];for(const [k,c] of map){const p=k.split(",").map(Number);if(N.some(n=>!map.has(K(p[0]+n[0],p[1]+n[1],p[2]+n[2]))))out.set(k,c);}return out;}
const P=(part,at,colour,turn)=>place({part,at,colour,turn:turn||0});
const F="medium azure",G="light bluish grey",W="white",B="black",O="orange",BO="bright light orange";

// Boardwalk: two hidden joists, 8-stud planks across them with ragged ends
const deck=[floor({at:[-2,0,-3],size:[42,2],colour:"reddish brown"}),floor({at:[-2,0,2],size:[42,2],colour:"reddish brown"})];
const studded=new Set([5,6,7,26,27,28,37,38]);
for(let x=-2;x<=39;x++){const z0=x>=35?-5:-5+(rng()<0.5?1:0);const r=rng();const c=r<0.6?"dark tan":r<0.85?"tan":"reddish brown";deck.push(floor({at:[x,1,z0],size:[1,8],colour:c,...(studded.has(x)?{}:{top:"tile"})}));}
section("Boardwalk",deck);

// Wheels: true elliptical rings in the x-y plane (1 stud = 2.5 plates)
const wheels=new Map();
function wheel(x0,hz){
 for(let j=0;j<=32;j++)for(let i=0;i<=12;i++){const dx=i-6,dy=(j-16)/2.5,d=Math.hypot(dx,dy);if(d>=5.3&&d<=6.5)put(wheels,x0+i,2+j,0,B);}
 for(let j=3;j<=29;j++)put(wheels,x0+6,2+j,0,G);
 for(let i=1;i<=11;i++)put(wheels,x0+i,18,0,G);
 for(let i=5;i<=7;i++)for(let y=16;y<=20;y++)for(let z=-hz;z<=hz;z++)put(wheels,x0+i,y,z,"dark bluish grey");
}
wheel(0,2);wheel(21,1);
section("Wheels",emit(wheels));

// Frame: diamond frame, stays and fork straddle the wheels
const frame=new Map();
for(let y=15;y<=18;y++)for(let z=-1;z<=1;z++)run(frame,13,y,z,2,"dark bluish grey");
for(let y=19;y<=35;y++)run(frame,13,y,0,2,F);
for(let y=36;y<=39;y++)for(let z=-1;z<=1;z++)run(frame,12,y,z,3,F);
run(frame,12,40,0,2,G);
for(let y=36;y<=37;y++)run(frame,15,y,0,8,F);
for(let y=33;y<=41;y++)run(frame,23,y,0,2,F);
for(let y=33;y<=35;y++)for(const z of [-1,1])run(frame,23,y,z,2,F);
for(let y=42;y<=43;y++)put(frame,23,y,0,G);
for(let z=-4;z<=4;z++)put(frame,23,44,z,G);
for(let y=21;y<=32;y++){const x=27-Math.round((y-20)*4/13);for(const z of [-1,1])run(frame,x,y,z,2,F);}
for(let y=19;y<=32;y++){const x=14+Math.round((y-19)*9/14);run(frame,x,y,0,2,F);}
for(let y=21;y<=35;y++){const x=6+Math.round((y-18)/3);for(const z of [-1,1])run(frame,x,y,z,2,F);}
for(let y=17;y<=18;y++)for(const z of [-1,1])run(frame,8,y,z,5,F);
for(let y=13;y<=20;y++){const e=(y===13||y===20);for(let x=e?13:12;x<=(e?14:15);x++)put(frame,x,y,2,G);}
run(frame,8,20,2,5,B);run(frame,7,15,2,5,B);
for(let y=15;y<=17;y++)run(frame,13,y,-2,2,G);
for(let y=12;y<=14;y++)run(frame,14,y,-2,2,G);
for(let y=18;y<=20;y++)run(frame,12,y,3,2,G);
for(let y=21;y<=23;y++)run(frame,11,y,3,2,G);
section("Bicycle",[...emit(frame),
 P("3021",[12,41,-1],"reddish brown",90),
 P("3021",[14,11,-4],B,90),P("3021",[11,24,3],B,90),
 P("3062b",[23,45,-4],B),P("3062b",[23,45,4],B),
 P("6141",[23,45,-2],"pearl gold"),P("98138",[23,46,-2],"pearl gold")]);

// Pelican: egg body, S-neck, long bill over a bulging pouch, wings reaching for the grips
const bird=new Map();
for(let x=3;x<=21;x++)for(let y=40;y<=67;y++)for(let z=-4;z<=4;z++){const ax=x<13?8.5:6.5;const v=((x-13)/ax)**2+((y+0.5-54)/11.5)**2+(z/3.6)**2;if(v<=1)put(bird,x,y,z,W);}
for(let x=3;x<=5;x++)for(let y=55;y<=57;y++)for(let z=-1;z<=1;z++)put(bird,x,y,z,W);
const blob=(cx,cy,ax,ay,az,c)=>{for(let x=Math.floor(cx-ax);x<=Math.ceil(cx+ax);x++)for(let y=Math.floor(cy-ay);y<=Math.ceil(cy+ay);y++)for(let z=-3;z<=3;z++){const v=((x+0.5-cx)/ax)**2+((y+0.5-cy)/ay)**2+(z/az)**2;if(v<=1)put(bird,x,y,z,c);}};
[[17.5,63],[16.5,66.5],[16.5,70],[17.5,73],[19,75]].forEach(([cx,cy])=>blob(cx,cy,2.2,4,1.6,W));
blob(20.5,77,3.3,6,2.6,W);
for(let x=19;x<=22;x++)for(let y=67;y<=72;y++)for(let z=-1;z<=1;z++)put(bird,x,y,z,O);
const yt=x=>x<=27?77:x<=32?76:75;
for(let x=23;x<=35;x++){const s=Math.sin(Math.PI*(x-22)/14);const yb=Math.round(73-8*s);for(let y=yb;y<=yt(x)-2;y++){const wz=(s>0.55&&y>yb&&y<yt(x)-3)?2:1;for(let z=-wz;z<=wz;z++)put(bird,x,y,z,O);}}
for(let x=22;x<=36;x++){for(const z of (x<=35?[-1,0,1]:[0])){put(bird,x,yt(x),z,BO);put(bird,x,yt(x)-1,z,BO);}}
for(let y=73;y<=75;y++)put(bird,37,y,0,"dark orange");
for(const z of [-4,4]){
 for(let x=5;x<=16;x++){const t=59-Math.round((16-x)*0.4),b=51+Math.round((16-x)*0.2);for(let y=b;y<=t;y++)put(bird,x,y,z,(x<=8||(y<=b+1&&x<=11))?B:W);}
 for(let y=48;y<=57;y++){const x0=16+Math.round((57-y)*6/9);for(let x=x0;x<=x0+2;x++)put(bird,x,y,z,x>=21?B:W);}
}
const legs=new Map();
for(let y=13;y<=27;y++)run(legs,15+Math.round((y-13)*2/14),y,-4,2,O);
for(let y=28;y<=47;y++)run(legs,17-Math.round((y-28)*4/19),y,-4,2,W);
for(let y=26;y<=36;y++)run(legs,11+Math.round((y-26)/2),y,4,2,O);
for(let y=37;y<=47;y++)run(legs,16-Math.round((y-37)*3/10),y,4,2,W);
section("Pelican",[...emit(hollow(bird)),...emit(legs),
 P("3021",[14,12,-4],O),P("3021",[10,25,4],O),
 P("4070",[21,77,-2],B,0),P("4070",[21,77,2],B,180),
 P("54200",[19,83,0],W,90)]);

// Delivery basket overflowing with fish, headlamp on the front
section("Basket",[
 box({at:[25,36,-2],size:[5,9,5],colour:"tan",texture:"grille",open:["top"]}),
 box({at:[26,36,-1],size:[3,7,3],colour:W,interior:"solid"}),
 P("64648",[26,43,-1],F,90),P("64648",[26,43,0],O,90),P("64648",[26,43,1],"sand green",90),P("64648",[27,46,0],"red",90),
 P("3023b",[29,40,0],B),P("3062b",[30,41,0],"trans yellow")]);

// A gull on a bollard eyes the catch
section("Gull",[
 P("3941",[37,2,-5],"dark bluish grey"),P("3941",[37,5,-5],"dark bluish grey"),
 P("3004",[37,8,-5],W),P("3023b",[36,11,-5],"yellow"),P("3005",[37,12,-5],W),P("54200",[38,11,-5],G,270)]);