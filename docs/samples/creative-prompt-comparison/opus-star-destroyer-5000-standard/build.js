const L=112,HW=36,Z0=-58,Z1=Z0+L-1,B=36;
const hw=z=>Math.max(1,Math.round(HW*(z-Z0+1)/L));
script({title:'Imperial Star Destroyer',description:'Imperial I-class Star Destroyer on a display stand: stepped wedge hull, terraced superstructure, command bridge with shield domes and glowing ion engines.',palette:{hull:'light bluish grey',panel:{mix:['light bluish grey','light bluish grey','light bluish grey','light bluish grey','dark bluish grey']},belly:{mix:['light bluish grey','light bluish grey','light bluish grey','dark bluish grey']},dark:'dark bluish grey',glow:'trans light blue'}});
function tier(inset,y,colour,tile){
  const ops=[];let start=Z0,cur=hw(Z0)-inset;
  for(let z=Z0+1;z<=Z1+1;z++){
    const w=z<=Z1?hw(z)-inset:-999;
    if(w!==cur){
      if(cur>0)ops.push(floor({at:[-cur,y,start],size:[2*cur,z-start],colour,layers:2,...(tile?{top:'tile'}:{})}));
      start=z;cur=w;
    }
  }
  return ops;
}
section('Display',[
  baseplate({at:[-48,-64],size:[96,128],colour:'dark bluish grey'}),
  box({at:[-14,0,6],size:[28,6,22],colour:'black',top:'tile'}),
  floor({at:[-6,6,7],size:[12,2],colour:'dark',top:'tile'}),
  box({at:[-3,6,14],size:[6,30,6],colour:'black'}),
]);
section('Hull',[
  range(1,7).map(j=>tier(2*j,B+12-2*j,j===1?'dark':'belly',false)),
  range(0,10).map(k=>tier(2*k,B+12+2*k,k===0?'hull':'panel',k%2===0)),
]);
const sup=[[14,56,14,20,40],[11,76,22,6,32],[9,82,28,6,26],[7,88,34,6,20]];
section('Superstructure',[
  sup.map(([h,y,z,ht,d])=>box({at:[-h,y,z],size:[2*h,ht,d],colour:'hull',texture:'grille'})),
  box({at:[-5,94,40],size:[10,12,6],colour:'hull',texture:'grille'}),
  floor({at:[-13,106,39],size:[26,8],colour:'dark',layers:2}),
  floor({at:[-12,108,39],size:[24,1],colour:'glow'}),
  floor({at:[-13,108,39],size:[1,1],colour:'hull'}),
  floor({at:[12,108,39],size:[1,1],colour:'hull'}),
  floor({at:[-13,108,40],size:[26,7],colour:'hull'}),
  floor({at:[-13,109,39],size:[26,8],colour:'hull',layers:3,top:'tile'}),
  [-10,6].map(cx=>[
    place({part:'3941',at:[cx+1,112,41],colour:'dark'}),
    place({part:'3960',at:[cx,115,40],colour:'hull'}),
  ]),
  place({part:'3062b',at:[-1,112,42],colour:'dark'}),
  place({part:'3957a',at:[-1,115,42],colour:'dark'}),
  place({part:'3062b',at:[0,112,44],colour:'dark'}),
  place({part:'3957a',at:[0,115,44],colour:'hull'}),
]);
function engine(x0,y0,w,h,d,big){
  const z=Z1+1,c=big?[[2,3],[1,6]]:[[1,3]];
  const ops=[box({at:[x0,y0,z],size:[w,h,d],colour:'dark',interior:'solid'})];
  for(const [cw,ch] of c){
    ops.push(carve({at:[x0,y0,z],size:[cw,ch,d]}),carve({at:[x0+w-cw,y0,z],size:[cw,ch,d]}),carve({at:[x0,y0+h-ch,z],size:[cw,ch,d]}),carve({at:[x0+w-cw,y0+h-ch,z],size:[cw,ch,d]}));
  }
  const gh=big?h-6:3;
  ops.push(box({at:[x0+1,y0+3,z+d],size:[w-2,gh,1],colour:'glow',interior:'solid'}));
  if(big)ops.push(carve({at:[x0+1,y0+3,z+d],size:[1,3,1]}),carve({at:[x0+w-2,y0+3,z+d],size:[1,3,1]}),carve({at:[x0+1,y0+h-6,z+d],size:[1,3,1]}),carve({at:[x0+w-2,y0+h-6,z+d],size:[1,3,1]}));
  return ops;
}
section('Engines',[
  [-14,-4,6].map(x=>engine(x,42,8,20,3,true)),
  [-21,17].map(x=>engine(x,45,4,9,2,false)),
  [-11,7].map(x=>engine(x,64,4,9,2,false)),
]);
const turrets=[];
for(const k of [4,6,8])for(let z=8;z<=50;z+=5){
  let zz=z;if(hw(zz)!==hw(zz+1))zz++;if(hw(zz)!==hw(zz+1))continue;
  const x0=hw(zz)-2*k-2;if(x0<15)continue;
  const y=B+14+2*k;
  for(const x of [x0,-x0-2])turrets.push(place({part:'4032b',at:[x,y,zz],colour:'dark'}),place({part:'15068',at:[x,y+1,zz],colour:'hull'}));
}
const sc=[];
for(let z0=Z0+4;z0<=Z1;z0+=8){const w=hw(z0)-1;sc.push(scatter({region:{at:[-w,z0],size:[2*w,Math.min(8,Z1+1-z0)]},parts:['3024','6141','54200','3070b','98138'],colours:['light bluish grey','dark bluish grey'],density:0.25,seed:z0}));}
section('Turbolasers',turrets);
section('Greebles',sc);
