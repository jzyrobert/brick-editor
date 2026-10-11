script({title:'Yub-Nub Explorer 497-E',description:'Classic Space, rebuilt by Ewoks: a yellow cockpit wrapped in a stitched russet hood, ear-shaped scanners, blue glider wings with wooden spars, log rocket sleds and a woven moon-acorn basket. Two Ewok astronauts operate a woodland radio totem.',palette:{hull:'blue',metal:'light bluish grey',wood:'reddish brown',hood:'dark orange',binding:'tan'},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour,turn=0)=>place({part,at:[x,y,z],colour,turn});
function engine(x){return [
 floor({at:[x+1,0,3],size:[2,10],layers:1,colour:'black',top:'tile'}),
 box({at:[x+1,1,6],size:[2,4,4],colour:'metal',top:'tile'}),
 box({at:[x,5,3],size:[4,3,10],colour:'wood',top:'tile'}),
 ...range(4).map(i=>P('61678',x+i,8,3,'wood')),
 box({at:[x,8,7],size:[4,3,2],colour:'binding',top:'tile'}),
 ...range(4).map(i=>P('61678',x+i,8,9,'wood',180)),
 P('4746',x+1,11,7,'blue')
];}
section('Log rocket sleds',[engine(-12),engine(8),floor({at:[-2,0,-10],size:[4,5],layers:1,colour:'black',top:'tile'}),box({at:[-1,1,-8],size:[2,4,3],colour:'metal',top:'tile'})]);
section('Flight chassis',[
 floor({at:[-4,4,-7],size:[8,16],layers:1,colour:'metal'}),
 box({at:[-4,5,-7],size:[8,3,16],colour:'hull',top:'tile'}),
 floor({at:[-12,5,3],size:[24,4],layers:1,colour:'metal'}),
 ...range(6).map(i=>P('13547',-3+i,5,-11,'reddish brown')),
 P('30363',-3,8,-11,'light bluish grey'),P('30363',1,8,-11,'light bluish grey'),
 P('3298p90',-1,8,-10,'blue'),P('3069b',-1,8,-11,'blue'),
 P('98138',-3,11,-8,'trans yellow'),P('98138',2,11,-8,'trans yellow')
]);
function wing(x,outer,part){return [
 floor({at:[x,6,-1],size:[4,8],layers:1,colour:'hull',top:'tile'}),
 P(part,outer,6,-1,'blue'),
 P('2431',x,7,0,'tan'),P('2431',x,7,4,'tan'),
 P('2431p01',x,7,6,'reddish brown'),
 P('2412b',x,7,2,'light bluish grey'),P('2412b',x+2,7,2,'light bluish grey'),
 P('30363',x+1,7,-4,'light bluish grey')
];}
section('Timber-spar delta wings',[wing(-8,-12,'3933'),wing(4,8,'3934')]);
function cheek(x){return range(3).map(k=>[
 box({at:[x,5,-7+3*k],size:[2,3+3*k,3],colour:'hood'}),
 P('24309',x,8+3*k,-7+3*k,'dark orange'),
 P('98138',x===-5?x:x+1,11+3*k,-5+3*k,'tan')
]);}
section('Hooded yellow cockpit',[
 P('18729',-3,8,-7,'trans yellow'),cheek(-5),cheek(3),
 box({at:[-4,8,3],size:[8,9,6],colour:'hood'}),
 P('88930',-4,17,3,'dark orange'),P('88930',0,17,3,'dark orange'),
 ...range(8).map(i=>P('61678',-4+i,17,5,'dark orange',180)),
 floor({at:[-2,20,4],size:[4,2],layers:1,colour:'hood',top:'tile'}),
 P('3957a',-4,20,5,'red'),
 P('3004p90',-1,11,8,'blue',180),P('3069b',-1,14,8,'tan')
]);
function ear(x){return [
 box({at:[x+1,6,2],size:[2,6,2],colour:'hull'}),
 P('87081',x,12,1,'reddish brown'),P('87081',x,15,1,'reddish brown'),
 P('3960',x,18,1,'reddish brown'),P('4740',x+1,20,2,'tan'),
 P('98138',x+1,21,2,'black')
];}
section('Ewok ear scanner pods',[ear(-9),ear(5)]);
section('Moon-acorn cargo basket',[
 box({at:[-3,5,9],size:[6,3,4],colour:'hull',top:'tile'}),
 P('3633',-3,8,9,'reddish brown',90),P('3633',2,8,9,'reddish brown',90),P('3633',-2,8,12,'reddish brown'),
 P('2489',-1,8,10,'reddish brown'),P('4032b',-1,13,10,'tan'),P('30153',-1,14,10,'trans yellow'),
 P('2412b',-2,8,9,'light bluish grey'),P('2412b',0,8,9,'light bluish grey')
]);
function astronaut(x,z,torso,colour){return group({at:[x,0,z],ops:[
 floor({at:[0,0,0],size:[4,4],layers:1,colour:'dark bluish grey',top:'tile'}),
 P('41879a',1,1,1,'reddish brown'),P(torso,0,5,1,colour),P('64805',1,12,1,'reddish brown')
]});}
section('Ewok survey crew',[astronaut(15,-5,'76382p91','blue'),astronaut(21,-1,'76382p90','white')]);
section('Woodland radio totem',[
 floor({at:[17,0,7],size:[4,4],layers:2,colour:'light bluish grey',top:'tile'}),
 box({at:[18,2,8],size:[2,12,2],colour:'wood',texture:'log'}),
 P('3004p90',18,5,8,'blue'),P('3039p34',18,11,7,'blue'),
 P('3941',18,14,8,'reddish brown'),P('3960',17,17,7,'light bluish grey'),P('3957a',18,19,8,'red'),
 P('32607',20,2,10,'green')
]);