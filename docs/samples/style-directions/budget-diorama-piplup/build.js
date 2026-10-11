script({title:"Piplup's First Bubble Beam",description:"A proud Piplup spreads its flippers on a crescent of sea ice. Three growing bubbles sweep from its beak across a swirling tide pool, where a little orange fish watches. A rounded navy cap, white cheeks, twin belly spots and golden webbed feet complete the penguin.",palette:{ice:"white",sky:"medium azure",cap:"dark blue",water:"dark blue",glass:"trans light blue"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const B=(at,size,colour,extra={})=>box({at,size,colour,interior:"solid",...extra});
section("Connected display and crescent ice",[
floor({at:[0,0,0],size:[24,22],layers:2,colour:"black",top:"tile"}),floor({at:[1,2,1],size:[22,20],colour:"water",top:"tile"}),
B([12,3,7],[11,2,14],"ice",{top:"tile"}),B([10,3,11],[2,2,10],"ice",{top:"tile"}),B([8,3,16],[2,2,5],"ice",{top:"tile"}),B([5,3,18],[3,2,3],"ice",{top:"tile"}),
...range(5).map(i=>P("15068",[12+2*i,3,5],"ice")),P("3045",[22,3,5],"ice"),...range(3).map(i=>P("15068",[8,3,10+2*i],"ice",90)),P("15068",[6,3,16],"ice",90),
B([1,3,17],[6,3,4],"medium azure",{top:"tile"}),P("3297",[2,6,16],"ice"),P("15068",[2,6,19],"ice",180),P("15068",[4,6,19],"ice",180),P("2431",[2,9,18],"ice"),P("2431",[2,9,19],"ice"),
P("3069b",[2,3,4],"glass"),P("3069b",[4,3,3],"glass"),P("3069b",[7,3,2],"glass"),P("3069b",[10,3,3],"glass",90),P("3069b",[2,3,11],"glass",90),P("2431",[4,3,13],"glass"),P("3069b",[9,3,4],"glass",90),
P("25269",[3,3,6],"ice",180),P("3069b",[4,3,5],"ice"),P("25269",[7,3,6],"ice",270),P("25269",[7,3,10],"ice"),P("3069b",[5,3,11],"ice"),P("25269",[3,3,10],"ice",90),P("64648",[9,3,7],"orange",90)
]);
function foot(x){return [P("2450",[x,5,8],"yellow"),P("15068",[x,6,7],"yellow"),P("3003",[x,6,9],"yellow"),P("3069b",[x+2,6,8],"yellow",90)];}
section("Webbed feet and tail",[foot(14),foot(18),floor({at:[15,5,15],size:[4,4],colour:"cap"}),P("3004",[16,6,15],"cap"),P("41769a",[15,6,16],"cap"),P("41770a",[17,6,16],"cap"),P("88930",[15,7,18],"cap",180),P("2431",[15,7,17],"cap")]);
function sideUnderside(x,y,z,turn,n){return range(n).map(i=>P("24201",[x,y,z+i],"sky",turn));}
function bellySpot(x){return [P("32803",[x,14,9],"ice"),P("15068",[x,18,9],"ice"),P("3069b",[x,21,10],"ice")];}
section("Rounded body and asymmetric flippers",[
B([15,9,11],[4,4,4],"sky"),...range(6).map(i=>P("24201",[14+i,9,9],"sky")),...range(6).map(i=>P("24201",[14+i,9,15],"cap",180)),sideUnderside(13,9,11,90,4),sideUnderside(19,9,11,270,4),
B([14,13,11],[6,11,4],"sky"),B([14,13,9],[6,9,2],"sky"),B([13,13,11],[1,8,4],"sky"),B([20,13,11],[1,8,4],"sky"),B([14,13,15],[6,11,1],"cap"),bellySpot(14),bellySpot(18),
...[11,13].map(z=>P("15068",[13,21,z],"sky",90)),...[11,13].map(z=>P("15068",[19,21,z],"sky",270)),floor({at:[14,22,9],size:[6,1],layers:2,colour:"cap",top:"tile"}),
P("88930",[13,24,10],"cap"),P("88930",[17,24,10],"cap"),P("88930",[13,24,14],"cap",180),P("88930",[17,24,14],"cap",180),B([14,24,12],[6,3,2],"cap"),
floor({at:[9,20,11],size:[5,2],colour:"sky"}),P("93606",[9,21,11],"sky",90),floor({at:[19,14,11],size:[5,2],colour:"sky"}),P("93606",[20,15,11],"sky",270)
]);
section("Sculpted Piplup head",[
B([13,27,10],[6,4,4],"sky"),...range(8).map(i=>P("24201",[12+i,27,8],i<3||i>4?"ice":"sky")),...range(8).map(i=>P("24201",[12+i,27,14],"sky",180)),sideUnderside(11,27,10,90,4),sideUnderside(19,27,10,270,4),
B([11,31,9],[10,6,6],"sky"),B([12,31,15],[8,6,1],"cap"),B([12,31,8],[3,6,1],"ice"),B([17,31,8],[3,6,1],"ice"),B([15,31,8],[2,6,1],"sky"),P("3003pe2",[13,34,8],"ice"),P("3003pe2",[17,34,8],"ice"),
P("15068",[12,37,8],"ice"),P("11477",[14,37,8],"ice"),P("15068",[15,37,8],"cap"),P("11477",[17,37,8],"ice"),P("15068",[18,37,8],"ice"),
B([12,37,10],[8,3,4],"cap"),...[10,12].map(z=>P("15068",[11,37,z],"cap",90)),...[10,12].map(z=>P("15068",[19,37,z],"cap",270)),...range(4).map(i=>P("15068",[12+i*2,37,14],"cap",180)),P("2431",[12,40,10],"cap",90),P("2431",[19,40,10],"cap",90),P("4162",[12,40,9],"cap"),P("61484",[13,40,10],"cap"),
P("3020",[15,31,6],"black",90),P("3020",[15,32,6],"yellow",90),P("15068",[15,33,6],"yellow"),P("3003",[15,33,8],"yellow"),P("3069b",[15,36,8],"cap")
]);
section("Bubble Beam and pool interaction",[
P("3795",[10,30,6],"glass"),P("4740",[10,31,6],"glass"),P("30151a",[10,32,6],"glass"),column({at:[7,3,4],height:17,diameter:1,colour:"trans-clear"}),P("4740",[7,20,4],"glass"),P("30367c",[7,21,4],"glass"),column({at:[4,3,8],height:5,diameter:1,colour:"trans-clear"}),P("4032b",[4,8,8],"trans-clear"),P("3960",[3,9,7],"glass"),P("86500",[3,11,7],"glass")
]);