script({title:"Piplup's First Bubble Lesson",description:"A bright-eyed Piplup balances on a sculpted ice floe, one flipper outstretched as three shining bubbles rise from its turquoise practice pool. A rounded blue hood, white eye patches, yellow beak, twin bib buttons and webbed feet give the little penguin its unmistakable silhouette.",defaults:{interior:"empty"}});
const p=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
const curvedRow=(xs,y,z,colour,turn=0)=>xs.map(x=>p('15068',x,y,z,colour,turn));
section('Connected ocean display',[
 box({at:[0,0,0],size:[22,2,18],colour:'dark blue',interior:'solid',top:'tile'}),
 floor({at:[1,2,1],size:[20,16],colour:'medium azure',top:'tile'}),
 floor({at:[1,3,1],size:[20,16],colour:'trans light blue',top:'tile'}),
 floor({at:[9,4,8],size:[11,8],colour:'white',layers:2,top:'tile'}),
 floor({at:[10,4,7],size:[8,1],colour:'white',layers:2,top:'tile'}),
 floor({at:[11,4,16],size:[7,1],colour:'white',layers:2,top:'tile'}),
 p('30357',7,4,8,'white',0),p('30357',18,4,6,'white',90),
 p('30357',8,4,14,'white',270),p('30357',18,4,14,'white',180),
 p('15068',8,5,10,'white',90),p('15068',8,5,12,'white',90),
 p('15068',18,5,10,'white',270),p('15068',18,5,12,'white',270),
 ...curvedRow([11,13,15],5,15,'white',180),
 ...[2,5,8].map((x,i)=>p('3069b',x,4,2+i,'white')),
 ...[[2,9],[5,10],[7,4],[19,4],[20,12]].map(([x,z])=>p('98138',x,4,z,'white'))
]);
function foot(x){return [floor({at:[x,6,8],size:[3,4],colour:'yellow'}),p('15068',x,7,8,'yellow'),p('11477',x+2,7,8,'yellow'),box({at:[x,7,10],size:[3,2,2],colour:'yellow',interior:'solid'})];}
section('Webbed feet and rounded body',[
 ...foot(11),...foot(15),
 box({at:[12,9,11],size:[4,13,4],colour:'medium azure'}),
 box({at:[11,12,11],size:[6,7,4],colour:'medium azure'}),
 p('1750',11,9,10,'medium azure'),p('1750',15,9,10,'medium azure'),
 p('1750',11,9,14,'medium azure',180),p('1750',15,9,14,'medium azure',180),
 ...[12,14].map(x=>p('1750',x,9,9,'white')),
 box({at:[12,12,9],size:[4,6,2],colour:'white',interior:'solid'}),
 ...curvedRow([12,14],18,9,'white'),
 ...curvedRow([11,15],19,11,'medium azure'),
 ...curvedRow([11,13,15],19,14,'medium azure',180),
 p('3005',12,21,10,'white'),p('3005',15,21,10,'white'),
 p('3795',7,15,11,'medium azure'),
 p('61678',7,16,11,'medium azure',90),p('61678',7,16,12,'medium azure',90),
 box({at:[16,9,12],size:[2,2,2],colour:'medium azure',interior:'solid'}),
 p('60481a',17,11,12,'medium azure',270),p('60481a',17,11,13,'medium azure',270),
 p('3031',12,12,14,'blue'),...curvedRow([12,14],13,16,'blue',180),
 floor({at:[12,22,11],size:[4,4],colour:'blue'})
]);
section('Sculpted Piplup head',[
 box({at:[11,23,10],size:[8,12,4],colour:'blue'}),
 box({at:[10,26,10],size:[1,6,4],colour:'blue',interior:'solid'}),
 box({at:[19,26,10],size:[1,6,4],colour:'blue',interior:'solid'}),
 box({at:[10,26,8],size:[1,6,2],colour:'medium azure',interior:'solid'}),
 box({at:[19,26,8],size:[1,6,2],colour:'medium azure',interior:'solid'}),
 box({at:[10,26,14],size:[10,6,2],colour:'blue'}),
 ...range(10,14).map(z=>p('24201',10,22,z,'blue',90)),
 ...range(10,14).map(z=>p('24201',18,22,z,'blue',270)),
 ...[11,13,15,17].map(x=>p('1750',x,23,14,'blue',180)),
 ...[11,16].map(x=>box({at:[x,26,8],size:[3,6,2],colour:'white',interior:'solid'})),
 p('1750',11,23,8,'white'),p('24201',13,22,8,'white'),
 p('24201',16,22,8,'white'),p('1750',17,23,8,'white'),
 p('3003pe2',11,29,8,'white'),p('3003pe2',17,29,8,'white'),
 p('15068',11,32,8,'white'),p('11477',13,32,8,'white'),
 p('11477',16,32,8,'white'),p('15068',17,32,8,'white'),
 box({at:[14,23,8],size:[2,7,2],colour:'medium azure',interior:'solid'}),
 p('3039',14,30,8,'blue'),
 p('3020',14,24,6,'yellow',90),p('3660b',14,25,6,'yellow'),p('15068',14,28,6,'yellow'),
 ...curvedRow([10,12,14,16,18],32,14,'blue',180),
 ...range(10,14).map(z=>p('11477',10,32,z,'blue',90)),
 ...range(10,14).map(z=>p('11477',18,32,z,'blue',270)),
 ...curvedRow([11,13,15,17],35,10,'blue'),
 ...curvedRow([11,13,15,17],35,12,'blue',180),
 p('11477',10,32,8,'medium azure'),p('11477',19,32,8,'medium azure')
]);
function bubble(x,z,y,large){return [column({at:[x+(large?1:0),4,z+(large?1:0)],height:y-4,diameter:large?2:1,colour:'trans-clear'}),large?p('86500',x,y,z,'trans light blue'):p('30367c',x,y,z,'trans light blue')];}
section('Bubble practice and frozen tide',[
 ...bubble(2,4,16,true),...bubble(6,6,24,false),...bubble(8,8,19,false),
 p('4740',1,4,3,'white'),p('4740',5,4,4,'white'),p('4740',7,4,9,'white'),
 box({at:[2,4,13],size:[5,3,3],colour:'dark azure',interior:'solid'}),
 ...curvedRow([2,4],7,13,'medium azure',180),p('11477',6,7,13,'medium azure',180),
 p('15068',2,7,15,'white',180),p('15068',4,7,15,'white',180),
 p('3039',19,6,14,'trans light blue',180),p('3678b',19,9,14,'white',180),
 p('54200',20,6,8,'trans light blue'),p('54200',9,6,15,'trans light blue',90),
 p('3069b',17,4,3,'white'),p('2431',13,4,3,'trans-clear'),
 p('3069b',4,4,11,'trans-clear')
]);