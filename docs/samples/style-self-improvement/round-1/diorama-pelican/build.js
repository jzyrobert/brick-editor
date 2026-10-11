script({title:'The Fishmonger\'s Express',description:'A white pelican pedals a turquoise fish-delivery bicycle along the harbour, with a huge golden throat pouch, swept black-tipped wings, alternating webbed feet, a wicker basket and a streaming red scarf.',palette:{bike:'medium azure'},defaults:{interior:'empty'}});
const W=44,D=26,p=(part,at,colour,turn=0)=>place({part,at,colour,turn}),b=(at,size,colour,extra={})=>box({at,size,colour,...extra});
function beam(a,c,colour,depth=1){const n=Math.max(Math.abs(c[0]-a[0]),Math.ceil(Math.abs(c[1]-a[1])/3),Math.abs(c[2]-a[2]));return range(n+1).map(i=>b([Math.round(a[0]+(c[0]-a[0])*i/n),4+3*Math.round((a[1]+(c[1]-a[1])*i/n-4)/3),Math.round(a[2]+(c[2]-a[2])*i/n)],[2,3,depth],colour,{interior:'solid'}));}
section('Harbour display',[
 floor({at:[0,0,0],size:[W,D],layers:3,colour:'black'}),floor({at:[0,3,0],size:[W,6],colour:'dark azure',top:'tile'}),floor({at:[0,3,6],size:[W,D-6],colour:'tan'}),
 ...range(11).map(i=>p('2431',[4*i,4,25],'dark bluish grey')),...range(6).map(i=>p('2431',[0,4,1+4*i],'dark bluish grey',90)),...range(6).map(i=>p('2431',[43,4,1+4*i],'dark bluish grey',90)),
 ...range(8).map(i=>[p('2431',[3+5*i,4,1+(i%3)],i%2?'medium azure':'trans light blue'),p('3069b',[4+5*i,4,4],'white')]),
 ...[2,40].map((x,i)=>[column({at:[x,4,21+i],height:9,diameter:2,colour:'black'}),p('14769',[x,13,21+i],'pearl gold')]),
 ...[[1,4,5],[41,4,5]].map(at=>p('3039',at,'dark bluish grey')),
 ...range(5).map(i=>[p('87079',[3+8*i,4,8],'dark tan'),p('87079',[6+8*i,4,20],'dark tan')]),
 floor({at:[3,4,7],size:[38,1],colour:'dark tan',top:'tile'}),floor({at:[3,4,23],size:[38,1],colour:'dark tan',top:'tile'})
]);
const widths=[6,10,12,14,14,14,14,14,14,12,10,6];
function wheel(cx){const ops=[];widths.forEach((w,k)=>{const x=cx-w/2,y=4+3*k;if(k===0||k===11){ops.push(b([x,y,12],[w,3,2],'black',{interior:'solid'}));}else{ops.push(b([x,y,12],[1,3,2],'black',{interior:'solid'}),b([x+w-1,y,12],[1,3,2],'black',{interior:'solid'}));if(k===1||k===10){ops.push(b([x+1,y,12],[w-2,3,2],'light bluish grey',{interior:'solid'}));}else{ops.push(b([x+1,y,12],[1,3,2],'light bluish grey',{interior:'solid'}),b([x+w-2,y,12],[1,3,2],'light bluish grey',{interior:'solid'}));}}});ops.push(...beam([cx-5,10,12],[cx+4,31,12],'light bluish grey',2),...beam([cx+4,10,12],[cx-5,31,12],'light bluish grey',2),b([cx-5,22,12],[10,3,2],'light bluish grey',{interior:'solid'}),b([cx-1,10,12],[2,24,2],'light bluish grey',{interior:'solid'}),b([cx-1,22,10],[2,3,6],'light bluish grey',{interior:'solid'}),p('3003',[cx-1,22,9],'dark bluish grey'),p('3003',[cx-1,22,15],'dark bluish grey'));return ops;}
section('Two sculpted spoked wheels',[wheel(10),wheel(33)]);
function frame(z){return [beam([10,22,z],[15,46,z],'bike'),beam([15,40,z],[28,43,z],'bike'),beam([15,40,z],[23,25,z],'bike'),beam([23,25,z],[28,46,z],'bike'),beam([28,43,z],[33,22,z],'bike'),beam([33,22,z],[23,25,z],'bike')];}
section('Bicycle chassis and pedals',[
 frame(10),beam([10,22,15],[15,46,15],'bike'),beam([28,43,15],[33,22,15],'bike'),b([23,4,12],[2,21,2],'dark bluish grey',{interior:'solid'}),b([22,25,8],[3,3,10],'dark bluish grey',{interior:'solid'}),b([26,46,10],[7,3,6],'black',{top:'tile'}),
 b([14,46,9],[2,3,8],'bike',{interior:'solid'}),b([13,49,8],[2,1,10],'light bluish grey',{interior:'solid'}),p('3004',[13,50,7],'black',90),p('3004',[13,50,17],'black',90),
 beam([23,25,8],[21,28,8],'dark bluish grey'),b([20,28,7],[5,2,3],'black',{top:'tile'}),beam([24,25,17],[27,34,17],'dark bluish grey'),b([26,34,17],[5,2,3],'black',{top:'tile'}),
 b([28,40,11],[9,2,4],'bike',{top:'tile'}),b([29,25,11],[1,15,1],'bike',{interior:'solid'}),b([36,25,14],[1,15,1],'bike',{interior:'solid'}),...[11,14].map(z=>p('54200',[36,42,z],'red'))
]);
section('Wicker morning-catch basket',[
 b([6,42,9],[8,1,8],'reddish brown',{interior:'solid'}),b([6,43,9],[8,6,8],'dark tan',{texture:'log',open:['top']}),floor({at:[7,43,10],size:[6,6],layers:6,colour:'dark tan'}),floor({at:[6,49,9],size:[8,8],colour:'reddish brown',holes:[{at:[7,10],size:[6,6]}]}),...[[8,49,11],[10,49,12],[12,49,11]].map((at,i)=>p('64648',at,i===1?'medium azure':'orange')),b([10,40,10],[5,2,6],'bike',{interior:'solid'})
]);
section('Alternating webbed feet',[
 beam([25,48,9],[25,38,9],'orange',2),beam([25,38,9],[22,31,8],'orange',2),beam([29,48,16],[31,43,17],'orange',2),beam([31,43,17],[28,37,17],'orange',2),floor({at:[20,30,7],size:[5,3],colour:'orange'}),floor({at:[26,36,17],size:[5,3],colour:'orange'}),...range(3).map(i=>p('54200',[20,31,7+i],'orange',90)),...range(3).map(i=>p('54200',[26,37,17+i],'orange',90))
]);
const bands=[[[26,49,11],[6,3,4]],[[24,52,10],[9,3,6]],[[22,55,9],[12,6,8]],[[21,61,9],[12,3,8]],[[21,64,10],[10,3,6]],[[20,67,11],[7,3,4]]];
function bodyCurves(){const ops=[];for(const y of [55,58,61]){for(let x=23;x<33;x+=2){ops.push(p('15068',[x,y,9],'white'),p('15068',[x,y,15],'white',180));}}for(let x=24;x<30;x+=2){ops.push(p('15068',[x,67,10],'white'),p('15068',[x,67,14],'white',180));}return ops;}
section('Pelican belly and shoulders',[
 ...bands.map(([at,size])=>b(at,size,'white',{top:'tile'})),bodyCurves(),...range(4).map(i=>p('13547',[24,52,10+i],'white',90)),b([33,56,11],[5,2,4],'white',{interior:'solid'}),...range(4).map(i=>p('61678',[34,58,11+i],i===0||i===3?'black':'white',270))
]);
function wing(z){const coreZ=z===7?7:15;return [b([27,55,coreZ],[8,3,4],'white'),b([25,58,coreZ],[10,3,4],'white'),b([24,61,coreZ],[10,3,4],'white'),...range(2).map(i=>[p('61678',[27,58,z+i],'white',270),p('61678',[31,58,z+i],'black',270),p('61678',[25,61,z+i],'white',270),p('61678',[29,61,z+i],'white',270),p('11477',[33,61,z+i],'black',270),p('61678',[24,64,z+i],'white',270),p('61678',[28,64,z+i],'white',270),p('11477',[32,64,z+i],'black',270)])];}
section('Swept layered wings',[wing(7),wing(17)]);
section('Long neck and red courier scarf',[
 b([19,66,10],[5,6,6],'white',{top:'tile'}),b([18,72,10],[5,6,6],'white',{top:'tile'}),b([17,78,10],[5,6,6],'white',{top:'tile'}),...[66,69,72,75,78,81].map((y,i)=>{const x=i<2?19:i<4?18:17;return [p('15068',[x,y,10],'white'),p('15068',[x+2,y,10],'white'),p('15068',[x,y,14],'white',180),p('15068',[x+2,y,14],'white',180)];}),
 floor({at:[18,71,9],size:[7,8],layers:2,colour:'red',holes:[{at:[19,11],size:[4,4]}],top:'tile'}),floor({at:[24,72,14],size:[5,2],layers:2,colour:'red',top:'tile'}),floor({at:[28,73,14],size:[5,2],layers:2,colour:'red',top:'tile'}),p('41769a',[32,73,14],'red',90)
]);
function pouchCurves(){return [73,76].map((y,i)=>{const start=i?6:9;return range(Math.floor((18-start)/2)).map(j=>[p('15068',[start+2*j,y,10],'tan'),p('15068',[start+2*j,y,14],'tan',180)]);});}
section('Golden bill and unmistakable throat pouch',[
 b([11,70,11],[7,3,4],'tan',{top:'tile'}),b([8,73,10],[10,3,6],'tan',{top:'tile'}),b([5,76,10],[13,3,6],'tan',{top:'tile'}),pouchCurves(),b([3,79,11],[15,3,4],'yellow',{top:'tile'}),...range(4).map(i=>p('61678',[3,82,11+i],'yellow',90)),floor({at:[7,82,11],size:[11,4],colour:'yellow',top:'tile'}),b([3,80,10],[14,1,1],'dark orange',{interior:'solid'}),b([3,80,15],[14,1,1],'dark orange',{interior:'solid'}),b([17,81,10],[7,6,6],'white',{top:'tile'}),p('3005',[18,84,10],'black'),p('3005',[18,84,15],'black'),p('3023b',[18,87,10],'white'),p('3023b',[18,87,15],'white'),...[17,19,21].map(x=>[p('15068',[x,88,10],'white'),p('15068',[x,88,14],'white',180)]),floor({at:[17,87,10],size:[7,6],colour:'white'}),floor({at:[17,88,12],size:[6,2],colour:'white',top:'tile'})
]);