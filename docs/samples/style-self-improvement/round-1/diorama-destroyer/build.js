script({title:'Devastator — The Pursuit Above Tatooine',description:'The Imperial dagger overtakes the tiny red-striped Tantive IV above a sandy planetary limb: layered armour, dark equipment trenches, eight heavy turbolasers, a terraced dorsal citadel, twin shield globes, a ventral docking bay and seven luminous stern exhausts. A connected starfield display supports both ships.',palette:{hull:'light bluish grey',shadow:'dark bluish grey',space:'black',desert:{mix:['tan','tan','tan','dark tan']}},defaults:{interior:'empty'}});
const P=(part,x,y,z,colour='light bluish grey',turn=0)=>place({part,at:[x,y,z],colour,turn});
const site=[floor({at:[-40,0,-64],size:[80,124],layers:3,colour:'black'})];
for(let x=-40;x<40;x+=8)site.push(P('4162',x,3,-64,'black'),P('4162',x,3,59,'black'));
for(let z=-63;z<57;z+=8)site.push(P('4162',-40,3,z,'black',90),P('4162',39,3,z,'black',90));
for(let i=0;i<60;i++){const x=-37+(i*23)%74,z=-60+(i*37)%116;if(!(x>-38&&x<-8&&z<-32))site.push(P('98138',x,3,z,i%9===0?'trans light blue':'white'));}
site.push(box({at:[-3,3,-7],size:[6,33,8],colour:'black',interior:'solid'}),box({at:[-4,3,32],size:[8,27,10],colour:'black',interior:'solid'}));
section('Connected starfield display',site);
const planet=[];
for(let j=0;j<3;j++){const r=[14,11,7][j];for(let z=-48-r;z<-48+r;z+=2){const dz=z+49,a=Math.floor(Math.sqrt(Math.max(0,r*r-dz*dz)));if(a>0)planet.push(floor({at:[-24-a,3+j*2,z],size:[a*2,2],layers:2,colour:'desert',top:'tile'}));}}
section('Tatooine curved planetary limb',planet);
const N=18,L=6,Z=-54;
const occupied=(x,z)=>((z>=18&&z<50&&x>=-18&&x<18)||(z>=24&&z<43&&((x>=-23&&x<-19)||(x>=19&&x<23))));
const hull=[];
for(let i=0;i<N;i++){
 const a=2*(i+1),z=Z+i*L,t=39+3*Math.floor(i/6),b=35-3*Math.floor(i/6);
 hull.push(P('78443',-a,b,z),P('78444',a-2,b,z),P('41748',-a,t-3,z),P('41747',a-2,t-3,z));
 if(a>2)hull.push(floor({at:[-a+2,b,z],size:[2*a-4,L],colour:'dark bluish grey'}),box({at:[-a+2,b+1,z],size:[2*a-4,t-b-3,L],colour:'light bluish grey',supports:6}));
 if(a>=4)for(let k=0;k<L;k++)hull.push(P('3040b',-a+2,t-3,z+k,'light bluish grey',90),P('3040b',a-4,t-3,z+k,'light bluish grey',270));
 for(let x=-a+4;x<a-4;x+=4)for(let q=0;q<L;q+=2){
  hull.push(P('3020',x,t-2,z+q));
  const zz=z+q,c=(zz%18===0&&Math.abs(x)>6)?'dark bluish grey':'light bluish grey';
  hull.push(P(occupied(x,zz)||occupied(x+2,zz)?'3710':'2431',x,t-1,zz,c));
  for(let s=0;s<4;s+=2)hull.push(P(occupied(x+s,zz+1)?'3023b':'3069b',x+s,t-1,zz+1,'light bluish grey'));
 }
 if(i>=6)for(const side of [-1,1]){const x=side<0?-a:a-2;for(let q=3;q<6;q+=2){let y=b+1;while(y<t-4){const brick=t-4-y>=3;hull.push(P(brick?'3004':'3023b',x,y,z+q,y===b+1?'black':'dark bluish grey'));y+=brick?3:1;}hull.push(P('3023b',x,t-4,z+q,'dark bluish grey'));}}
}
hull.push(box({at:[-1,36,-48],size:[2,1,96],colour:'light bluish grey',interior:'solid'}));
section('Tapered armoured dagger and equipment trenches',hull);
function tier(x,y,z,w,d,h){
 const o=[room({at:[x,y,z],size:[w,h,d],colour:'light bluish grey',texture:'grille',openings:[]}),floor({at:[x,y+h,z],size:[w,d],colour:'light bluish grey',top:'tile'})];
 for(let k=2;k<w-2;k+=4)o.push(P('2412b',x+k,y+h+1,z+1,'dark bluish grey'),P('2412b',x+k,y+h+1,z+d-2,'dark bluish grey'));
 for(let k=3;k<d-3;k+=5)o.push(P('3062b',x-1,y,z+k,'dark bluish grey'),P('3062b',x+w,y,z+k,'dark bluish grey'));
 return o;
}
const city=[...tier(-16,45,18,32,32,6),...tier(-13,52,24,26,26,5),...tier(-10,58,30,20,20,5),...tier(-7,64,36,14,14,5),room({at:[-4,70,39],size:[8,11,8],colour:'light bluish grey',texture:'grille',openings:[]}),floor({at:[-14,81,36],size:[28,10],layers:2,colour:'light bluish grey'}),box({at:[-14,83,36],size:[28,7,10],colour:'light bluish grey',top:'tile',supports:6})];
for(let x=-12;x<12;x+=2)city.push(P('3004',x,84,36,(x%6===0?'light bluish grey':'black')),P('3004',x,84,45,(x%6===0?'light bluish grey':'black')));
for(let z=36;z<46;z++)city.push(P('50950',-14,87,z,'light bluish grey',90),P('50950',11,87,z,'light bluish grey',270));
for(let x=-14;x<14;x+=2){if(x>=-4&&x<4)continue;city.push(P('3660b',x,78,37,'light bluish grey'),P('3660b',x,78,42,'light bluish grey',180));}
for(const x of [-12,6])city.push(column({at:[x+1,90,40],height:4,diameter:4,colour:'dark bluish grey'}),dome({at:[x,94,39],diameter:6,colour:'light bluish grey'}));
city.push(column({at:[-1,90,43],height:9,diameter:2,colour:'light bluish grey',cap:'cone'}));
section('Terraced dorsal citadel and command bridge',city);
function gun(x,z){return [P('3020',x,45,z,'dark bluish grey'),P('4032b',x+1,46,z),P('3941',x+1,47,z,'dark bluish grey'),P('3623',x+1,50,z-1,'light bluish grey',90),P('3623',x+2,50,z-1,'light bluish grey',90),P('15068',x+1,51,z),P('3623',x+1,49,z-3,'dark bluish grey',90),P('3623',x+2,49,z-3,'dark bluish grey',90),P('2412b',x+1,50,z-3,'light bluish grey',90),P('2412b',x+2,50,z-3,'light bluish grey',90)];}
const weapons=[];
for(const x of [-23,19])for(const z of [24,29,34,39])weapons.push(...gun(x,z));
for(const side of [-1,1])for(let z=18;z<48;z+=6){if(z===36)continue;const x=side<0?-18:16;weapons.push(P('3023b',x,45,z),P('3004',x,46,z,'dark bluish grey'),P('2412b',x,49,z));}
section('Heavy batteries and flank machinery',weapons);
function engine(cx,y,z,w,rows){
 const o=[],h=rows*3;
 for(let r=0;r<rows;r++)for(let c=0;c<w;c++){
  const rr=((c-(w-1)/2)/(w/2))**2+((r-(rows-1)/2)/(rows/2))**2;if(rr>1)continue;
  const x=cx-Math.floor(w/2)+c,yy=y+r*3;
  o.push(box({at:[x,yy,z],size:[1,3,5],colour:rr>.55?'light bluish grey':'dark bluish grey',interior:'solid'}),P('3005',x,yy,z+5,rr>.55?'light bluish grey':(rr<.24?'trans light blue':'medium azure')));
 }
 o.push(box({at:[cx-Math.floor(w/2)+1,y+3,z-3],size:[w-2,h-6,4],colour:'dark bluish grey',interior:'solid'}));
 return o;
}
const engines=[];
for(const x of [-19,0,19])engines.push(...engine(x,25,54,8,7));
for(const x of [-29,-10,10,29])engines.push(...engine(x,36,54,4,4));
section('Three main and four auxiliary blue exhausts',engines);
const belly=[box({at:[-6,28,-4],size:[12,4,16],colour:'dark bluish grey',interior:'solid',open:['front','top']}),floor({at:[-4,29,-2],size:[8,12],colour:'black'}),P('3020',-2,30,2,'white'),P('2412b',-2,31,2,'dark bluish grey'),P('2412b',0,31,2,'dark bluish grey')];
for(const x of [-5,4])for(let z=-2;z<10;z+=3)belly.push(P('3005',x,29,z,'trans light blue'));
section('Ventral capture bay',belly);
component('Tantive IV',{size:[10,30],ops:[box({at:[3,0,3],size:[4,6,20],colour:'white',interior:'solid'}),box({at:[2,0,10],size:[6,6,5],colour:'dark red',interior:'solid'}),box({at:[-2,0,0],size:[14,6,4],colour:'white',interior:'solid',top:'tile'}),box({at:[0,0,22],size:[10,12,6],colour:'white',interior:'solid'}),P('3004',4,2,0,'black'),...range(6).map(i=>P('15068',-1+i*2,6,1,'white')),...range(10).map(i=>P('3069b',3,6,3+i*2,'white',90)),...range(3).map(r=>range(r===1?3:4).map(k=>{const x=(r===1?2:1)+2*k;return [P('3022',x,r*4,27,'dark bluish grey'),P('3004',x,r*4+1,28,'trans light blue')];})),P('3022',4,6,16,'dark bluish grey'),P('4740',4,7,16,'white'),P('3957a',4,8,16,'white')]});
section('The fleeing blockade runner',[box({at:[16,3,-31],size:[4,9,5],colour:'black',interior:'solid'}),instance({component:'Tantive IV',at:[13,12,-46]})]);