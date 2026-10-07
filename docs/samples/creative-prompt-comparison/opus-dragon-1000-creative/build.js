script({
  title: "Ember Peak: The Hoard Awakens",
  description: "A dark red dragon rears on its crag above a glittering hoard cave, wings raised, torching the treasure hunters' lookout tower while their abandoned gold cart waits on the path.",
  palette: {
    scale: "dark red", wing: "red", bone: "black", belly: "tan", wood: "reddish brown",
    rock: { mix: ["light bluish grey", "light bluish grey", "dark bluish grey"] },
    fire: { mix: ["trans orange", "trans orange", "trans yellow", "trans red"] },
    ash: { mix: ["dark bluish grey", "dark bluish grey", "black", "dark tan"] },
    thatch: { mix: ["tan", "dark tan", "dark tan", "black"] }
  }
});

section("Site", [
  baseplate({ at: [0, 0], size: [64, 48], colour: "green" }),
  floor({ at: [24, 0, 0], size: [6, 10], colour: "dark tan" }),
  floor({ at: [27, 0, 8], size: [8, 10], colour: "dark tan" }),
  floor({ at: [30, 0, 16], size: [12, 4], colour: "dark tan" }),
  floor({ at: [0, 0, 15], size: [16, 15], colour: "ash" }),
  scatter({ region: { at: [0, 0], size: [22, 13] }, parts: ["24866"], colours: ["yellow", "white", "red"], density: 0.12, spacing: 2 }),
  place({ part: "3470", at: [2, 0, 40], colour: "green" }),
  place({ part: "2435", at: [9, 0, 42], colour: "dark green" }),
  place({ part: "3471", at: [58, 0, 38], colour: "green" }),
  place({ part: "2435", at: [54, 0, 43], colour: "dark green" }),
  place({ part: "2435", at: [59, 0, 12], colour: "green" }),
  place({ part: "6255", at: [17, 0, 44], colour: "green" }),
  place({ part: "6255", at: [60, 0, 4], colour: "green" }),
  place({ part: "6255", at: [14, 0, 34], colour: "green" })
]);

const grey = (i) => (i % 2 ? "dark bluish grey" : "light bluish grey");
section("Crag", [
  box({ at: [24, 0, 20], size: [28, 12, 22], colour: "rock", texture: "masonry", supports: 8 }),
  box({ at: [19, 0, 23], size: [6, 8, 14], colour: "rock", texture: "masonry" }),
  box({ at: [50, 0, 23], size: [7, 9, 11], colour: "rock", texture: "masonry" }),
  box({ at: [42, 0, 15], size: [9, 5, 6], colour: "rock" }),
  box({ at: [24, 12, 37], size: [10, 5, 5], colour: "rock" }),
  box({ at: [20, 0, 37], size: [6, 5, 6], colour: "rock" }),
  carve({ at: [31, 0, 20], size: [10, 10, 7] }),
  wall({ from: [31, 27], to: [40, 27], height: 10, colour: "dark bluish grey" }),
  wall({ from: [30, 20], to: [30, 27], height: 10, colour: "dark bluish grey" }),
  wall({ from: [41, 20], to: [41, 27], height: 10, colour: "dark bluish grey" }),
  place({ part: "3665a", at: [31, 7, 20], colour: "dark bluish grey" }),
  place({ part: "3665a", at: [40, 7, 20], colour: "dark bluish grey" }),
  place({ part: "3660b", at: [35, 7, 20], colour: "dark bluish grey" }),
  ...[24, 26, 49].map((x, i) => place({ part: "3039", at: [x, 12, 20], colour: grey(i) })),
  ...[44, 45, 47].map((x, i) => place({ part: "3040b", at: [x, 12, 20], colour: grey(i + 1) })),
  ...[40, 44, 48].map((x, i) => place({ part: "3039", at: [x, 12, 40], colour: grey(i), turn: 180 })),
  place({ part: "3039", at: [19, 8, 23], colour: "dark bluish grey" }),
  place({ part: "3040b", at: [43, 5, 15], colour: "light bluish grey" }),
  place({ part: "3040b", at: [45, 5, 15], colour: "dark bluish grey" }),
  place({ part: "54200", at: [48, 5, 16], colour: "light bluish grey" })
]);

// Hoard heaped inside the cave, coins spilling onto the path.
const hoardTop = (x, z) => {
  let t = 2;
  if (x >= 32 && x <= 39 && z >= 22) t = 4;
  if (x >= 33 && x <= 38 && z >= 23) t = 6;
  if (x >= 35 && x <= 37 && z >= 24) t = 7;
  return t;
};
const coin = (x, y, z, p) => {
  const v = rng();
  if (v > p) return null;
  const c = v < p * 0.08 ? "trans red" : v < p * 0.15 ? "trans light blue" : "pearl gold";
  return place({ part: v < p * 0.5 ? "98138" : "6141", at: [x, y, z], colour: c });
};
const coins = [];
for (let x = 31; x <= 40; x++) for (let z = 21; z <= 26; z++) coins.push(coin(x, hoardTop(x, z), z, 0.5));
for (let x = 31; x <= 40; x++) coins.push(coin(x, 0, 20, 0.35));
for (let x = 30; x <= 41; x++) for (let z = 16; z <= 19; z++) coins.push(coin(x, 1, z, 0.16));
for (let x = 27; x <= 34; x++) for (let z = 14; z <= 15; z++) coins.push(coin(x, 1, z, 0.1));
section("Hoard", [
  box({ at: [31, 0, 21], size: [10, 2, 6], colour: "yellow", interior: "solid" }),
  box({ at: [32, 2, 22], size: [8, 2, 5], colour: "yellow", interior: "solid" }),
  box({ at: [33, 4, 23], size: [6, 2, 4], colour: "yellow", interior: "solid" }),
  box({ at: [35, 6, 24], size: [3, 1, 3], colour: "yellow", interior: "solid" }),
  ...coins
]);

// Treasure hunters' cart, abandoned mid-escape; it rolls on top of the dirt path.
const cartGold = [];
for (let x = 27; x <= 33; x++) for (let z = 9; z <= 12; z++) if (rng() < 0.55) cartGold.push(place({ part: "98138", at: [x, 10, z], colour: "pearl gold" }));
section("Cart", [
  place({ part: "4600", at: [28, 3, 10], colour: "black", turn: 90, wheels: "reddish brown" }),
  place({ part: "4600", at: [32, 3, 10], colour: "black", turn: 90, wheels: "reddish brown" }),
  box({ at: [28, 4, 10], size: [2, 3, 2], colour: "wood", interior: "solid" }),
  box({ at: [32, 4, 10], size: [2, 3, 2], colour: "wood", interior: "solid" }),
  floor({ at: [26, 7, 8], size: [9, 6], colour: "wood" }),
  box({ at: [26, 8, 8], size: [9, 3, 6], colour: "wood", open: ["top"] }),
  box({ at: [27, 8, 9], size: [7, 2, 4], colour: "yellow", interior: "solid" }),
  place({ part: "3666", at: [21, 6, 9], colour: "wood" }),
  ...cartGold
]);

// Lookout tower, roof burning through where the fire hits.
const posts = [[3, 18], [8, 18], [3, 23], [8, 23]];
section("Tower", [
  box({ at: [2, 1, 17], size: [8, 6, 8], colour: "rock", texture: "masonry" }),
  ...posts.map(([x, z]) => column({ at: [x, 7, z], height: "3b", colour: "wood" })),
  floor({ at: [2, 16, 17], size: [8, 8], colour: "wood" }),
  ...posts.map(([x, z]) => column({ at: [x, 17, z], height: "3b", colour: "wood" })),
  fence({ path: [[2, 17], [9, 17]], y: 17, colour: "wood" }),
  fence({ path: [[2, 18], [2, 24]], y: 17, colour: "wood" }),
  roof({ style: "hip", at: [3, 26, 18], size: [6, 6], colour: "thatch", holes: [{ at: [5, 20], size: [5, 5] }] }),
  place({ part: "3062b", at: [4, 17, 20], colour: "trans yellow" }),
  place({ part: "4589", at: [4, 20, 20], colour: "trans orange" }),
  place({ part: "3062b", at: [6, 17, 21], colour: "trans red" }),
  place({ part: "4589", at: [6, 20, 21], colour: "trans yellow" }),
  place({ part: "4589", at: [7, 17, 19], colour: "trans red" }),
  place({ part: "2489", at: [11, 1, 18], colour: "wood" }),
  place({ part: "2489", at: [12, 1, 21], colour: "wood" }),
  place({ part: "4345b", at: [10, 1, 24], colour: "tan" })
]);

// Bat wing: bones radiate from the wrist; the membrane scallops between finger tips.
const WR = [4, 9];
const tips = [[0, 0], [6, 1], [10, 1], [14, 3], [16, 7]];
const rast = (a, b) => {
  const du = b[0] - a[0], dr = b[1] - a[1], n = Math.max(Math.abs(du), Math.abs(dr));
  return range(n + 1).map((i) => [Math.round(a[0] + (du * i) / n), Math.round(a[1] + (dr * i) / n)]);
};
const bone = {};
tips.forEach((t) => rast(WR, t).forEach(([u, r]) => { bone[u + "," + r] = true; }));
const wingCols = range(17).map((u) => {
  let top = -1, bmin = 99;
  for (let r = 0; r < 10; r++) if (bone[u + "," + r]) { top = Math.max(top, r); bmin = Math.min(bmin, r); }
  let k = 0;
  while (k < tips.length - 2 && u > tips[k + 1][0]) k++;
  const a = tips[k], b = tips[k + 1], t = (u - a[0]) / (b[0] - a[0]);
  const sc = Math.round(a[1] + (b[1] - a[1]) * t + (k === 0 ? 1 : 3) * Math.sin(Math.PI * t));
  return [Math.min(sc, bmin), top];
});
const wing = (x0, y0, z0, dz) => {
  const zb = (r) => (dz < 0 ? z0 - Math.floor(r / 2) : z0 + Math.floor(r / 2));
  const ops = [];
  wingCols.forEach(([lo, hi], u) => {
    for (let r = lo; r <= hi; r++) ops.push(box({ at: [x0 + u, y0 + 3 * r, zb(r)], size: [1, 3, 2], colour: bone[u + "," + r] ? "bone" : "wing", interior: "solid" }));
  });
  ops.push(place({ part: "4589", at: [x0 + 4, y0 + 30, zb(9)], colour: "black" }));
  return ops;
};

section("Dragon body", [
  box({ at: [31, 18, 27], size: [12, 9, 8], colour: "scale" }),
  box({ at: [29, 19, 28], size: [2, 8, 6], colour: "scale" }),
  box({ at: [32, 17, 29], size: [9, 1, 4], colour: "belly", interior: "solid" }),
  box({ at: [31, 24, 25], size: [5, 3, 12], colour: "scale", interior: "solid" }),
  box({ at: [31, 27, 29], size: [12, 3, 4], colour: "scale", interior: "solid" }),
  box({ at: [33, 27, 35], size: [3, 3, 2], colour: "scale", interior: "solid" }),
  ...range(31, 43).map((x) => place({ part: "3040b", at: [x, 27, 27], colour: "scale" })),
  ...range(31, 43).map((x) => place({ part: "3040b", at: [x, 27, 33], colour: "scale", turn: 180 })),
  ...[33, 35, 37, 39, 41].map((x, i) => place({ part: "4589", at: [x, 30, 30 + (i % 2)], colour: "bone" })),
  // legs: front pair planted, rear haunches bunched to spring
  box({ at: [30, 12, 27], size: [2, 8, 2], colour: "scale", interior: "solid" }),
  box({ at: [30, 12, 33], size: [2, 8, 2], colour: "scale", interior: "solid" }),
  box({ at: [28, 12, 26], size: [3, 1, 3], colour: "scale", interior: "solid" }),
  box({ at: [28, 12, 32], size: [3, 1, 3], colour: "scale", interior: "solid" }),
  ...[26, 27, 28, 32, 33, 34].map((z) => place({ part: "54200", at: [28, 13, z], colour: "bone", turn: 90 })),
  box({ at: [38, 15, 25], size: [5, 10, 3], colour: "scale" }),
  box({ at: [38, 15, 34], size: [5, 10, 3], colour: "scale" }),
  box({ at: [36, 12, 24], size: [6, 3, 3], colour: "scale", interior: "solid" }),
  box({ at: [36, 12, 35], size: [6, 3, 3], colour: "scale", interior: "solid" }),
  ...[24, 25, 26, 35, 36, 37].map((z) => place({ part: "54200", at: [36, 15, z], colour: "bone", turn: 90 })),
  // tail sweeping off the crag and curling round to the front
  box({ at: [42, 19, 28], size: [4, 6, 6], colour: "scale" }),
  box({ at: [45, 17, 29], size: [4, 5, 4], colour: "scale" }),
  box({ at: [48, 14, 29], size: [4, 4, 4], colour: "scale", interior: "solid" }),
  box({ at: [51, 12, 28], size: [3, 4, 4], colour: "scale", interior: "solid" }),
  box({ at: [52, 9, 22], size: [3, 3, 9], colour: "scale", interior: "solid" }),
  box({ at: [53, 3, 19], size: [3, 7, 4], colour: "scale", interior: "solid" }),
  box({ at: [51, 0, 14], size: [5, 4, 6], colour: "scale", interior: "solid" }),
  box({ at: [47, 0, 12], size: [5, 2, 3], colour: "scale", interior: "solid" }),
  place({ part: "3043", at: [45, 0, 12], colour: "bone", turn: 90 }),
  place({ part: "54200", at: [45, 0, 14], colour: "bone", turn: 90 }),
  ...[[43, 25, 30], [44, 25, 31], [46, 22, 30], [49, 18, 31], [50, 18, 30], [52, 16, 29], [53, 12, 25], [53, 12, 23], [53, 4, 15], [49, 2, 13]].map((p) => place({ part: "4589", at: p, colour: "bone" }))
]);

section("Dragon neck and head", [
  box({ at: [28, 23, 28], size: [4, 7, 5], colour: "scale" }),
  box({ at: [26, 28, 27], size: [4, 6, 4], colour: "scale" }),
  box({ at: [24, 32, 25], size: [4, 6, 4], colour: "scale" }),
  box({ at: [22, 36, 24], size: [4, 6, 4], colour: "scale" }),
  box({ at: [19, 40, 23], size: [6, 6, 5], colour: "scale" }),
  box({ at: [14, 43, 24], size: [6, 3, 3], colour: "scale", interior: "solid" }),
  box({ at: [15, 38, 24], size: [6, 2, 3], colour: "scale", interior: "solid" }),
  box({ at: [19, 37, 24], size: [5, 3, 3], colour: "scale", interior: "solid" }),
  box({ at: [21, 46, 24], size: [4, 2, 3], colour: "scale", interior: "solid" }),
  ...[24, 25, 26].map((z) => place({ part: "3040b", at: [14, 46, z], colour: "scale", turn: 90 })),
  ...[23, 24, 25, 26, 27].map((z) => place({ part: "3040b", at: [19, 46, z], colour: "scale", turn: 90 })),
  place({ part: "98138", at: [16, 46, 24], colour: "black" }),
  place({ part: "98138", at: [16, 46, 26], colour: "black" }),
  place({ part: "3062b", at: [19, 43, 23], colour: "trans yellow" }),
  place({ part: "3062b", at: [19, 43, 27], colour: "trans yellow" }),
  ...[[15, 24], [17, 24], [15, 26], [17, 26]].map(([x, z]) => place({ part: "54200", at: [x, 40, z], colour: "white", turn: 90 })),
  ...[24, 26].map((z) => place({ part: "3062b", at: [23, 48, z], colour: "tan" })),
  ...[24, 26].map((z) => place({ part: "4589", at: [23, 51, z], colour: "tan" })),
  place({ part: "4589", at: [24, 46, 23], colour: "bone" }),
  place({ part: "4589", at: [24, 46, 27], colour: "bone" }),
  ...[[30, 30, 30], [28, 34, 28], [26, 34, 29], [26, 38, 26], [25, 42, 25]].map((p) => place({ part: "54200", at: p, colour: "bone", turn: 90 }))
]);

section("Wings", [
  ...wing(31, 27, 25, -1),
  ...wing(33, 30, 35, 1)
]);

section("Fire", [
  box({ at: [13, 40, 25], size: [4, 3, 1], colour: "fire", interior: "solid" }),
  box({ at: [11, 37, 24], size: [3, 3, 3], colour: "fire", interior: "solid" }),
  box({ at: [9, 34, 23], size: [3, 3, 4], colour: "fire", interior: "solid" }),
  box({ at: [7, 31, 22], size: [3, 3, 4], colour: "fire", interior: "solid" }),
  box({ at: [5, 26, 20], size: [4, 5, 5], colour: "fire", interior: "solid" })
]);
