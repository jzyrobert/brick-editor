script({title:"Endor Outpost LL-918: the Ewok Galaxy Explorer", description:"A Classic Space probe has crashed on the forest moon. The Ewoks have stripped it for parts: its radar dishes now crown their log huts, and in the treetops they have built their own blue-and-grey spaceship from logs and hide, ready on a log ski-jump while a lost spaceman watches.", palette:{log:"reddish brown", bark:{mix:["reddish brown","reddish brown","dark brown"]}, planks:{mix:["reddish brown","dark tan","reddish brown"]}, leaf:{mix:["dark green","green","dark green"]}, moss:{mix:["dark green","green","green","dark tan"]}, stone:{mix:["light bluish grey","light bluish grey","light bluish grey","dark bluish grey"]}, hide:{mix:["tan","dark tan"]}}});

const P=(part,at,colour,turn)=>place({part,at,colour,turn:turn||0});
const rim=(from,to,y,h)=>wall({from,to,y,height:h||3,colour:"log",texture:"log"});
const plat=(x,y,z,w,d)=>floor({at:[x,y,z],size:[w,d],colour:"planks",top:"tile"});
const lantern=(x,y,z)=>[P("3062b",[x,y,z],"log"),P("6141",[x,y+3,z],"trans yellow")];
const ewok=(x,y,z)=>[P("41879a",[x,y,z],"reddish brown"),P("973",[x,y+4,z],"reddish brown"),P("64805",[x,y+10,z],"reddish brown")];
const roots=(list)=>list.map(([x,z,t])=>P("3039",[x,1,z],"log",t));

function hut(x,y,z,w,d,hb,roofC,doorSide,winSide,cap){
  const Y=y+3*hb, cx=x+w/2-1, cz=z+d/2-1;
  const along=s=>(s==="front"||s==="back")?w:d;
  return [
    room({at:[x,y,z],size:[w,hb+"b",d],colour:"log",texture:"log",openings:[
      {side:doorSide,at:Math.floor(along(doorSide)/2)-1,width:2,y:0,height:7,fill:"none"},
      {side:winSide,at:1,width:2,y:2,height:6,fill:"window",frame:"blue",glass:"trans yellow"}]}),
    roof({style:"hip",at:[x,Y,z],size:[w,d],colour:roofC,holes:[{at:[cx,cz],size:[2,2]}]}),
    box({at:[cx,Y,cz],size:[2,12,2],colour:"light bluish grey",interior:"solid"}),
    cap==="dish"&&P("3960",[cx-1,Y+12,cz-1],"light bluish grey"),
    cap==="big"&&P("44375b",[cx-2,Y+12,cz-2],"light bluish grey"),
    cap==="ant"&&[P("3941",[cx,Y+12,cz],"blue"),P("3957a",[cx,Y+15,cz],"light bluish grey"),P("3957a",[cx+1,Y+15,cz+1],"light bluish grey")]
  ];
}

section("Forest floor",[
  baseplate({at:[0,0],size:[48,48],colour:"green"}),
  floor({at:[0,0,18],size:[20,30],colour:"moss",top:"tile"}),
  floor({at:[25,0,22],size:[23,26],colour:"moss",top:"tile"}),
  floor({at:[38,0,0],size:[10,22],colour:"moss",top:"tile"}),
  floor({at:[0,0,14],size:[13,4],colour:"moss",top:"tile"}),
  floor({at:[25,0,0],size:[13,8],colour:"moss",top:"tile"}),
  floor({at:[20,0,0],size:[5,22],colour:"dark tan"}),
  floor({at:[13,0,14],size:[7,4],colour:"dark tan"}),
  P("2435",[44,1,2],"dark green"),
  P("3471",[1,1,42],"green"),
  P("2417",[43,1,5],"dark green"),
  P("2417",[28,1,38],"dark green"),
  P("2417",[12,1,41],"dark green"),
  P("2417",[17,1,28],"green"),
  P("2423",[25,1,1],"green"),
  P("2423",[1,1,20],"dark green"),
  P("30137",[29,1,24],"log"),P("30137",[29,1,25],"log"),P("30137",[30,4,24],"log"),P("30136",[30,4,25],"log"),
  P("4032b",[16,0,9],"dark bluish grey"),P("4589",[16,1,9],"trans red"),P("4589",[17,1,10],"trans yellow"),P("3040b",[18,0,9],"log",270),
  ewok(17,0,12)
]);

section("Crashed probe",[
  cylinder({at:[3,0,2],diameter:12,height:3,colour:"stone"}),
  carve({at:[5,1,4],size:[8,2,8]}),
  box({at:[7,1,6],size:[4,6,4],colour:"light bluish grey",interior:"solid"}),
  P("3037",[7,7,6],"blue",0),P("3037",[7,7,8],"blue",180),
  P("3960",[5,1,10],"blue"),
  P("2412b",[11,1,5],"dark bluish grey"),P("2412b",[11,1,7],"dark bluish grey"),
  P("3957a",[11,1,9],"light bluish grey"),
  ewok(5,1,6)
]);

section("Trees",[
  cylinder({at:[5,0,26],diameter:10,height:66,colour:"bark",texture:"log"}),
  dome({at:[3,66,24],diameter:14,colour:"leaf"}),
  cylinder({at:[40,0,30],diameter:8,height:54,colour:"bark",texture:"log"}),
  dome({at:[40,54,30],diameter:8,colour:"leaf"}),
  cylinder({at:[20,0,38],diameter:6,height:60,colour:"bark",texture:"log"}),
  dome({at:[19,60,37],diameter:8,colour:"leaf"}),
  roots([[9,24,0],[9,36,180],[3,30,90],[15,30,270],[43,28,0],[43,38,180],[38,33,90],[22,36,0],[22,44,180],[18,40,90],[26,40,270]])
]);

section("Great tree village",[
  plat(0,23,18,22,22),
  [[0,18],[21,18],[0,39],[21,39]].map(([x,z])=>[box({at:[x,0,z],size:[1,2,1],colour:"stone",interior:"solid"}),column({at:[x,2,z],height:21,colour:"log"})]),
  rim([0,18],[11,18],24,6), rim([15,18],[21,18],24,6),
  rim([0,19],[0,39],24,6), rim([1,39],[21,39],24,6),
  rim([21,19],[21,25],24,6), rim([21,38],[21,38],24,6),
  hut(1,24,19,6,6,3,"blue","front","left","dish"),
  hut(16,24,30,6,8,3,"light bluish grey","front","right","dish"),
  ewok(8,24,20),
  P("3941",[11,24,20],"tan"),P("14769",[11,27,20],"tan"),
  lantern(0,30,26), lantern(21,30,22), lantern(7,24,18),
  plat(3,45,24,14,14),
  rim([5,24],[16,24],46), rim([3,26],[3,37],46), rim([4,37],[16,37],46), rim([16,25],[16,36],46),
  box({at:[3,46,24],size:[2,3,2],colour:"light bluish grey",interior:"solid"}),
  P("44375b",[0,49,21],"light bluish grey"),
  ewok(14,46,25), P("64644",[12,46,25],"dark bluish grey"),
  P("2549",[22,15,26],"dark tan",90)
]);

section("Hut tree",[
  plat(38,23,26,10,19),
  [[47,26],[47,44],[38,44]].map(([x,z])=>[box({at:[x,0,z],size:[1,2,1],colour:"stone",interior:"solid"}),column({at:[x,2,z],height:21,colour:"log"})]),
  rim([42,26],[47,26],24,6), rim([47,27],[47,44],24,6), rim([38,30],[38,44],24,6), rim([39,44],[46,44],24,6),
  hut(40,24,39,6,6,4,"blue","left","back","ant"),
  lantern(47,30,30), lantern(38,30,36),
  stairs({at:[39,16,22],width:3,steps:4,dir:"+z",rise:2,colour:"log"}),
  plat(38,36,28,10,10),
  rim([38,29],[38,37],37),
  box({at:[42,37,28],size:[2,3,2],colour:"light bluish grey",interior:"solid"}),
  P("4740",[42,40,28],"light bluish grey"),
  lantern(46,37,28)
]);

section("High hut",[
  plat(16,48,33,17,13),
  [[31,33],[31,44],[17,44]].map(([x,z])=>column({at:[x,0,z],height:48,diameter:2,colour:"log"})),
  rim([16,33],[32,33],49,6), rim([16,34],[16,45],49,6), rim([32,34],[32,45],49,6), rim([17,45],[31,45],49,6),
  hut(27,49,36,6,6,4,"blue","left","front","big"),
  ewok(18,49,35), lantern(25,49,34)
]);

section("Launch deck",[
  floor({at:[27,15,8],size:[16,14],colour:"planks",top:"tile"}),
  [[27,8],[41,8],[27,20],[41,20],[34,14]].map(([x,z])=>column({at:[x,0,z],height:15,diameter:2,colour:"log"})),
  floor({at:[32,15,3],size:[6,5],colour:"log",top:"tile"}),
  column({at:[32,0,3],height:15,colour:"log"}), column({at:[37,0,3],height:15,colour:"log"}),
  range(32,38).map(x=>P("3040b",[x,16,3],"log",180)),
  P("63864",[32,16,5],"light bluish grey",90), P("63864",[37,16,5],"light bluish grey",90),
  rim([42,8],[42,21],16), rim([27,10],[27,21],16), rim([28,21],[31,21],16),
  P("87079p50",[28,16,19],"blue"),
  lantern(42,19,8),
  P("2489",[40,16,18],"log"), P("2489",[38,16,19],"log"),
  ewok(29,16,9), P("2335",[31,16,9],"red"),
  P("73200b-f1",[39,16,9],"white"), P("973p90",[39,22,9],"white"), P("3626c",[39,28,9],"yellow")
]);

section("Ewok Galaxy Explorer",[
  box({at:[33,16,8],size:[4,3,12],colour:"light bluish grey",interior:"solid"}),
  P("15068",[33,19,8],"blue"), P("15068",[35,19,8],"blue"),
  box({at:[33,19,10],size:[4,6,10],colour:"log",texture:"log",interior:"solid"}),
  P("2437",[33,25,10],"trans yellow"),
  P("87079p50",[33,25,13],"blue"),
  P("87079",[33,25,15],"light bluish grey"),
  P("3020",[33,25,17],"blue"), P("60481a",[34,26,17],"blue"), P("60481a",[35,26,17],"blue"),
  P("2431",[33,25,19],"light bluish grey"),
  floor({at:[27,19,12],size:[6,7],colour:"blue"}),
  floor({at:[37,19,12],size:[6,7],colour:"blue"}),
  floor({at:[29,20,13],size:[4,5],colour:"hide",top:"tile"}),
  floor({at:[37,20,13],size:[4,5],colour:"hide",top:"tile"}),
  P("3941",[27,20,12],"light bluish grey"), P("4589",[27,23,12],"trans yellow"),
  P("3941",[41,20,12],"light bluish grey"), P("4589",[42,23,13],"trans yellow"),
  P("3957a",[27,20,17],"light bluish grey"), P("3957a",[42,20,17],"light bluish grey"),
  [33,35].map(x=>[P("3941",[x,16,20],"light bluish grey"),P("3941",[x,19,20],"light bluish grey"),P("4032b",[x,22,20],"dark bluish grey")])
]);
