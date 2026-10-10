script({title:"Piplup's Bubble-Berg",description:"A big, bright-eyed Piplup captains a drifting ice floe, waving one flipper as an orange fish escapes through a trail of rising bubbles. Sculpted cheeks, a curved golden bill, webbed feet, a navy collar and a little curved tail make the penguin recognisable from every angle.",palette:{water:'trans light blue',ice:'white',penguin:'medium azure',hood:'dark blue',beak:'yellow'}});
const lift=4;
// Water hugs the floe and opens into a wake lobe where the fish escapes.
const sea=[[8,4,16,30],[0,12,32,14],[3,8,26,24],[14,0,18,8],[24,0,8,15]];
const floes=[[6,10,20,19],[9,7,13,3],[3,14,3,10],[26,16,3,8],[10,29,12,2]];
// Sloped ice shoulders [x,z,turn] round the floe's exposed edges.
const edge=[...[9,11,13,15,17,19].map(x=>[x,5,0]),...[6,22,24].map(x=>[x,8,0]),...[14,16,18,20,22].map(z=>[1,z,90]),...[10,12,24,26].map(z=>[4,z,90]),...[16,18,20,22].map(z=>[29,z,270]),...[10,12,14,24,26].map(z=>[26,z,270]),...[6,8,22,24].map(x=>[x,29,180]),...[10,12,14,16,18,20].map(x=>[x,31,180])];
section('The drifting iceberg',[
 ...sea.map(([x,z,w,d])=>floor({at:[x,0,z],size:[w,d],colour:'water',top:'tile'})),
 ...floes.map(([x,z,w,d])=>box({at:[x,1,z],size:[w,3,d],colour:'ice',top:'tile'})),
 ...edge.map(([x,z,t],i)=>place({part:i%3===1?'15068':'3039',at:[x,1,z],colour:'white',turn:t})),
 ...[[10,8,0],[12,9,0],[23,12,90],[25,24,90],[8,26,0]].map(([x,z,t])=>place({part:'3069b',at:[x,lift,z],colour:'blue',turn:t})),
 ...[6,7,24,25].map(x=>place({part:'61678',at:[x,lift,25],colour:'white',turn:180}))
]);
function ell(x,y,z,cx,cy,cz,rx,ry,rz){return ((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1;}
function headColour(x,y,z){
 let c='medium azure';
 if(z<19&&(y>=61||(y>=51&&Math.abs(x-16)<2+(y-51)*0.13)))c='dark blue';
 if(z<17&&[10.5,21.5].some(ex=>((x-ex)/5)**2+((y-55)/13)**2<=1))c='white';
 if(z<19&&y>=53&&Math.abs(x-16)<1.3+(y-53)*0.13)c='dark blue';
 for(const ex of [10.5,21.5]){
  const front=19-8*Math.sqrt(Math.max(0,1-((x-16)/10)**2-((y-55)/21)**2));
  if(((x-ex)/1.6)**2+((y-58)/7.5)**2<=1&&z<front+2.2){
   c='black';
   if(Math.abs(x-ex)<0.6&&y>=60&&y<63&&z<front+1.5)c='white';
  }
 }
 return c;
}
function bodyColour(x,y,z){
 let c='medium azure';
 if(y>=37||(y>=31&&(x<12||x>20)))c='dark blue';
 if(z<17&&[13,19].some(ex=>((x-ex)/1.5)**2+((y-27)/4)**2<=1))c='white';
 return c;
}
// Thin one-stud shells over a central core, tied together at the neck and crown.
function colourAt(ix,h,iz){
 const x=ix+0.5,y=h+1.5,z=iz+0.5;
 const head=ell(x,y,z,16,55,19,10,21,8);
 const body=ell(x,y,z,16,27,20,7.5,21,6);
 const diaphragm=h===39||h===57;
 if(head&&(!ell(x,y,z,16,55,19,9,18,7)||diaphragm))return headColour(x,y,z);
 if(body&&(!ell(x,y,z,16,27,20,6.5,18,5)||diaphragm))return bodyColour(x,y,z);
 if(ell(x,y,z,8-0.22*(y-25),36,20,2.7,13,2.3))return 'medium azure';
 if(ell(x,y,z,24+0.2*(32-y),24,20,2.7,12,2.3))return 'medium azure';
 if([12,20].some(cx=>ell(x,y,z,cx,4.5,17,3.5,4.5,5)))return 'yellow';
 if(h>=9&&h<69&&ix>=14&&ix<18&&iz>=18&&iz<22)return 'medium azure';
 return null;
}
// Each course is cut into the largest same-colour rectangles, so long shell runs become long bricks.
const sculpture=[];
for(let h=0;h<78;h+=3){
 const g=[],used=[];
 for(let z=0;z<30;z++){g.push(range(32).map(x=>z>=5?colourAt(x,h,z):null));used.push(range(32).map(()=>false));}
 const rowOk=(z,x,w,c)=>{for(let i=x;i<x+w;i++)if(g[z][i]!==c||used[z][i])return false;return true;};
 for(let z=5;z<30;z++)for(let x=0;x<32;x++){
  const c=g[z][x];
  if(!c||used[z][x])continue;
  let w=1;while(x+w<32&&g[z][x+w]===c&&!used[z][x+w])w++;
  let d=1;while(z+d<30&&rowOk(z+d,x,w,c))d++;
  for(let a=z;a<z+d;a++)for(let b=x;b<x+w;b++)used[a][b]=true;
  sculpture.push(box({at:[x,lift+h,z],size:[w,3,d],colour:c,interior:'solid'}));
 }
}
// A real bill: an orange lower lip of inverted slopes hangs under a broad yellow upper bill that curves down to its tip and keys into the face shell.
const bill='yellow',lip='bright light orange';
sculpture.push(
 place({part:'3660b',at:[14,lift+45,9],colour:lip}),
 place({part:'3660b',at:[16,lift+45,9],colour:lip}),
 place({part:'3010',at:[14,lift+45,11],colour:lip}),
 ...[13,15,17].map(x=>place({part:'15068',at:[x,lift+48,8],colour:bill})),
 place({part:'2456',at:[13,lift+48,10],colour:bill}),
 place({part:'3009',at:[13,lift+48,12],colour:bill}),
 ...[13,15,17].map(x=>place({part:'85984',at:[x,lift+51,10],colour:bill}))
);
function toes(cx){return range(3).map(i=>place({part:'54200',at:[cx-2+i*2,lift,i===1?12:13],colour:'yellow'}));}
sculpture.push(...[12,20].flatMap(toes));
sculpture.push(...range(4).map(i=>place({part:'61678',at:[14+i,lift+21,25],colour:'medium azure',turn:180})));
section('Piplup — waving captain',sculpture);
function bubble(x,z,h){return group({at:[x,1,z],turn:0,ops:[column({at:[0,0,0],diameter:2,height:h,colour:'trans-clear'}),place({part:'4740',at:[0,h,0],colour:'trans-clear'}),place({part:'54821',at:[0,h+1,0],colour:'trans light blue'})]});}
section('The fish and the bubbling wake',[
 bubble(25,4,6),bubble(28,8,12),bubble(29,12,18),
 place({part:'64648',at:[23,1,3],colour:'orange'}),
 ...[[20,2],[27,2],[17,3],[24,6],[0,24],[30,24],[3,28]].map(([x,z],i)=>place({part:'14769',at:[x,1,z],colour:i%3===0?'white':'medium azure'})),
 ...[[6,11],[4,17],[27,18],[11,29],[23,28]].map(([x,z],i)=>place({part:'54200',at:[x,lift,z],colour:i%2?'white':'trans light blue',turn:i%2?180:0}))
]);
