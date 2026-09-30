/**
 * Official LDraw train parts that Play and the build checks recognise by
 * name (keys: lowercase file name without .dat), chosen from the titles in
 * the complete library catalogue (ldraw-full-2026-09-28). Pinned by
 * tests/unit/play-trains.test.ts.
 */
export const trainPartKey = (ref: string) =>
  ref
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/^.*\//, "")
    .replace(/\.dat$/, "");

/** Official parts that ride on the rails (wheels, bogies, wheeled bases, motors). */
export const TRAIN_WHEEL_PARTS: ReadonlySet<string> = new Set([
  "243c01",
  "244c01",
  "244c02",
  "244c03",
  "245c01",
  "245c02",
  "270c01",
  "270c02",
  "447c01",
  "501ac01",
  "501bc01",
  "501cc01",
  "579c01",
  "579c02",
  "579c03",
  "579p01c01",
  "579p01c02",
  "579p01c03",
  "736c01",
  "736c02",
  "867",
  "2878c01",
  "2878c02",
  "2894c01",
  "2927",
  "3443ac01",
  "3443ac02",
  "3443ac03",
  "3443ac04",
  "3443bc01",
  "3443bc02",
  "3443bc03",
  "3443bc04",
  "3443bc05",
  "3443bc06",
  "38339c01",
  "38339c02",
  "38340",
  "50254",
  "55423",
  "57878",
  "85489a",
  "85489ac01",
  "85489b",
  "90840",
  "u9582bc01",
]);
/**
 * Couplings, magnets and buffers. Two of them touching join two cars into
 * one train; they never make two cars one rigid body.
 */
export const TRAIN_COUPLER_PARTS: ReadonlySet<string> = new Set([
  "290",
  "499c01",
  "509c01-f1",
  "509c01-f2",
  "735",
  "737",
  "737c01-f1",
  "737c01-f2",
  "753",
  "753c01",
  "753c02",
  "2920",
  "2959bc01",
  "3176c01-f1",
  "3176c01-f2",
  "3488",
  "4022",
  "4022c01",
  "4022c02",
  "4023",
  "4023c01",
  "4023c02",
  "29084",
  "29085c01",
  "45708",
  "64414",
  "64415c01",
  "64417c01",
  "64422",
  "91968c01",
  "91994",
  "u9514c01",
  "u9516c01",
  "u9517",
]);
/** Parts that make a car a locomotive (fronts and motors). */
export const TRAIN_LOCO_PARTS: ReadonlySet<string> = new Set([
  "2917",
  "2924ac01",
  "2924bc01",
  "2924bc02",
  "15536",
  "37493",
  "45706",
  "45706p01",
  "45706p01c01",
  "55768",
  "501ac01",
  "501bc01",
  "501cc01",
  "579c01",
  "579c02",
  "579c03",
  "579p01c01",
  "579p01c02",
  "579p01c03",
  "2894c01",
  "2871a",
  "2871b",
]);
/** Track parts Play follows (the keys of TRACK_PARTS in src/play/track.ts). */
export const TRAIN_TRACK_PARTS: ReadonlySet<string> = new Set([
  "53401",
  "53400",
  "74746",
  "74747",
  "75541-f1",
  "75541-f2",
  "75541c01-f1",
  "75541c01-f2",
  "75542-f1",
  "75542-f2",
  "75542c01-f1",
  "75542c01-f2",
  "3228ac01",
  "3228bc01",
  "861c01",
  "3240ac01",
  "3240bc01",
  "3229ac01",
  "3229bc01",
  "866c01",
  "3241ac01",
]);
/**
 * Track pieces interlock at their joined ends, and wheels run inside the
 * rail heads: neither is an overlap between part bodies.
 */
export function onRails(a: string, b: string) {
  const x = trainPartKey(a),
    y = trainPartKey(b);
  const tx = TRAIN_TRACK_PARTS.has(x),
    ty = TRAIN_TRACK_PARTS.has(y);
  return (
    (tx && ty) ||
    (tx && TRAIN_WHEEL_PARTS.has(y)) ||
    (ty && TRAIN_WHEEL_PARTS.has(x))
  );
}
