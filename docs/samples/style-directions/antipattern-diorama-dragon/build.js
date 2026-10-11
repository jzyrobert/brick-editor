script({title:"The Last Ember",description:"An emerald dragon shelters its ivory egg on fractured basalt above glowing lava. Broad scalloped wings, swept horns, planted talons and a hooked tail frame the nest.",palette:{skin:"dark green",scale:"green",wing:"dark red",bone:"tan",rock:"dark bluish grey"}});
const W=48,D=40,G=11;
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function rim(){const a=[];for(let x=0;x<W;x+=4){a.push(p('2431',x,3,0,'black'),p('2431',x,3,D-1,'black'));}for(let z=1;z<D-1;z+=2){a.push(p('3069b',0,3,z,'black',90),p('3069b',W-1,3,z,'black',90));}return a;}
function rock(x,z,w,d,h){return box({at:[x,5,z],size:[w,h,d],colour:'rock'});}
function boulder(x,z,w,d,h){return [box({at:[x,5,z],size:[w,h,d],colour:'rock'}),...range(Math.floor(w/2)).map(i=>p('3678b',x+2*i,5+h,z,'dark bluish grey'))];}
section('Basalt and ember fissures',[
 floor({at:[0,0,0],size:[W,D],layers:3,colour:'black'}),floor({at:[1,3,1],size:[46,38],layers:2,colour:'dark bluish grey'}),rim(),
 floor({at:[3,5,4],size:[12,12],colour:'trans orange',top:'tile'}),floor({at:[5,5,16],size:[6,16],colour:'trans red',top:'tile'}),floor({at:[7,5,32],size:[9,4],colour:'orange',top:'tile'}),
 rock(15,16,18,20,6),rock(11,21,4,12,6),rock(33,19,5,14,6),rock(17,11,16,5,6),rock(19,5,12,8,6),rock(8,33,7,5,6),rock(15,36,16,2,6),
 boulder(3,5,4,4,3),boulder(10,6,4,3,2),boulder(3,23,2,5,6),boulder(40,27,4,6,6),boulder(39,7,4,4,3),boulder(3,34,2,3,3),
 ...range(8).map(i=>p('3039',11+i*3,5,2+(i%2),'dark bluish grey',180)),
 ...range(5).map(i=>p('3039',39,5,13+i*2,'dark bluish grey',270)),
 ...range(5).map(i=>p('3039',5,6,9+i*4,'black',90)),
 ...range(5).map(i=>p('54200',6,6,11+i*4,'trans yellow'))
]);
function foot(x,z){return [...range(3).map(i=>p('3032',x,G+i,z,'skin',90)),p('3031',x,G+3,z+2,'skin'),...[0,1,3].map(i=>p('15070',x+i,G+3,z,'tan')),p('15068',x,G+4,z+2,'skin'),p('15068',x+2,G+4,z+2,'skin')];}
function hindleg(x,turn){return [box({at:[x,14,27],size:[5,12,5],colour:'skin'}),p('3037',x,26,27,'skin',turn),p('3037',x+2,26,27,'skin',turn),...range(3).map(i=>p('11477',x,17+i*3,25,'skin'))];}
function foreleg(x){return [box({at:[x,14,17],size:[3,15,4],colour:'skin'}),p('15068',x,29,17,'skin'),p('11477',x+2,29,17,'scale'),...range(3).map(i=>p('11477',x,17+i*3,15,'skin'))];}
section('Four planted limbs',[foot(13,25),foot(30,25),foot(16,14),foot(29,14),hindleg(16,90),hindleg(28,270),foreleg(18),foreleg(28)]);
section('Chest and rising neck',[
 box({at:[19,23,20],size:[10,15,12],colour:'skin'}),floor({at:[19,38,20],size:[10,12],colour:'skin'}),
 box({at:[17,26,20],size:[2,6,12],colour:'skin'}),box({at:[29,26,20],size:[2,6,12],colour:'skin'}),
 ...range(6).map(i=>[p('3660b',17,23,20+2*i,'skin',90),p('3660b',29,23,20+2*i,'skin',270),p('15068',17,32,20+2*i,'skin',90),p('15068',29,32,20+2*i,'skin',270)]),
 ...range(5).map(i=>[p('15068',19+2*i,39,20,'skin'),p('15068',19+2*i,39,30,'skin',180)]),
 ...[22,24,28].map(z=>[p('15068',19,39,z,'skin',90),p('15068',27,39,z,'skin',270)]),
 box({at:[21,29,15],size:[6,9,7],colour:'skin'}),box({at:[21,38,12],size:[6,9,7],colour:'skin'}),box({at:[20,47,11],size:[8,6,5],colour:'skin'}),
 ...range(3).map(i=>p('3039',23,29+i*3,13,'tan')),
 ...range(3).map(i=>p('3039',23,38+i*3,10,'tan')),
 ...range(3).map(i=>[p('11477',20,38+i*3,13,'scale',90),p('11477',27,38+i*3,13,'scale',270)]),
 ...range(3).map(i=>[p('3022',23,39,23+i*3,'skin'),p('3942c',23,40,23+i*3,'tan')]),
 p('3022',23,47,18,'skin'),p('3942c',23,48,18,'tan')
]);
function tailSegment(x,y,z,w,d,h,turn){return [box({at:[x,y,z],size:[w,h,d],colour:'skin'}),...range(Math.floor(w/2)).map(i=>p('15068',x+2*i,y+h,z,'skin',turn))];}
section('Hooked tapering tail',[
 tailSegment(22,11,31,6,6,9,180),tailSegment(17,11,34,6,4,6,180),tailSegment(12,11,35,5,3,5,90),tailSegment(8,11,33,4,3,4,90),tailSegment(6,5,29,3,6,7,0),tailSegment(7,5,26,2,4,4,0),
 p('3022',24,20,34,'skin'),p('3942c',24,21,34,'tan'),p('3022',19,17,36,'skin'),p('4589',19,18,36,'tan'),p('3024',13,16,36,'skin'),p('4589',13,17,36,'tan'),p('54200',7,12,30,'scale')
]);
function interp(points,x){for(let i=1;i<points.length;i++){if(x<=points[i][0]){const a=points[i-1],b=points[i];return Math.round(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}}return points[points.length-1][1];}
function wing(right){const a=[],lo=[[2,45],[5,39],[8,46],[12,32],[15,40],[20,29]],hi=[[2,47],[8,63],[12,60],[20,39]],ids={1:'3005',2:'3004',3:'3622',4:'3010',6:'3009'};for(let y=29;y<=63;y+=3){let cells=[];for(let x=2;x<=20;x++){let b=interp(lo,x),t=interp(hi,x);if(y>=b&&y+2<=t){let colour=(y-b<3||t-y<5||x===20)?'skin':'wing';cells.push({x:right?47-x:x,c:colour});}}cells.sort((a,b)=>a.x-b.x);for(let j=0;j<cells.length;){let q=cells[j],n=1;while(j+n<cells.length&&n<6&&cells[j+n].x===q.x+n&&cells[j+n].c===q.c)n++;const len=[6,4,3,2,1].find(v=>v<=n);a.push(p(ids[len],q.x,y,27,q.c));j+=len;}}return a;}
section('Two scalloped bat wings',[wing(false),wing(true)]);
section('Watchful horned face',[
 box({at:[20,40,6],size:[8,3,10],colour:'skin'}),floor({at:[21,43,7],size:[6,7],colour:'dark red'}),
 ...range(3).map(i=>[p('15070',20,43,7+i*2,'white',90),p('15070',27,43,7+i*2,'white',270)]),
 box({at:[20,47,7],size:[8,6,8],colour:'skin'}),box({at:[21,46,4],size:[6,3,4],colour:'skin'}),
 p('15068',21,49,4,'skin'),p('15068',23,49,4,'skin'),p('15068',25,49,4,'skin'),
 p('3070b',21,52,5,'black'),p('3070b',26,52,5,'black'),
 p('3005',20,49,8,'yellow'),p('3005',27,49,8,'yellow'),p('54200',20,52,8,'black'),p('54200',27,52,8,'black'),
 p('11477',19,53,9,'skin',90),p('11477',27,53,9,'skin',270),
 floor({at:[20,53,11],size:[8,4],colour:'skin'}),
 p('40379',20,54,11,'tan',180),p('40379',27,54,11,'tan',180),
 p('3040b',19,47,13,'scale',90),p('3040b',28,47,13,'scale',270),
 p('15068',22,54,11,'skin'),p('15068',24,54,11,'skin')
]);
function nestRing(){const a=[];for(let x=20;x<=28;x+=2){a.push(p('30136',x,11,5,'reddish brown'),p('30136',x,11,13,'reddish brown'));}for(let z=7;z<=11;z+=2){a.push(p('30136',19,11,z,'reddish brown',90),p('30136',29,11,z,'reddish brown',90));}return a;}
section('The guarded egg',[
 floor({at:[20,11,6],size:[9,7],colour:'dark tan'}),nestRing(),
 cylinder({at:[23,12,8],diameter:4,height:6,colour:'tan'}),dome({at:[23,18,8],diameter:4,colour:'white'}),
 p('54200',21,12,7,'dark tan'),p('54200',27,12,11,'dark tan',180),p('54200',21,12,11,'dark tan',90)
]);