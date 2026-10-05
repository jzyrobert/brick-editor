import { occurrences } from "../core/document";
import { mv, orthonormalized } from "../core/math";
import { ensure, type Vec3 } from "../core/types";
import {
  bindArocsWheelSources,
  arocsPartInterface,
} from "./arocs-wheel-interfaces";
import {
  readPreparedPneumaticPump,
  type PreparedPneumaticPump,
} from "./pneumatic-pump-source";
export type SourcePneumaticPumpMount = Readonly<{
  pumpOccurrenceId: string;
  shaftOccurrenceId: string;
  collarOccurrenceIds: readonly [string, string];
  pivot: Vec3;
  axis: Vec3;
  bearingSpanLdu: readonly [-10, 10];
  freedom: Readonly<{
    pumpRotation: "free";
    pumpAxial: "two-collar-capture";
    collarRotation: "keyed";
    collarAxial: "ideal-grip-not-a-weld";
  }>;
}>;
const seals = new WeakMap<SourcePneumaticPumpMount, PreparedPneumaticPump>();
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i], 0);
/** Actual stopped axle plus two source collar faces retain the round base bore.
 * This is an attachment witness, not a chassis support or a zero-axial weld. */
export async function prepareSourcePneumaticPumpMount(
  token: PreparedPneumaticPump,
  sources: Readonly<Record<string, string>>,
  input: {
    shaftOccurrenceId: string;
    collarOccurrenceIds: readonly [string, string];
  },
): Promise<SourcePneumaticPumpMount> {
  const seal = readPreparedPneumaticPump(token),
    binding = await bindArocsWheelSources(
      sources,
      ["87083.dat", "32123a.dat"],
      { project: seal.project },
    ),
    all = occurrences(seal.project);
  const selected = [input.shaftOccurrenceId, ...input.collarOccurrenceIds].map(
    (id) => {
      const o = all.find((o) => o.id === id),
        f = o && arocsPartInterface(o, binding);
      ensure(
        f?.axis,
        "INVALID_INPUT",
        "Choose actual source axle and collar mount owners",
      );
      return f;
    },
  );
  const [shaft, ...collars] = selected;
  ensure(
    shaft.ref === "87083.dat" &&
      collars.every((c) => c.ref === "32123a.dat") &&
      new Set([input.shaftOccurrenceId, ...input.collarOccurrenceIds]).size ===
        3,
    "INVALID_INPUT",
    "The pump mount needs one stopped axle and two distinct collars",
  );
  const frame = orthonormalized(seal.members[0].frame),
    axis = mv(frame.basis, [1, 0, 0]),
    pivot = frame.position;
  const fits = (center: Vec3, basis: Vec3) => {
    const delta = center.map((v, i) => v - pivot[i]) as Vec3,
      along = dot(delta, axis);
    return {
      along,
      radial: Math.hypot(...delta.map((v, i) => v - along * axis[i])),
      parallel: Math.abs(dot(basis, axis)),
    };
  };
  const a = fits(shaft.axis!.center, shaft.axis!.axis);
  ensure(
    a.parallel >= 0.999999 &&
      a.radial <= 1e-7 &&
      Math.abs(a.along) <= 1e-7 &&
      shaft.axis!.span[0] <= -20 &&
      shaft.axis!.span[1] >= 20,
    "INVALID_INPUT",
    "The pump bore does not seat on this actual spanning stopped axle",
  );
  const spans = collars.map((c) => {
    const f = fits(c.axis!.center, c.axis!.axis),
      key = Math.abs(dot(c.axis!.keyDirection!, shaft.axis!.keyDirection!));
    ensure(
      f.parallel >= 0.999999 &&
        f.radial <= 1e-7 &&
        (key >= 0.999999 || key <= 1e-7),
      "INVALID_INPUT",
      "A collar is not seated in its source keyed phase",
    );
    const span: [number, number] = [f.along - 5, f.along + 5];
    ensure(
      shaft.keyedSpans!.some(([lo, hi]) => span[0] >= lo && span[1] <= hi),
      "INVALID_INPUT",
      "A collar is outside the actual axle keyed span",
    );
    return span;
  });
  ensure(
    spans.some((s) => Math.abs(s[1] + 10) <= 1e-7) &&
      spans.some((s) => Math.abs(s[0] - 10) <= 1e-7),
    "INVALID_INPUT",
    "The pump base is not retained by both actual collar inside faces",
  );
  const result = Object.freeze({
    pumpOccurrenceId: token.occurrenceIds[0],
    shaftOccurrenceId: input.shaftOccurrenceId,
    collarOccurrenceIds: Object.freeze([
      ...input.collarOccurrenceIds,
    ]) as unknown as SourcePneumaticPumpMount["collarOccurrenceIds"],
    pivot: Object.freeze([...pivot]) as unknown as Vec3,
    axis: Object.freeze([...axis]) as unknown as Vec3,
    bearingSpanLdu: Object.freeze([-10, 10]) as readonly [-10, 10],
    freedom: Object.freeze({
      pumpRotation: "free" as const,
      pumpAxial: "two-collar-capture" as const,
      collarRotation: "keyed" as const,
      collarAxial: "ideal-grip-not-a-weld" as const,
    }),
  });
  readPreparedPneumaticPump(token);
  seals.set(result, token);
  return result;
}
export function requireSourcePneumaticPumpMount(
  token: PreparedPneumaticPump,
  mount: SourcePneumaticPumpMount,
) {
  ensure(
    seals.get(mount) === token,
    "INVALID_INPUT",
    "Use the exact source pump mount witness",
  );
  readPreparedPneumaticPump(token);
}
