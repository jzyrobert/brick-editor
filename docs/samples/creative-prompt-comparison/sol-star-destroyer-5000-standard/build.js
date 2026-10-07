script({title:"Imperial Star Destroyer — Devastator",description:"A large triangular Imperial flagship with layered armor, a recessed equatorial trench, mechanical deck panels, eight heavy turbolaser batteries, seven blue stern engines and a tall T-shaped command bridge with twin shield generators. Three display cradles support the hollow ribbed hull.",palette:{hull:"light bluish grey",edge:"dark bluish grey",recess:"black",engine:"trans light blue",stand:"black"},defaults:{interior:"empty"}});
const N=32,D=4,Z0=-64;
const half=i=>2+Math.floor(3*i/2);
const halfAt=z=>half(Math.max(0,Math.min(N-1,Math.floor((z-Z0)/D))));
const batteries=[36,44,52,60];
section("Display foundation",[
 baseplate({at:[-56,-72],size:[112,144],colour:"dark bluish grey"}),
 box({at:[-24,0,-24],size:[48,4,88],colour:"stand"}),
 ...[-8,24,48].map(z=>box({at:[-6,4,z],size:[12,18,8],colour:"stand",supports:4})),
 floor({at:[-12,4,-22],size:[24,6],colour:"edge",top:"tile"}),
 ...range(10).map(i=>place({part:"3069b",at:[-10+2*i,5,-20],colour:i===0||i===9?"red":"light bluish grey"}))
]);
function hullBand(i){const h=half(i),z=Z0+D*i;return [
 h>2&&floor({at:[-h+2,22,z],size:[2*h-4,D],layers:2,colour:"hull"}),
 floor({at:[-h,23,z],size:[2*h,D],colour:"hull"}),
 room({at:[-h,24,z],size:[2*h,6,D],colour:"edge",openings:[]}),
 h>2&&floor({at:[-h+2,30,z],size:[2*h-4,D],layers:3,colour:"hull"}),
 ...[0,2].flatMap(dz=>[
  place({part:"3660b",at:[-h,21,z+dz],colour:"hull",turn:90}),
  place({part:"3660b",at:[h-2,21,z+dz],colour:"hull",turn:270}),
  place({part:"3039",at:[-h,30,z+dz],colour:"hull",turn:90}),
  place({part:"3039",at:[h-2,30,z+dz],colour:"hull",turn:270}),
  place({part:"2877",at:[-h,27,z+dz],colour:"edge",turn:90}),
  place({part:"2877",at:[h-1,27,z+dz],colour:"edge",turn:270})
 ])
];}
section("Triangular armored hull",range(N).map(hullBand));
component("Deck machinery",{size:[6,4],ops:[
 floor({at:[0,0,0],size:[6,4],colour:"hull"}),
 place({part:"3020",at:[0,1,0],colour:"hull"}),
 place({part:"2412b",at:[0,2,0],colour:"edge"}),
 place({part:"3069b",at:[2,2,0],colour:"hull"}),
 place({part:"2412b",at:[0,2,1],colour:"recess"}),
 place({part:"3069b",at:[2,2,1],colour:"hull"}),
 place({part:"3022",at:[4,1,0],colour:"edge"}),
 place({part:"54200",at:[4,2,0],colour:"hull"}),
 place({part:"3070b",at:[5,2,0],colour:"hull"}),
 place({part:"3070b",at:[4,2,1],colour:"edge"}),
 place({part:"6141",at:[5,2,1],colour:"hull"}),
 place({part:"87087",at:[0,1,2],colour:"edge"}),
 place({part:"3023b",at:[2,1,2],colour:"hull"}),
 place({part:"3069b",at:[2,2,2],colour:"hull"}),
 place({part:"3023b",at:[4,1,2],colour:"hull"}),
 place({part:"3069b",at:[4,2,2],colour:"edge"}),
 place({part:"3069b",at:[0,1,3],colour:"hull"}),
 place({part:"2412b",at:[2,1,3],colour:"edge"}),
 place({part:"3069b",at:[4,1,3],colour:"hull"})
]});
const deck=[];
for(let z=-54;z<=58;z+=5){for(let x=6;x<=38;x+=8){
 const hitsBattery=batteries.some(tz=>{const tx=halfAt(tz)-10;return z<tz+4&&z+4>tz-3&&x<tx+4&&x+6>tx;});
 if(x+6<=halfAt(z)-3&&!(x<22&&z+4>20)&&!hitsBattery){
 deck.push(instance({component:"Deck machinery",at:[x,33,z]}));
 deck.push(instance({component:"Deck machinery",at:[-x-6,33,z],turn:180}));
}}}
section("Mechanical deck panels",deck);
section("Axial armor and launch recess",[
 floor({at:[-2,33,-52],size:[4,72],colour:"hull",top:"tile"}),
 box({at:[-6,20,10],size:[12,2,18],colour:"recess",interior:"solid"}),
 floor({at:[-5,19,11],size:[10,16],colour:"edge"}),
 ...range(7).map(i=>place({part:"3023b",at:[-1,19,12+2*i],colour:"recess"})),
 ...range(16).flatMap(i=>[
 place({part:"3069b",at:[-2,34,-48+4*i],colour:"edge"}),
 place({part:"3069b",at:[0,34,-48+4*i],colour:"hull"})])
]);
function terrace(w,d,y,h,z){return box({at:[-Math.round(w/2),y,z],size:[w,h,d],colour:"hull",texture:"grille",top:"tile",supports:8});}
section("Stepped command citadel",[
 terrace(44,36,33,7,22),
 terrace(34,26,40,6,30),
 terrace(26,18,46,6,36),
 box({at:[-4,52,46],size:[8,13,8],colour:"hull",texture:"grille"}),
 floor({at:[-18,65,43],size:[36,12],layers:3,colour:"hull"}),
 box({at:[-18,68,43],size:[36,7,12],colour:"hull",texture:"grille"}),
 wall({from:[-16,43],to:[15,43],y:69,height:2,colour:"recess"}),
 wall({from:[-16,54],to:[15,54],y:69,height:2,colour:"recess"}),
 floor({at:[-19,71,42],size:[38,2],colour:"hull",top:"tile"}),
 floor({at:[-19,71,54],size:[38,2],colour:"hull",top:"tile"}),
 ...range(18).flatMap(i=>[
 place({part:"3660b",at:[-18+2*i,62,43],colour:"hull"}),
 place({part:"3660b",at:[-18+2*i,62,53],colour:"hull",turn:180})]),
 ...range(8).flatMap(i=>[
 place({part:"3070b",at:[-15+4*i,69,43],colour:"hull"}),
 place({part:"3070b",at:[-15+4*i,69,54],colour:"hull"})])
]);
function shield(x){return [
 cylinder({at:[x+1,75,46],diameter:6,height:6,colour:"edge"}),
 floor({at:[x,81,45],size:[8,8],colour:"hull"}),
 dome({at:[x,82,45],diameter:8,colour:"hull"})
];}
section("Shield generators and communications",[
 ...shield(-14),...shield(6),
 place({part:"3022",at:[-1,75,50],colour:"edge"}),
 place({part:"3941",at:[-1,76,50],colour:"hull"}),
 place({part:"3957a",at:[-1,79,50],colour:"hull"}),
 place({part:"3957a",at:[0,79,51],colour:"edge"}),
 ...[-3,2].map(x=>place({part:"54200",at:[x,75,45],colour:"edge"}))
]);
component("Heavy turbolaser",{size:[4,4],ops:[
 floor({at:[0,0,0],size:[4,4],colour:"edge"}),
 cylinder({at:[0,1,0],diameter:4,height:3,colour:"hull"}),
 floor({at:[0,4,0],size:[4,4],colour:"hull"}),
 box({at:[1,5,1],size:[2,3,2],colour:"hull",interior:"solid"}),
 ...[0,3].flatMap(x=>[
 place({part:"3710",at:[x,5,-3],colour:"edge",turn:90}),
 place({part:"3710",at:[x,6,-3],colour:"hull",turn:90})])
]});
section("Eight heavy batteries",batteries.flatMap(z=>{
 const x=halfAt(z)-10;
 return [instance({component:"Heavy turbolaser",at:[x,33,z]}),instance({component:"Heavy turbolaser",at:[-x-4,33,z]})];
}));
function engine(cx,cy,w,h){const x=cx-Math.round(w/2);return [
 box({at:[x,cy,64],size:[w,h,4],colour:"edge",open:["back"]}),
 box({at:[x+1,cy+3,65],size:[w-2,h-6,3],colour:"recess",interior:"solid"}),
 wall({from:[x+2,67],to:[x+w-3,67],y:cy+3,height:h-6,colour:"engine"}),
 ...[x,x+w-2].flatMap(xx=>[
 carve({at:[xx,cy,64],size:[2,3,4]}),
 carve({at:[xx,cy+h-3,64],size:[2,3,4]})])
];}
section("Seven stern ion engines",[
 ...[-24,0,24].map(x=>engine(x,18,10,21)),
 ...[-38,-12,12,38].map(x=>engine(x,25,6,9))
]);
function ventRow(x,z,n){return range(n).map(i=>place({part:"2412b",at:[x+2*i,52,z],colour:"edge"}));}
section("Citadel cooling galleries",[
 ...ventRow(-12,37,12),...ventRow(-12,52,12),
 ...range(10).flatMap(i=>[
 place({part:"3069b",at:[-21+4*i,40,23],colour:"edge"}),
 place({part:"3069b",at:[-21+4*i,40,56],colour:"edge"})]),
 ...range(8).flatMap(i=>[
 place({part:"2412b",at:[-15+4*i,46,31],colour:"edge"}),
 place({part:"2412b",at:[-15+4*i,46,54],colour:"edge"})])
]);