script({title:'The Penny-fishthing',description:'A white pelican leans into the handlebars of a jade penny-farthing, with a golden fishing pouch, opposing webbed pedals and a fluttering scarlet scarf. Continuous sloped limbs, sculpted wings and a curved neck refine the original riding pose; compact stabilizers sit beside the rear axle.',palette:{bird:'white',bike:'dark green',bill:'yellow',pouch:'orange',metal:'light bluish grey'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour)=>box({at:[x,y,z],size:[w,h,d],colour,interior:'solid'});
const L=(a,b,colour)=>line({from:a,to:b,colour});
const wheel=[];
for(let j=0;j<24;j++){const y=j*3,t=(y+1.5-36)/36,ti=(y+1.5-36)/30,cells=[];for(let x=-15;x<15;x++)if((x+.5)*(x+.5)/225+t*t<=1&&((x+.5)*(x+.5)/144+ti*ti>=1))cells.push(x);if(!cells.length)continue;const lo=cells[0],hi=cells[cells.length-1]+1,left=cells.includes(lo+1),right=cells.includes(hi-2);for(const x of cells){if((left&&(x===lo||x===lo+1))||(right&&(x===hi-2||x===hi-1)))continue;wheel.push(P('3004',x,y,-1,'black',90));}if(left)wheel.push(P(j<12?'3660b':'3039',lo,y,-1,'black',90));else wheel.push(P('3004',lo,y,-1,'black',90));if(right&&hi-2>lo+1)wheel.push(P(j<12?'3660b':'3039',hi-2,y,-1,'black',270));else if(hi-1>lo+1)wheel.push(P('3004',hi-1,y,-1,'black',90));for(const x of cells){const inside=xx=>((xx+.5)*(xx+.5)/144+ti*ti<1);if(inside(x-1)||inside(x+1))wheel.push(P('3005',x,y,-2,'metal'));}}
for(let k=0;k<8;k++){const a=2*Math.PI*k/8;wheel.push(L([0,36,-2],[Math.round(12*Math.cos(a)),36+Math.round(29*Math.sin(a)),-2],'metal'));}
wheel.push(B(-2,33,-3,4,6,6,'dark bluish grey'),P('87087',-1,35,-4,'metal'),P('87087',-1,34,3,'metal',180),P('88517',27,0,-1,'black'));
section('Great eight-spoked wheel and little trailing wheel',wheel);
const cycle=[];
for(const z of [-4,2]){for(let k=0;k<6;k++)cycle.push(P('60481a',k,36+6*k,z,'bike',90));cycle.push(B(6,72,z,1,3,1,'bike'),L([6,73,z],[10,74,z],'bike'));}
for(let k=0;k<18;k++)cycle.push(P('3040b',14+k,63-3*k,-4,'bike',270));
cycle.push(L([9,74,-4],[14,66,-4],'bike'),B(32,12,-4,2,6,1,'metal'),B(32,12,3,2,6,1,'metal'),B(-1,35,-4,3,3,8,'metal'),B(31,11,-4,3,3,8,'metal'),floor({at:[3,73,-4],size:[7,8],layers:2,colour:'bike',top:'tile'}),B(8,73,-2,4,3,4,'bike'),B(7,76,-3,8,1,6,'black'));
for(const z of [-3,-1,1])cycle.push(P('15068',7,77,z,'black',90),P('15068',13,77,z,'black',270));
cycle.push(B(9,77,-3,4,2,6,'black'),B(9,79,-3,4,1,6,'black'),B(3,73,-7,2,3,14,'metal'));
for(const z of [-8,6])cycle.push(B(2,76,z,4,2,2,'reddish brown'),P('15068',2,78,z,'reddish brown',90),P('15068',4,78,z,'reddish brown',270));
cycle.push(P('4032b',3,76,-4,'pearl gold'),P('4740',3,77,-4,'pearl gold'));
for(const z of [-4,3])cycle.push(B(30,0,z-1,5,2,2,'dark bluish grey'),column({at:[32,2,z],height:9,colour:'dark bluish grey'}));
cycle.push(L([0,36,-5],[-3,30,-5],'metal'),B(-5,29,-6,5,2,3,'black'),L([0,36,4],[3,42,4],'metal'),B(2,41,3,5,2,3,'black'));
section('Swept jade frame, leather saddle and compact rear stabilizers',cycle);
function risingLeg(part,x,y,z,count,dx,dy){return range(count).map(k=>P(part,x+k*dx,y+k*dy,z,'orange',90));}
const legs=[...risingLeg('3039',-3,36,-6,8,1,3),...risingLeg('3039',5,60,-6,7,1,3),...risingLeg('3298',3,48,4,4,2,3),...risingLeg('60481a',11,60,4,3,1,6),...risingLeg('60481a',11,60,5,3,1,6),P('3039',14,78,4,'orange',90),B(11,78,-5,3,3,3,'orange'),B(14,78,2,3,3,3,'orange')];
function foot(x,y,z){return [B(x,y,z,5,2,3,'orange'),P('15068',x,y+2,z,'orange',90),P('15068',x+2,y+2,z,'orange',90),P('11477',x+4,y+2,z,'orange',90),P('11477',x,y+2,z+2,'orange',90),P('11477',x+2,y+2,z+2,'orange',90),P('54200',x+4,y+2,z+2,'orange',90)];}
legs.push(...foot(-5,31,-6),...foot(2,43,3));section('Smooth opposing legs and webbed feet',legs);
const body=[box({at:[9,80,-3],size:[13,13,6],colour:'bird',interior:'empty'}),box({at:[7,83,-4],size:[17,8,8],colour:'bird',interior:'empty'})];
for(let x=8;x<24;x++)body.push(P('13547',x,80,-5,'bird'),P('13547',x,80,1,'bird',180),P('61678',x,93,-4,'bird'),P('61678',x,93,0,'bird',180));
for(let z=-3;z<3;z++)body.push(P('50950',5,83,z,'bird',90),P('50950',5,86,z,'bird',90),P('50950',24,83,z,'bird',270));
body.push(B(8,91,-3,14,2,6,'bird'));for(let z=-3;z<3;z++)body.push(P('61678',22,91,z,'bird',270));
for(let z=-2;z<2;z++)body.push(P('42022',24,87,z,z===-2||z===1?'black':'bird',270),P('61678',27,90,z,z===-2||z===1?'black':'bird',270));
section('Rounded breast, continuous back and pointed tail',body);
function wing(z){const cap=(x,zz,w,d)=>box({at:[x,87,zz],size:[w,3,d],colour:'bird',interior:'solid',top:'tile'});const out=[cap(12,z,10,3),cap(12,z<0?-4:3,10,3)];for(let k=0;k<3;k++)out.push(P('30363',4+k*3,81+k*3,z,'bird',90));out.push(P('42022',13,90,z,'bird',270),P('61678',19,90,z,'bird',270),P('42022',13,90,z+1,'bird',270),P('42022',19,90,z+1,'bird',270),P('50950',20,90,z+2,'bird',270),P('2431',12,90,z+2,'bird'),P('2431',16,90,z+2,'bird'));return out;}
section('Tapered sculpted wings gripping the handlebars',[...wing(-7),...wing(5)]);
const neck=[B(5,89,-2,5,5,4,'bird'),B(6,94,-2,4,13,4,'bird'),B(4,100,-2,6,3,4,'bird'),B(4,103,-2,6,7,4,'bird'),B(2,110,-3,6,6,6,'bird'),B(8,91,-2,5,9,4,'bird'),floor({at:[5,93,-5],size:[5,10],colour:'bird'}),floor({at:[3,105,-4],size:[6,8],colour:'bird'})];
for(const z of [-2,0])neck.push(P('3678b',4,94,z,'bird',90),P('3678b',3,100,z,'bird',90));
for(let z=-2;z<2;z++)neck.push(P('6091',2,106,z,'bird',90),P('42022',7,100,z,'bird',270));
for(const z of [-4,2]){const turn=z<0?0:180;neck.push(P('24309',6,94,z<0?-5:2,'bird',turn),P('15068',5,100,z,'bird',turn),P('15068',7,100,z,'bird',turn),P('15068',3,106,z,'bird',turn),P('15068',5,106,z,'bird',turn),P('15068',7,106,z,'bird',turn));}
for(let x=2;x<8;x+=2)neck.push(P('15068',x,116,-3,'bird'),P('15068',x,116,1,'bird',180));for(let z=-1;z<1;z++)neck.push(P('2431',2,116,z,'bird'));
for(const z of [-4,3])neck.push(P('3004',1,110,z,'yellow'),P('87087',2,113,z,'black',z<0?0:180),P('3005',1,113,z,'yellow'),P('3005',3,113,z,'bird'),P('15068',0,116,z,'bird',90));
neck.push(B(0,107,-3,5,3,6,'bird'));section('Sculpted S-neck, bright eyes and smooth crown',neck);
const bill=[B(-20,109,-2,22,2,4,'yellow'),B(-19,108,-2,20,1,4,'dark orange'),B(-14,102,-3,15,6,6,'orange'),B(-19,105,-2,5,3,4,'orange')];
for(let x=-18;x<0;x+=2)bill.push(P('15068',x,111,-2,'yellow'),P('15068',x,111,0,'yellow',180));
for(let z=-2;z<2;z++)bill.push(P('61678',-23,108,z,'yellow',90),P('13547',-19,102,z,'orange',90));
for(let x=-13;x<1;x++)bill.push(P('13547',x,99,-4,'orange'),P('13547',x,99,0,'orange',180));
for(let x=-12;x<0;x+=2)bill.push(P('15068',x,105,-5,'orange'),P('15068',x,105,3,'orange',180),P('3069b',x,108,-4,'yellow'),P('3069b',x,108,3,'yellow'));
section('Long golden bill and deep orange fishing pouch',bill);
section('Fluttering scarlet neckerchief',[B(5,98,-4,5,2,8,'dark red'),B(10,98,0,8,1,2,'dark red'),B(14,99,1,4,1,1,'dark red'),P('61678',15,99,0,'dark red',270),P('61678',14,100,1,'red',270)]);