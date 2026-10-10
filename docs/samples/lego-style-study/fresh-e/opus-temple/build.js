script({title:'Kiyomizu Hillside Temple',description:'A vermilion three-storey pagoda and an irimoya-roofed main hall above a stilted wooden stage on an autumn hillside.',palette:{wood:'reddish brown',beam:'dark brown',verm:'red',plaster:'white',deck:'dark tan',roof:{mix:['dark bluish grey','dark bluish grey','black']},hill:{mix:['dark green','dark green','green','dark bluish grey']},rock:{mix:['dark bluish grey','light bluish grey','light bluish grey','dark green']},stone:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']}}});

// Stone lantern (toro)
component('toro',{size:[2,2],ops:[
  place({part:'3022',at:[0,0,0],colour:'light bluish grey'}),
  place({part:'3941',at:[0,1,0],colour:'light bluish grey'}),
  place({part:'3022',at:[0,4,0],colour:'light bluish grey'}),
  place({part:'3062b',at:[0,5,0],colour:'trans yellow'}),
  place({part:'3062b',at:[1,5,1],colour:'trans yellow'}),
  place({part:'3062b',at:[1,5,0],colour:'light bluish grey'}),
  place({part:'3062b',at:[0,5,1],colour:'light bluish grey'}),
  place({part:'3022',at:[0,8,0],colour:'light bluish grey'}),
  place({part:'3942c',at:[0,9,0],colour:'light bluish grey'})
]});

// Eave corners: an upturned tip on top, a gold wind bell hanging beneath
const eave=(x,y,z,w,d,colour)=>[[x,z,180],[x+w-1,z,180],[x,z+d-1,0],[x+w-1,z+d-1,0]].map(([cx,cz,t])=>[
  place({part:'54200',at:[cx,y+1,cz],colour,turn:t}),
  place({part:'3062b',at:[cx,y-3,cz],colour:'pearl gold'})]);

section('Hillside',[
  box({at:[0,0,24],size:[60,18,18],colour:'hill'}),
  stairs({at:[3,0,12],width:34,steps:4,rise:3,run:3,dir:'+z',colour:'rock'}),
  box({at:[37,0,14],size:[6,12,10],colour:'rock'}),
  box({at:[47,0,12],size:[13,9,12],colour:'rock'}),
  box({at:[50,0,6],size:[10,4,6],colour:'rock'}),
  box({at:[-3,0,27],size:[3,9,9],colour:'rock'}),
  box({at:[6,0,42],size:[12,8,3],colour:'rock'}),
  box({at:[29,0,42],size:[9,5,2],colour:'rock'}),
  box({at:[48,0,42],size:[8,12,3],colour:'rock'}),
  stairs({at:[43,0,6],width:4,steps:18,dir:'+z',colour:'stone'}),
  scatter({region:{at:[47,12],size:[5,12]},parts:['24866'],colours:['green','dark green','lime'],density:0.35}),
  scatter({region:{at:[38,14],size:[5,10]},parts:['24866'],colours:['green','dark green','lime'],density:0.35})
]);

const SX=[4,9,14,19,24,29,34], SZ=[5,10,15,20];
section('Kiyomizu stage',[
  SX.map(x=>SZ.map(z=>column({at:[x,0,z],height:'6b',diameter:2,colour:'wood'}))),
  SZ.map(z=>wall({from:[4,z],to:[35,z],y:12,height:1,colour:'beam'})),
  [5,10].map(z=>wall({from:[4,z],to:[35,z],y:6,height:1,colour:'beam'})),
  SX.map(x=>wall({from:[x,5],to:[x,21],y:12,height:1,colour:'beam'})),
  floor({at:[3,18,4],size:[34,28],layers:2,colour:'deck',top:'tile'}),
  fence({path:[[3,14],[3,4],[36,4],[36,14]],y:20,colour:'wood',style:'spindle'}),
  place({part:'3001',at:[20,20,11],colour:'wood'}),
  [[20,11],[22,11],[20,12],[22,12]].map(([x,z])=>place({part:'2412b',at:[x,23,z],colour:'black'})),
  place({part:'3941',at:[21,20,6],colour:'dark bluish grey'}),
  place({part:'4032b',at:[21,23,6],colour:'dark bluish grey'}),
  place({part:'3942c',at:[21,24,6],colour:'dark bluish grey'})
]);

const hwin=(side,at)=>({side,at,width:4,y:3,height:9,frame:'verm'});
const HX=[9,14,19,24,29,34];
section('Main hall',[
  room({at:[9,20,17],size:[26,'6b',12],colour:'plaster',openings:[
    ...[1,6,16,21].map(a=>hwin('front',a)),
    {side:'front',at:11,width:4,height:18,frame:'verm',door:'white',opens:'out'},
    ...[6,16].map(a=>hwin('back',a)),
    ...[1,6].map(a=>hwin('left',a)),
    ...[1,6].map(a=>hwin('right',a))]}),
  HX.map(x=>[17,28].map(z=>column({at:[x,20,z],height:'6b',colour:'verm'}))),
  [9,34].map(x=>column({at:[x,20,22],height:'6b',colour:'verm'})),
  floor({at:[6,38,14],size:[32,18],colour:'verm',top:'tile'}),
  roof({style:'hip',at:[8,39,16],size:[28,14],colour:'roof',holes:[{at:[11,19],size:[22,8]}]}),
  box({at:[12,39,20],size:[20,10,6],colour:'verm'}),
  roof({style:'gable',at:[12,49,20],size:[20,6],ridge:'x',colour:'roof',gable:'plaster'}),
  eave(6,38,14,32,18,'verm')
]);

const pwin=(side,at,w,y,h)=>({side,at,width:w,y,height:h,frame:'plaster'});
const SIDES=['front','back','left','right'];
const tiers=[
  {core:[45,21,29,10,12],floor:[40,33,24,20],roof:[42,34,26,16],hole:[46,30,8],open:[pwin('front',3,4,3,9),pwin('back',3,4,3,9),pwin('left',4,2,3,6),pwin('right',4,2,3,6)]},
  {core:[46,34,30,8,18],floor:[41,52,25,18],roof:[43,53,27,14],hole:[47,31,6],open:SIDES.map(s=>pwin(s,3,2,12,6))},
  {core:[47,53,31,6,18],floor:[42,71,26,16],roof:[44,72,28,12],hole:[49,33,2],open:SIDES.map(s=>pwin(s,2,2,12,6))}];
const tier=t=>{
  const [cx,cy,cz,cw,ch]=t.core, [fx,fy,fz,fs]=t.floor, [rx,ry,rz,rs]=t.roof, [hx,hz,hs]=t.hole;
  return [
    room({at:[cx,cy,cz],size:[cw,ch,cw],colour:'verm',openings:t.open}),
    floor({at:[fx,fy,fz],size:[fs,fs],colour:'plaster',top:'tile'}),
    roof({style:'hip',at:[rx,ry,rz],size:[rs,rs],colour:'roof',holes:[{at:[hx,hz],size:[hs,hs]}]}),
    eave(fx,fy,fz,fs,fs,'plaster')];
};
section('Three-storey pagoda',[
  box({at:[42,18,26],size:[16,3,16],colour:'stone',texture:'masonry'}),
  tiers.map(tier),
  column({at:[49,72,33],height:'6b',diameter:2,colour:'dark bluish grey'}),
  range(7).map(i=>[
    place({part:'4032b',at:[49,90+2*i,33],colour:'pearl gold'}),
    place({part:'6141',at:[49,91+2*i,33],colour:'pearl gold'})]),
  place({part:'3062b',at:[49,104,33],colour:'pearl gold'}),
  place({part:'4589',at:[49,107,33],colour:'pearl gold'})
]);

section('Gate and lanterns',[
  column({at:[42,0,5],height:'5b',colour:'verm'}),
  column({at:[47,0,5],height:'5b',colour:'verm'}),
  place({part:'3666',at:[42,15,4],colour:'verm'}),
  place({part:'3666',at:[42,15,5],colour:'verm'}),
  roof({style:'gable',at:[42,16,4],size:[6,2],ridge:'x',colour:'roof',gable:'verm'}),
  [[5,20,6],[32,20,6],[39,0,8],[48,0,8],[48,18,24]].map(at=>instance({component:'toro',at}))
]);

section('Maples and pines',[
  place({part:'3470',at:[-6,0,6],colour:'red'}),
  place({part:'3470',at:[53,9,15],colour:'red'}),
  place({part:'3470',at:[1,18,33],colour:'red'}),
  place({part:'3470',at:[20,18,34],colour:'red'}),
  place({part:'3471',at:[10,18,35],colour:'green'}),
  place({part:'3471',at:[30,18,34],colour:'green'}),
  place({part:'2435',at:[38,18,27],colour:'dark green'})
]);
