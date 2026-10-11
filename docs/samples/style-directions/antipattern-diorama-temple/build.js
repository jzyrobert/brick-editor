script({title:'Temple of the Evening Bell',description:'A Japanese Buddhist precinct with a broad irimoya worship hall, a three-storey pagoda, an open shoro with a suspended bell and wooden striker, and a koi pond. Swept eaves, exposed timber, white shoji and a golden altar give the buildings their distinct forms.',palette:{timber:'dark red',wood:'reddish brown',plaster:'white',roof:'black',stone:{mix:['light bluish grey','light bluish grey','dark bluish grey']},moss:'dark green'}});
const W=56,D=44,Y=4;
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function perimeterEaves(x,y,z,w,d,short=false){const n=short?2:4,part=short?'24201':'13547';return [range(w).map(i=>p(part,x+i,y,z-n,'black')),range(w).map(i=>p(part,x+i,y,z+d,'black',180)),range(d).map(i=>p(part,x-n,y,z+i,'black',90)),range(d).map(i=>p(part,x+w,y,z+i,'black',270))];}
function lantern(x,z){return [floor({at:[x,Y,z],size:[4,4],colour:'stone'}),p('3941',x+1,Y+1,z+1,'light bluish grey'),p('3941',x+1,Y+4,z+1,'light bluish grey'),p('3031',x,Y+7,z,'light bluish grey'),[0,3].flatMap(a=>[0,3].map(b=>column({at:[x+a,Y+8,z+b],height:6,colour:'black'}))),p('3003',x+1,Y+8,z+1,'trans yellow'),p('3003',x+1,Y+11,z+1,'trans yellow'),roof({style:'hip',at:[x,Y+14,z],size:[4,4],colour:'black',overhang:0})];}
section('Connected display and gravel precinct',[
 floor({at:[0,0,0],size:[W,D],layers:3,colour:'black'}),
 floor({at:[1,3,1],size:[W-2,D-2],colour:'dark tan',holes:[{at:[17,4],size:[12,10]},{at:[33,1],size:[8,17]}]}),
 floor({at:[33,3,1],size:[8,17],colour:'light bluish grey',top:'tile'}),floor({at:[5,4,15],size:[28,3],colour:'light bluish grey',top:'tile'}),
 floor({at:[17,4,19],size:[4,3],colour:'moss'}),floor({at:[19,4,23],size:[3,17],colour:'moss'}),floor({at:[47,4,4],size:[7,11],colour:'moss'}),
 wall({from:[1,41],to:[54,41],y:Y,height:9,colour:'stone',texture:'masonry'}),roof({style:'gable',at:[1,13,41],size:[54,2],ridge:'x',overhang:0,ends:0,colour:'black'}),
 wall({from:[1,1],to:[1,40],y:Y,height:6,colour:'stone',texture:'masonry'}),roof({style:'gable',at:[1,10,1],size:[2,40],ridge:'z',overhang:0,ends:0,colour:'black'}),
 wall({from:[54,18],to:[54,40],y:Y,height:6,colour:'stone',texture:'masonry'}),roof({style:'gable',at:[54,10,18],size:[2,22],ridge:'z',overhang:0,ends:0,colour:'black'})
]);
section('Raised hondo and timber verandah',[
 box({at:[22,Y,18],size:[30,6,20],colour:'stone',supports:8}),floor({at:[22,10,18],size:[30,20],colour:'wood',top:'tile'}),
 stairs({at:[34,Y,11],width:6,steps:7,dir:'+z',rise:1,colour:'light bluish grey',top:'tile'}),
 room({at:[26,11,23],size:[22,21,12],colour:'plaster',openings:[{side:'front',at:8,width:6,height:18,fill:'none'},...[1,3,16,18].map(at=>({side:'front',at,width:2,y:6,height:6,frame:'wood',glass:'white'})),...[2,7].flatMap(at=>['left','right'].map(side=>({side,at,width:2,y:6,height:6,frame:'wood',glass:'white'}))),...[2,6,12,17].map(at=>({side:'back',at,width:2,y:6,height:6,frame:'wood',glass:'white'}))]}),
 [23,31,39,49].map(x=>column({at:[x,11,19],height:21,diameter:2,colour:'timber'})),[23,49].map(x=>column({at:[x,11,35],height:21,diameter:2,colour:'timber'})),
 [26,31,40,47].map(x=>column({at:[x,11,23],height:21,colour:'timber'})),[26,47].flatMap(x=>[28,34].map(z=>column({at:[x,11,z],height:21,colour:'timber'}))),[31,40].map(x=>column({at:[x,11,34],height:21,colour:'timber'})),
 floor({at:[26,32,23],size:[22,12],layers:3,colour:'wood'}),
 [19,35].map(z=>box({at:[22,32,z],size:[30,3,2],colour:'timber',interior:'solid'})),[22,50].map(x=>box({at:[x,32,21],size:[2,3,14],colour:'timber',interior:'solid'})),
 [23,27,43,47].map(x=>p('3633',x,11,18,'reddish brown')),[22,51].flatMap(x=>[22,26,30,34].map(z=>p('3633',x,11,z,'reddish brown',90))),
 box({at:[34,11,30],size:[6,3,3],colour:'timber',interior:'solid'}),floor({at:[35,14,30],size:[4,3],colour:'pearl gold'}),p('90398',36,15,31,'pearl gold'),p('90398',38,15,31,'pearl gold'),
 p('4032b',36,11,20,'dark bluish grey'),p('3941',36,12,20,'dark bluish grey'),p('4740',36,15,20,'pearl gold')
]);
section('Swept irimoya roof',[
 perimeterEaves(23,32,19,28,18),roof({style:'hip',at:[23,35,19],size:[28,18],colour:'roof',holes:[{at:[28,23],size:[18,10]}]}),
 room({at:[28,35,23],size:[18,12,10],colour:'plaster'}),roof({style:'gable',at:[28,47,23],size:[18,10],ridge:'x',overhang:0,ends:0,colour:'roof',gable:'plaster'})
]);
function pagodaStage(x,y,z,size,core,next,h){return [room({at:[core[0],y,core[1]],size:[core[2],h,core[2]],colour:'plaster',openings:[{side:'front',at:Math.round((core[2]-2)/2),width:2,y:3,height:6,frame:'wood',glass:'white'}]}),[0,core[2]-1].flatMap(a=>[0,core[2]-1].map(b=>column({at:[core[0]+a,y,core[1]+b],height:h,colour:'timber'}))),perimeterEaves(x,y+h-4,z,size,size,true),roof({style:'hip',at:[x,y+h,z],size:[size,size],colour:'roof',holes:next?[{at:[next[0],next[1]],size:[next[2],next[2]]}]:[]})];}
section('Three-storey Buddhist pagoda',[
 box({at:[3,Y,23],size:[16,6,18],colour:'stone',supports:6}),floor({at:[3,10,23],size:[16,18],colour:'wood',top:'tile'}),stairs({at:[8,Y,16],width:6,steps:7,dir:'+z',colour:'light bluish grey',top:'tile'}),
 pagodaStage(4,11,25,14,[6,27,10],[8,29,6],15),pagodaStage(6,26,27,10,[8,29,6],[9,30,4],18),pagodaStage(8,44,29,6,[9,30,4],null,15),
 p('3942c',10,71,31,'black'),range(7).flatMap(i=>[p('4740',10,77+i*4,31,'pearl gold'),p('3941',10,78+i*4,31,'black')]),p('3942c',10,105,31,'pearl gold'),p('4589',10,111,31,'pearl gold'),
 [4,14].flatMap(x=>[25,37].map(z=>column({at:[x,11,z],height:12,colour:'timber'}))),[4,14].flatMap(x=>[27,31].map(z=>p('3633',x,11,z,'reddish brown',90))),[4,8,12].map(x=>p('3633',x,11,39,'reddish brown'))
]);
section('Shoro with suspended bell',[
 box({at:[3,Y,4],size:[12,3,12],colour:'stone',texture:'masonry'}),floor({at:[3,7,4],size:[12,12],colour:'wood',top:'tile'}),stairs({at:[7,Y,1],width:4,steps:4,dir:'+z',colour:'stone'}),
 [4,12].flatMap(x=>[5,13].map(z=>column({at:[x,8,z],height:18,diameter:2,colour:'wood'}))),floor({at:[4,26,5],size:[10,10],layers:2,colour:'wood'}),
 p('3960',7,12,8,'dark bluish grey'),p('87081',7,14,8,'dark bluish grey'),p('3943b',7,17,8,'dark bluish grey'),p('3941',8,23,9,'dark bluish grey'),
 p('3009',9,14,2,'reddish brown',90),[5,7].map(z=>column({at:[9,17,z],height:9,colour:'black'})),
 perimeterEaves(4,25,5,10,10),roof({style:'hip',at:[4,28,5],size:[10,10],colour:'roof'}),[5,9].map(x=>p('3633',x,8,15,'reddish brown'))
]);
section('Pond, moss and approach lanterns',[
 floor({at:[17,3,4],size:[12,10],colour:'trans light blue',top:'tile'}),
 range(6).flatMap(i=>[p('3039',17+i*2,4,4,'dark bluish grey'),p('3039',17+i*2,4,12,'light bluish grey',180)]),range(3).flatMap(i=>[p('3039',17,4,6+i*2,'light bluish grey',90),p('3039',27,4,6+i*2,'dark bluish grey',270)]),
 p('32607',21,4,7,'green'),p('24866',21,5,7,'white'),p('32607',25,4,10,'green'),p('24866',25,5,10,'bright pink'),p('3069b',22,4,9,'orange'),p('54200',24,4,9,'white',270),p('3069b',20,4,11,'white'),
 p('2435',18,5,19,'dark green'),p('2435',50,5,8,'green'),p('30176',20,5,34,'green'),p('30176',20,8,34,'green'),
 lantern(29,4),lantern(42,4),lantern(29,10),lantern(42,10)
]);