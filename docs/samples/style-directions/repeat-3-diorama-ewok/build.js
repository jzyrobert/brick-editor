script({title:'YUB-NUB 1979: The Canopy Launchport',description:'The Ewoks have joined Classic Space! A blue-and-grey Logwing Explorer with a yellow cockpit, timber engine pods and classic emblems docks beside a thatched mission-control hut. Suited Ewoks prepare the expedition beneath two ancient trees. A bridge, radar balcony, access stairs, creek ford and little exploration rover connect the forest village into one playable launchport.',palette:{bark:'reddish brown',space:'blue',metal:'light bluish grey',leaf:'dark green',thatch:{mix:['blue','blue','reddish brown','tan']}},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour,extra={})=>box({at:[x,y,z],size:[w,h,d],colour,...extra});
section('Forest moon display',[
B(0,0,0,48,3,40,'black',{top:'tile',supports:8}),floor({at:[0,3,0],size:[48,40],layers:2,colour:'dark green'}),...[[0,0],[44,0],[0,36],[44,36]].map(([x,z])=>carve({at:[x,0,z],size:[4,5,4]})),
floor({at:[1,5,4],size:[17,5],colour:'trans light blue',top:'tile'}),floor({at:[2,5,9],size:[8,3],colour:'trans light blue',top:'tile'}),
B(0,5,12,8,3,11,'dark tan',{top:'tile'}),B(14,5,5,5,3,12,'dark tan',{top:'tile'}),B(18,5,0,22,3,6,'dark tan',{top:'tile'}),B(29,5,31,17,3,9,'dark tan'),
floor({at:[2,5,2],size:[16,2],colour:'dark tan'}),...range(8).map(i=>P('3039',2+i*2,6,2,i%3?'dark bluish grey':'light bluish grey',180)),...range(5).map(i=>P('15068',15,8,7+i*2,'dark tan',90)),
stairs({at:[9,5,3],width:3,steps:12,dir:'+z',rise:3,run:1,colour:'reddish brown',top:'tile'}),floor({at:[9,41,14],size:[3,2],colour:'reddish brown'}),
...range(7).map(i=>floor({at:[20+i*3,8,3+(i%2)],size:[2,2],colour:'light bluish grey',top:'tile'}))
]);
function tree(x,z,d,h){
const a=[cylinder({at:[x,5,z],diameter:d,height:h,colour:'bark',texture:'log'}),cylinder({at:[x+1,5+h,z+1],diameter:d-2,height:18,colour:'bark',texture:'log'}),cylinder({at:[x+2,23+h,z+2],diameter:d-4,height:9,colour:'bark',texture:'log'})];
const ribs=[[1,0,0],[d-3,0,0],[1,d-1,0],[d-3,d-1,0],[0,2,90],[0,d-4,90],[d-1,2,90],[d-1,d-4,90]];
for(let k=0;k<Math.floor(h/3);k++)for(let j=0;j<ribs.length;j++){const [rx,rz,t]=ribs[j];a.push(P('30136',x+rx,5+k*3,z+rz,(k+j)%5?'reddish brown':'dark brown',t));}
for(let j=0;j<4;j++){const xx=x+(j%2)*(d-2),zz=z+Math.floor(j/2)*(d-2);a.push(B(xx,5,zz,2,12,2,'bark',{top:'tile'}));if(j<2)a.push(P('3678b',xx,5,zz-2,'reddish brown'),P('3039',xx,11,zz-2,'reddish brown'));}
return a;
}
section('Ancient launch trees',[...tree(5,30,10,69),...tree(37,32,8,57),B(3,50,29,4,6,5,'bark',{texture:'log'}),B(13,59,28,4,6,7,'bark',{texture:'log'}),B(33,58,32,5,6,4,'bark',{texture:'log'})]);
function crown(x,z,y,d){
const a=[floor({at:[x,y,z],size:[d,d],layers:2,colour:'reddish brown'})];
const clusters=[[0,0,0],[5,0,3],[10,1,0],[0,5,5],[5,5,9],[10,6,5],[1,10,2],[6,10,6],[11,11,1]];
for(let j=0;j<clusters.length;j++){const [dx,dz,dy]=clusters[j];a.push(column({at:[x+dx+2,y+2,z+dz+2],height:3+dy,diameter:1,colour:'reddish brown'}),P('2417',x+dx,y+5+dy,z+dz,j%3?'dark green':'green'),P('2417',x+dx+1,y+6+dy,z+dz+1,'green',180),P('2423',x+dx+1,y+7+dy,z+dz+2,'dark green',90),P('2423',x+dx+2,y+8+dy,z+dz+1,j%2?'green':'dark green'));}
return a;
}
section('Layered forest canopy',[...crown(1,26,101,16),...crown(32,28,88,16)]);
section('Tree village and launch decks',[
...[[1,17],[15,17],[1,28],[15,28],[22,9],[44,9],[22,28],[44,28]].map(([x,z])=>column({at:[x,5,z],height:33,diameter:2,colour:'reddish brown'})),
B(0,38,15,18,4,16,'reddish brown',{top:'tile',supports:6}),floor({at:[16,40,24],size:[7,4],layers:2,colour:'dark tan',top:'tile'}),B(21,38,7,26,4,24,'reddish brown',{top:'tile',supports:6}),
...range(10).map(i=>P('2431',22+i*2,42,8,'dark tan',90)),...range(11).map(i=>P(i===3||i===4?'3023b':'3069b',22+i*2,42,29,'dark tan')),
...[[0,16],[0,22],[0,29],[16,16],[16,22],[16,29],[21,7],[27,7],[37,7],[45,7],[21,30],[27,30],[34,30]].map(([x,z])=>column({at:[x,42,z],height:6,diameter:1,colour:'reddish brown',cap:'tile'})),
wall({from:[0,16],to:[0,29],y:46,height:1,colour:'dark tan'}),wall({from:[21,7],to:[27,7],y:46,height:1,colour:'light bluish grey'}),wall({from:[37,7],to:[45,7],y:46,height:1,colour:'light bluish grey'}),
...range(7).map(i=>P('3023b',16+i,42,24,'reddish brown',90)),...range(7).map(i=>P('3023b',16+i,42,26,'dark tan',90)),
...[[17,24],[20,24],[17,27],[20,27]].map(([x,z])=>column({at:[x,43,z],height:6,colour:'dark brown',diameter:1})),wall({from:[17,24],to:[20,24],y:49,height:1,colour:'dark tan'}),wall({from:[17,27],to:[20,27],y:49,height:1,colour:'dark tan'}),
room({at:[1,42,17],size:[14,15,12],colour:'reddish brown',texture:'log',floor:'tan',openings:[{side:'front',at:5,width:3,height:12,fill:'none'},{side:'front',at:2,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'},{side:'front',at:10,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'},{side:'left',at:3,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'},{side:'right',at:3,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'},{side:'back',at:6,width:2,y:6,height:6,frame:'blue',glass:'trans yellow'}]}),
roof({style:'hip',at:[1,57,17],size:[14,12],colour:'thatch',overhang:1}),P('87079p50',6,42,16,'blue'),B(2,43,25,4,6,2,'blue'),P('3039p34',3,49,25,'white'),P('2489',11,43,25,'reddish brown'),
B(28,66,30,19,3,10,'reddish brown',{top:'tile',supports:6}),B(28,66,25,8,3,5,'reddish brown',{top:'tile'}),column({at:[29,43,29],height:23,diameter:2,colour:'reddish brown'}),
stairs({at:[45,42,30],width:2,steps:9,dir:'+z',rise:3,colour:'reddish brown',top:'tile'}),column({at:[31,69,34],height:12,diameter:2,colour:'blue'}),P('3961',28,81,31,'light bluish grey'),P('3957a',31,84,34,'red'),column({at:[32,69,31],height:4,diameter:1,colour:'blue'}),P('3960',31,73,30,'yellow'),P('3039p34',33,69,36,'blue'),P('2489',34,69,38,'reddish brown')
]);
section('Logwing Galaxy Explorer',[
...[[29,12],[33,12],[25,26],[37,26]].map(([x,z])=>[P('3022',x,42,z,'dark bluish grey'),column({at:[x,43,z],height:5,diameter:2,colour:'light bluish grey'})]),
B(29,48,13,6,3,16,'light bluish grey'),B(29,48,9,6,3,4,'blue'),B(23,48,26,18,2,2,'light bluish grey'),floor({at:[29,51,13],size:[6,16],colour:'blue'}),
P('30355',22,50,16,'light bluish grey'),P('30356',36,50,16,'light bluish grey'),...range(3).map(i=>P('93606',29+i*2,51,9,'blue')),
P('4474',30,52,13,'trans yellow'),P('3039p34',30,52,20,'white'),P('87079p50',30,52,24,'blue'),
...range(13).map(i=>[P('11477',27,51,15+i,'blue',90),P('11477',35,51,15+i,'blue',270)]),...range(6).map(i=>[P('3710',23,51,22+i,'blue'),P('3710',37,51,22+i,'blue')]),
...range(6).map(i=>[23,26,37,40].map(x=>P('3070b',x,52,22+i,i===0||i===4?'dark tan':'blue'))),
...[[24,21],[38,21]].map(([x,z])=>[B(x,52,z,2,4,8,'reddish brown',{texture:'log'}),...range(4).map(i=>P('15068',x,56,z+i*2,'blue')),P('4746',x,59,z+2,'blue'),P('6141',x,59,z+1,'trans red')]),
P('3957a',22,51,25,'red'),P('3957a',41,51,25,'red'),P('3068b',30,52,27,'light bluish grey'),P('3068b',32,52,27,'light bluish grey')
]);
component('Ewok astronaut',{size:[4,4],ops:[P('41879a',1,0,1,'reddish brown'),P('76382p90',0,4,1,'white'),P('64805',1,11,1,'reddish brown')]});
section('Launch crew and expedition rover',[
instance({component:'Ewok astronaut',at:[2,42,10]}),instance({component:'Ewok astronaut',at:[12,42,12],turn:90}),instance({component:'Ewok astronaut',at:[43,42,18],turn:90}),instance({component:'Ewok astronaut',at:[28,69,26],turn:270}),instance({component:'Ewok astronaut',at:[18,8,0],turn:90}),instance({component:'Ewok astronaut',at:[13,8,13]}),
place({part:'4600',at:[5,8,6],colour:'light bluish grey',wheels:'light bluish grey'}),place({part:'4600',at:[5,8,10],colour:'light bluish grey',wheels:'light bluish grey'}),B(5,9,6,2,2,6,'light bluish grey'),floor({at:[4,11,6],size:[6,6],layers:1,colour:'blue'}),P('2437',5,12,6,'trans yellow'),P('4079',5,12,9,'blue'),P('2489',8,12,10,'reddish brown'),
...[[24,8,1],[27,8,1],[30,8,1]].map(([x,y,z])=>P('2489',x,y,z,'reddish brown')),P('3039p34',34,8,3,'blue'),P('3957a',36,8,3,'red')
]);
const plants=[];
for(const [x,z] of [[2,13],[3,24],[20,33],[25,34],[29,27],[33,7],[40,3],[46,13],[19,19],[1,34]])plants.push(B(x,5,z,1,3,1,'dark green'),P('6255',x,8,z,'green'));
for(let i=0;i<18;i++){const x=26+(i%6)*3,z=12+Math.floor(i/6)*4;plants.push(P('3039',x,5,z,i%4?'dark bluish grey':'light bluish grey',i%2?0:180),P('2423',x,8,z,'dark green'));}
section('Roots, ferns and moon rocks',plants);