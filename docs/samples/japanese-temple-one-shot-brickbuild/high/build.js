script({title:'Temple of the Morning Bell',description:'A Japanese Buddhist temple courtyard with a five-storey pagoda, timber prayer hall, roofed entrance gate, suspended bronze bell, stone lanterns and a reflecting pond.',palette:{stone:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']},wood:'dark red',beam:'reddish brown',wall:'tan',roof:'black'},defaults:{interior:'empty'}});
const CX=52,CZ=33,Y=6,H=18;
const cores=[12,10,8,6,4],eaves=[16,14,12,10,8];
const stoneStep=(x,z,w)=>stairs({at:[x,1,z],width:w,steps:5,dir:'+z',rise:1,run:1,colour:'stone'});
section('Courtyard and garden',[
 ...[0,32].flatMap(x=>[0,16,32].map(z=>baseplate({at:[x,z],size:[32,16],colour:'dark bluish grey'}))),
 floor({at:[0,0,0],size:[64,48],colour:'dark tan'}),
 floor({at:[28,1,0],size:[8,24],colour:'stone',top:'tile'}),
 floor({at:[14,1,17],size:[34,4],colour:'stone',top:'tile'}),
 floor({at:[4,1,8],size:[16,10],colour:'dark bluish grey',top:'tile'}),
 floor({at:[5,2,9],size:[14,8],colour:'trans light blue',top:'tile'}),
 ...[0,1,2,3].map(i=>place({part:'3068b',at:[7+i*3,3,12+(i%2)],colour:'light bluish grey'})),
 stoneStep(14,19,8),stoneStep(48,18,8),
 place({part:'2435',at:[3,1,19],colour:'dark green'}),
 place({part:'2435',at:[38,1,39],colour:'dark green'}),
 place({part:'3471',at:[59,1,5],colour:'green'}),
 ...[[7,4],[16,4],[47,7],[57,16],[35,44]].map(([x,z])=>place({part:'6255',at:[x,1,z],colour:'green'})),
 ...[[5,21],[10,5],[18,6],[46,12],[55,5],[60,19]].map(([x,z],i)=>group({at:[x,1,z],ops:[place({part:'3024',at:[0,0,0],colour:'green'}),place({part:'24866',at:[0,1,0],colour:i%2?'white':'yellow'})]}))
]);
const hallWindows=(side,positions)=>positions.map(at=>({side,at,width:2,y:6,height:9,frame:'reddish brown',glass:'dark brown'}));
const hallPosts=[];
[5,11,17,23,29].forEach(x=>[25,40].forEach(z=>hallPosts.push(column({at:[x,6,z],height:24,diameter:1,colour:'wood'}),place({part:'3665a',at:[x,30,z===25?24:40],turn:z===25?0:180,colour:'beam'}))));
[30,35].forEach(z=>[5,30].forEach(x=>hallPosts.push(column({at:[x,6,z],height:24,diameter:1,colour:'wood'}),place({part:'3665a',at:[x===5?4:30,30,z],turn:x===5?90:270,colour:'beam'}))));
section('Main prayer hall',[
 box({at:[4,1,24],size:[28,4,18],colour:'stone',texture:'masonry',supports:8}),
 floor({at:[4,5,24],size:[28,18],colour:'beam',top:'tile'}),
 room({at:[7,6,27],size:[22,27,12],colour:'wall',quoins:'wood',openings:[{side:'front',at:9,width:4,height:18,frame:'reddish brown',door:'reddish brown',opens:'out'},...hallWindows('front',[2,6,15,19]),...hallWindows('back',[2,6,10,14,18]),...hallWindows('left',[2,6,9]),...hallWindows('right',[2,6,9])]}),
 ...hallPosts,
 floor({at:[5,33,25],size:[26,16],colour:'beam'}),
 roof({style:'gable',at:[5,34,25],size:[26,16],ridge:'x',colour:'roof',gable:'wall'}),
 ...[8,12,16,20,24,28].flatMap(x=>[place({part:'3069b',at:[x,27,27],colour:'pearl gold'}),place({part:'3004',at:[x,24,27],colour:'beam'})]),
 box({at:[15,6,34],size:[6,3,2],colour:'beam',interior:'solid'}),
 floor({at:[15,9,34],size:[6,2],colour:'pearl gold',top:'tile'}),
 place({part:'3942c',at:[17,10,34],colour:'pearl gold'}),
 ...[7,24].map(x=>fence({path:[[x,25],[x+3,25]],y:6,colour:'reddish brown',style:'lattice-low'})),
 ...[5,30].flatMap(x=>[26,31,36].map(z=>fence({path:[[x,z],[x,z+3]],y:6,colour:'reddish brown',style:'lattice-low'})))
]);
function pagodaTier(i){
 const c=cores[i],w=eaves[i],y=Y+i*H,x=CX-c/2,z=CZ-c/2,rx=CX-w/2,rz=CZ-w/2;
 const next=i<4?cores[i+1]:2;
 const positions=c>=10?[2,c-4]:[Math.round((c-2)/2)];
 const openings=['front','back','left','right'].flatMap(side=>positions.map(at=>({side,at,width:2,y:i===0?6:9,height:6,frame:'reddish brown',glass:'dark brown'})));
 if(i===0)openings.push({side:'front',at:4,width:4,height:18,frame:'reddish brown',door:'reddish brown',opens:'out'});
 const brackets=[];
 for(let p=2;p<c-2;p+=2){if(!(i===0&&p>=4&&p<=6))brackets.push(place({part:'3665a',at:[x+p,y+15,z-1],colour:'beam'}));brackets.push(place({part:'3665a',at:[x+p,y+15,z+c-1],turn:180,colour:'beam'}),place({part:'3665a',at:[x-1,y+15,z+p],turn:90,colour:'beam'}),place({part:'3665a',at:[x+c-1,y+15,z+p],turn:270,colour:'beam'}));}
 const edging=[];
 for(let p=0;p<w;p+=2)edging.push(place({part:'3069b',at:[rx+p,y+18,rz],colour:'wood'}),place({part:'3069b',at:[rx+p,y+18,rz+w-1],colour:'wood'}));
 for(let p=1;p<w-1;p+=2)edging.push(place({part:'3069b',at:[rx,y+18,rz+p],turn:90,colour:'wood'}),place({part:'3069b',at:[rx+w-1,y+18,rz+p],turn:90,colour:'wood'}));
 return [room({at:[x,y,z],size:[c,18,c],colour:'wall',quoins:'wood',openings}),...[[x,z],[x+c-1,z],[x,z+c-1],[x+c-1,z+c-1]].map(([px,pz])=>column({at:[px,y,pz],height:18,diameter:1,colour:'wood'})),...brackets,floor({at:[rx,y+17,rz],size:[w,w],colour:'beam'}),...edging,roof({style:'hip',at:[rx,y+19,rz],size:[w,w],overhang:i===0?1:0,colour:'roof',holes:[{at:[CX-next/2,CZ-next/2],size:[next,next]}]})];
}
section('Five-storey pagoda',[
 box({at:[42,1,23],size:[20,4,20],colour:'stone',texture:'masonry',supports:8}),
 floor({at:[42,5,23],size:[20,20],colour:'stone',top:'tile'}),
 ...range(5).map(pagodaTier),
 column({at:[51,96,32],height:18,diameter:2,colour:'black'}),
 ...[114,118,122].map(y=>place({part:'4032b',at:[51,y,32],colour:'pearl gold'})),
 ...[115,119].map(y=>place({part:'3941',at:[51,y,32],colour:'black'})),
 place({part:'3942c',at:[51,123,32],colour:'pearl gold'})
]);
component('stone-lantern',{size:[4,4],ops:[floor({at:[0,0,0],size:[4,4],colour:'stone'}),place({part:'3022',at:[1,1,1],colour:'dark bluish grey'}),column({at:[1,2,1],height:6,diameter:2,colour:'light bluish grey'}),place({part:'3022',at:[1,8,1],colour:'light bluish grey'}),place({part:'3941',at:[1,9,1],colour:'trans yellow'}),roof({style:'hip',at:[0,12,0],size:[4,4],overhang:0,ends:0,colour:'dark bluish grey'})]});
section('Entrance gate and stone lanterns',[
 ...[[25,7],[37,7],[25,11],[37,11]].map(([x,z])=>column({at:[x,1,z],height:18,diameter:2,colour:'wood'})),
 floor({at:[24,19,6],size:[16,8],layers:2,colour:'beam'}),
 roof({style:'hip',at:[24,21,6],size:[16,8],colour:'roof'}),
 ...[29,33].flatMap(x=>[place({part:'4032b',at:[x,15,9],colour:'pearl gold'}),place({part:'3941',at:[x,16,9],colour:'trans yellow'})]),
 ...[[20,16],[39,16],[20,4],[40,4]].map(([x,z])=>instance({component:'stone-lantern',at:[x,1,z]}))
]);
section('Bell pavilion',[
 floor({at:[34,1,28],size:[6,6],colour:'stone',top:'tile'}),
 ...[[34,28],[39,28],[34,33],[39,33]].map(([x,z])=>column({at:[x,2,z],height:15,diameter:1,colour:'beam'})),
 floor({at:[34,17,28],size:[6,6],colour:'beam'}),
 roof({style:'hip',at:[34,18,28],size:[6,6],colour:'roof'}),
 place({part:'4032b',at:[36,10,30],colour:'pearl gold'}),
 place({part:'3942c',at:[36,11,30],colour:'pearl gold'})
]);