// Generates the "Air pump & cylinder" sample (fixtures/ldraw/templates/
// air-pump.mpd). The arrangement, stand and hose paths are original CC0 work.
// The pump base, valve and cylinder definitions are the unmodified embedded
// 2015 versions from Philippe Hurbain's 42043-1 OMR model (CCAL 2.0), copied
// from the reviewed excerpts in fixtures/play/mechanical-systems/. Official
// parts (pump barrel/cap/rod, tube ends and segments, bricks) stay in the
// pinned library. Run through `npm run templates`; a unit test keeps the
// committed file identical.
import { readFileSync } from "node:fs";
import type { Vec3 } from "../src/core/types";

const FIXTURES = "fixtures/play/mechanical-systems/";
type Basis = [Vec3, Vec3, Vec3]; // columns

/** Exact definitions copied verbatim (by FILE block) from reviewed excerpts. */
const EMBEDDED: Array<[file: string, names: string[]]> = [
  [
    "42043-pneumatic-pump.mpd",
    ["42043 - 2943-v2.dat", "s/42043 - 2943s01.dat"],
  ],
  [
    "42043-pneumatic-routing.mpd",
    [
      "42043 - 47223-v2-p1.dat",
      "42043 - 47222-v2.dat",
      "s\\42043 - 47222s01.dat",
    ],
  ],
  [
    "42043-pneumatic-cylinder.mpd",
    [
      "42043 - 19466c01.dat",
      "42043 - 19466.dat",
      "42043 - u9306.dat",
      "42043 - 7-16ring17.dat",
      "42043 - 7-16ring9.dat",
      "42043 - 19467c01.dat",
      "42043 - 19467.dat",
      "42043 - u9113.dat",
    ],
  ],
];
function blocks(file: string) {
  const out = new Map<string, string>();
  const text = readFileSync(FIXTURES + file, "utf8").replace(/\r\n/g, "\n");
  for (const chunk of text.split(/^(?=0 FILE )/m)) {
    const name = /^0 FILE (.+)$/m.exec(chunk)?.[1].trim();
    if (name) out.set(name, chunk.replace(/\n+$/, "") + "\n");
  }
  return out;
}

const fmt = (n: number) => {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? "0" : String(r);
};
const row = (p: Vec3, b: Basis) =>
  [
    ...p,
    b[0][0],
    b[1][0],
    b[2][0],
    b[0][1],
    b[1][1],
    b[2][1],
    b[0][2],
    b[1][2],
    b[2][2],
  ]
    .map(fmt)
    .join(" ");
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3) => scale(a, 1 / len(a));
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const apply = (origin: Vec3, b: Basis, local: Vec3): Vec3 =>
  addv(
    origin,
    addv(
      scale(b[0], local[0]),
      addv(scale(b[1], local[1]), scale(b[2], local[2])),
    ),
  );
/** Any unit vector perpendicular to `a`, chosen deterministically. */
const perpendicular = (a: Vec3): Vec3 =>
  unit(cross(a, Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));

/** One reviewed source port of a placed part: tip and outward axis. */
type Port = { tip: Vec3; axis: Vec3 };
const port = (origin: Vec3, b: Basis, base: Vec3, tip: Vec3): Port => {
  const t = apply(origin, b, tip);
  return { tip: t, axis: unit(sub(t, apply(origin, b, base))) };
};

/**
 * One LDCad flexible tube between two barbs, with its generated fallback.
 * Each 165 tube end sits 4 LDU beyond the barb tip with its bore (+Y)
 * pointing in: 16 LDU of the 17–18 LDU barb is inside the end. The body is
 * a cubic Bézier leaving each port along its axis; 166 segments follow it.
 */
function hose(name: string, a: Port, b: Port, reach: [number, number]) {
  const cap = (p: Port) => {
    const position = addv(p.tip, scale(p.axis, 4)),
      inward = scale(p.axis, -1),
      x = perpendicular(inward),
      z = cross(x, inward);
    return { position, basis: [x, inward, z] as Basis };
  };
  const start = cap(a),
    end = cap(b);
  const p0 = start.position,
    p1 = addv(p0, scale(a.axis, reach[0])),
    p3 = end.position,
    p2 = addv(p3, scale(b.axis, reach[1]));
  const at = (t: number): Vec3 => {
    const u = 1 - t;
    return addv(
      addv(scale(p0, u * u * u), scale(p1, 3 * u * u * t)),
      addv(scale(p2, 3 * u * t * t), scale(p3, t * t * t)),
    );
  };
  // Dense sampling, then segments of about 6 LDU along the curve.
  const dense = Array.from({ length: 401 }, (_, i) => at(i / 400));
  const lengths = [0];
  for (let i = 1; i < dense.length; i++)
    lengths.push(lengths[i - 1] + len(sub(dense[i], dense[i - 1])));
  const total = lengths[lengths.length - 1],
    count = Math.max(4, Math.round(total / 6)),
    points: Vec3[] = [];
  for (let k = 0, j = 0; k <= count; k++) {
    const target = (total * k) / count;
    while (j < lengths.length - 2 && lengths[j + 1] < target) j++;
    const f = (target - lengths[j]) / (lengths[j + 1] - lengths[j] || 1);
    points.push(addv(dense[j], scale(sub(dense[j + 1], dense[j]), f)));
  }
  let previousX = start.basis[0];
  const segments = points.slice(0, -1).map((p, i) => {
    const along = sub(points[i + 1], p),
      y = unit(along);
    // Parallel-transport the side axis so the tube does not twist.
    let x = sub(previousX, scale(y, dot(previousX, y)));
    x = len(x) > 1e-6 ? unit(x) : perpendicular(y);
    previousX = x;
    const z = cross(x, y);
    return `1 16 ${row(p, [x, along, z])} 166.dat`;
  });
  const posOri = (c: { position: Vec3; basis: Basis }) =>
    row(c.position, c.basis);
  return [
    `0 FILE ${name}`,
    `0 ${name.replace(/\.ldr$/, "")}`,
    `0 Name: ${name}`,
    "0 Author: Brick Editor contributors",
    "0 !LDRAW_ORG Unofficial_Model",
    "0 !LICENSE Licensed under CC0 1.0 : see https://creativecommons.org/publicdomain/zero/1.0/",
    "0 !KEYWORDS flexible, pneumatic",
    "0 !LDCAD CONTENT [type=path] [addFallBack=default] [looped=false] [displayKind=mm] [curveStep=0] [displayLenCor=0]",
    "",
    `0 !LDCAD PATH_POINT [type=bezier] [posOri=${posOri(start)}] [prevCPDist=${fmt(reach[0])}] [nextCPDist=${fmt(reach[0])}] [cirR=20] [cirDir=xyCW] [prevYRoll=0] [nextYRoll=0]`,
    `0 !LDCAD PATH_POINT [type=bezier] [posOri=${posOri(end)}] [prevCPDist=${fmt(reach[1])}] [nextCPDist=${fmt(reach[1])}] [cirR=20] [cirDir=xyCW] [prevYRoll=0] [nextYRoll=0]`,
    "",
    "0 !LDCAD PATH_SKIN [donCol=16] [donOri=1 0 0 0 1 0 0 0 1] [donPart=166.dat] [donYSize=400%] [donCen=absCen] [donCenYOfs=0] [donFinScale=none] [donPlace=refsDyn] [donYAlign=0] [donInline=false] [segSize=40%] [segSizeTol=5%] [segsCnt=0] [segsGrp=0] [segsMaxMerge=1] [segsMrgAng=0] [segsMrgRollAng=0] [segsEdgeDelKind=keepFirstLeft]",
    "",
    `0 !LDCAD PATH_CAP [group=start] [color=16] [posOri=${posOri(start)}] [part=165.dat] [extraLen=8mm]`,
    `0 !LDCAD PATH_CAP [group=end] [color=16] [posOri=${posOri(end)}] [part=165.dat] [extraLen=8mm]`,
    "",
    "0 // Fallback LDraw content for the path above (Brick Editor generator).",
    "0 BFC CERTIFY CCW",
    "",
    "0 // Start cap reference",
    `1 16 ${posOri(start)} 165.dat`,
    "",
    "0 // End cap reference",
    `1 16 ${posOri(end)} 165.dat`,
    "",
    "0 // Segments",
    ...segments,
    "",
  ].join("\n");
}

/** Column bases (exact) for the hardware orientations used here. */
// Valve: ports point up (local +X), lever faces the front (local −Z → −Z).
const VALVE: Basis = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
];
// Pump: barrel and rod run out to the left (local −Y → −X); outlet points up.
const PUMP: Basis = [
  [0, 0, 1],
  [1, 0, 0],
  [0, 1, 0],
];
// Cylinder: rod runs out to the right (local −Y → +X); ports point up.
const CYLINDER: Basis = [
  [0, 0, -1],
  [-1, 0, 0],
  [0, 1, 0],
];
const FLAT: Basis = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export const AIR_PUMP_FILE = "air-pump.mpd";
export const AIR_PUMP_CRATE_MODEL = "air-pump - crate.ldr";
/** Rest geometry the sample's tests and Play hint rely on (LDU). */
/** Rest geometry (LDU). Everything stands on the studs of the table, whose
 * top surface is Y 0; the crate sits in the rod's path. */
export const AIR_PUMP_LAYOUT = Object.freeze({
  valve: [-20, -14, 110] as Vec3,
  /** On a 2 × 4 plate, so the moving rod head clears the table's studs. */
  pump: [-90, -22, 60] as Vec3,
  pumpSeparation: 120,
  cylinder: [-70, -24, -10] as Vec3,
  rodSeparation: 205,
  crate: [190, -8, 0] as Vec3,
});

export function airPumpSampleSource() {
  const { valve, pump, pumpSeparation, cylinder, rodSeparation, crate } =
    AIR_PUMP_LAYOUT;
  const along = (o: Vec3, b: Basis, y: number) => apply(o, b, [0, y, 0]);
  const supply = port(valve, VALVE, [10, 0, -24], [26, 0, -24]),
    workA = port(valve, VALVE, [10, 11, -30], [26, 11, -30]),
    workB = port(valve, VALVE, [10, -11, -30], [26, -11, -30]),
    outlet = port(pump, PUMP, [0, -10, -9], [0, -10, -26]),
    base = port(cylinder, CYLINDER, [0, -20, -18], [0, -20, -36]),
    capPort = port(cylinder, CYLINDER, [0, -168, -19], [0, -168, -36]);
  const hoses = [
    hose("air-pump - supply hose.ldr", outlet, supply, [40, 40]),
    hose("air-pump - base hose.ldr", workB, base, [40, 40]),
    hose("air-pump - cap hose.ldr", workA, capPort, [50, 50]),
  ];
  const at = (ref: string, colour: number, p: Vec3, b: Basis = FLAT) =>
    `1 ${colour} ${row(p, b)} ${ref}`;
  // A dark grey table of two 8 × 16 plates (top surface at Y 0).
  const table = [
    at("92438.dat", 72, [-100, 0, 40]),
    at("92438.dat", 72, [220, 0, 40]),
    // The pump case rests on a light grey 2 × 4 plate.
    at("3020.dat", 71, [-120, -8, 60]),
    // Smooth tiles let the loose crate slide instead of locking on studs.
    at("87079.dat", 71, [200, -8, 0]),
    at("87079.dat", 71, [280, -8, 0]),
  ];
  const crateModel = [
    `0 FILE ${AIR_PUMP_CRATE_MODEL}`,
    "0 Crate",
    `0 Name: ${AIR_PUMP_CRATE_MODEL}`,
    "0 Author: Brick Editor contributors",
    "0 !LICENSE Licensed under CC0 1.0 : see https://creativecommons.org/publicdomain/zero/1.0/",
    at("3003.dat", 25, [0, -24, 0]),
    at("3003.dat", 25, [0, -48, 0]),
    at("3068b.dat", 70, [0, -56, 0]),
    "",
  ].join("\n");
  const main = [
    "0 FILE air-pump.ldr",
    "0 Air pump & cylinder",
    "0 Name: air-pump.ldr",
    "0 Author: Brick Editor contributors (arrangement, stand and hose paths, CC0 1.0)",
    "0 !LICENSE Embedded 42043 definitions: Redistributable under CCAL version 2.0 : see CAreadme.txt",
    "0 // Embedded pump base, valve and cylinder: Philippe Hurbain [Philo], LDraw OMR 42043-1",
    "0 // https://library.ldraw.org/library/omr/42043-1.mpd",
    "0 // OMR source SHA256: 6264ccf8fd18d666b68c4538eb69ddfbd87fe5bf633ebf34395b48229e9fc369",
    ...table,
    at("42043 - 47223-v2-p1.dat", 72, valve, VALVE),
    at("42043 - 2943-v2.dat", 1, pump, PUMP),
    at("99799.dat", 1, along(pump, PUMP, -88), PUMP),
    at("2941.dat", 0, along(pump, PUMP, -90), PUMP),
    at("2944.dat", 0, along(pump, PUMP, -pumpSeparation), PUMP),
    at("42043 - 19466c01.dat", 14, cylinder, CYLINDER),
    at(
      "42043 - 19467c01.dat",
      0,
      along(cylinder, CYLINDER, -rodSeparation),
      CYLINDER,
    ),
    ...hoses.map((h) => at(/^0 FILE (.+)$/m.exec(h)![1], 0, [0, 0, 0])),
    at(AIR_PUMP_CRATE_MODEL, 16, crate),
    "",
  ].join("\n");
  const embedded = EMBEDDED.flatMap(([file, names]) => {
    const found = blocks(file);
    return names.map((name) => {
      const text = found.get(name);
      if (!text) throw new Error(`Missing ${name} in ${file}`);
      return text;
    });
  });
  return [main, crateModel, ...hoses, ...embedded].join("\n");
}
