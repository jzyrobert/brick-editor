script({title:'Imperial Star Destroyer - Pursuit of the Tantive IV', description:'A 120-stud Imperial-class Star Destroyer on a display stand: nested-chevron dorsal hull, equatorial trench, stepped superstructure, command bridge with twin shield globes and glowing ion engines, closing in on a fleeing Tantive IV.', palette:{hull:'light bluish grey', dark:'dark bluish grey', glow:'trans light blue', deck:{mix:['light bluish grey','light bluish grey','dark bluish grey']}}});

const G=40, L=3*G, B=43, UP=12, DOWN=7, R=5;

// one hull plate layer: a stepped triangle, nose at z=0, widening 1 stud each side every 3 rows;
// hollow (a ring R studs wide) where it is wide, solid at the stern face
function layer(y, inset, colour, minH, solid){
  const ops=[];
  for(let g=0; g<G; g++){
    const h=Math.max(minH||0, 1+g-inset);
    if(h<1) continue;
    if(solid || g===G-1 || h<=R) ops.push(floor({at:[-h,y,3*g], size:[2*h,3], colour}));
    else ops.push(
      floor({at:[-h,y,3*g], size:[R,3], colour}),
      floor({at:[h-R,y,3*g], size:[R,3], colour}),
    );
  }
  return ops;
}

section('Hull', [
  layer(B,0,'hull'),
  layer(B+1,1,'dark',1),
  layer(B+2,0,'hull'),
  range(1,UP+1).map(u=>layer(B+2+u,2*u,'hull')),
  range(1,DOWN+1).map(d=>layer(B-d,3*d,'hull',0,d===DOWN)),
]);

// a superstructure deck: segments [halfWidth, z0, z1] widening toward the rear, chamfered top edges
function tier(segs, y0, y1){
  const ops=[]; let prev=0; const ys=y1-3;
  segs.forEach(([h,z0,z1])=>{
    ops.push(box({at:[-h,y0,z0], size:[2*h,y1-y0,z1-z0], colour:'deck', pattern:'courses'}));
    for(let x=prev; x<h; x+=2){
      ops.push(place({part:'3039', at:[x,ys,z0], colour:'hull'}));
      ops.push(place({part:'3039', at:[-x-2,ys,z0], colour:'hull'}));
    }
    for(let z=z0+2; z+2<=z1; z+=2){
      ops.push(place({part:'3039', at:[-h,ys,z], colour:'hull', turn:90}));
      ops.push(place({part:'3039', at:[h-2,ys,z], colour:'hull', turn:270}));
    }
    prev=h;
  });
  return ops;
}

const turret=(x,y,z)=>[
  place({part:'4032b', at:[x,y,z], colour:'dark'}),
  place({part:'48336', at:[x,y+1,z+1], colour:'hull'}),
];
const turretPair=(xr,y,z)=>[turret(xr,y,z), turret(-xr-2,y,z)];

const hullTurrets=[];
[[2,[18,21,24,27,30,33,36]],[6,[16,19,22,25]]].forEach(([u,gs])=>gs.forEach(g=>{
  const h=1+g-2*u, y=B+3+u;
  hullTurrets.push(turret(h-2,y,3*g), turret(-h,y,3*g));
}));

section('Superstructure', [
  tier([[8,66,82],[14,82,98],[20,98,L]], 46, 64),
  tier([[8,86,100],[12,100,L]], 64, 75),
  tier([[8,104,L]], 75, 86),
  box({at:[-4,86,108], size:[8,15,10], colour:'dark', texture:'grille'}),
  floor({at:[-15,101,106], size:[30,12], layers:3, colour:'hull'}),
  floor({at:[-14,104,107], size:[28,11], colour:'black'}),
  floor({at:[-15,105,106], size:[30,12], layers:4, colour:'hull'}),
  range(15).map(i=>place({part:'3039', at:[-15+2*i,106,106], colour:'hull'})),
  range(5).map(i=>[
    place({part:'3039', at:[-15,106,108+2*i], colour:'hull', turn:90}),
    place({part:'3039', at:[13,106,108+2*i], colour:'hull', turn:270}),
  ]),
  [-11,9].map(x=>[
    place({part:'3941', at:[x,109,111], colour:'hull'}),
    place({part:'60474', at:[x-1,112,110], colour:'hull'}),
    place({part:'86500', at:[x-1,113,110], colour:'hull'}),
  ]),
  place({part:'3957a', at:[-2,109,115], colour:'hull'}),
  place({part:'3957a', at:[1,109,116], colour:'hull'}),
  hullTurrets,
  [88,93].map(z=>turretPair(9,64,z)),
  [102,107,112].map(z=>turretPair(14,64,z)),
  [108,114].map(z=>turretPair(8,75,z)),
]);

const MAIN=[4,6,8,10,10,10,8,6,4], MAINGLOW=[0,4,6,8,8,8,6,4,0];
const SMALL=[4,6,6,4], SMALLGLOW=[2,4,4,2];
const engine=(cx,ylo,widths,glows)=>widths.map((w,i)=>{
  const y=ylo+3*i, g=glows[i], r=(w-g)/2;
  return [
    box({at:[cx-w/2,y,L], size:[w,3,1], colour:'dark', interior:'solid'}),
    r>0 && box({at:[cx-w/2,y,L+1], size:[r,3,2], colour:'dark', interior:'solid'}),
    r>0 && box({at:[cx+g/2,y,L+1], size:[r,3,2], colour:'dark', interior:'solid'}),
    range(g/2).map(j=>place({part:'3004', at:[cx-g/2+2*j,y,L+1], colour:'glow'})),
  ];
});

section('Engines', [
  [-15,0,15].map(cx=>engine(cx,38,MAIN,MAINGLOW)),
  [-27,27].map(cx=>engine(cx,39,SMALL,SMALLGLOW)),
]);

section('Display stand', [
  floor({at:[-12,0,68], size:[24,24], colour:'dark', layers:2}),
  floor({at:[-10,2,70], size:[20,20], colour:'black'}),
  place({part:'87079', at:[-2,3,71], colour:'dark'}),
  column({at:[-2,3,78], diameter:4, height:'11b', colour:'black'}),
]);

section('Tantive IV', [
  floor({at:[-34,0,-20], size:[6,6], colour:'black', layers:3}),
  column({at:[-31,3,-18], diameter:2, height:'5b', colour:'black'}),
  box({at:[-36,18,-22], size:[12,6,10], colour:'white'}),
  box({at:[-36,24,-22], size:[12,3,10], colour:'red', interior:'solid'}),
  box({at:[-36,27,-22], size:[12,4,10], colour:'white'}),
  range(6).map(i=>place({part:'15068', at:[-36+2*i,28,-22], colour:'white'})),
  range(4).map(i=>[
    place({part:'15068', at:[-36,28,-20+2*i], colour:'white', turn:90}),
    place({part:'15068', at:[-26,28,-20+2*i], colour:'white', turn:270}),
  ]),
  range(4).map(i=>place({part:'15068', at:[-34+2*i,28,-14], colour:'white', turn:180})),
  floor({at:[-36,18,-12], size:[12,1], colour:'white'}),
  range(6).map(i=>place({part:'3062b', at:[-35+2*i,19,-12], colour:'glow'})),
  floor({at:[-36,22,-12], size:[12,1], colour:'white'}),
  range(5).map(i=>place({part:'3062b', at:[-34+2*i,23,-12], colour:'glow'})),
  floor({at:[-36,26,-12], size:[12,1], colour:'red'}),
  box({at:[-32,20,-32], size:[4,7,10], colour:'white', interior:'solid'}),
  floor({at:[-38,21,-36], size:[16,4], colour:'red'}),
  floor({at:[-38,22,-36], size:[16,4], colour:'white'}),
  floor({at:[-38,23,-36], size:[16,1], colour:'black'}),
  floor({at:[-38,23,-35], size:[16,3], colour:'white'}),
  range(8).map(i=>place({part:'15068', at:[-38+2*i,24,-36], colour:'white'})),
  box({at:[-38,24,-34], size:[16,3,2], colour:'white', interior:'solid'}),
  place({part:'3941', at:[-31,31,-19], colour:'white'}),
  place({part:'4740', at:[-31,34,-19], colour:'light bluish grey'}),
]);

section('Finish', [smooth({})]);
