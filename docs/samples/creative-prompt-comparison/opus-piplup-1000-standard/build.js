script({
  title: 'Piplup',
  description: 'Piplup, the Penguin Pokemon, standing on an ice floe',
  palette: { navy: 'dark blue', sky: 'medium azure', snow: 'white', beak: 'yellow', feet: 'orange', eye: 'black', ice: 'white' },
});

const sq = (v) => v * v;
const CH = 1.2, NK = 21, Y0 = 2;
const X0 = -14, X1 = 13, Z0 = -13, Z1 = 12;
const ell = (p, e) => sq((p[0] - e[0][0]) / e[1][0]) + sq((p[1] - e[0][1]) / e[1][1]) + sq((p[2] - e[0][2]) / e[1][2]) <= 1;
const BODY = [[0, 6.6, 0.4], [7.5, 7, 6.6]];
const HEAD = [[0, 18, -0.4], [8.4, 7.5, 7.9]];
const BEAK = [[0, 16.2, -8.1], [2.2, 1.5, 2.4]];
const FEET = [-1, 1].map((s) => [[s * 3, 0.6, -5.3], [2.2, 1, 3]]);
const EYE_H = 18.6;

// Flippers: ellipsoids tilted out and down from the shoulders.
const flipper = (p, s) => {
  const dx = 0.45 * s, dy = -0.89;
  const px = p[0] - 8.4 * s, py = p[1] - 9.2;
  return sq((px * dx + py * dy) / 4.4) + sq((py * dx - px * dy) / 1.4) + sq(p[2] / 2.5) <= 1;
};

function kind(x, k, z) {
  const p = [x + 0.5, k * CH + 0.6, z + 0.5];
  const [cx, H, cz] = p;
  if (FEET.some((f) => ell(p, f))) return 'feet';
  if (ell(p, BEAK)) return 'beak';
  if (flipper(p, 1) || flipper(p, -1)) return 'navy';
  const inB = ell(p, BODY), inH = ell(p, HEAD);
  if (!inB && !inH) return null;
  if (inH && (H >= 12.8 || !inB)) {
    if (cz < -2) {
      for (const s of [-1, 1]) {
        if (Math.abs(cx - s * 3.6) <= 1 && Math.abs(H - EYE_H) <= 1.3)
          return s * cx < 3.6 && H > EYE_H + 0.5 ? 'snow' : 'eye';
        if (sq(cx - s * 4) + sq((H - 18.2) / 1.1) < sq(2.9)) return 'snow';
      }
    }
    if (cz < -1 && ((Math.abs(cx) < 1 && H > 17.5 && H < 23.8) || (H > 21.6 && H < 23.8))) return 'sky';
    return 'navy';
  }
  if (H > 10.6) return 'navy';
  if (cz > 2.2 && H > 7.5) return 'navy';
  return 'sky';
}

const grid = [];
for (let k = 0; k < NK; k++) {
  const layer = [];
  for (let z = Z0; z <= Z1; z++) {
    const row = [];
    for (let x = X0; x <= X1; x++) row.push(kind(x, k, z));
    layer.push(row);
  }
  grid.push(layer);
}
const cell = (x, k, z) => (k < 0 || k >= NK || x < X0 || x > X1 || z < Z0 || z > Z1 ? null : grid[k][z - Z0][x - X0]);
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const skin = (x, k, z) => {
  const c = cell(x, k, z);
  return c && N6.some(([a, b, d]) => !cell(x + a, k + b, z + d)) ? c : null;
};

// Hollow 1-stud skin, one box per run of same-coloured cells along x.
const piplup = [];
for (let k = 0; k < NK; k++)
  for (let z = Z0; z <= Z1; z++) {
    let x = X0;
    while (x <= X1) {
      const c = skin(x, k, z);
      if (!c) { x++; continue; }
      let e = x;
      while (e < X1 && skin(e + 1, k, z) === c) e++;
      piplup.push(box({ at: [x, Y0 + 3 * k, z], size: [e - x + 1, 3, 1], colour: c, interior: 'solid' }));
      x = e + 1;
    }
  }

const floe = (at, size) => floor({ at: [at[0], 0, at[1]], size, colour: 'ice', layers: 2, top: 'tile' });

section('Ice floe', [
  baseplate({ at: [-16, -16], size: [32, 32], colour: 'blue' }),
  floe([-13, -13], [26, 24]),
  floe([-15, -8], [2, 14]),
  floe([13, -10], [2, 12]),
  floe([-9, 11], [16, 3]),
  floe([-8, -15], [12, 2]),
  ...[[-15, 9], [14, 12], [-14, -15], [9, -15], [15, -14]].map(([x, z]) => place({ part: '3005', at: [x, 0, z], colour: 'trans-clear' })),
  place({ part: '3003', at: [10, 0, 13], colour: 'white' }),
  place({ part: '3062b', at: [-11, 2, -11], colour: 'white' }),
  place({ part: '3062b', at: [10, 2, -10], colour: 'white' }),
  place({ part: '3070b', at: [-12, 2, -9], colour: 'trans light blue' }),
]);

section('Piplup', piplup);
