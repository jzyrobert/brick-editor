const G = 1, ZW = 15;
script({
  title: "Pelican Riding a Bicycle",
  description: "A white pelican pedals a sky-blue bicycle over a pelican crossing, wingtips on the handlebars, a basket on the front and its orange pouch thrust out over the front wheel.",
  palette: { frame: "medium azure", tyre: "black", spoke: "light bluish grey", hub: "dark bluish grey", plume: "white", quill: "black", bill: "yellow", pouch: "orange", leg: "orange", road: "dark bluish grey", wicker: "reddish brown" },
});

// Wheels stand in the x-y plane: radius in studs, rows in plates (2.5 plates per stud).
const R = 7, RI = 5.6;
const ring = (cx, j0, r0, r1, colour) => {
  const ops = [];
  for (let j = j0; j < 2 * Math.ceil(r1 * 2.5); j++) {
    const dy = (j + 0.5 - 17.5) / 2.5;
    const xo = Math.round(Math.sqrt(Math.max(0, r1 * r1 - dy * dy)));
    if (xo < 1) continue;
    let xi = Math.abs(dy) < r0 ? Math.round(Math.sqrt(r0 * r0 - dy * dy)) : 0;
    if (xi >= xo) xi = xo - 1;
    const y = G + j;
    if (xi === 0) ops.push(floor({ at: [cx - xo, y, ZW], size: [2 * xo, 2], colour }));
    else ops.push(
      floor({ at: [cx - xo, y, ZW], size: [xo - xi, 2], colour }),
      floor({ at: [cx + xi, y, ZW], size: [xo - xi, 2], colour }));
  }
  return ops;
};
function wheel(cx) {
  return [
    ring(cx, 0, RI, R, "tyre"),
    box({ at: [cx - 1, G + 4, ZW], size: [2, 27, 1], colour: "spoke", interior: "solid" }),
    box({ at: [cx - 6, G + 16, ZW], size: [12, 3, 1], colour: "spoke", interior: "solid" }),
    line({ from: [cx - 4, G + 8, ZW], to: [cx + 3, G + 26, ZW], colour: "spoke" }),
    line({ from: [cx + 3, G + 8, ZW], to: [cx - 4, G + 26, ZW], colour: "spoke" }),
    box({ at: [cx - 1, G + 15, ZW - 1], size: [2, 5, 4], colour: "hub", interior: "solid" }),
  ];
}
// Rear mudguard: the upper arc of a ring just outside the tyre.
function mudguard(cx) {
  const ops = [];
  for (let j = 24; j < 38; j++) {
    const dy = (j + 0.5 - 17.5) / 2.5;
    const xi = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)));
    let xo = Math.round(Math.sqrt(Math.max(0, 64 - dy * dy)));
    if (xo <= xi) xo = xi + 1;
    if (xi === 0) ops.push(floor({ at: [cx - xo, G + j, ZW], size: [2 * xo, 2], colour: "frame" }));
    else ops.push(
      floor({ at: [cx - xo, G + j, ZW], size: [xo - xi, 2], colour: "frame" }),
      floor({ at: [cx + xi, G + j, ZW], size: [xo - xi, 2], colour: "frame" }));
  }
  return ops;
}
const tube = (a, b, zs, c) => zs.map(z => line({ from: [a[0], a[1], z], to: [b[0], b[1], z], colour: c || "frame" }));

section("Bicycle", [
  wheel(12), wheel(36), mudguard(12),
  tube([22, 15], [19, 39], [15, 16]),
  tube([22, 15], [33, 38], [15, 16]),
  tube([20, 38], [33, 42], [15, 16]),
  tube([19, 37], [12, 19], [14, 17]),
  tube([22, 15], [12, 18], [14, 17]),
  tube([34, 37], [36, 19], [14, 17]),
  box({ at: [33, 37, 15], size: [2, 10, 2], colour: "frame", interior: "solid" }),
  floor({ at: [33, 37, 14], size: [2, 4], colour: "frame" }),
  floor({ at: [17, 40, 15], size: [5, 2], layers: 2, colour: "black" }),
  floor({ at: [33, 47, 10], size: [2, 12], colour: "hub" }),
  floor({ at: [33, 48, 10], size: [2, 2], colour: "black" }),
  floor({ at: [33, 48, 20], size: [2, 2], colour: "black" }),
  box({ at: [35, 41, 13], size: [4, 6, 6], colour: "wicker", texture: "grille", open: ["top"] }),
  box({ at: [21, 14, 13], size: [2, 3, 6], colour: "hub", interior: "solid" }),
  box({ at: [20, 12, 18], size: [4, 7, 1], colour: "hub", interior: "solid" }),
  box({ at: [11, 16, 18], size: [2, 4, 1], colour: "hub", interior: "solid" }),
  tube([20, 18], [13, 19], [18], "black"),
  tube([20, 12], [13, 16], [18], "black"),
  tube([22, 15], [24, 9], [12], "hub"),
  tube([21, 15], [20, 21], [19], "hub"),
  floor({ at: [23, 8, 9], size: [3, 4], colour: "black" }),
  floor({ at: [19, 22, 19], size: [3, 4], colour: "black" }),
]);

const tiers = [[43, 16, 26, 13, 18], [46, 15, 27, 12, 19], [49, 14, 28, 12, 19], [52, 14, 28, 12, 19], [55, 15, 28, 12, 19], [58, 17, 28, 13, 18], [61, 20, 27, 13, 18]];
function wing(z, hz) {
  const ops = [
    box({ at: [16, 52, z], size: [10, 6, 1], colour: "plume", interior: "solid" }),
    box({ at: [13, 49, z], size: [13, 3, 1], colour: "quill", interior: "solid" }),
    box({ at: [32, 49, hz], size: [3, 4, 2], colour: "quill", interior: "solid" }),
  ];
  for (let i = 0; i < 6; i++) {
    const lo = 52 - Math.round(i * 0.6), hi = 57 - Math.round(i * 0.8);
    ops.push(
      floor({ at: [26 + i, lo, z], size: [1, 1], colour: "quill" }),
      box({ at: [26 + i, lo + 1, z], size: [1, hi - lo, 1], colour: "plume", interior: "solid" }));
  }
  return ops;
}

section("Pelican", [
  floor({ at: [16, 42, 13], size: [10, 6], colour: "plume" }),
  tiers.map(([y, x0, x1, z0, z1], i) => box({ at: [x0, y, z0], size: [x1 - x0 + 1, 3, z1 - z0 + 1], colour: "plume", interior: "solid", top: i >= 4 ? "tile" : undefined })),
  box({ at: [11, 51, 14], size: [3, 3, 4], colour: "plume", interior: "solid" }),
  [14, 15, 16, 17].map(z => place({ part: "3040b", at: [11, 54, z], colour: "plume", turn: 90 })),
  wing(11, 10), wing(20, 20),
  tube([22, 48], [27, 28], [10, 11], "leg"), tube([27, 28], [24, 10], [10, 11], "leg"),
  floor({ at: [22, 9, 9], size: [4, 3], colour: "leg" }),
  tube([22, 48], [25, 36], [20, 21], "leg"), tube([25, 36], [20, 24], [20, 21], "leg"),
  floor({ at: [18, 23, 20], size: [4, 3], colour: "leg" }),
  box({ at: [24, 64, 14], size: [4, 3, 4], colour: "plume", interior: "solid" }),
  box({ at: [24, 67, 15], size: [3, 3, 2], colour: "plume", interior: "solid" }),
  box({ at: [23, 70, 15], size: [3, 3, 2], colour: "plume", interior: "solid" }),
  box({ at: [23, 73, 15], size: [3, 2, 2], colour: "plume", interior: "solid" }),
  box({ at: [22, 75, 14], size: [6, 9, 4], colour: "plume", interior: "solid", top: "tile" }),
  box({ at: [26, 77, 15], size: [12, 3, 2], colour: "pouch", interior: "solid" }),
  box({ at: [26, 74, 15], size: [9, 3, 2], colour: "pouch", interior: "solid" }),
  box({ at: [26, 72, 15], size: [5, 2, 2], colour: "pouch", interior: "solid" }),
  floor({ at: [26, 80, 15], size: [16, 2], layers: 2, colour: "bill" }),
  floor({ at: [40, 79, 15], size: [2, 2], colour: "pouch" }),
  [14, 17].map(z => place({ part: "3005", at: [25, 81, z], colour: "black" })),
  [15, 16].map(z => place({ part: "3040b", at: [22, 84, z], colour: "plume", turn: 90 })),
]);

const beacon = (x, z) => [
  ...range(5).map(k => column({ at: [x, 3 * k, z], height: 3, colour: k % 2 ? "white" : "black" })),
  place({ part: "3062b", at: [x, 15, z], colour: "orange" }),
];

section("Lane", [
  baseplate({ at: [0, 0], size: [48, 32], colour: "green" }),
  floor({ at: [0, 0, 7], size: [48, 18], colour: "road" }),
  floor({ at: [0, 1, 7], size: [43, 1], colour: "white", top: "tile" }),
  floor({ at: [0, 1, 24], size: [43, 1], colour: "white", top: "tile" }),
  [8, 12, 16, 20].map(z => floor({ at: [43, 1, z], size: [5, 2], colour: "white", top: "tile" })),
  beacon(45, 4), beacon(45, 27),
  place({ part: "3470", at: [2, 0, 26], colour: "green" }),
  place({ part: "3471", at: [38, 0, 26], colour: "green" }),
  place({ part: "2435", at: [30, 0, 27], colour: "dark green" }),
  fence({ path: [[8, 30], [27, 30]], colour: "white", style: "picket" }),
  scatter({ region: { at: [0, 0], size: [43, 6] }, parts: ["24866"], colours: ["red", "yellow", "white"], density: 0.2, spacing: 2 }),
  scatter({ region: { at: [8, 25], size: [19, 4] }, parts: ["24866"], colours: ["red", "yellow", "white"], density: 0.25, spacing: 2, seed: 7 }),
]);
