script({title:'The Ember Nursery',description:'A moss-green mother dragon shelters her eggs above a warm volcanic spring. Swept wine-red wings, ivory horns, a hooked armored tail and watchful eyes frame the little basalt nest.',palette:{hide:'dark green',belly:'sand green',membrane:'dark red',bone:'tan',rock:'dark bluish grey',moss:'olive green'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour,top)=>box({at:[x,y,z],size:[w,h,d],colour,interior:'solid',...(top?{top:'tile'}:{})});
section('Connected basalt display',[
 floor({at:[0,0,0],size:[36,30],layers:2,colour:'black',top:'tile'}),floor({at:[1,2,1],size:[34,28],colour:'rock',top:'tile'}),floor({at:[9,3,10],size:[16,17],colour:'moss'}),
 floor({at:[24,3,2],size:[3,11],colour:'orange',top:'tile'}),floor({at:[26,3,11],size:[5,3],colour:'trans yellow',top:'tile'}),floor({at:[29,3,13],size:[3,7],colour:'orange',top:'tile'}),floor({at:[31,3,18],size:[3,8],colour:'dark red',top:'tile'}),
 B(25,3,4,6,1,6,'black',true),floor({at:[25,4,4],size:[6,6],layers:2,colour:'dark tan'}),B(28,3,21,6,3,6,'rock',true),B(3,3,5,5,3,5,'rock',true),B(2,3,24,5,3,4,'rock',true),
 P('3684a',30,6,23,'rock',180),P('3678b',28,6,24,'light bluish grey',90),P('3039',32,6,25,'rock',180),P('3039',3,6,5,'light bluish grey',90),P('3039',5,6,7,'rock',180),P('15068',2,6,25,'rock',90),P('2431',15,2,0,'pearl gold'),P('3069b',19,2,0,'dark red')
]);
function foot(x,z,rear){return [B(x,4,z,4,3,5,'hide',true),...([0,2].map(dx=>P(rear?'93606':'15068',x+dx,7,z+2,'hide'))),...([0,1,3].map(dx=>P('49668',x+dx,7,z,'tan'))),B(x+2,7,z+3,2,rear?9:11,3,'hide'),P('15068',x+2,11,z+2,'hide'),rear?P('93606',x+1,16,z+1,'hide'):P('93606',x+2,14,z+2,'hide')];}
section('Four grounded clawed legs',[...foot(11,10,false),...foot(11,20,true),...foot(21,10,false),...foot(21,20,true)]);
section('Sculpted body and upright neck',[
 B(15,9,14,6,15,10,'hide'),B(12,17,13,4,3,8,'hide'),B(20,17,13,4,3,8,'hide'),B(17,12,10,4,19,5,'hide'),
 ...[15,17,19].flatMap(x=>[P('93606',x,24,14,'hide'),P('93606',x,24,20,'hide',180),P('3678b',x,18,23,'hide',180)]),floor({at:[15,24,18],size:[6,2],colour:'hide',top:'tile'}),
 ...[16,18].flatMap(z=>[P('93606',13,16,z,'hide',90),P('93606',19,16,z,'hide',270)]),
 ...[18,21,24,27].flatMap(y=>[17,18,19,20].map(x=>P('11477',x,y,9,'belly'))),P('15068',17,28,13,'hide',180),P('15068',19,28,13,'hide',180),
 P('4589',16,28,17,'bone'),P('4589',17,25,18,'bone'),P('4589',18,25,19,'bone'),P('4589',19,28,20,'bone'),...[15,20].flatMap(x=>[P('11477',x,12,16,'belly',180),P('11477',x,15,18,'hide',180)])
]);
function wing(){const W=(part,x,y,z,c,t=0)=>P(part,x-2,y-20,z-13,c,t);return [
 W('3034',2,20,13,'hide'),W('3020',10,20,13,'hide'),W('3795',6,20,15,'hide'),W('3020',10,20,17,'hide'),W('3020',10,20,19,'hide'),
 W('54384',2,21,13,'membrane',90),W('54384',8,21,13,'membrane',90),W('54384',6,21,16,'membrane',90),W('41770a',10,21,19,'membrane',90),
 W('11477',2,22,13,'hide',90),W('2431',4,22,13,'hide'),W('2431',8,22,13,'hide'),W('11477',12,22,13,'hide',90),W('3068b',6,22,14,'membrane'),W('3068b',10,22,14,'membrane'),W('15068',8,22,16,'membrane'),W('63864',11,22,16,'hide',90),W('3069b',12,22,19,'hide',90)
 ];}
component('sweptWing',{size:[12,8],ops:wing()});
section('Asymmetric sheltering wings',[instance({component:'sweptWing',at:[2,20,13]}),instance({component:'sweptWing',at:[22,20,13],turn:180})]);
section('Long hooked tail',[
 B(15,4,23,4,8,4,'hide'),B(9,4,25,8,5,2,'hide'),B(7,4,23,2,5,4,'hide'),P('93606',15,12,23,'hide',180),P('93606',17,12,23,'hide',180),P('93606',9,9,25,'hide',90),P('93606',13,9,25,'hide',90),P('93606',7,9,23,'hide'),P('40379',7,4,19,'hide'),P('4589',15,16,23,'bone'),P('54200',10,13,26,'bone',90),P('54200',7,13,26,'bone')
]);
section('Watchful dragon face',[
 ...[17,18,19,20].map(x=>P('24201',x,27,5,'belly')),floor({at:[16,31,5],size:[6,8],colour:'hide'}),floor({at:[17,32,5],size:[4,4],layers:2,colour:'black'}),
 P('49668',16,32,5,'tan'),P('49668',21,32,5,'tan'),P('49668',16,32,7,'tan'),P('49668',21,32,7,'tan'),P('93606',17,34,5,'hide'),P('93606',19,34,5,'hide'),B(16,32,9,6,5,4,'hide'),
 ...[16,18,20].map(x=>P('15068',x,37,11,'hide')),...[16,21].flatMap(x=>[P('6141',x,37,9,'yellow'),P('10238',x,38,9,'white'),P('54200',x,37,10,'hide'),P('4589',x,40,12,'bone'),P('64847',x,43,12,'tan',x===16?0:180)]),
 P('98138',18,38,8,'black'),P('98138',20,38,8,'black'),P('3069b',18,37,10,'belly'),P('15070',16,34,12,'tan',90),P('15070',21,34,12,'tan',270)
]);
section('Warm spring and precious eggs',[
 ...[25,27,29].flatMap(x=>[P('15068',x,6,4,'reddish brown'),P('15068',x,6,8,'reddish brown',180)]),P('11477',25,6,6,'reddish brown',90),P('11477',30,6,6,'reddish brown',270),P('24946',27,6,6,'white'),P('24946',29,6,6,'tan'),
 P('98138',24,4,2,'trans yellow'),P('98138',25,4,12,'trans yellow'),P('98138',30,4,17,'trans yellow'),P('54200',23,3,4,'rock',90),P('54200',23,3,8,'rock',90),P('3039',32,3,10,'rock',270),
 P('32607',5,9,8,'dark green'),P('32607',3,6,26,'dark green'),P('32607',32,9,26,'dark green'),P('3068b',6,3,3,'sand green'),P('3069b',8,3,5,'sand green'),P('3068b',3,3,18,'sand green'),P('3069b',26,3,25,'sand green')
]);