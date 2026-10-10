script({title:"Piplup's Bubble-Berg",description:"A big, bright-eyed Piplup captains a drifting ice floe, waving one flipper as an orange fish escapes through a trail of rising bubbles. Sculpted cheeks, a golden beak, webbed feet, a scalloped navy collar and a little curved tail make the penguin recognisable from every angle.",palette:{water:"trans light blue",ice:"white",penguin:"medium azure",hood:"dark blue",beak:"yellow"}});
const site=32, lift=5;
section("The drifting iceberg",[
 baseplate({at:[0,0],size:[site,site],colour:"blue"}),
 floor({at:[0,0,0],size:[site,site],colour:"water",top:"tile"}),
 ...[[6,10,20,19],[9,7,13,3],[3,14,3,10],[26,16,3,8],[10,29,12,2]].flatMap(([x,z,w,d])=>[box({at:[x,1,z],size:[w,3,d],colour:"ice"}),floor({at:[x,4,z],size:[w,d],colour:"ice",top:"tile"})]),
 ...range(4).map(i=>place({part:"3039",at:[10+i*3,1,6],colour:"white"})),
 ...[[10,8,0],[12,9,0],[23,12,90],[25,24,90],[8,26,0]].map(([x,z,t])=>place({part:"3069b",at:[x,5,z],colour:"blue",turn:t})),
 ...[6,7,24,25].map(x=>place({part:"61678",at:[x,5,25],colour:"white",turn:180}))
]);
function ell(x,y,z,cx,cy,cz,rx,ry,rz){return ((x-cx)/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2<=1;}
function headColour(x,y,z){
 let c="medium azure";
 if(z<19&&(y>=61||(y>=51&&Math.abs(x-16)<2+(y-51)*0.13)))c="dark blue";
 if(z<17&&[10.5,21.5].some(ex=>((x-ex)/5)**2+((y-55)/13)**2<=1))c="white";
 if(z<19&&y>=53&&Math.abs(x-16)<1.3+(y-53)*0.13)c="dark blue";
 for(const ex of [10.5,21.5]){
  const front=19-8*Math.sqrt(Math.max(0,1-((x-16)/10)**2-((y-55)/21)**2));
  if(((x-ex)/1.6)**2+((y-58)/7.5)**2<=1&&z<front+2.2){
   c="black";
   if(Math.abs(x-ex)<0.6&&y>=60&&y<63&&z<front+1.5)c="white";
  }
 }
 return c;
}
function bodyColour(x,y,z){
 let c="medium azure";
 if(y>=37||(y>=31&&(x<12||x>20)))c="dark blue";
 if(z<17&&[13,19].some(ex=>((x-ex)/1.5)**2+((y-27)/4)**2<=1))c="white";
 return c;
}
function colourAt(ix,h,iz){
 const x=ix+0.5,y=h+1.5,z=iz+0.5;
 const head=ell(x,y,z,16,55,19,10,21,8);
 const body=ell(x,y,z,16,27,20,7.5,21,6);
 const diaphragm=h===24||h===39||h===57;
 if(head&&(!ell(x,y,z,16,55,19,8,15,6)||diaphragm))return headColour(x,y,z);
 if(body&&(!ell(x,y,z,16,27,20,5.5,15,4)||diaphragm))return bodyColour(x,y,z);
 if(ell(x,y,z,8-0.22*(y-25),36,20,2.7,13,2.3))return "medium azure";
 if(ell(x,y,z,24+0.2*(32-y),24,20,2.7,12,2.3))return "medium azure";
 if([12,20].some(cx=>ell(x,y,z,cx,4.5,17,3.5,4.5,5)))return "yellow";
 if(h>=9&&h<69&&ix>=14&&ix<18&&iz>=18&&iz<22)return "medium azure";
 return null;
}
const sculpture=[];
for(let h=0;h<78;h+=3){
 for(let z=5;z<30;z++){
  let start=0,last=null;
  for(let x=0;x<=32;x++){
   const c=x<32?colourAt(x,h,z):null;
   if(c!==last){
    if(last)sculpture.push(box({at:[start,lift+h,z],size:[x-start,3,1],colour:last,interior:"solid"}));
    start=x;last=c;
   }
  }
 }
}
// The broad upper bill and its smaller lower lip overlap the cheek shell.
for(let h=42;h<54;h+=3){
 for(let z=6;z<14;z++){
  let start=-1;
  for(let x=12;x<=20;x++){
   const inside=x<20&&ell(x+0.5,h+1.5,z+0.5,16,48,10,3.2,5,4);
   if(inside&&start<0)start=x;
   if(!inside&&start>=0){sculpture.push(box({at:[start,lift+h,z],size:[x-start,3,1],colour:h<48?"bright light orange":"yellow",interior:"solid"}));start=-1;}
  }
 }
}
function toes(cx){return range(3).map(i=>place({part:"54200",at:[cx-2+i*2,lift,i===1?12:13],colour:"yellow"}));}
sculpture.push(...[12,20].flatMap(toes));
sculpture.push(...range(4).map(i=>place({part:"61678",at:[14+i,26,25],colour:"medium azure",turn:180})));
sculpture.push(smooth({region:{at:[2,18],size:[4,4]}}));
section("Piplup — waving captain",sculpture);
function bubble(x,z,h){return group({at:[x,1,z],turn:0,ops:[column({at:[0,0,0],diameter:2,height:h,colour:"trans-clear"}),place({part:"4740",at:[0,h,0],colour:"trans-clear"}),place({part:"54821",at:[0,h+1,0],colour:"trans light blue"})]});}
section("The fish and the bubbling wake",[
 bubble(25,4,6),bubble(28,8,12),bubble(29,12,18),
 place({part:"64648",at:[23,1,3],colour:"orange"}),
 ...[[20,2],[27,2],[22,7],[2,8],[2,27],[28,28],[5,5],[17,3]].map(([x,z],i)=>place({part:"14769",at:[x,1,z],colour:i%3===0?"white":"medium azure"})),
 ...[[6,11],[4,17],[27,18],[11,29],[23,28]].map(([x,z],i)=>place({part:"54200",at:[x,5,z],colour:i%2?"white":"trans light blue",turn:i%2?180:0}))
]);
