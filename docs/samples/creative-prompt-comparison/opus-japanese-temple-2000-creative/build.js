script({title:'Kiyomizu Stage in Autumn', description:'A hillside Japanese Buddhist temple in maple season: the main hall stands on a timber stage cantilevered over a ravine on tiers of pillars and tie beams, flanked by wing pavilions, beside a vermilion three-storey pagoda, a bronze-bell pavilion, a red gate, the Otowa spring falling from the stone wall and a tea bench under a red parasol.', palette:{stone:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']}, rock:{mix:['dark bluish grey','light bluish grey','dark bluish grey']}, wood:'reddish brown', lacquer:'red', plaster:'white', tile:'dark bluish grey', deck:'dark tan', water:'trans light blue', grass:'green', gold:'pearl gold'}});
const upturn=(x0,x1,z0,z1,y)=>[place({part:'11477',at:[x0,y,z0],colour:'tile',turn:180}),place({part:'11477',at:[x1,y,z0],colour:'tile',turn:180}),place({part:'11477',at:[x0,y,z1-1],colour:'tile',turn:0}),place({part:'11477',at:[x1,y,z1-1],colour:'tile',turn:0})];
const toro=(x,y,z)=>[place({part:'3022',at:[x,y,z],colour:'light bluish grey'}),place({part:'3941',at:[x,y+1,z],colour:'light bluish grey'}),place({part:'3022',at:[x,y+4,z],colour:'dark bluish grey'}),place({part:'3941',at:[x,y+5,z],colour:'trans yellow'}),place({part:'3943b',at:[x-1,y+8,z-1],colour:'light bluish grey'})];
const rock=(at,size)=>box({at,size,colour:'rock',interior:'solid'});
const tree=(at,colour)=>place({part:'3470',at,colour});
const pine=(at)=>place({part:'2435',at,colour:'dark green'});
const lat=(x,y,z,turn,colour)=>place({part:'3185',at:[x,y,z],colour:colour||'wood',turn:turn||0});
// Ring of bracket sets (inverted slopes) hanging under an eave skirt around a body x..x+w-1, z..z+d-1.
const brackets=(x,z,w,d,y,colour)=>[...range(w).flatMap(i=>[place({part:'3665a',at:[x+i,y,z-2],colour,turn:0}),place({part:'3665a',at:[x+i,y,z+d],colour,turn:180})]),...range(d).flatMap(i=>[place({part:'3665a',at:[x-2,y,z+i],colour,turn:90}),place({part:'3665a',at:[x+w,y,z+i],colour,turn:270})])];
section('Hillside',[
 baseplate({at:[-24,-24],size:[48,48],colour:'green'}),
 box({at:[-24,0,6],size:[48,18,18],colour:'stone',texture:'masonry',interior:'empty'}),
 floor({at:[-24,18,6],size:[48,18],colour:'grass',layers:2,holes:[{at:[-12,6],size:[2,4]}]}),
 floor({at:[-12,18,6],size:[2,4],colour:'water',layers:2,top:'tile'}),
 box({at:[-12,0,5],size:[2,20,1],colour:'water',interior:'solid'}),
 rock([-14,20,9],[5,3,3]),
 floor({at:[-24,0,-24],size:[18,11],colour:'water',top:'tile'}),
 floor({at:[-13,0,-13],size:[4,18],colour:'water',top:'tile'}),
 place({part:'98138',at:[-18,0,-20],colour:'orange'}),place({part:'98138',at:[-15,0,-17],colour:'white'}),place({part:'98138',at:[-20,0,-16],colour:'orange'}),place({part:'98138',at:[-10,0,-21],colour:'orange'}),
 rock([-6,0,-18],[3,3,3]),rock([-9,0,-12],[3,6,2]),rock([-24,0,-12],[6,6,4]),rock([-24,0,0],[5,9,6]),rock([-19,0,2],[4,6,4]),rock([-16,0,-5],[2,3,3]),rock([20,0,-4],[4,6,10]),rock([20,6,0],[4,6,6]),rock([21,12,2],[3,3,4]),rock([-6,0,4],[4,6,2]),rock([5,0,4],[6,4,2]),
 place({part:'2417',at:[-24,9,0],colour:'orange'}),place({part:'2423',at:[-24,6,-12],colour:'red'}),place({part:'2423',at:[20,6,-4],colour:'orange'}),place({part:'2423',at:[-19,6,2],colour:'red'}),place({part:'32607',at:[21,15,3],colour:'orange'}),
 stairs({at:[17,0,-4],width:3,steps:10,dir:'+z',rise:2,colour:'stone'}),
 ...[[10,-23],[11,-20],[10,-17],[11,-14],[10,-11]].map(([x,z],i)=>place({part:'3068b',at:[x,0,z],colour:i%2?'dark bluish grey':'light bluish grey'})),
 floor({at:[10,0,-9],size:[11,5],colour:'stone',top:'tile'}),
 tree([-23,20,6],'red'),tree([-3,0,-23],'red'),tree([-21,0,-6],'red'),pine([-17,0,-10]),pine([20,0,-23]),pine([21,20,7]),
 ...toro(12,0,-12),...toro(7,0,-9),...toro(-10,20,6),...toro(15,20,10),...toro(-5,0,-10),
 ...[[1,-15],[4,-15],[1,-14],[4,-14],[6,-18],[7,-18],[6,-15],[7,-15]].map(([x,z])=>place({part:'3005',at:[x,0,z],colour:'reddish brown'})),
 floor({at:[1,3,-15],size:[4,2],colour:'red'}),floor({at:[6,3,-18],size:[2,4],colour:'red'}),
 place({part:'6141',at:[2,4,-15],colour:'white'}),place({part:'6141',at:[3,4,-14],colour:'white'}),
 place({part:'3957a',at:[3,0,-17],colour:'reddish brown'}),place({part:'3943b',at:[2,12,-18],colour:'red'}),
 scatter({region:{at:[-6,-14],size:[6,6]},parts:['24866','98138'],colours:['red','orange','yellow'],density:0.3,spacing:1})
]);
const sx=[-7,-3,1,5,9,13], sz=[-6,-3,0,3];
const wing=(x,z)=>[
 ...[[x,z],[x+3,z],[x,z+3],[x+3,z+3]].map(([a,b])=>column({at:[a,22,b],height:'3b',colour:'wood'})),
 floor({at:[x-2,31,z-2],size:[8,8],colour:'tile'}),
 roof({style:'hip',at:[x,32,z],size:[4,4],colour:'tile'}),
 ...upturn(x-2,x+5,z-2,z+5,32)];
section('Stage',[
 floor({at:[-7,20,-6],size:[21,15],colour:'deck',layers:2,top:'tile'}),
 ...sx.flatMap(x=>sz.flatMap(z=>[0,7,14].map(y=>column({at:[x,y,z],height:'2b',colour:'wood'})))),
 ...[6,13].flatMap(y=>[...sz.map(z=>floor({at:[-7,y,z],size:[21,1],colour:'wood'})),floor({at:[-7,y,-6],size:[1,10],colour:'wood'}),floor({at:[13,y,-6],size:[1,10],colour:'wood'})]),
 fence({path:[[-7,7],[-7,-6],[13,-6],[13,2]],y:22,colour:'wood',style:'spindle'}),
 ...wing(-6,-5),...wing(9,-5),
 place({part:'3941',at:[2,22,-2],colour:'dark bluish grey'}),place({part:'4032b',at:[2,25,-2],colour:'dark bluish grey'}),place({part:'3062b',at:[2,26,-2],colour:'trans-clear'}),place({part:'3062b',at:[2,29,-2],colour:'trans-clear'}),
 place({part:'3001',at:[2,22,6],colour:'reddish brown'}),...[[2,6],[4,6],[2,7],[4,7]].map(([x,z])=>place({part:'2412b',at:[x,25,z],colour:'black'})),
 place({part:'93059',at:[-1,22,3],colour:'tan'}),place({part:'93059',at:[7,22,1],colour:'dark tan'}),place({part:'4332',at:[11,22,3],colour:'reddish brown'})
]);
const hp=[-7,-2,3,8,13];
section('Main hall',[
 floor({at:[-8,20,9],size:[23,14],colour:'stone',layers:2,top:'tile'}),
 fence({path:[[-8,9],[-8,22],[14,22],[14,9]],y:22,colour:'wood',style:'spindle'}),
 room({at:[-7,22,10],size:[21,18,12],colour:'plaster',openings:[
  ...[1,16].map(a=>({side:'front',at:a,width:4,y:3,height:12,fill:'none'})),
  ...[6,11].map(a=>({side:'front',at:a,width:4,height:18,frame:'wood',door:'wood'})),
  ...[1,6,11,16].map(a=>({side:'back',at:a,width:4,y:3,height:12,fill:'none'})),
  ...[1,6].map(a=>({side:'left',at:a,width:4,y:3,height:12,fill:'none'})),
  ...[1,6].map(a=>({side:'right',at:a,width:4,y:3,height:12,fill:'none'}))]}),
 ...[1,16].flatMap(a=>[lat(-7+a,25,10),lat(-7+a,31,10),place({part:'3010',at:[-7+a,22,10],colour:'wood'})]),
 ...[1,6,11,16].flatMap(a=>[lat(-7+a,25,21),lat(-7+a,31,21),place({part:'3010',at:[-7+a,22,21],colour:'wood'})]),
 ...[-7,13].flatMap(x=>[1,6].flatMap(a=>[lat(x,25,10+a,90),lat(x,31,10+a,90),place({part:'3010',at:[x,22,10+a],colour:'wood',turn:90})])),
 ...hp.flatMap(x=>[10,21].map(z=>column({at:[x,22,z],height:'6b',colour:'wood'}))),
 column({at:[-7,22,15],height:'6b',colour:'wood'}),column({at:[13,22,15],height:'6b',colour:'wood'}),
 floor({at:[-7,40,10],size:[21,12],colour:'wood'}),
 ...brackets(-7,10,21,12,38,'wood'),
 floor({at:[-9,41,8],size:[25,16],colour:'tile'}),
 roof({style:'hip',at:[-7,42,10],size:[21,12],colour:'tile',holes:[{at:[-4,13],size:[15,6]}]}),
 box({at:[-3,42,13],size:[13,12,6],colour:'plaster'}),
 roof({style:'gable',at:[-3,54,13],size:[13,6],colour:'tile',ridge:'x',gable:'wood'}),
 ...upturn(-9,15,8,23,42)
]);
const tier=(x,z,n,y,h,ly)=>{
 const c=[[x,z],[x+n-1,z],[x,z+n-1],[x+n-1,z+n-1]].map(([a,b])=>column({at:[a,y,b],height:(h/3)+'b',colour:'lacquer'}));
 const o=(n-4)/2;
 const d=n>=6?[lat(x+o,ly,z,0,'lacquer'),lat(x+o,ly,z+n-1,0,'lacquer'),lat(x,ly,z+o,90,'lacquer'),lat(x+n-1,ly,z+o,90,'lacquer')]:[0,3].flatMap(dy=>[place({part:'2877',at:[x+1,ly+dy,z],colour:'lacquer'}),place({part:'2877',at:[x+1,ly+dy,z+n-1],colour:'lacquer'}),place({part:'2877',at:[x,ly+dy,z+1],colour:'lacquer',turn:90}),place({part:'2877',at:[x+n-1,ly+dy,z+1],colour:'lacquer',turn:90})]);
 return [room({at:[x,y,z],size:[n,h,n],colour:'plaster'}),...c,...d,...brackets(x,z,n,n,y+h-3,'lacquer')];
};
section('Pagoda',[
 floor({at:[-22,20,12],size:[10,10],colour:'stone',layers:2,top:'tile'}),
 ...tier(-21,13,8,22,12,25),
 floor({at:[-23,34,11],size:[12,12],colour:'tile'}),
 roof({style:'hip',at:[-21,35,13],size:[8,8],colour:'tile',holes:[{at:[-20,14],size:[6,6]}]}),
 ...upturn(-23,-12,11,22,35),
 ...tier(-20,14,6,35,15,43),
 floor({at:[-22,50,12],size:[10,10],colour:'tile'}),
 roof({style:'hip',at:[-20,51,14],size:[6,6],colour:'tile',holes:[{at:[-19,15],size:[4,4]}]}),
 ...upturn(-22,-13,12,21,51),
 ...tier(-19,15,4,51,15,59),
 floor({at:[-21,66,13],size:[8,8],colour:'tile'}),
 roof({style:'hip',at:[-19,67,15],size:[4,4],colour:'tile',holes:[{at:[-18,16],size:[2,2]}]}),
 ...upturn(-21,-14,13,20,67),
 box({at:[-18,67,16],size:[2,6,2],colour:'dark bluish grey',interior:'solid'}),
 place({part:'3941',at:[-18,73,16],colour:'dark bluish grey'}),
 ...range(9).map(i=>place({part:'4032b',at:[-18,76+i,16],colour:i%2?'dark bluish grey':'pearl gold'})),
 place({part:'3942c',at:[-18,85,16],colour:'pearl gold'})
]);
section('Bell pavilion',[
 floor({at:[15,0,-18],size:[7,6],colour:'stone',layers:3,top:'tile'}),
 ...[[15,-18],[21,-18],[15,-13],[21,-13]].map(([x,z])=>column({at:[x,3,z],height:'4b',colour:'wood'})),
 floor({at:[13,15,-20],size:[11,10],colour:'tile'}),
 roof({style:'hip',at:[15,16,-18],size:[7,6],colour:'tile'}),
 ...upturn(13,23,-20,-11,16),
 place({part:'3941',at:[17,12,-16],colour:'sand green'}),place({part:'3941',at:[17,9,-16],colour:'sand green'}),place({part:'4032b',at:[17,8,-16],colour:'sand green'}),
 place({part:'30136',at:[19,12,-16],colour:'reddish brown'})
]);
section('Gate',[
 column({at:[16,0,-7],height:'5b',colour:'lacquer'}),column({at:[20,0,-7],height:'5b',colour:'lacquer'}),
 floor({at:[15,15,-7],size:[7,2],colour:'lacquer'}),
 roof({style:'gable',at:[15,16,-7],size:[7,2],colour:'tile',ridge:'x',gable:'lacquer'})
]);
section('Otowa spring',[
 ...[[-14,1],[-9,1],[-14,4],[-9,4]].map(([x,z])=>column({at:[x,0,z],height:'3b',colour:'lacquer'})),
 floor({at:[-14,9,1],size:[6,4],colour:'lacquer'}),
 roof({style:'gable',at:[-14,10,2],size:[6,2],colour:'tile',ridge:'x',gable:'lacquer'})
]);
section('Amida hall',[
 floor({at:[16,20,13],size:[8,8],colour:'stone',layers:2,top:'tile'}),
 room({at:[17,22,14],size:[6,12,6],colour:'plaster',openings:[{side:'front',at:1,width:4,height:12,fill:'none'},{side:'right',at:1,width:4,y:3,height:6,fill:'none'},{side:'back',at:1,width:4,y:3,height:6,fill:'none'}]}),
 ...[[17,14],[22,14],[17,19],[22,19]].map(([x,z])=>column({at:[x,22,z],height:'4b',colour:'lacquer'})),
 lat(18,22,14,0,'lacquer'),lat(18,28,14,0,'lacquer'),lat(22,25,15,90,'lacquer'),lat(18,25,19,0,'lacquer'),
 floor({at:[16,34,13],size:[8,8],colour:'tile'}),
 roof({style:'hip',at:[17,35,14],size:[6,6],colour:'tile',overhang:0}),
 ...upturn(16,23,13,20,35)
]);