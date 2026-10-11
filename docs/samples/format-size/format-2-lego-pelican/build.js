script({title:"Pouch Express — a pelican pedalling",description:"A big golden pouch leads a white pelican on a cherry-red bicycle. Swept wings grip the handlebars, webbed feet pedal at different heights, and a turquoise scarf streams behind. Real wheel assemblies and a small transparent support make a compact character sculpture.",palette:{bird:"white",bill:"yellow",bike:"red",metal:"light bluish grey",scarf:"dark turquoise"}});
const P=(part,at,colour,turn=0)=>place({part,at,colour,turn});
const beam=(a,b,c)=>line({from:a,to:b,colour:c});
const frontHub=5,rearHub=23,crank=14;
section("Quiet display support",[floor({at:[12,0,2],size:[4,6],layers:2,colour:"dark bluish grey",top:"tile"}),box({at:[13,2,4],size:[2,18,2],colour:"trans-clear",interior:"solid"})]);
section("Rolling bicycle",[
...[0,18].map(x=>P("2903c01",[x,0,4],"light bluish grey")),
...[2,7].map(z=>[
beam([frontHub,12,z],[8,33,z],"metal"),beam([8,33,z],[19,36,z],"bike"),beam([8,33,z],[crank,20,z],"bike"),beam([crank,20,z],[19,36,z],"bike"),beam([19,36,z],[rearHub,12,z],"bike"),beam([rearHub,12,z],[crank,20,z],"bike"),
...range(3).map(i=>P("4460b",[5+i,12+9*i,z],"metal",90)),...range(3).map(i=>P("4460b",[22-i,12+9*i,z],"bike",270))]),
beam([5,12,2],[5,12,7],"metal"),beam([23,12,2],[23,12,7],"metal"),beam([14,20,2],[14,20,7],"bike"),
box({at:[7,32,3],size:[2,9,4],colour:"bike",interior:"solid"}),
box({at:[18,35,4],size:[2,5,2],colour:"metal",interior:"solid"}),
floor({at:[17,40,3],size:[6,4],layers:1,colour:"black"}),
P("15068",[17,41,3],"black",90),P("15068",[17,41,5],"black",90),P("15068",[21,41,3],"black",270),P("15068",[21,41,5],"black",270),
floor({at:[7,41,-1],size:[2,12],layers:1,colour:"metal"}),
...[-1,9].map(z=>P("15068",[7,42,z],"black",90)),
beam([14,20,1],[23,12,1],"black"),beam([14,18,1],[23,12,1],"black"),
floor({at:[12,22,0],size:[4,2],layers:1,colour:"black"}),floor({at:[17,30,8],size:[4,2],layers:1,colour:"black"}),
beam([14,20,2],[14,22,1],"metal"),beam([14,20,7],[18,30,8],"metal"),
P("6141",[8,42,3],"pearl gold"),P("98138",[8,43,3],"pearl gold")
]);
function foot(x,y,z){return [P("43723a",[x,y,z],"bill",90),P("11477",[x,y+1,z],"bill",90),P("11477",[x,y+1,z+1],"bill",90)];}
section("Webbed feet in mid pedal",[
foot(12,23,0),foot(17,31,8),
beam([14,26,1],[12,33,1],"bill"),beam([12,33,1],[18,46,1],"bill"),
beam([19,34,8],[22,38,8],"bill"),beam([22,38,8],[20,46,8],"bill"),
P("11477",[12,33,0],"bill",90),P("11477",[21,38,8],"bill",270)
]);
section("Round white body and flowing neck",[
P("54091",[15,44,1],"bird"),floor({at:[15,50,1],size:[8,8],layers:2,colour:"bird",top:"tile"}),P("54095",[15,52,1],"bird"),
box({at:[12,50,3],size:[5,3,4],colour:"bird",interior:"solid",top:"tile"}),
box({at:[12,53,4],size:[3,16,2],colour:"bird",interior:"solid"}),
...[3,6].map(z=>[P("4460b",[12,53,z],"bird",90),P("6091",[12,62,z],"bird",90),P("11477",[12,66,z],"bird",90)]),
P("93606",[10,53,3],"bird",90),P("93606",[10,53,5],"bird",90),
P("41748",[22,50,3],"bird",270),P("41747",[22,50,5],"bird",270),
P("61678",[23,53,4],"black",270),P("61678",[23,53,5],"black",270)
]);
function wing(z){return [beam([8,44,z],[17,51,z],"bird"),P("61678",[9,45,z],"bird",90),P("61678",[9,45,z+1],"bird",90),P("41747",[12,48,z],"bird",90),P("44126",[12,51,z],"bird",90),P("93606",[18,54,z],"bird",270),P("11477",[8,44,z],"black",90),P("11477",[8,44,z+1],"black",90)];}
section("Wings steering the bicycle",[wing(-1),wing(9)]);
section("Alert face and unmistakable pelican pouch",[
...range(3,7).map(z=>P("13547",[8,66,z],"bird",90)),
box({at:[9,69,3],size:[4,3,4],colour:"bird",interior:"solid"}),
P("93606",[8,72,3],"bird",90),P("93606",[8,72,5],"bird",90),
...range(3,7).map(z=>P("11477",[12,72,z],"bird",270)),
...[2,7].map(z=>[P("3005",[10,69,z],"white"),P("3062b",[10,72,z],"black"),P("11477",[10,75,z],"white",90)]),
...range(3,7).map(z=>[P("42023",[0,63,z],"bill",90),P("13547",[6,63,z],"bill",270)]),
box({at:[1,66,3],size:[7,3,4],colour:"bill",interior:"solid",top:"tile"}),
...range(3,7).map(z=>P("61678",[4,69,z],"bill",90)),
...[4,5].map(z=>[P("42022",[-2,69,z],"bill",90),P("11477",[-4,69,z],"orange",90)]),
P("3070b",[5,72,3],"dark tan"),P("3070b",[5,72,6],"dark tan")
]);
section("Sea breeze scarf",[
floor({at:[11,58,3],size:[5,4],layers:2,colour:"scarf",holes:[{at:[12,4],size:[3,2]}],top:"tile"}),
floor({at:[15,59,2],size:[6,2],layers:1,colour:"scarf",top:"tile"}),P("44126",[15,60,2],"scarf",270)
]);