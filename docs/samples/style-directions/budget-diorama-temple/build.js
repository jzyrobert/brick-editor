script({title:'Lotus Bells — an Autumn Buddhist Temple',description:'An irimoya-roofed worship hall and three-storey pagoda overlook a lotus pond. An arched vermilion bridge leads to the veranda; a suspended bell waits beneath its own pavilion. Autumn maple, stone lanterns, an open golden altar and a ringed sorin complete the temple precinct.',palette:{stone:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']},wood:'dark red',roof:'dark bluish grey',plaster:'white'},defaults:{interior:'empty'}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const paving=(at,size,colour='stone',layers=1)=>floor({at,size,colour,layers,top:'tile'});
section('Connected chamfered display',[
 floor({at:[2,0,0],size:[42,36],layers:3,colour:'black'}),floor({at:[0,0,2],size:[46,32],layers:3,colour:'black'}),
 floor({at:[2,3,1],size:[42,34],colour:'dark tan',holes:[{at:[3,4],size:[17,13]}]}),floor({at:[1,3,3],size:[44,30],colour:'dark tan',holes:[{at:[3,4],size:[17,13]}]}),
 paving([3,3,4],[17,13],'dark turquoise'),
 paving([29,4,2],[7,6]),paving([15,4,17],[15,3]),paving([9,4,15],[6,7]),
 box({at:[24,4,19],size:[18,5,11],colour:'stone',texture:'masonry',top:'tile'}),paving([23,9,16],[20,14],'reddish brown',2),
 box({at:[29,4,14],size:[8,5,2],colour:'stone',top:'tile'}),paving([29,9,14],[8,2],'reddish brown',2),
 stairs({at:[30,4,7],width:6,steps:7,dir:'+z',colour:'light bluish grey',top:'tile'}),
 box({at:[3,4,20],size:[12,5,12],colour:'stone',texture:'masonry',top:'tile'}),stairs({at:[7,4,17],width:4,steps:5,dir:'+z',colour:'light bluish grey',top:'tile'})
]);
function lotus(x,z){return [P('4032b',[x,4,z],'green'),P('4728',[x,5,z],'bright pink'),P('24866',[x,8,z],'yellow')];}
function rock(x,z,h,turn){return [box({at:[x,4,z],size:[2,h,2],colour:'dark bluish grey',interior:'solid'}),P('15068',[x,4+h,z],'light bluish grey',turn)];}
section('Lotus water and its banks',[
 lotus(5,6),lotus(16,12),lotus(6,13),
 ...[[2,5,2,90],[2,11,1,0],[18,5,2,270],[18,15,1,180],[4,17,2,0],[16,17,1,90]].map(a=>rock(...a)),
 P('32607',[1,4,17],'dark green',180),P('32607',[21,4,7],'green',90),P('32607',[21,4,13],'dark green',180),P('32607',[6,4,33],'dark green'),
 P('98138',[8,4,9],'white'),P('98138',[9,4,10],'orange'),P('98138',[16,4,7],'orange'),P('98138',[17,4,7],'white'),
 P('3069b',[4,4,10],'medium azure'),P('3069b',[14,4,5],'medium azure'),P('3069b',[15,4,15],'medium azure')
]);
section('Arched approach bridge',[
 P('3307',[10,4,5],'red',90),P('3307',[13,4,5],'red',90),paving([10,10,5],[4,6],'reddish brown'),
 stairs({at:[10,4,2],width:4,steps:3,rise:2,dir:'+z',colour:'reddish brown',top:'tile'}),stairs({at:[10,4,14],width:4,steps:3,rise:2,dir:'-z',colour:'reddish brown',top:'tile'}),
 ...[10,13].flatMap(x=>[...[5,8,10].map(z=>column({at:[x,11,z],height:6,colour:'dark red',cap:'plate'})),wall({from:[x,5],to:[x,10],y:17,height:1,colour:'dark red',top:'tile'})])
]);
function lattice(at){return {at,width:2,y:6,height:9,frame:'reddish brown',glass:'black'};}
section('Open worship hall',[
 room({at:[25,11,19],size:[16,21,10],colour:'plaster',quoins:'dark red',openings:[{side:'front',at:5,width:6,height:18,fill:'none'},...['front','back'].flatMap(side=>[2,12].map(at=>({side,...lattice(at)}))),...['left','right'].flatMap(side=>[2,6].map(at=>({side,...lattice(at)})))]}),
 ...[24,28,37,41].map(x=>column({at:[x,11,17],height:18,colour:'dark red',cap:'plate'})),
 wall({from:[24,17],to:[41,17],y:29,height:3,colour:'dark red'}),
 ...[24,41].map(x=>column({at:[x,11,28],height:21,colour:'dark red',cap:'plate'})),
 ...[25,29,36,40].map(x=>box({at:[x,11,18],size:[1,18,1],colour:'dark red',interior:'solid'})),
 paving([27,31,18],[12,1],'pearl gold'),
 ...[23,42].flatMap(x=>[fence({path:[[x,19],[x,26]],y:11,colour:'reddish brown',style:'lattice-low'}),P('3070b',[x,14,27],'reddish brown')]),
 fence({path:[[24,29],[40,29]],y:11,colour:'reddish brown',style:'lattice-low'}),
 box({at:[30,11,24],size:[6,3,3],colour:'dark brown',top:'tile'}),P('3960',[31,14,24],'pearl gold'),P('90398',[32,16,25],'pearl gold'),
 ...[30,35].flatMap(x=>[P('3062b',[x,14,24],'pearl gold'),P('6141',[x,17,24],'trans yellow')]),
 box({at:[31,11,20],size:[4,3,2],colour:'reddish brown',top:'tile'}),P('2412b',[32,14,20],'pearl gold'),
 ...[29,36].map(x=>column({at:[x,11,14],height:12,colour:'dark red',cap:'plate'})),
 wall({from:[29,14],to:[36,14],y:20,height:3,colour:'dark red'}),roof({style:'gable',at:[29,23,14],size:[8,4],overhang:0,ends:0,colour:'roof',gable:'dark red'})
]);
function curvedEaves(x,y,z,w,d){return [
 ...range(w).flatMap(i=>[P('13547',[x+i,y-3,z-4],'roof'),P('13547',[x+i,y-3,z+d],'roof',180)]),
 ...range(d).flatMap(i=>[P('13547',[x-4,y-3,z+i],'roof',90),P('13547',[x+w,y-3,z+i],'roof',270)]),
 paving([x,y,z-4],[w,3],'roof'),paving([x,y,z+d+1],[w,3],'roof'),paving([x-4,y,z],[3,d],'roof'),paving([x+w+1,y,z],[3,d],'roof')
];}
section('Sweeping irimoya roof',[
 ...curvedEaves(24,32,18,18,12),
 floor({at:[23,32,17],size:[20,14],colour:'dark bluish grey',holes:[{at:[27,21],size:[12,6]}],top:'tile'}),
 roof({style:'hip',at:[24,33,18],size:[18,12],colour:'roof',holes:[{at:[27,21],size:[12,6]}]}),
 room({at:[27,32,21],size:[12,10,6],colour:'white',quoins:'dark red',openings:[{side:'left',at:2,width:2,y:3,height:6,frame:'reddish brown',glass:'black'},{side:'right',at:2,width:2,y:3,height:6,frame:'reddish brown',glass:'black'}]}),
 roof({style:'gable',at:[27,42,21],size:[12,6],colour:'roof',gable:'white'}),
 ...[26,39].map(x=>P('4589',[x,54,24],'pearl gold'))
]);
function pagodaTier(i){const n=8-2*i,x=5+i,z=21+i,y=9+18*i,rt=y+18;return [
 room({at:[x,y,z],size:[n,18,n],colour:'white',quoins:'dark red',openings:['front','back','left','right'].map(side=>({side,at:Math.round((n-2)/2),width:2,y:6,height:9,frame:'reddish brown',glass:'black'}))}),
 floor({at:[x-3,rt-2,z-3],size:[n+6,n+6],colour:'dark red',top:'tile'}),floor({at:[x-4,rt-1,z-4],size:[n+8,n+8],colour:'roof',top:'tile'}),
 ...[0,n-1].flatMap(dx=>[0,n-1].map(dz=>P('3665a',[x+dx,rt-3,z+dz],'reddish brown',dz===0?0:180))),
 roof({style:'hip',at:[x-2,rt,z-2],size:[n+4,n+4],colour:'roof',holes:i<2?[{at:[x,z],size:[n,n]}]:[]}),
 ...[x-4,x+n+3].flatMap(cx=>[z-4,z+n+3].map(cz=>P('54200',[cx,rt,cz],'roof',cz<z?180:0)))
 ];}
section('Three storey pagoda and five-ring sorin',[
 ...range(3).flatMap(pagodaTier),
 P('4032b',[8,78,24],'black'),
 ...range(5).flatMap(i=>[P('3062b',[8,79+4*i,24],'pearl gold'),P('4032b',[8,82+4*i,24],'pearl gold')]),
 P('4589',[8,99,24],'pearl gold'),
 P('90398',[4,9,20],'light bluish grey'),P('90398',[13,9,20],'light bluish grey')
]);
component('Stone lantern',{size:[4,4],ops:[paving([0,0,0],[4,4],'dark bluish grey'),column({at:[1,1,1],height:6,diameter:2,colour:'light bluish grey'}),P('4032b',[1,7,1],'dark bluish grey'),P('3941',[1,8,1],'trans yellow'),roof({style:'hip',at:[1,11,1],size:[2,2],colour:'dark bluish grey'}),P('4589',[1,17,1],'light bluish grey')]});
section('Lantern-lit processional path',[instance({component:'Stone lantern',at:[23,4,9]}),instance({component:'Stone lantern',at:[37,4,12]})]);
section('Bell pavilion',[
 box({at:[37,4,3],size:[8,2,8],colour:'stone',texture:'masonry',top:'tile'}),
 ...[38,43].flatMap(x=>[4,9].map(z=>column({at:[x,6,z],height:15,colour:'dark red',cap:'plate'}))),
 floor({at:[38,21,4],size:[6,6],colour:'reddish brown'}),roof({style:'hip',at:[38,22,4],size:[6,6],colour:'roof'}),
 P('30151a',[40,16,6],'black'),P('4032b',[40,15,6],'black'),
 column({at:[43,6,5],height:9,colour:'reddish brown'}),wall({from:[41,5],to:[43,5],y:15,height:3,colour:'reddish brown',top:'tile'}),
 P('90398',[38,6,7],'tan'),paving([38,4,1],[5,2],'light bluish grey')
]);
section('Autumn maple behind the pond',[
 box({at:[18,4,30],size:[2,15,2],colour:'reddish brown',interior:'solid'}),floor({at:[14,18,30],size:[8,2],colour:'reddish brown'}),
 P('2417',[14,19,28],'dark orange'),P('2417',[17,20,29],'orange'),P('2423',[15,21,27],'dark red'),P('2423',[19,21,28],'dark orange',90),
 P('24866',[17,4,33],'orange'),P('24866',[20,4,32],'dark red'),P('24866',[17,4,27],'orange'),P('24866',[16,4,25],'dark red')
]);