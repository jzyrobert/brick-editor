script({title:"Kondō and Five-Storey Pagoda",description:"A Japanese Buddhist temple with a broad irimoya-roofed worship hall, timber verandas, five diminishing pagoda roofs and an open bell pavilion with a suspended bronze bell and wooden striker. Each building has its own stone footing.",palette:{timber:"reddish brown",plaster:"white",roof:"dark bluish grey",stone:{mix:["light bluish grey","light bluish grey","dark bluish grey"]}},defaults:{interior:"empty"}});
const hall={w:36,d:26,deck:10,eave:35};
function cornerTips(x,y,z,w,d){return [-2,w+1].flatMap(dx=>[place({part:"50950",at:[x+dx,y,z-2],colour:"roof",turn:180}),place({part:"50950",at:[x+dx,y,z+d-1],colour:"roof"})]);}
function timberPost(x,z,y,h,diameter=2){return column({at:[x,y,z],height:h,diameter,colour:"timber"});}
section("Hall stone podium and approach",[
 floor({at:[-2,0,-2],size:[hall.w+4,hall.d+4],layers:2,colour:"dark bluish grey"}),
 box({at:[-2,2,-2],size:[hall.w+4,6,hall.d+4],colour:"stone",texture:"masonry",supports:8}),
 floor({at:[-2,8,-2],size:[hall.w+4,hall.d+4],layers:2,colour:"timber"}),
 floor({at:[12,9,-2],size:[12,6],colour:"timber",top:"tile"}),
 stairs({at:[12,0,-12],width:12,steps:5,run:2,rise:2,dir:"+z",colour:"light bluish grey",top:"tile"})
]);
const perimeterPosts=[...range(5).flatMap(i=>[[0,i*6],[hall.w-2,i*6]]),...range(1,6).flatMap(i=>[[i*6,0],[i*6,hall.d-2]])];
function verandaPost(p){const [x,z]=p;return [timberPost(x,z,hall.deck,18),place({part:"3003",at:[x,28,z],colour:"timber"}),place({part:"3660b",at:[x,31,z],colour:"timber",turn:z===hall.d-2?180:0})];}
const sideWindow=(side,at)=>({side,at,width:4,y:6,height:9,frame:"reddish brown",glass:"trans-clear"});
section("Kondo timber frame and shoji walls",[
 room({at:[4,10,4],size:[28,24,18],colour:"plaster",openings:[{side:"front",at:10,width:8,height:18,fill:"none"},sideWindow("left",4),sideWindow("left",10),sideWindow("right",4),sideWindow("right",10),sideWindow("back",2),sideWindow("back",22)]}),
 perimeterPosts.map(verandaPost),
 [4,10,25,31].flatMap(x=>[4,21].map(z=>timberPost(x,z,10,24,1))),
 [10,19].flatMap(y=>[14,18].map(x=>place({part:"60598",at:[x,y,4],colour:"black"}))),
 box({at:[14,28,4],size:[8,3,1],colour:"timber",interior:"solid"}),
 box({at:[0,31,0],size:[hall.w,3,2],colour:"timber",interior:"solid"}),
 box({at:[0,31,24],size:[hall.w,3,2],colour:"timber",interior:"solid"}),
 box({at:[0,31,2],size:[2,3,hall.d-4],colour:"timber",interior:"solid"}),
 box({at:[34,31,2],size:[2,3,hall.d-4],colour:"timber",interior:"solid"}),
 floor({at:[4,10,5],size:[28,16],colour:"dark tan",top:"tile"}),
 box({at:[15,11,16],size:[6,3,3],colour:"dark brown",interior:"solid"}),
 place({part:"4032b",at:[17,14,16],colour:"pearl gold"}),
 place({part:"3942c",at:[17,15,16],colour:"pearl gold"})
]);
section("Irimoya roof and ridge ornaments",[
 floor({at:[-2,hall.eave-1,-2],size:[hall.w+4,hall.d+4],colour:"timber"}),
 roof({style:"hip",at:[0,hall.eave,0],size:[hall.w,hall.d],colour:"roof",holes:[{at:[6,8],size:[24,10]}]}),
 room({at:[6,35,8],size:[24,18,10],colour:"plaster"}),
 [6,29].flatMap(x=>[8,17].map(z=>[timberPost(x,z,35,15,1),box({at:[x,50,z],size:[1,3,1],colour:"timber",interior:"solid"})])),
 floor({at:[6,52,8],size:[24,10],colour:"timber"}),
 roof({style:"gable",at:[6,53,8],size:[24,10],ridge:"x",colour:"roof",gable:"plaster"}),
 cornerTips(0,hall.eave,0,hall.w,hall.d),
 [5,29].map(x=>place({part:"3942c",at:[x,71,12],colour:"pearl gold"}))
]);
const tower={cx:62,cz:14,start:6,levels:5,step:22};
function pagodaTier(i){const r=20-2*i,c=Math.max(6,12-2*i),x=tower.cx-Math.round(r/2),z=tower.cz-Math.round(r/2),cx=tower.cx-Math.round(c/2),cz=tower.cz-Math.round(c/2),y=tower.start+i*tower.step,ry=y+19,last=i===tower.levels-1;
 return [floor({at:[cx,y,cz],size:[c,c],colour:"timber"}),room({at:[cx,y+1,cz],size:[c,18,c],colour:"plaster",openings:[{side:"front",at:Math.round(c/2)-1,width:2,y:6,height:6,frame:"reddish brown",glass:"trans-clear"},{side:"back",at:Math.round(c/2)-1,width:2,y:6,height:6,frame:"reddish brown",glass:"trans-clear"}]}),[cx,cx+c-1].flatMap(px=>[cz,cz+c-1].map(pz=>[timberPost(px,pz,y+1,15,1),box({at:[px,y+16,pz],size:[1,3,1],colour:"timber",interior:"solid"})])),floor({at:[x-2,ry-1,z-2],size:[r+4,r+4],colour:"timber"}),roof({style:"hip",at:[x,ry,z],size:[r,r],colour:"roof",holes:last?[]:[{at:[cx,cz],size:[c,c]}]}),cornerTips(x,ry,z,r,r),!last&&box({at:[cx,ry,cz],size:[c,3,c],colour:"timber",interior:"solid"})];
}
section("Pagoda stone footing",[box({at:[50,0,2],size:[24,6,24],colour:"light bluish grey",supports:8}),floor({at:[50,5,2],size:[24,24],colour:"light bluish grey"}),stairs({at:[59,0,-4],width:6,steps:6,dir:"+z",colour:"light bluish grey"})]);
section("Five diminishing pagoda storeys",range(tower.levels).map(pagodaTier));
const crownY=tower.start+(tower.levels-1)*tower.step+19+21;
section("Pagoda sorin finial",[place({part:"3941",at:[61,crownY,13],colour:"black"}),range(7).flatMap(i=>[place({part:"4032b",at:[61,crownY+3+i*4,13],colour:"pearl gold"}),place({part:"3062b",at:[61,crownY+4+i*4,13],colour:"black"})]),place({part:"4589",at:[61,crownY+31,13],colour:"pearl gold"})]);
section("Open shoro bell pavilion",[
 floor({at:[-25,0,5],size:[18,18],colour:"dark bluish grey"}),box({at:[-25,1,5],size:[18,6,18],colour:"light bluish grey",supports:8}),floor({at:[-25,7,5],size:[18,18],colour:"light bluish grey"}),
 [-22,-12].flatMap(x=>[8,18].map(z=>timberPost(x,z,8,18))),
 [8,18].map(z=>box({at:[-22,26,z],size:[12,3,2],colour:"timber",interior:"solid"})),
 box({at:[-17,27,9],size:[1,2,13],colour:"timber",interior:"solid"}),
 place({part:"3960",at:[-18,14,12],colour:"dark bluish grey"}),cylinder({at:[-18,15,12],diameter:4,height:6,colour:"dark bluish grey"}),place({part:"3943b",at:[-18,21,12],colour:"black"}),
 place({part:"3009",at:[-17,18,16],colour:"reddish brown",turn:90}),[17,21].map(z=>column({at:[-17,21,z],height:6,diameter:1,colour:"black"})),
 floor({at:[-25,28,5],size:[18,18],colour:"timber"}),roof({style:"hip",at:[-23,29,7],size:[14,14],colour:"roof"}),cornerTips(-23,29,7,14,14)
]);