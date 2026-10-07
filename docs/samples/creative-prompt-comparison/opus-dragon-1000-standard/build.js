const G = 6;
script({
  title: "Red Dragon Guarding its Hoard",
  description: "A dark red dragon with raised wings perched on a rocky outcrop above its gold hoard.",
  palette: {
    body: "dark red",
    belly: "tan",
    wing: "red",
    horn: "tan",
    spike: "black",
    stone: { mix: ["light bluish grey", "light bluish grey", "light bluish grey", "dark bluish grey"] }
  }
});

const B = (x0, x1, y, h, z0, z1, colour, extra) =>
  box(Object.assign({ at: [x0, y, z0], size: [x1 - x0 + 1, h, z1 - z0 + 1], colour, interior: "solid" }, extra || {}));
const S = { texture: "masonry" };
const P = (part, at, colour, turn) => place({ part, at, colour, turn: turn || 0 });

section("Site", [
  baseplate({ at: [0, 0], size: [48, 48], colour: "green" }),
  B(8, 39, 0, 3, 10, 43, "stone"),
  // upper ledge: plain core, masonry rim
  B(13, 34, 3, 3, 15, 36, "stone"),
  B(12, 35, 3, 3, 14, 14, "stone", S),
  B(12, 35, 3, 3, 37, 37, "stone", S),
  B(12, 12, 3, 3, 15, 36, "stone", S),
  B(35, 35, 3, 3, 15, 36, "stone", S),
  B(5, 8, 0, 6, 16, 21, "stone", S),
  B(39, 42, 0, 6, 22, 26, "stone", S),
  B(10, 13, 3, 6, 34, 39, "stone", S),
  P("3470", [3, 0, 3], "green"),
  P("3471", [42, 0, 41], "green"),
  P("2435", [2, 0, 30], "dark green"),
  P("2435", [3, 0, 40], "dark green"),
  P("6255", [44, 0, 30], "green"),
  scatter({ region: { at: [1, 9], size: [4, 18] }, parts: ["24866"], colours: ["red", "yellow", "white", "blue"], density: 0.3, spacing: 1 })
]);

section("Hoard", [
  floor({ at: [30, 0, 1], size: [15, 8], colour: "yellow", layers: 2 }),
  floor({ at: [33, 2, 2], size: [9, 6], colour: "yellow", layers: 1 }),
  scatter({ region: { at: [30, 1], size: [15, 8] }, parts: ["98138", "6141"], colours: ["pearl gold", "pearl gold", "pearl gold", "trans red", "trans light blue"], density: 0.6 }),
  P("4738a", [42, 0, 12], "reddish brown"),
  P("4739a", [42, 4, 12], "reddish brown")
]);

const F = [19, 18, 17, 16, 16, 16, 17, 17];
const K = [28, 29, 30, 30, 29, 27, 24, 20];
const side = [
  // front leg
  B(27, 29, G + 6, 9, 18, 21, "body"),
  B(28, 29, G + 3, 3, 17, 19, "body"),
  B(28, 30, G, 3, 15, 19, "body"),
  [28, 29, 30].map(x => P("49668", [x, G, 13], "horn")),
  // hind leg
  B(27, 30, G + 6, 9, 25, 31, "body", S),
  B(29, 30, G + 3, 3, 26, 29, "body"),
  B(29, 31, G, 3, 23, 29, "body"),
  [29, 30, 31].map(x => P("49668", [x, G, 21], "horn")),
  // wing: stepped slabs rising outward
  range(8).map(k => [
    B(28 + k, 29 + k, G + 15 + 3 * k, 3, F[k], F[k], "body"),
    B(28 + k, 29 + k, G + 15 + 3 * k, 3, F[k] + 1, K[k], "wing")
  ]),
  P("49668", [36, G + 39, 16], "horn")
];

section("Dragon", [
  // body
  B(21, 26, G + 6, 3, 18, 31, "belly", S),
  B(20, 27, G + 9, 3, 17, 32, "body", S),
  B(19, 28, G + 12, 3, 17, 32, "body", S),
  B(20, 27, G + 15, 3, 18, 31, "body", S),
  B(21, 26, G + 18, 3, 19, 30, "body", S),
  B(22, 25, G + 21, 3, 21, 28, "body", S),
  B(22, 25, G + 9, 3, 16, 16, "belly"),
  // neck
  B(21, 26, G + 12, 9, 13, 17, "body", S),
  B(22, 25, G + 18, 6, 11, 14, "body", S),
  B(22, 25, G + 21, 6, 9, 12, "body", S),
  B(22, 25, G + 24, 6, 8, 11, "body", S),
  B(23, 24, G + 12, 6, 12, 12, "belly"),
  B(23, 24, G + 18, 3, 10, 10, "belly"),
  B(23, 24, G + 21, 3, 8, 8, "belly"),
  B(23, 24, G + 24, 3, 7, 7, "belly"),
  // head
  B(22, 25, G + 27, 2, 2, 7, "body"),
  B(22, 25, G + 29, 1, 6, 7, "body"),
  B(21, 26, G + 30, 6, 6, 11, "body", S),
  B(22, 25, G + 30, 4, 2, 5, "body"),
  [22, 25].map(x => P("6141", [x, G + 34, 2], "black")),
  [23, 24].map(x => P("54200", [x, G + 34, 2], "body")),
  [21, 26].map(x => [
    P("4070", [x, G + 33, 6], "yellow"),
    P("54200", [x, G + 36, 6], "spike"),
    P("3040b", [x, G + 36, 9], "horn", 180),
    P("49668", [x, G + 39, 9], "horn", 180)
  ]),
  [[22, 2], [25, 2], [22, 4], [25, 4]].map(([x, z]) => P("3024", [x, G + 29, z], "white")),
  P("3023b", [23, G + 29, 3], "red"),
  // spines
  [[G + 36, 10], [G + 24, 13], [G + 21, 15], [G + 21, 19], [G + 24, 21], [G + 24, 23], [G + 24, 25], [G + 24, 27], [G + 21, 29], [20, 33], [20, 35], [15, 37], [15, 39]]
    .map(([y, z]) => P("3039", [23, y, z], "spike", 180)),
  P("3039", [24, 10, 41], "spike", 180),
  // tail
  B(21, 26, 13, 7, 33, 36, "body", S),
  B(22, 25, 9, 6, 36, 40, "body", S),
  B(23, 26, 3, 7, 40, 43, "body", S),
  B(26, 32, 3, 3, 41, 43, "body"),
  B(32, 37, 3, 2, 41, 42, "body"),
  [28, 31].map(x => P("3040b", [x, 6, 42], "spike", 270)),
  [41, 42].map(z => P("3040b", [38, 3, z], "body", 270)),
  // legs and wings, both sides
  mirror({ axis: "x", about: 24, ops: side })
]);
