piplup

This is a visual revision of an accepted draft, not a new concept contest.
The attached images show the draft from three-quarter, front, back and top.
Inspect the actual images before editing. Internally identify the three most
important visual defects, then revise the supplied source to address them.
Keep the subject recognizable and improve its existing concept. Judge its
silhouette, proportions, support footprint and surface construction in all
views. Remove unnecessary scenery slabs; keep compact supports only where
needed. Finish visible skin with coherent shaping parts and selective tiles;
retain purposeful texture and connection studs. A smooth staircase remains
a stepped silhouette, so improve the transitions rather than merely hiding
studs. Check the revised code for overlaps, colour availability and part count.
Do not add disconnected decorative parts just to approach the part target.
Reply through the same parts_search, check_build and brick.build protocols.

Accepted draft source:
```js
script({title:'Piplup — A Very Proud Little Wave',description:'A freestanding, round-headed Piplup with a raised flipper, glossy oval eyes, white cheek mask, blue forehead marking, two white chest buttons, a pointed yellow bill, webbed feet and three curved tail feathers. Broad feet, interlocked skins and continuous internal spines support the sculpted character.',palette:{blue:'medium azure',cap:'dark blue',mask:'white',bill:'yellow'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function band(x,z,w,d,y,colour,inverted=false){const s=inverted?'3660b':'3039',c=inverted?(colour==='blue'?'3660b':'3676'):'3045';const a=[floor({at:[x+2,y,z+2],size:[w-4,d-4],layers:1,colour})];for(let i=x+2;i<x+w-2;i+=2)a.push(P(s,i,y,z,colour),P(s,i,y,z+d-2,colour,180));for(let k=z+2;k<z+d-2;k+=2)a.push(P(s,x,y,k,colour,90),P(s,x+w-2,y,k,colour,270));a.push(P(c,x,y,z,colour),P(c,x+w-2,y,z,colour,270),P(c,x,y,z+d-2,colour,90),P(c,x+w-2,y,z+d-2,colour,180));return a;}
function foot(x){return [floor({at:[x,0,-8],size:[6,12],layers:2,colour:'bill'}),box({at:[x,2,-6],size:[6,3,10],colour:'bill',top:'tile',interior:'solid'}),range(3).map(i=>P('15068',x+2*i,2,-8,'bill'))];}
section('Broad webbed feet',[foot(-8),foot(2)]);
const body=[];for(let i=0;i<3;i++)body.push(band(-7-i,-4-i,14+2*i,10+2*i,5+3*i,'blue',true));
body.push(wall({from:[-5,-6],to:[4,-6],y:14,height:24,colour:'blue'}),wall({from:[-5,7],to:[4,7],y:14,height:24,colour:'cap'}),wall({from:[-9,-2],to:[-9,3],y:14,height:24,colour:'blue'}),wall({from:[8,-2],to:[8,3],y:14,height:24,colour:'blue'}),box({at:[-3,5,-1],size:[6,39,4],colour:'blue',interior:'solid'}),floor({at:[-7,26,-4],size:[14,10],layers:1,colour:'blue'}),floor({at:[-7,37,-4],size:[14,10],layers:1,colour:'cap'}));
for(let y=14;y<38;y+=3)body.push(P('48092',-9,y,-6,'blue'),P('48092',5,y,-6,'blue',270),P('48092',-9,y,4,'cap',90),P('48092',5,y,4,'cap',180));
body.push(band(-9,-6,18,14,38,'cap'),band(-8,-5,16,12,41,'cap'));
section('Egg-shaped body and navy cape',body);
function button(c){return [P('3004',c-1,21,-6,'mask'),P('3010',c-2,24,-6,'mask'),P('3004',c-1,27,-6,'mask'),P('3024',c-2,23,-6,'mask'),P('3024',c+1,23,-6,'mask'),P('54200',c-2,27,-6,'mask',90),P('54200',c+1,27,-6,'mask',270)];}
section('Two white chest buttons',[button(-4),button(4)]);
const fins=[box({at:[-15,29,0],size:[8,9,4],colour:'blue',interior:'solid'}),floor({at:[-18,35,0],size:[11,4],layers:2,colour:'blue'}),box({at:[-18,37,0],size:[4,16,4],colour:'blue',interior:'solid'}),box({at:[-20,38,0],size:[2,9,4],colour:'blue',interior:'solid'})];
for(let z=0;z<4;z++)fins.push(P('3665a',-20,35,z,'blue',90),P('60481a',-20,47,z,'blue',90));
for(let x=-18;x<-14;x+=2)fins.push(P('15068',x,53,0,'blue'),P('15068',x,53,2,'blue',180));
fins.push(floor({at:[9,20,-1],size:[4,5],layers:1,colour:'blue'}),box({at:[9,21,-1],size:[4,14,5],colour:'blue',interior:'solid'}),box({at:[7,32,-1],size:[6,3,5],colour:'blue',interior:'solid'}));
for(let z=-1;z<4;z++)fins.push(P('24201',10,16,z,'blue',270),P('60481a',13,29,z,'blue',270),P('61678',9,35,z,'blue',270));
section('One flipper waving, one flipper resting',fins);
function feather(x,len){const a=[floor({at:[x,14,6],size:[2,len],layers:2,colour:'cap'})];for(let j=0;j<2;j++){a.push(P('61678',x+j,16,6+len-4,'cap',180));let z=6,n=len-4;while(n>0){let k=n>=4?4:n>=2?2:1;a.push(P(k===4?'2431':k===2?'3069b':'3070b',x+j,16,z,'cap',90));z+=k;n-=k;}}return a;}
section('Three overlapping tail feathers',[feather(-3,7),feather(-1,10),feather(1,8)]);
const head=[];for(let i=0;i<3;i++)head.push(band(-10-i,-8-i,20+2*i,16+2*i,43+3*i,'cap',true));
head.push(floor({at:[-11,52,-12],size:[22,6],layers:1,colour:'mask'}),floor({at:[-8,52,-6],size:[16,12],layers:1,colour:'cap'}),wall({from:[-8,-10],to:[7,-10],y:53,height:30,colour:'cap'}),wall({from:[-8,9],to:[7,9],y:53,height:30,colour:'cap'}),wall({from:[-12,-6],to:[-12,5],y:53,height:30,colour:'cap'}),wall({from:[11,-6],to:[11,5],y:53,height:30,colour:'cap'}),box({at:[-2,43,-1],size:[4,58,4],colour:'cap',interior:'solid'}),floor({at:[-8,68,-6],size:[16,12],layers:1,colour:'cap'}),floor({at:[-8,82,-6],size:[16,12],layers:1,colour:'cap'}));
for(let y=53;y<83;y+=3){const front=y>=56&&y<=77?'mask':'cap';head.push(P('48092',-12,y,-10,front),P('48092',8,y,-10,front,270),P('48092',-12,y,6,'cap',90),P('48092',8,y,6,'cap',180));}
for(let i=0;i<6;i++)head.push(band(-12+i,-10+i,24-2*i,20-2*i,83+3*i,'cap'));
head.push(floor({at:[-6,100,-4],size:[12,8],layers:1,colour:'cap'}));for(let x=-6;x<6;x++)head.push(P('61678',x,101,-4,'cap'),P('61678',x,101,0,'cap',180));
section('Oversized rounded head and smooth crown',head);
function cheek(c){const a=[];for(let i=0;i<2;i++){let w=8+2*i,x=c-w/2,y=53+3*i;a.push(box({at:[x+2,y,-12],size:[w-4,3,2],colour:'mask',interior:'solid'}),P('3660b',x,y,-12,'mask',90),P('3660b',x+w-2,y,-12,'mask',270));}a.push(box({at:[c-5,59,-12],size:[10,18,2],colour:'mask',interior:'solid'}));for(let i=0;i<3;i++){let w=10-2*i,x=c-w/2,y=77+3*i;a.push(box({at:[x+2,y,-12],size:[w-4,3,2],colour:'mask',interior:'solid'}),P('3039',x,y,-12,'mask',90),P('3039',x+w-2,y,-12,'mask',270));}return a;}
section('White oval cheeks and blue forehead',[cheek(-6),cheek(6),box({at:[-1,53,-12],size:[2,30,2],colour:'blue',interior:'solid'}),box({at:[-3,83,-12],size:[6,3,2],colour:'blue',interior:'solid'}),floor({at:[-3,86,-12],size:[6,4],layers:3,colour:'blue'}),range(6).map(i=>P('61678',-3+i,89,-12,'blue'))]);
function eye(x){const a=[P('3004',x+1,65,-12,'black')];for(let y=68;y<=74;y+=3){a.push(P('3005',x,y,-12,'cap'),P('3005',x+3,y,-12,'cap'));if(y===74)a.push(P('3005',x+1,y,-12,'white'),P('3005',x+2,y,-12,'black'));else a.push(P('3004',x+1,y,-12,'black'));}a.push(P('15068',x+1,77,-12,'black'));return a;}
section('Large bright eyes',[eye(-8),eye(4)]);
section('Pointed yellow beak and mouth seam',[box({at:[-1,57,-14],size:[2,3,4],colour:'bill',interior:'solid'}),P('3660b',-1,57,-16,'bill'),floor({at:[-1,60,-17],size:[2,7],layers:2,colour:'bill'}),floor({at:[-3,60,-14],size:[6,4],layers:2,colour:'bill'}),P('3023b',-1,61,-17,'black'),P('3039',-1,62,-17,'bill'),P('3298',-1,62,-15,'bill'),P('3039',-3,62,-14,'bill'),P('3039',1,62,-14,'bill'),box({at:[-3,62,-12],size:[6,3,2],colour:'bill',interior:'solid'})]);
```
