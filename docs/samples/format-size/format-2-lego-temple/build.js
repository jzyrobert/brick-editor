script({title:'Temple of the Evening Bell',description:'A Japanese Buddhist precinct with an open golden Buddha hall, sweeping irimoya eaves, a three-storey relic pagoda, a suspended temple bell and an autumn maple. Tiled verandas, shoji screens, deep timber brackets and separate stone terraces make a complete walkable temple composition.',palette:{timber:'reddish brown',dark:'dark brown',stone:'light bluish grey',roof:'dark bluish grey',gold:'pearl gold',plaster:'tan'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
function screen(x,y,z,w,turn=0){return group({at:[x,y,z],turn,ops:[box({at:[0,0,0],size:[w,15,1],colour:'white',interior:'solid'}),box({at:[1,0,0],size:[1,15,1],colour:'dark',interior:'solid'}),...[3,7,11].map(h=>P('3710',[0,h,0],'timber'))]});}
function lantern(x,z){return group({at:[x,0,z],ops:[floor({at:[0,0,0],size:[4,4],colour:'stone',layers:1,top:'tile'}),P('3941',[1,1,1],'stone'),column({at:[1,4,1],height:6,diameter:1,colour:'stone'}),P('3022',[1,10,1],'stone'),P('3003',[1,11,1],'trans yellow'),P('3043',[1,14,1],'dark bluish grey')]});}
section('Stone terraces and approach',[floor({at:[-1,0,8],size:[26,18],layers:1,colour:'dark bluish grey'}),box({at:[-1,1,8],size:[26,4,18],colour:'stone',texture:'masonry',top:'tile'}),floor({at:[-1,5,8],size:[26,18],layers:2,colour:'timber',top:'tile'}),floor({at:[9,0,-4],size:[6,5],layers:1,colour:'stone',top:'tile'}),stairs({at:[9,1,1],width:6,steps:6,dir:'+z',colour:'stone',top:'tile'}),box({at:[9,0,7],size:[6,7,1],colour:'stone',top:'tile'}),...[8,15].map(x=>stairs({at:[x,1,1],width:1,steps:6,dir:'+z',colour:'dark bluish grey',top:'tile'})),lantern(2,0),lantern(19,2)]);
const hall=[];
hall.push(room({at:[1,7,11],size:[22,24,12],colour:'plaster',quoins:'timber',openings:[{side:'front',at:8,width:6,height:21,fill:'none'},{side:'front',at:2,width:4,y:3,height:15,fill:'none'},{side:'front',at:16,width:4,y:3,height:15,fill:'none'},{side:'back',at:2,width:4,y:3,height:15,fill:'none'},{side:'back',at:9,width:4,y:3,height:15,fill:'none'},{side:'back',at:16,width:4,y:3,height:15,fill:'none'},{side:'left',at:3,width:4,y:3,height:15,fill:'none'},{side:'right',at:3,width:4,y:3,height:15,fill:'none'}]}));
[3,17].forEach(x=>hall.push(screen(x,10,11,4)));
[3,10,17].forEach(x=>hall.push(screen(x,10,22,4)));
hall.push(screen(1,10,18,4,90),screen(22,10,18,4,90));
[1,8,15,22].forEach(x=>[11,22].forEach(z=>hall.push(column({at:[x,7,z],height:24,colour:'timber'}))));
[0,7,16,23].forEach(x=>hall.push(column({at:[x,7,8],height:(x===7||x===16)?20:23,colour:'timber'})));
[0,23].forEach(x=>[15,21,25].forEach(z=>hall.push(column({at:[x,7,z],height:23,colour:'timber'}))));
hall.push(floor({at:[0,28,8],size:[24,1],layers:2,colour:'dark'}),floor({at:[0,28,25],size:[24,1],layers:2,colour:'dark'}));
[0,23].forEach(x=>hall.push(floor({at:[x,28,9],size:[1,16],layers:2,colour:'dark'})));
[0,23].forEach(x=>[9,17].forEach(z=>hall.push(P('3185',[x,7,z],'reddish brown',90))));
[1,18].forEach(x=>hall.push(P('3185',[x,7,8],'reddish brown')));
[1,7,16,22].forEach(x=>hall.push(P('3665a',[x,27,7],'reddish brown')));
hall.push(box({at:[9,7,18],size:[6,2,5],colour:'dark',top:'tile'}),P('3960',[10,9,18],'gold'),P('15068',[10,11,18],'gold'),P('15068',[12,11,18],'gold'),box({at:[11,11,20],size:[2,9,2],colour:'gold',interior:'solid'}),P('15068',[11,20,20],'gold'),P('4032b',[11,23,20],'gold'),P('4589',[11,24,21],'gold'));
[10,13].forEach(x=>hall.push(P('3005',[x,14,19],'gold'),P('11477',[x,17,19],'gold'),P('98138',[x,20,20],'gold')));
[7,16].forEach(x=>hall.push(column({at:[x,7,19],height:6,colour:'gold'}),P('6141',[x,13,19],'white'),P('54200',[x,14,19],'trans yellow')));
hall.push(box({at:[9,7,12],size:[6,3,2],colour:'dark',top:'tile'}),...[9,11,13].map(x=>P('2412b',[x,10,12],'reddish brown')));
section('Buddha hall and timber veranda',hall);
const r=[];
r.push(floor({at:[-3,30,7],size:[30,20],layers:1,colour:'dark'}),box({at:[1,31,11],size:[22,3,12],colour:'roof'}),box({at:[1,34,14],size:[22,3,6],colour:'roof'}),box({at:[1,37,16],size:[22,3,2],colour:'roof'}));
for(let x=1;x<23;x++){r.push(P('61678',[x,31,7],'roof'),P('61678',[x,31,23],'roof',180));}
for(let z=11;z<23;z++){r.push(P('61678',[-3,31,z],'roof',90),P('61678',[23,31,z],'roof',270));}
for(const x of [-3,-1,23,25]){r.push(P('30363',[x,31,7],'roof'),P('30363',[x,31,23],'roof',180));}
for(let x=1;x<23;x+=2){r.push(P('3298',[x,34,11],'roof'),P('3298',[x,34,20],'roof',180),P('3039',[x,37,14],'roof'),P('3039',[x,37,18],'roof',180));if(x>1&&x<21)r.push(P('3043',[x,40,16],'roof'));}
[-3,26].forEach(x=>{r.push(P('13547',[x,27,7],'roof'),P('13547',[x,27,23],'roof',180));});
[1,22].forEach(x=>{r.push(box({at:[x,31,11],size:[1,3,12],colour:'plaster'}),box({at:[x,34,14],size:[1,3,6],colour:'plaster'}),box({at:[x,37,16],size:[1,3,2],colour:'plaster'}),box({at:[x,31,16],size:[1,9,2],colour:'timber'}));});
[1,21].forEach((x,i)=>r.push(box({at:[x,40,16],size:[2,4,2],colour:'roof',interior:'solid'}),P('3022',[x,44,16],'gold'),P('11477',[x,45,16],'gold',i?270:90),P('4589',[i?x:x+1,48,16],'gold')));
section('Sweeping irimoya roof',r);
function pagodaRoof(x,z,y,w,hole){const a=[floor({at:[x-1,y-1,z-1],size:[w+2,w+2],layers:1,colour:'dark',holes:hole?[{at:[hole[0],hole[1]],size:[hole[2],hole[2]]}]:[]}),roof({style:'hip',at:[x,y,z],size:[w,w],colour:'roof',holes:hole?[{at:[hole[0],hole[1]],size:[hole[2],hole[2]]}]:[]})];[x-1,x+w].forEach(xx=>a.push(P('13547',[xx,y-4,z-1],'roof'),P('13547',[xx,y-4,z+w-3],'roof',180)));return a;}
function pagodaStorey(x,y,z,w,h){return [room({at:[x,y,z],size:[w,h,w],colour:'plaster',quoins:'timber',openings:['front','back','left','right'].map(side=>({side,at:1,width:2,y:3,height:9,frame:'reddish brown',glass:'trans-clear'}))}),...[x,x+w-1].flatMap(xx=>[z,z+w-1].map(zz=>column({at:[xx,y,zz],height:h,colour:'timber'})))];}
const pagoda=[floor({at:[-18,0,16],size:[14,14],layers:2,colour:'dark bluish grey',top:'tile'}),box({at:[-17,2,17],size:[12,4,12],colour:'stone',texture:'masonry',top:'tile'}),floor({at:[-16,6,18],size:[10,10],layers:2,colour:'timber',top:'tile'}),...pagodaStorey(-14,8,20,6,15),...pagodaStorey(-14,23,20,6,18),...pagodaStorey(-13,41,21,4,18),floor({at:[-14,40,20],size:[6,6],layers:1,colour:'timber'}),floor({at:[-13,58,21],size:[4,4],layers:1,colour:'timber'}),...pagodaRoof(-16,18,23,10,[-14,20,6]),...pagodaRoof(-15,19,41,8,[-13,21,4]),...pagodaRoof(-14,20,59,6,[-12,22,2]),column({at:[-12,59,22],height:12,diameter:2,colour:'black'}),P('6141',[-12,71,22],'black')];
for(let i=0;i<5;i++){const y=72+3*i;pagoda.push(P('4740',[-12,y,22],'gold'),P('6141',[-12,y+1,22],'black'),P('6141',[-12,y+2,22],'black'));}pagoda.push(P('4589',[-12,87,22],'gold'));
section('Three-storey relic pagoda',pagoda);
const b=[];
b.push(floor({at:[30,0,2],size:[12,12],layers:2,colour:'dark bluish grey',top:'tile'}),box({at:[31,2,3],size:[10,3,10],colour:'stone',texture:'masonry',top:'tile'}),floor({at:[32,5,4],size:[8,8],layers:1,colour:'dark tan',top:'tile'}));
[32,39].forEach(x=>[4,11].forEach(z=>b.push(column({at:[x,6,z],height:17,colour:'timber'}))));
b.push(floor({at:[32,21,4],size:[8,8],layers:2,colour:'dark',holes:[{at:[33,5],size:[6,6]}]}),box({at:[32,21,5],size:[8,2,1],colour:'dark'}),box({at:[33,19,7],size:[6,2,2],colour:'dark'}),P('4032b',[35,9,7],'black'),P('3941',[35,10,7],'black'),P('3942c',[35,13,7],'black'),P('6140',[32,12,5],'reddish brown'),column({at:[32,15,5],height:6,colour:'black'}),column({at:[37,15,5],height:6,colour:'black'}),roof({style:'hip',at:[32,23,4],size:[8,8],colour:'roof'}),stairs({at:[34,0,0],width:4,steps:3,rise:2,dir:'+z',colour:'stone',top:'tile'}));
section('Shoro bell pavilion',b);
section('Autumn maple and moss',[floor({at:[-12,0,3],size:[7,6],layers:2,colour:'olive green'}),floor({at:[-10,0,1],size:[4,2],layers:1,colour:'olive green'}),column({at:[-9,2,5],height:15,colour:'timber'}),column({at:[-7,2,6],height:18,colour:'timber'}),box({at:[-10,16,5],size:[4,1,2],colour:'timber'}),P('2417',[-12,17,3],'dark red'),P('2417',[-9,20,4],'orange'),box({at:[-9,20,5],size:[1,3,1],colour:'timber'}),P('2423',[-10,23,3],'dark red'),P('15068',[-12,2,7],'dark bluish grey'),P('15068',[-6,2,3],'dark bluish grey'),P('32607',[-11,2,4],'dark green',180)]);