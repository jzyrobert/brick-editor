script({title:'Emberwing — Keeper of the Last Egg',description:'A crimson dragon spreads scalloped black wings around its ice-blue egg. Massive talons and a curling tail balance the protective pose.',palette:{skin:'dark red',bone:'tan',membrane:'black',ember:'orange'}});
const P=(part,x,y,z,colour='skin',turn=0)=>place({part,at:[x,y,z],colour,turn});
const B=(x,y,z,w,h,d,colour='skin',top)=>box({at:[x,y,z],size:[w,h,d],colour,interior:'solid',...(top?{top:'tile'}:{})});
function foot(x,z,right){return [B(x,0,z,6,4,10,'skin',true),...range(3).map(i=>P('4286',x+2*i,1,z,'bone')),...range(3).map(i=>P('15068',x+2*i,4,z+3)),B(x+1,4,z+5,4,14,4),B(x,14,z+4,6,15,6),P('93606',right?x+4:x,26,z+4),P('4460b',x,8,z+5,'skin',90),P('4460b',x+4,8,z+5,'skin',270),P('15068',x+1,18,z+2),P('15068',x+3,18,z+2)];}
section('Grounded talons and muscular haunches',[...foot(-10,-5,false),...foot(4,-2,true)]);
const body=[B(-4,20,0,8,25,10),B(-5,24,-1,10,18,12),B(-4,39,-3,8,9,12),B(-3,45,-9,6,15,7),B(-4,54,-13,8,12,7)];
for(const z of [-1,1,3,5,7,9])body.push(P('3660b',-7,24,z,'skin',90),P('3660b',5,24,z,'skin',270),P('93606',-8,27,z,'skin',90),P('93606',4,27,z,'skin',270),P('93606',-6,39,z,'skin',90),P('93606',2,39,z,'skin',270));
for(let z=-1;z<11;z+=2)body.push(P('3684a',-7,30,z,'skin',90),P('3684a',5,30,z,'skin',270));
for(let x=-3;x<3;x++)body.push(P('4460b',x,24,-3,'bone'),P('4460b',x,33,-5,'bone'),P('4460b',x,42,-7,'bone'),P('4460b',x,51,-11,'bone'));
for(const x of [-4,-2,0,2])for(const y of [30,34])body.push(P('93606',x,y,8,'skin',180));
for(const x of [-2,0])body.push(P('93606',x,38,8,'skin',180));
for(let z=-9;z<-3;z++)body.push(P('4460b',-5,48,z,'skin',90),P('4460b',3,48,z,'skin',270));
for(const z of [-12,-10,-8])body.push(P('15068',-5,60,z,'skin',90),P('15068',3,60,z,'skin',270));
for(const z of [5,8])body.push(P('3941',-1,45,z),P('3942c',-1,48,z,'bone'));
section('Armoured chest and arched neck',body);
function wing(side){const a=[],bottoms=[33,36,39,42,42,39,42,45,42,39,48],sx=(x,w)=>side===1?x:-x-w;for(let i=0;i<11;i++){const x=6+2*i,z=5+Math.floor(i/4),top=45+3*i,low=bottoms[i];a.push(B(sx(x,2),low,z,2,top-low,2,'membrane'),B(sx(x,2),top-3,z,2,3,2),P('3039',sx(x,2),top,z,'skin',side===1?90:270),P('3660b',sx(x,2),low,z,'membrane',side===1?90:270));if([2,6,10].includes(i))for(let y=low+3;y<top-3;y+=3)a.push(P('3004',sx(x+1,1),y,z,'skin',90));}a.push(B(sx(4,4),33,5,4,9,4),P('2142',sx(26,2),78,7,'bone'));return a;}
section('Swept scalloped wings',[...wing(1),...wing(-1)]);
const tailData=[[-3,8,10,6,12,8],[-2,6,17,6,9,7],[0,4,23,6,7,7],[3,2,29,6,5,6],[7,1,33,6,4,5],[12,0,35,6,3,4],[17,0,34,6,3,4],[22,0,31,4,3,6],[24,0,27,2,3,6]],covered=new Set();
function tailSegment(t,k){const[x,y,z,w,h,d]=t,a=[B(x,y,z,w,h,d,'skin',true)];let spine=false;for(let dz=0;dz<(d>=8?8:4);dz+=4)for(let j=0;j<w;j+=2){let clash=false;for(let u=0;u<2;u++)for(let v=0;v<4;v++)for(let q=y+h;q<y+h+4;q++)if(covered.has(`${x+j+u},${q},${z+dz+v}`))clash=true;if(!clash){a.push(P('93606',x+j,y+h,z+dz));for(let u=0;u<2;u++)for(let v=0;v<4;v++)for(let q=y+h;q<y+h+4;q++)covered.add(`${x+j+u},${q},${z+dz+v}`);if(dz===0&&!spine){a.push(P('4589',x+j+1,y+h+4,z+3,k%2?'bone':'ember'));spine=true;}}}return a;}
section('Hooked balancing tail',tailData.flatMap(tailSegment));
function arm(x,y,z){return [B(x,y+6,z+5,4,9,5),B(x,y,z+1,4,9,7),B(x,y,z-3,5,4,6,'skin',true),P('93606',x,y+12,z+5),P('93606',x+2,y+12,z+5),P('15068',x,y+4,z-3),P('15068',x+2,y+4,z-3),...range(3).map(i=>P('4286',x+i,y+1,z-4,'bone')),P('4460b',x,y+3,z+2,'skin',90)];}
section('Protective hands and ice egg',[...arm(-10,30,-9),...arm(5,33,-8),B(-6,30,-12,12,3,3),cylinder({at:[-3,33,-14],diameter:6,height:6,colour:'medium azure'}),dome({at:[-3,39,-14],diameter:6,colour:'medium azure'})]);
const head=[B(-4,62,-22,8,3,10,'skin',true),B(-4,62,-13,8,10,4),B(-4,68,-22,8,4,12,'skin',true),B(-6,68,-17,12,6,8),floor({at:[-6,72,-17],size:[12,8],layers:2,colour:'skin',top:'tile'}),P('93606',-8,68,-15,'skin',90),P('93606',4,68,-15,'skin',270)];
for(const x of [-4,-2,0,2])head.push(P('93606',x,72,-22));
for(const x of [-4,3])for(const z of [-20,-17])head.push(P('4589',x,65,z,'bone'));
for(const x of [-5,4])head.push(P('10238',x,74,-16,'white'),P('11477',x,74,-15),P('3070b',x,74,-13,'ember'));
for(const x of [-5,3])head.push(P('3941',x,74,-11),P('2142',x,77,-11,'bone'));
for(const x of [-3,2])head.push(P('98138',x,76,-19,'black'));
head.push(P('15068',-1,74,-14,'skin',180),P('3003',-1,74,-12),P('3942c',-1,77,-12,'ember'));
section('Long muzzle, slit mouth, watchful eyes and horns',head);