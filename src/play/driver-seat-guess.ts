import { add, mv } from "../core/math";
import type { Bounds } from "../core/spatial";
import type { Occurrence, Transform, Vec3 } from "../core/types";
import type { MotionRig } from "../mechanisms/types";
import { SEATED_BODY_PROFILE } from "./seated-profile";

/**
 * Driver's-seat heuristic for detected cars without an authored seat.
 *
 * A placement guess for the seated figure and its camera, NOT a claim that the
 * model has authored seating, and no part is attached or moved. In order:
 *
 * 1. Real seat parts (Minifig Seat 2 × 2), each paired with the nearest
 *    steering-wheel part in front of it at a plausible height. The pelvis is
 *    the seat's own hip point (18 LDU above its origin, as the authored
 *    Roadster and Jeep seats use).
 * 2. Otherwise, an empty gap in the middle front of the chassis (behind the
 *    front axle, between the sides) where the declared seated-figure boxes fit,
 *    with a supporting surface under the hips, clear headroom and a clear line
 *    of sight forward (transparent parts and the steering wheel excepted).
 *
 * Occupancy uses part bounding boxes, so a gap is conservative: a curved part
 * counts as filling its whole box. Candidates are ranked and the reason for
 * the choice is reported; with none, a plain reason is returned.
 */
export const SEAT_PARTS: Readonly<Record<string, Vec3>> = Object.freeze({
  "4079.dat": [0, -18, 0],
  "407924.dat": [0, -18, 0],
});
export const STEERING_WHEEL_PARTS = new Set([
  "3829c01.dat",
  "3828.dat",
  "30663.dat",
  "16091.dat",
  "2819.dat",
  "2741.dat",
  "67811.dat",
  "41850.dat",
  "30640c01.dat",
  "30640c02.dat",
  "874.dat",
  "9551.dat",
  "9552.dat",
  "9553.dat",
  "9556.dat",
  "9566.dat",
  "73081.dat",
  "4226995.dat",
]);
/** Common LDraw transparent colour codes: a windscreen does not block the view. */
const TRANSPARENT = new Set([
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "52",
  "54",
  "57",
  "230",
  "231",
  "232",
  "233",
  "234",
  "235",
  "236",
  "284",
  "285",
  "293",
]);

export type DriverSeatGuess = {
  kind: "seat-part" | "cockpit-gap";
  /** World LDU hip point of the seated figure. */
  pelvis: Vec3;
  /** Seated yaw relative to the vehicle's forward, degrees. */
  yawDegrees: number;
  seat?: { occurrenceId: string; ref: string };
  steering?: { occurrenceId: string; ref: string };
  score: number;
  /** Plain words: why this place. */
  reason: string;
};
export type DriverSeatResult = {
  chosen?: DriverSeatGuess;
  candidates: DriverSeatGuess[];
  /** Cockpit places tried and the first check each failed. */
  rejected?: { support: number; sides: number; body: number; view: number };
  reason?: string;
};

type Box = { min: Vec3; max: Vec3 };
const overlaps = (a: Box, b: Box, shrink = 0.5) =>
  [0, 1, 2].every(
    (k) => a.min[k] < b.max[k] - shrink && b.min[k] < a.max[k] - shrink,
  );

export function guessDriverSeat(input: {
  rig: MotionRig;
  lookup: ReadonlyMap<string, Occurrence>;
  bounds: (o: Occurrence) => Bounds | null;
  /** Extra parts known to be the steering wheel (e.g. a ride-along pulley). */
  steeringIds?: readonly string[];
}): DriverSeatResult {
  const { rig, lookup, bounds } = input;
  const vehicle = rig.vehicle;
  if (!vehicle) return { candidates: [], reason: "This is not a vehicle" };
  const chassis = rig.groups.find((g) => g.id === vehicle.chassisGroup)!;
  const frame: Transform = chassis.frame,
    // Vehicle-local: x right, y down, z backwards (forward is -z).
    toLocal = (p: Vec3): Vec3 => {
      const d = p.map((v, k) => v - frame.position[k]);
      const b = frame.basis;
      return [
        b[0] * d[0] + b[3] * d[1] + b[6] * d[2],
        b[1] * d[0] + b[4] * d[1] + b[7] * d[2],
        b[2] * d[0] + b[5] * d[1] + b[8] * d[2],
      ];
    },
    toWorld = (p: Vec3): Vec3 => add(frame.position, mv(frame.basis, p));
  const ids = rig.groups.flatMap((g) => g.occurrenceIds);
  const members = ids
    .map((id) => lookup.get(id))
    .filter((o): o is Occurrence => !!o);
  const localBox = (o: Occurrence): Box | null => {
    const b = bounds(o);
    if (!b) return null;
    const corners = Array.from({ length: 8 }, (_, n) =>
      toLocal(
        [0, 1, 2].map((k) => (n & (1 << k) ? b.max[k] : b.min[k])) as Vec3,
      ),
    );
    return {
      min: [0, 1, 2].map((k) => Math.min(...corners.map((c) => c[k]))) as Vec3,
      max: [0, 1, 2].map((k) => Math.max(...corners.map((c) => c[k]))) as Vec3,
    };
  };
  const boxes = members
    .map((o) => ({ o, box: localBox(o) }))
    .filter((x): x is { o: Occurrence; box: Box } => !!x.box);
  const steering = members.filter(
    (o) =>
      STEERING_WHEEL_PARTS.has(o.node.ref.toLowerCase()) ||
      input.steeringIds?.includes(o.id),
  );
  const candidates: DriverSeatGuess[] = [];
  /** Places tried in the cockpit search and the first check each failed. */
  const rejected = { support: 0, sides: 0, body: 0, view: 0 };
  // 1. Real seat parts, paired with a steering wheel in front.
  for (const seat of members) {
    const offset = SEAT_PARTS[seat.node.ref.toLowerCase()];
    if (!offset) continue;
    const pelvis = add(
      seat.transform.position,
      mv(seat.transform.basis, offset),
    );
    const local = toLocal(pelvis);
    const seatForward = toLocal(
      add(frame.position, mv(seat.transform.basis, [0, 0, -1])),
    );
    const facing = -seatForward[2]; // 1 when the seat faces the car's front
    let best: { o: Occurrence; ahead: number; side: number } | undefined;
    for (const wheel of steering) {
      const w = toLocal(wheel.transform.position),
        ahead = local[2] - w[2],
        side = Math.abs(w[0] - local[0]),
        rise = local[1] - w[1];
      if (ahead < 10 || ahead > 120 || side > 30 || rise < -20 || rise > 80)
        continue;
      if (!best || ahead + side < best.ahead + best.side)
        best = { o: wheel, ahead, side };
    }
    const score =
      100 +
      (best ? 60 - best.side - Math.abs(best.ahead - 50) * 0.2 : 0) +
      (facing > 0.7 ? 20 : -50) -
      Math.abs(local[0]) * 0.05;
    candidates.push({
      kind: "seat-part",
      pelvis,
      yawDegrees: 0,
      seat: { occurrenceId: seat.id, ref: seat.node.ref },
      ...(best
        ? { steering: { occurrenceId: best.o.id, ref: best.o.node.ref } }
        : {}),
      score,
      reason: best
        ? `Seat part ${seat.node.ref} with steering wheel ${best.o.node.ref} in front of it`
        : `Seat part ${seat.node.ref}; no steering wheel found in front of it`,
    });
  }
  // 2. An empty cockpit gap behind the front axle, between the sides.
  if (!candidates.length) {
    const wheels = vehicle.wheels.map((w) =>
      toLocal(rig.groups.find((g) => g.id === w.groupId)!.frame.position),
    );
    const front = Math.min(...wheels.map((w) => w[2])),
      rear = Math.max(...wheels.map((w) => w[2])),
      all = boxes.map((b) => b.box),
      width =
        Math.max(...all.map((b) => b.max[0])) -
        Math.min(...all.map((b) => b.min[0]));
    // Part boxes overstate slopes and curves; allow them to graze the
    // figure's boxes by up to 3 LDU. Seat entry still checks real geometry.
    const blocks = (box: Box, except: (o: Occurrence) => boolean) =>
      boxes.some((b) => !except(b.o) && overlaps(b.box, box, 3));
    const envelope = (pelvis: Vec3, id: string) => {
      const e = SEATED_BODY_PROFILE.envelopes.find((x) => x.id === id)!;
      return {
        min: [0, 1, 2].map(
          (k) => pelvis[k] + e.center[k] - e.halfExtents[k],
        ) as Vec3,
        max: [0, 1, 2].map(
          (k) => pelvis[k] + e.center[k] + e.halfExtents[k],
        ) as Vec3,
      };
    };
    const hipUnder = 9.3;
    for (let z = front + 30; z <= front + (rear - front) * 0.6; z += 10)
      for (let x = -width / 2 + 20; x <= width / 2 - 20; x += 10) {
        // Candidate support tops under the hips.
        const foot: Box = {
          min: [x - 14, -Infinity, z - 10],
          max: [x + 14, Infinity, z + 10],
        };
        const tops = [
          ...new Set(
            boxes
              .filter(
                (b) =>
                  b.box.min[0] < foot.max[0] &&
                  b.box.max[0] > foot.min[0] &&
                  b.box.min[2] < foot.max[2] &&
                  b.box.max[2] > foot.min[2],
              )
              .map((b) => Math.round(b.box.min[1] * 10) / 10),
          ),
        ];
        for (const top of tops) {
          const pelvis: Vec3 = [x, top - hipUnder, z];
          // Hips supported: sample the footprint at the support level.
          let covered = 0;
          for (let i = 0; i < 5; i++)
            for (let j = 0; j < 5; j++) {
              const px = x - 12 + i * 6,
                pz = z - 8 + j * 4;
              if (
                boxes.some(
                  (b) =>
                    Math.abs(b.box.min[1] - top) <= 1.5 &&
                    b.box.min[0] <= px &&
                    b.box.max[0] >= px &&
                    b.box.min[2] <= pz &&
                    b.box.max[2] >= pz,
                )
              )
                covered++;
            }
          if (covered < 15) {
            rejected.support++;
            continue;
          }
          // Between the sides: parts beside the hips rise above the seat, so the
          // figure sits in the car rather than on its roof.
          const side = (sign: -1 | 1) =>
            boxes.some(
              (b) =>
                b.box.min[2] < z + 20 &&
                b.box.max[2] > z - 20 &&
                (sign < 0 ? b.box.max[0] <= x - 10 : b.box.min[0] >= x + 10) &&
                Math.abs((sign < 0 ? b.box.max[0] : b.box.min[0]) - x) <= 60 &&
                b.box.min[1] < top - 4 &&
                b.box.max[1] > top - 2,
            );
          if (!side(-1) || !side(1)) {
            rejected.sides++;
            continue;
          }
          const isWheel = (o: Occurrence) => steering.includes(o);
          if (
            blocks(envelope(pelvis, "torso-head"), isWheel) ||
            blocks(envelope(pelvis, "straight-legs"), isWheel)
          ) {
            rejected.body++;
            continue;
          }
          // Headroom above the head and a line of sight forward.
          const eye = add(pelvis, SEATED_BODY_PROFILE.eyeFromPelvis as Vec3);
          const head: Box = {
            min: [x - 10, eye[1] - 40, z - 10],
            max: [x + 10, eye[1] - 8, z + 10],
          };
          const sight: Box = {
            min: [x - 8, eye[1] - 3, z - 120],
            max: [x + 8, eye[1] + 3, z - 15],
          };
          const seeThrough = (o: Occurrence) =>
            isWheel(o) || TRANSPARENT.has(o.colorCode);
          if (blocks(head, seeThrough) || blocks(sight, seeThrough)) {
            rejected.view++;
            continue;
          }
          const wheel = steering
            .map((o) => ({ o, w: toLocal(o.transform.position) }))
            .find(
              ({ w }) =>
                z - w[2] >= 10 && z - w[2] <= 120 && Math.abs(w[0] - x) <= 30,
            );
          candidates.push({
            kind: "cockpit-gap",
            pelvis: toWorld(pelvis),
            yawDegrees: 0,
            ...(wheel
              ? {
                  steering: { occurrenceId: wheel.o.id, ref: wheel.o.node.ref },
                }
              : {}),
            score:
              50 +
              (wheel ? 40 - Math.abs(wheel.w[0] - x) : 0) -
              Math.abs(x) * 0.5 -
              Math.abs(z - (front + (rear - front) * 0.3)) * 0.05 +
              covered,
            reason: wheel
              ? `Empty cockpit gap with support under the hips and steering wheel ${wheel.o.node.ref} in front`
              : "Empty cockpit gap with support under the hips and a clear view ahead",
          });
          break;
        }
      }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length
    ? { chosen: candidates[0], candidates, rejected }
    : {
        candidates,
        rejected,
        reason: `No seat part, and no space in the front of the car where a seated figure fits. Of the places tried, ${rejected.support} had nothing flat to sit on, ${rejected.sides} were not between the car's sides, ${rejected.body} were too narrow or too low for the figure and ${rejected.view} had no view ahead`,
      };
}
