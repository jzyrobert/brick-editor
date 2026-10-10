a pelican riding a bicycle

This is a visual revision of an accepted draft, not a new concept contest.
The attached images show the draft from three-quarter, front, back and top.
Inspect the actual images before editing. Internally identify the three most
important visual defects, then revise the supplied source to address them.
Keep the subject recognizable and improve its existing concept. Judge its
silhouette, proportions, support footprint and surface construction in all
views. Remove unnecessary scenery slabs; keep compact supports only where
needed. Finish visible skin with coherent shaping parts and selective tiles;
retain purposeful texture and connection studs. A smooth staircase remains
a stepped silhouette, so improve the transitions rather than merely hiding
studs. Check the revised code for overlaps, colour availability and part count.
Do not add disconnected decorative parts just to approach the part target.
Reply through the same parts_search, check_build and brick.build protocols.

Accepted draft source:
```js
script({title:'The Penny-fishthing',description:'A great white pelican pedals a jade Victorian penny-farthing. Its enormous golden fishing pouch echoes the great front wheel; webbed feet work opposing pedals, feathered wings hold the handlebars, and a scarlet neckerchief flutters behind.',palette:{bird:'white',bike:'dark green',bill:'yellow',pouch:'orange',metal:'light bluish grey'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour)=>box({at:[x,y,z],size:[w,h,d],colour,interior:'solid'});
const L=(a,b,colour)=>line({from:a,to:b,colour});
function strut(a,b,c){if(a[1]>b[1]){const q=a;a=b;b=q;}const out=[],part=Math.abs(b[0]-a[0])*3/(b[1]-a[1])>1?'3622':'3004';for(let y=a[1];y<b[1];y+=3){const x=Math.round(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));out.push(b[1]-y>=3?P(part,x,y,a[2],c):B(x,y,a[2],2,b[1]-y,1,c));}return out;}
const wheel=[];
for(let j=0;j<24;j++){const y=j*3,t=(y+1.5-36)/36,ti=(y+1.5-36)/30,cells=[];for(let x=-15;x<15;x++)if((x+.5)*(x+.5)/225+t*t<=1&&((x+.5)*(x+.5)/144+ti*ti>=1))cells.push(x);if(!cells.length)continue;const lo=cells[0],hi=cells[cells.length-1]+1,left=cells.includes(lo+1),right=cells.includes(hi-2);for(const x of cells){if((left&&(x===lo||x===lo+1))||(right&&(x===hi-2||x===hi-1)))continue;wheel.push(P('3004',x,y,-1,'black',90));}if(left)wheel.push(P(j<12?'3660b':'3039',lo,y,-1,'black',90));else wheel.push(P('3004',lo,y,-1,'black',90));if(right&&hi-2>lo+1)wheel.push(P(j<12?'3660b':'3039',hi-2,y,-1,'black',270));else if(hi-1>lo+1)wheel.push(P('3004',hi-1,y,-1,'black',90));for(const x of cells){const inside=xx=>((xx+.5)*(xx+.5)/144+ti*ti<1);if(inside(x-1)||inside(x+1))wheel.push(P('3005',x,y,-2,'metal'));}}
for(let k=0;k<4;k++){const a=2*Math.PI*k/4;wheel.push(L([0,36,-2],[Math.round(12*Math.cos(a)),36+Math.round(29*Math.sin(a)),-2],'metal'));}
wheel.push(B(-2,33,-3,4,6,6,'dark bluish grey'),P('87087',-1,35,-4,'metal'),P('87087',-1,34,3,'metal',180),P('88517',27,0,-1,'black'));
section('Great spoked wheel and little trailing wheel',wheel);
const cycle=[];
for(const z of [-4,2])cycle.push(...strut([0,36,z],[5,73,z],'bike'),L([5,73,z],[9,66,z],'bike'));
cycle.push(...strut([32,12,-4],[9,66,-4],'bike'),B(32,12,-4,2,6,1,'metal'),B(32,12,3,2,6,1,'metal'));
cycle.push(B(-1,35,-4,3,3,8,'metal'),B(31,11,-4,3,3,8,'metal'),floor({at:[3,73,-4],size:[7,8],layers:2,colour:'bike'}),B(8,73,-2,4,3,4,'bike'),B(7,76,-3,8,1,6,'black'));
for(const z of [-3,-1,1])cycle.push(P('15068',7,77,z,'black',90),P('15068',13,77,z,'black',270));
cycle.push(B(9,77,-3,4,2,6,'black'),B(9,79,-3,4,1,6,'black'),B(3,73,-7,2,3,14,'metal'));
for(const z of [-8,6])cycle.push(B(2,76,z,4,2,2,'reddish brown'),P('15068',2,78,z,'reddish brown',90),P('15068',4,78,z,'reddish brown',270));
cycle.push(P('4032b',3,76,-4,'pearl gold'),P('4740',3,77,-4,'pearl gold'),column({at:[20,0,-5],height:40,colour:'dark bluish grey'}),column({at:[20,0,5],height:40,colour:'dark bluish grey'}),B(18,0,-6,5,2,2,'dark bluish grey'),B(18,0,4,5,2,2,'dark bluish grey'),L([19,40,-3],[20,40,-5],'dark bluish grey'),L([19,40,3],[20,40,5],'dark bluish grey'));
cycle.push(L([0,36,-5],[-3,30,-5],'metal'),B(-5,29,-6,5,2,3,'black'),L([0,36,4],[3,42,4],'metal'),B(2,41,3,5,2,3,'black'));
section('Jade frame, leather saddle, brass bell and pedals',cycle);
const legs=[...strut([5,58,-5],[12,80,-5],'orange'),...strut([-3,36,-5],[5,58,-5],'orange'),...strut([11,60,4],[15,80,4],'orange'),...strut([4,48,4],[11,60,4],'orange'),B(11,78,-5,3,3,3,'orange'),B(14,78,2,3,3,3,'orange')];
function foot(x,y,z){return [B(x,y,z,5,2,3,'orange'),P('15068',x,y+2,z,'orange',90),P('15068',x+2,y+2,z,'orange',90),P('11477',x+4,y+2,z,'orange',90),P('11477',x,y+2,z+2,'orange',90),P('11477',x+2,y+2,z+2,'orange',90),P('54200',x+4,y+2,z+2,'orange',90)];}
legs.push(...foot(-5,31,-6),...foot(2,43,3));section('Bent orange legs and webbed feet',legs);
const body=[box({at:[9,80,-3],size:[13,13,6],colour:'bird',interior:'empty'}),box({at:[7,83,-4],size:[17,8,8],colour:'bird',interior:'empty'})];
for(let x=8;x<24;x++)body.push(P('13547',x,80,-5,'bird'),P('13547',x,80,1,'bird',180),P('61678',x,93,-4,'bird'),P('61678',x,93,0,'bird',180));
for(let z=-3;z<3;z++)body.push(P('50950',5,83,z,'bird',90),P('50950',5,86,z,'bird',90),P('50950',24,83,z,'bird',270));
body.push(B(8,91,-3,14,2,6,'bird'));for(let z=-3;z<3;z++)body.push(P('61678',22,91,z,'bird',270));
for(let z=-2;z<2;z++)body.push(P('42022',24,87,z,z===-2||z===1?'black':'bird',270),P('61678',27,90,z,z===-2||z===1?'black':'bird',270));
body.push(floor({at:[10,83,-7],size:[13,15],colour:'bird'}));section('Rounded breast, smooth back and pointed tail',body);
function wing(z){const out=[B(10,84,z,13,3,3,'bird')];for(let k=0;k<3;k++)out.push(P('42022',13+k,87,z+k,'bird',270),P('61678',13+k,90,z+k,'bird',270));out.push(L([12,88,z],[3,78,z],'bird'),L([12,89,z+1],[3,79,z+1],'bird'));for(let k=0;k<4;k++)out.push(P('11477',3+k*2,79+k*3,z,'bird',90),P('11477',3+k*2,79+k*3,z+1,'bird',90));for(let k=0;k<3;k++)out.push(P('50950',20+k,87,z+k,'light bluish grey',270));return out;}
section('Feathered wings reaching both handlebars',[...wing(-7),...wing(5)]);
const neck=[B(5,92,-2,5,18,4,'bird'),B(3,103,-2,6,9,4,'bird'),B(2,110,-3,6,6,6,'bird')];
for(let j=0;j<6;j++){const y=92+j*3,c=j===1||j===2?'dark red':'bird';for(const x of [5,7])neck.push(P('15068',x,y,-4,c),P('15068',x,y,2,c,180));neck.push(P('11477',9,y,-4,c),P('11477',9,y,2,c,180));for(let z=-2;z<2;z++)neck.push(P('50950',2,y,z,'bird',90));}
for(let x=2;x<8;x+=2)neck.push(P('15068',x,116,-3,'bird'),P('15068',x,116,1,'bird',180));for(let z=-1;z<1;z++)neck.push(P('2431',2,116,z,'bird'));
for(const z of [-4,3])neck.push(P('3004',1,110,z,'yellow'),P('87087',2,113,z,'black',z<0?0:180),P('3005',1,113,z,'yellow'),P('3005',3,113,z,'bird'),P('15068',0,116,z,'bird',90));
neck.push(B(0,107,-3,5,3,6,'bird'));section('Crooked neck, bright eyes and smooth crown',neck);
const bill=[B(-20,109,-2,22,2,4,'yellow'),B(-19,108,-2,20,1,4,'dark orange'),B(-14,102,-3,15,6,6,'orange'),B(-19,105,-2,5,3,4,'orange')];
for(let x=-18;x<0;x+=2)bill.push(P('15068',x,111,-2,'yellow'),P('15068',x,111,0,'yellow',180));
for(let z=-2;z<2;z++)bill.push(P('61678',-23,108,z,'yellow',90),P('13547',-19,102,z,'orange',90));
for(let x=-13;x<1;x++)bill.push(P('13547',x,99,-4,'orange'),P('13547',x,99,0,'orange',180));
for(let x=-12;x<0;x+=2)bill.push(P('15068',x,105,-5,'orange'),P('15068',x,105,3,'orange',180),P('3069b',x,108,-4,'yellow'),P('3069b',x,108,3,'yellow'));
section('Long golden bill and deep orange fishing pouch',bill);
section('Fluttering scarlet neckerchief',[B(5,96,-4,5,2,8,'dark red'),B(10,96,0,8,1,2,'dark red'),P('61678',15,97,0,'dark red',270),P('61678',14,98,1,'red',270)]);

```
