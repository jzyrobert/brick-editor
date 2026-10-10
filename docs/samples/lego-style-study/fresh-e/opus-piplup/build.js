script({
  title: "Piplup's Bubble Beam",
  description: "A proud Piplup on its ice floe, one flipper raised to conduct a stream of bubbles rising from a fishing hole.",
  palette: { body: "medium azure", head: "dark blue", beak: "yellow", feet: "orange", ice: "white" }
});

const B = 3;
const bodyA = [3.9, 5.2, 6.0, 6.5, 6.8, 6.9, 6.8, 6.5, 6.1, 5.7];
const headA = [6.1, 7.0, 7.5, 7.9, 8.1, 8.1, 8.0, 7.7, 7.25, 6.5, 5.5, 3.9];
const prof = [
  ...bodyA.map(a => ({ a, b: a * 0.9, zc: 0 })),
  ...headA.map(a => ({ a, b: a * 0.86, zc: -0.3 }))
];
const N = prof.length;
const inside = (c, x, z) => {
  if (c < 0 || c >= N) return false;
  const p = prof[c];
  const u = (x + 0.5) / p.a, v = (z + 0.5 - p.zc) / p.b;
  return u * u + v * v <= 1;
};
const NB = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
const isShell = (c, x, z) => {
  if (!inside(c, x, z)) return false;
  if (!inside(c + 1, x, z) || !inside(c - 1, x, z)) return true;
  return NB.some(([dx, dz]) => !inside(c, x + dx, z + dz));
};

// Body: sky blue with a navy cape on the back and two white chest spots.
// Head: navy with white-glinted eyes, white cheek spots and a light blue crown crest.
const colourAt = (c, x, z) => {
  const px = x + 0.5, pz = z + 0.5;
  const th = Math.atan2(px, -pz);
  const front = pz < -2.5;
  if (c < 10) {
    if (pz > 0 && Math.abs(th) > Math.PI - (0.3 + 0.08 * c)) return "head";
    if (front && (c === 7 || c === 8) && ((x >= -4 && x <= -3) || (x >= 2 && x <= 3))) return "white";
    return "body";
  }
  const h = c - 10;
  if (front) {
    const ex = x >= 0 ? x : -1 - x;
    if (h >= 4 && h <= 6 && (ex === 2 || ex === 3)) {
      if (h === 6 && (x === -4 || x === 2)) return "white";
      return "black";
    }
    if ((h === 2 || h === 3) && (ex === 3 || ex === 4)) return "white";
    if (ex === 0 && h >= 5 && h <= 9) return "body";
    if (h === 8 && ex <= 2) return "body";
    if (h === 9 && (ex === 0 || ex === 2)) return "body";
  }
  return "head";
};

const shellOps = (c0, c1) => {
  const ops = [];
  for (let c = c0; c < c1; c++) {
    const y = B + 3 * c;
    for (let z = -11; z <= 10; z++) {
      let run = null;
      for (let x = -11; x <= 11; x++) {
        const col = isShell(c, x, z) ? colourAt(c, x, z) : null;
        if (run && run.col !== col) {
          ops.push(box({ at: [run.x0, y, z], size: [x - run.x0, 3, 1], colour: run.col, interior: "solid" }));
          run = null;
        }
        if (col && !run) run = { x0: x, col };
      }
    }
  }
  return ops;
};

const frontZ = (c, x) => { for (let z = -12; z <= 0; z++) if (isShell(c, x, z)) return z; return 0; };
const backZ = (c, x) => { for (let z = 12; z >= 0; z--) if (isShell(c, x, z)) return z; return 0; };
const rightX = (c, z) => { for (let x = 12; x >= 0; x--) if (isShell(c, x, z)) return x; return 0; };
const leftX = (c, z) => { for (let x = -12; x <= 0; x++) if (isShell(c, x, z)) return x; return 0; };

section("Body", shellOps(0, 10));
section("Head", shellOps(10, N));

// Beak: a yellow wedge of inverted and plain 33-degree slopes
const zf = Math.max(frontZ(13, -1), frontZ(13, 0), frontZ(14, -1), frontZ(14, 0));
section("Beak", [
  place({ part: "3747b", at: [-1, B + 39, zf - 2], colour: "beak" }),
  place({ part: "3298", at: [-1, B + 42, zf - 2], colour: "beak" })
]);

// Flippers: right raised in a stepped diagonal, left hanging out and down
const cs = 6, y0 = B + 3 * cs;
const E = Math.min(rightX(cs, -1), rightX(cs, 0));
const L = Math.max(leftX(cs, -1), leftX(cs, 0));
section("Flippers", [
  ...range(4).map(k => place({ part: "3003", at: [E + k, y0 + 3 * k, -1], colour: "head" })),
  ...range(1, 4).map(k => place({ part: "85984", at: [E + k - 1, y0 + 3 * k, -1], colour: "head", turn: 90 })),
  place({ part: "15068", at: [E + 3, y0 + 12, -1], colour: "head", turn: 270 }),
  ...range(3).map(k => place({ part: "3003", at: [L - 1 - k, y0 - 3 * k, -1], colour: "head" })),
  ...range(1, 3).map(k => place({ part: "85984", at: [L - 1 - k, y0 - 3 * k + 3, -1], colour: "head", turn: 90 }))
]);

const Bz = Math.min(backZ(1, -1), backZ(1, 0));
const foot = (x0) => [
  floor({ at: [x0, 2, -8], size: [3, 7], colour: "feet", top: "tile" }),
  ...range(3).map(i => place({ part: "54200", at: [x0 + i, 3, -8], colour: "feet" }))
];
section("Feet and tail", [
  ...foot(-5), ...foot(2),
  place({ part: "3039", at: [-1, B + 3, Bz], colour: "head", turn: 180 })
]);

// Ice floe with a fishing hole
const fx = 2, fz = -1, fa = 14, fb = 11;
const onFloe = (x, z) => {
  const px = x + 0.5 - fx, pz = z + 0.5 - fz;
  const th = Math.atan2(pz, px);
  const r = 1 + 0.07 * Math.sin(3 * th + 0.5) + 0.05 * Math.cos(5 * th + 1.3);
  const u = px / (fa * r), v = pz / (fb * r);
  return u * u + v * v <= 1;
};
const inHole = (x, z) => x >= 8 && x <= 11 && z >= -9 && z <= -6;
const floeOps = [];
for (let z = -16; z <= 14; z++) {
  let x0 = null;
  for (let x = -16; x <= 20; x++) {
    const on = onFloe(x, z) && !inHole(x, z);
    if (on && x0 === null) x0 = x;
    if (!on && x0 !== null) {
      floeOps.push(floor({ at: [x0, 0, z], size: [x - x0, 1], colour: "trans light blue" }));
      floeOps.push(floor({ at: [x0, 1, z], size: [x - x0, 1], colour: "ice", top: "tile" }));
      x0 = null;
    }
  }
}
section("Ice floe", [
  ...floeOps,
  floor({ at: [8, 0, -9], size: [4, 4], colour: "trans light blue", top: "tile" }),
  place({ part: "64648", at: [3, 2, -10], colour: "orange", turn: 90 }),
  place({ part: "3045", at: [-9, 2, 3], colour: "ice" }),
  place({ part: "3039", at: [-9, 2, 5], colour: "ice", turn: 180 }),
  place({ part: "3040b", at: [-7, 2, 4], colour: "trans-clear", turn: 270 }),
  place({ part: "3040b", at: [11, 2, 4], colour: "trans light blue" }),
  place({ part: "54200", at: [12, 2, 3], colour: "trans-clear", turn: 270 })
]);

// Bubble stream rising from the hole toward the raised flipper
section("Bubbles", [
  place({ part: "3941", at: [9, 1, -8], colour: "trans-clear" }),
  place({ part: "3062b", at: [10, 4, -7], colour: "trans light blue" }),
  place({ part: "3941", at: [9, 7, -7], colour: "trans light blue" }),
  place({ part: "3062b", at: [9, 10, -6], colour: "trans-clear" }),
  place({ part: "3941", at: [8, 13, -6], colour: "trans-clear" }),
  place({ part: "3062b", at: [8, 16, -5], colour: "trans light blue" }),
  place({ part: "3941", at: [7, 19, -6], colour: "trans light blue" }),
  place({ part: "3062b", at: [7, 22, -6], colour: "trans-clear" }),
  place({ part: "6141", at: [7, 25, -6], colour: "trans light blue" })
]);

section("Finish", [smooth({})]);
