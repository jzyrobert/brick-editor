import {
  add,
  compose,
  inverse,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import {
  ensure,
  type Occurrence,
  type Project,
  type Transform,
  type Vec3,
} from "../core/types";
import { RESOURCE_PROFILES } from "../core/resource-profile";
import { verifyReviewedSourceClosures } from "./reviewed-source-closure";
import {
  bindWinchRetentionSources,
  winchRetention,
  type WinchRetentionBinding,
} from "./winch-retention";
import mountSources from "./winch-carrier-sources.json";

export type WinchCarrierBinding = Readonly<{ refs: readonly string[] }>;
const bindings = new WeakMap<WinchCarrierBinding, WinchRetentionBinding>();
export async function bindWinchCarrierSources(
  resolved: Readonly<Record<string, string>>,
  project: Pick<Project, "models">,
) {
  const refs = await verifyReviewedSourceClosures(
      resolved,
      mountSources,
      Object.keys(mountSources),
      { project },
    ),
    retained = await bindWinchRetentionSources(resolved, project),
    binding = Object.freeze({
      refs: Object.freeze([...refs, ...retained.refs]),
    });
  bindings.set(binding, retained);
  return binding;
}
type Span = readonly [number, number];
type Port = Readonly<{
  occurrenceId: string;
  feature: string;
  center: Vec3;
  axis: Vec3;
  spanLdu: Span;
}>;
export type WinchSourceBearing = Readonly<{
  shaft: Port;
  bore: Port;
  kind: "round" | "keyed";
  engagementLdu: number;
  axialFreedom: true;
  activeWhen: "positive-current-and-predicted-source-overlap";
  /** Friction requires an explicit bounded slipping model, never a weld. */
  frictionFit: boolean;
  /** Coincident source-derived anchors; native bearing is conditional, not
   * a permanent attachment after the actual shaft leaves this bore. */
  native: Readonly<{
    bodyA: string;
    bodyB: string;
    kind: "cylindrical";
    anchorA: Vec3;
    anchorB: Vec3;
    axisA: Vec3;
    axisB: Vec3;
  }>;
}>;
export type WinchCarrierPlan = Readonly<{
  kind: "42042-articulated-winch";
  /** Every literal member stays a separate body until a rigid proof exists. */
  bodies: readonly Readonly<{ occurrenceId: string; frame: Transform }>[];
  mountHolderIds: readonly string[];
  bearings: readonly WinchSourceBearing[];
  heads: readonly Readonly<{
    shaftId: string;
    supportId: string;
    lowerLdu: 0;
    upperLdu: null;
  }>[];
  worm: Readonly<{ inputId: string; outputId: string; ratio: number }>;
  /** Each one-port row measures shaft twist relative to its own real bore
   * body and returns equal/opposite torque there. No fictional common case. */
  keyRows: readonly Readonly<{
    bearingIndex: number;
    bodyId: string;
    carrierId: string;
    maxTorqueNm: 10;
  }>[];
  ordinaryAdmission: false;
}>;
const plans = new WeakSet<WinchCarrierPlan>();
export const isWinchCarrierPlan = (value: unknown): value is WinchCarrierPlan =>
  !!value && typeof value === "object" && plans.has(value as WinchCarrierPlan);
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const sub = (a: Vec3, b: Vec3) => a.map((n, i) => n - b[i]) as Vec3;
const freezePort = (
  o: Occurrence,
  feature: string,
  center: Vec3,
  axis: Vec3,
  span: Span,
): Port => {
  const frame = orthonormalized(o.transform);
  return Object.freeze({
    occurrenceId: o.id,
    feature,
    center: Object.freeze(
      add(frame.position, mv(frame.basis, center)),
    ) as unknown as Vec3,
    axis: Object.freeze(mv(frame.basis, axis)) as unknown as Vec3,
    spanLdu: Object.freeze([...span]) as unknown as Span,
  });
};

/** Literal pin/key interfaces from Philo's42042 first winch and root mounts.
 * This graph proves source connections, not a rigid MPD ownership weld or
 * an ordinary Play admission token. Source slots/ribs/catches stay geometry. */
export function winchCarrierPlan(
  worm: Occurrence,
  all: readonly Occurrence[],
  binding: WinchCarrierBinding,
): WinchCarrierPlan {
  const retained = bindings.get(binding);
  ensure(
    retained && all.length <= RESOURCE_PROFILES.desktop.occurrences,
    "INVALID_INPUT",
    "Use a bounded actual winch carrier source binding.",
  );
  const frame = orthonormalized(worm.transform),
    inv = inverse(frame);
  // The imported occurrence index can include thousands of rope render
  // segments. This linear metadata pass observes the existing import ceiling;
  // ONLY the <=512 reviewed-family candidates proceed to connection review.
  // It allocates no physics for the rest and raises no native/member budget.
  const allowed = new Set(binding.refs),
    nearby = all.filter(
      (o) =>
        o.namespace === "official" &&
        o.node.kind === "part" &&
        allowed.has(o.node.ref) &&
        nearlyPhysical(o.transform) &&
        Math.hypot(...compose(inv, orthonormalized(o.transform)).position) <
          300,
    );
  ensure(
    nearby.length <= 512,
    "RESOURCE_LIMIT",
    "Too many source candidates for the winch review.",
  );
  const review = winchRetention(worm, nearby, retained);
  const seat = (ref: string, position: Vec3, basis: Transform["basis"]) => {
    const matches = nearby.filter((o) => {
      if (
        o.namespace !== "official" ||
        o.node.kind !== "part" ||
        o.node.ref !== ref
      )
        return false;
      const local = compose(inv, orthonormalized(o.transform));
      return (
        Math.hypot(...sub(local.position, position)) <= 1e-6 &&
        local.basis.every((n, i) => Math.abs(n - basis[i]) <= 1e-6)
      );
    });
    ensure(
      matches.length === 1,
      "INVALID_INPUT",
      "Missing/displaced/ambiguous mounted winch source seat: " + ref,
    );
    return matches[0];
  };
  const rootLong = seat(
      "40490.dat",
      [20, -40, 50],
      [0, 1, 0, 0, 0, 1, 1, 0, 0],
    ),
    rootBent = seat("32140.dat", [20, 20, 70], [0, 1, 0, -1, 0, 0, 0, 0, 1]),
    selected = nearby.filter((o) => review.sourceMembers.includes(o.id)),
    part = (ref: string, position: Vec3) => {
      const found = selected.filter(
        (o) =>
          o.node.ref === ref &&
          Math.hypot(
            ...sub(
              compose(inv, orthonormalized(o.transform)).position,
              position,
            ),
          ) <= 1e-6,
      );
      ensure(
        found.length === 1,
        "INVALID_INPUT",
        "Missing literal winch interface member: " + ref,
      );
      return found[0];
    },
    bearings: WinchSourceBearing[] = [];
  const connect = (
    a: Port,
    b: Port,
    kind: "round" | "keyed",
    frictionFit = false,
  ) => {
    const delta = sub(b.center, a.center),
      station = dot(delta, a.axis),
      sign = dot(a.axis, b.axis),
      boreSpan = b.spanLdu.map((s) => station + sign * s).sort((a, b) => a - b),
      engagementLdu =
        Math.min(a.spanLdu[1], boreSpan[1]) -
        Math.max(a.spanLdu[0], boreSpan[0]);
    ensure(
      Math.abs(Math.abs(sign) - 1) <= 1e-6 &&
        Math.hypot(...sub(delta, a.axis.map((n) => n * station) as Vec3)) <=
          1e-6 &&
        engagementLdu > 0,
      "INVALID_INPUT",
      "Winch source ports are not coaxial with positive engagement.",
    );
    const world = add(
        a.center,
        a.axis.map(
          (n) =>
            (n *
              (Math.max(a.spanLdu[0], boreSpan[0]) +
                Math.min(a.spanLdu[1], boreSpan[1]))) /
            2,
        ) as Vec3,
      ),
      shaftFrame = orthonormalized(
        nearby.find((o) => o.id === a.occurrenceId)!.transform,
      ),
      boreFrame = orthonormalized(
        nearby.find((o) => o.id === b.occurrenceId)!.transform,
      ),
      invA = inverse(boreFrame),
      invB = inverse(shaftFrame),
      frozen = (v: Vec3) => Object.freeze(v) as unknown as Vec3,
      native = Object.freeze({
        bodyA: b.occurrenceId,
        bodyB: a.occurrenceId,
        kind: "cylindrical" as const,
        anchorA: frozen(add(invA.position, mv(invA.basis, world))),
        anchorB: frozen(add(invB.position, mv(invB.basis, world))),
        axisA: frozen(mv(invA.basis, a.axis)),
        axisB: frozen(mv(invB.basis, a.axis)),
      });
    bearings.push(
      Object.freeze({
        shaft: a,
        bore: b,
        kind,
        engagementLdu,
        axialFreedom: true,
        activeWhen: "positive-current-and-predicted-source-overlap",
        frictionFit,
        native,
      }),
    );
  };
  const axle = (o: Occurrence, span: Span) =>
      freezePort(o, "literal cross axle", [0, 0, 0], [1, 0, 0], span),
    bore = (o: Occurrence, p: Vec3, axis: Vec3, span: Span, feature: string) =>
      freezePort(o, feature, p, axis, span),
    beams = [-25, -15, 15, 25].map((x) => part("32449.dat", [x, 20, 0])),
    blocks = [-30, 30].map((z) => part("6536.dat", [0, 20, z])),
    stops = [-30, 30].map((z) => part("87083.dat", [8, 20, z])),
    input = selected.find((o) => o.id === review.input.shaftId)!,
    output = selected.find((o) => o.id === review.output.shaftId)!,
    gear = selected.find((o) => o.id === review.output.keyedTo)!;
  for (const [i, stop] of stops.entries()) {
    const shaft = axle(stop, [-37.5, 38]);
    for (const beam of beams)
      connect(
        shaft,
        bore(beam, [0, 0, [-30, 30][i]], [0, 1, 0], [-5, 5], "32449 axlehol4"),
        "keyed",
      );
    connect(
      shaft,
      bore(
        blocks[i],
        [0, 0, 0],
        [1, 0, 0],
        [-10, 10],
        "6536 bush0 keyed X bore",
      ),
      "keyed",
    );
  }
  const inputPort = axle(input, [-47.5, 48]),
    outputPort = axle(output, [-97.5, 97.5]);
  connect(
    inputPort,
    bore(worm, [0, 0, 0], [0, 0, 1], [-20, 20], "4716 intrinsic keyed column"),
    "keyed",
  );
  connect(
    outputPort,
    bore(gear, [0, 0, 0], [0, 0, 1], [-10, 10], "10928 intrinsic keyed column"),
    "keyed",
  );
  for (const block of blocks)
    connect(
      inputPort,
      bore(block, [0, 20, 0], [0, 0, 1], [-10, 10], "6536 round R6 core"),
      "round",
    );
  for (const beam of beams)
    connect(
      outputPort,
      bore(beam, [0, 0, 10], [0, 1, 0], [-5, 5], "32449 beamhol2 round core"),
      "round",
    );
  const mounting = part("32525.dat", [40, 20, -10]),
    pin = part("2780.dat", [30, 20, -10]),
    t = part("60484.dat", [60, 20, 90]);
  const pinPort = freezePort(
    pin,
    "2780 opposed confric5 halves",
    [0, 0, 0],
    [1, 0, 0],
    [-20, 20],
  );
  for (const beam of beams.slice(2))
    connect(
      pinPort,
      bore(beam, [0, 0, -10], [0, 1, 0], [-5, 5], "32449 peghole round core"),
      "round",
      true,
    );
  connect(
    pinPort,
    bore(mounting, [0, 0, 0], [0, 1, 0], [-10, 10], "32525 beamhole"),
    "round",
    true,
  );
  for (const z of [50, 90]) {
    const pin = part("6558.dat", [40, 20, z]),
      p = freezePort(
        pin,
        "6558 source long/short pin",
        [0, 0, 0],
        [1, 0, 0],
        [-30, 30],
      );
    connect(
      p,
      bore(mounting, [0, 0, z + 10], [0, 1, 0], [-10, 10], "32525 beamhole"),
      "round",
      true,
    );
    connect(
      p,
      bore(
        t,
        [0, 0, z === 90 ? 0 : 40],
        [0, 1, 0],
        [-10, 10],
        "60484 actual pin hole",
      ),
      "round",
      true,
    );
    const root = z === 50 ? rootLong : rootBent;
    connect(
      p,
      bore(
        root,
        [0, 0, z === 50 ? 60 : 20],
        [0, 1, 0],
        [-10, 10],
        "actual root mount hole",
      ),
      "round",
      true,
    );
  }
  // The remaining keyed accessories also retain their own axial degrees of
  // freedom. No bush, pulley, joiner or round drum is absorbed into a shaft.
  for (const o of selected.filter((o) =>
    ["32123a.dat", "4185.dat"].includes(o.node.ref),
  ))
    connect(
      outputPort,
      bore(o, [0, 0, 0], [0, 0, 1], [-5, 5], "literal keyed accessory bore"),
      "keyed",
      true,
    );
  const sleeve = selected.find((o) => o.id === review.output.roundSleeveId)!;
  for (const span of [
    [-18, -2],
    [2, 18],
  ] as const)
    connect(
      outputPort,
      bore(sleeve, [0, 0, 0], [1, 0, 0], span, "62462 separate round R6 half"),
      "round",
    );
  const joiner = selected.find((o) => o.id === review.input.joinerId)!,
    shaft3 = part("4519.dat", [0, 0, -110]);
  connect(
    inputPort,
    bore(joiner, [0, 0, 0], [0, 0, 1], [2, 29.5], "18948 positive keyed half"),
    "keyed",
  );
  connect(
    axle(shaft3, [-27.5, 27.5]),
    bore(
      joiner,
      [0, 0, 0],
      [0, 0, 1],
      [-29.5, -2],
      "18948 negative keyed half",
    ),
    "keyed",
  );
  const axlePin = part("11214.dat", [40, 20, -110]);
  connect(
    freezePort(axlePin, "11214 confric3 pin", [0, 0, 0], [1, 0, 0], [-30, 10]),
    bore(mounting, [0, 0, -100], [0, 1, 0], [-10, 10], "32525 end peghole"),
    "round",
    true,
  );
  const members = [...selected, rootLong, rootBent];
  ensure(
    members.length === 29 && new Set(members.map((o) => o.id)).size === 29,
    "INVALID_INPUT",
    "Winch source body roster overlaps.",
  );
  const bodies = members.map((o) => {
      const frame = structuredClone(o.transform);
      Object.freeze(frame.position);
      Object.freeze(frame.basis);
      return Object.freeze({ occurrenceId: o.id, frame: Object.freeze(frame) });
    }),
    plan: WinchCarrierPlan = Object.freeze({
      kind: "42042-articulated-winch",
      bodies: Object.freeze(bodies),
      mountHolderIds: Object.freeze([rootLong.id, rootBent.id]),
      bearings: Object.freeze(bearings),
      heads: Object.freeze([
        ...stops.map((s) =>
          Object.freeze({
            shaftId: s.id,
            supportId: beams[0].id,
            lowerLdu: 0 as const,
            upperLdu: null,
          }),
        ),
        Object.freeze({
          shaftId: input.id,
          supportId: review.input.stopSupportId,
          lowerLdu: 0 as const,
          upperLdu: null,
        }),
      ]),
      worm: Object.freeze({
        inputId: worm.id,
        outputId: gear.id,
        ratio: 1 / 8,
      }),
      keyRows: Object.freeze(
        bearings.flatMap((b, bearingIndex) =>
          b.kind === "keyed"
            ? [
                Object.freeze({
                  bearingIndex,
                  bodyId: b.shaft.occurrenceId,
                  carrierId: b.bore.occurrenceId,
                  maxTorqueNm: 10 as const,
                }),
              ]
            : [],
        ),
      ),
      ordinaryAdmission: false,
    });
  plans.add(plan);
  return plan;
}
