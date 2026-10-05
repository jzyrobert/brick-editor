import { occurrences } from "../core/document";
import {
  add,
  inverse,
  mv,
  nearlyPhysical,
  orthonormalized,
} from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import type { PlayMechanismSource } from "./mechanism";
import type { PlayMemberLocalGeometry } from "./types";
import { reviewedGeometryDigest } from "./reviewed-geometry-binding";

export type ArocsBallRestDeclaration = Readonly<{
  profile: "arocs-ball-native-seat-v1";
  ballOccurrenceId: string;
  socketOccurrenceId: string;
  socketEndpoint: 0 | 1;
}>;
type Packet =
  (typeof import("./generated/arocs-ball-contacts.json"))["packets"][number];
type Member = Readonly<{
  id: string;
  groupId: string;
  frame: Transform;
  anchor: Vec3;
  local: PlayMemberLocalGeometry;
  vertices: Float64Array;
  indices: Uint32Array;
  authoredFrame: string;
  packet: Packet;
}>;
export type PreparedArocsBallRest = Readonly<{
  jointId: string;
  initialGapLdu: number;
  childCount: number;
}>;
type Sealed = Readonly<{
  source: PlayMechanismSource;
  revision: number;
  state: string;
  ball: Member;
  socket: Member;
  endpoint: 0 | 1;
}>;
const seals = new WeakMap<PreparedArocsBallRest, Sealed>();
const failure =
  "This ball assembly needs its reviewed source parts and actual anchors.";
const point = (f: Transform, p: Vec3) => add(f.position, mv(f.basis, p));
const gap = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, k) => v - b[k]));
export const AROCS_BALL_SEATING_LIMITS = Object.freeze({
  // A construction limit for the observed noncoincident 6628/32005 source
  // pairs, NOT a free-clearance claim or a proximity connection search.
  initialGapLdu: 2.05,
  ticks: 240,
  stableTicks: 30,
  readyGapLdu: 0.01,
  ordinaryGapLdu: 0.05,
  relativeSpeedMetres: 0.001,
});

/** Independent native-rest preflight. A descriptor declares a requirement;
 * successful preflight grants neither product eligibility nor ready controls. */
export async function prepareArocsBallRest(
  source: PlayMechanismSource,
): Promise<readonly PreparedArocsBallRest[]> {
  const rig = source.project.motionRigs[source.rigId];
  ensure(
    rig &&
      rig.groups.length <= 64 &&
      rig.joints.length <= 64 &&
      rig.groups.reduce((n, g) => n + g.occurrenceIds.length, 0) <= 512,
    "INVALID_INPUT",
    failure,
  );
  const revision = source.project.revision,
    state = JSON.stringify(rig),
    lookup = new Map(occurrences(source.project).map((o) => [o.id, o])),
    declarations = rig.joints.flatMap((j) => {
      const d = (j as unknown as { restAssembly?: ArocsBallRestDeclaration })
        .restAssembly;
      if (d === undefined) return [];
      ensure(
        j.kind === "spherical" &&
          j.motor === undefined &&
          j.mating === undefined &&
          d !== null &&
          typeof d === "object" &&
          !Array.isArray(d) &&
          Object.keys(d).length === 4 &&
          d.profile === "arocs-ball-native-seat-v1" &&
          typeof d.ballOccurrenceId === "string" &&
          typeof d.socketOccurrenceId === "string" &&
          (d.socketEndpoint === 0 || d.socketEndpoint === 1),
        "INVALID_INPUT",
        failure,
      );
      return [{ joint: j, declaration: d }];
    });
  if (!declarations.length) return [];
  ensure(
    !rig.transmissions?.length &&
      declarations.length === 1 &&
      rig.joints.length === 1 &&
      rig.groups.length === 2 &&
      !rig.loopClosures?.length,
    "INVALID_INPUT",
    failure,
  );
  const data = await import("./generated/arocs-ball-contacts.json"),
    packets = new Map(data.packets.map((p) => [p.ref, p])),
    shadow = new Set(
      Object.entries(source.project.models)
        .flatMap(([id, m]) => [id, m.name])
        .map((n) => n.toLowerCase().replaceAll("\\", "/")),
    ),
    used = new Set<string>(),
    result: PreparedArocsBallRest[] = [];
  let children = 0;
  for (const { joint, declaration: d } of declarations) {
    const members: Member[] = [];
    for (const [id, ref, center] of [
      [d.ballOccurrenceId, "6628.dat", [-10, 0, 0]],
      [d.socketOccurrenceId, "32005.dat", [0, 0, d.socketEndpoint * 100]],
    ] as const) {
      const o = lookup.get(id),
        group = rig.groups.find((g) => g.occurrenceIds.includes(id)),
        local = source.memberLocals?.[id],
        packet = packets.get(ref);
      ensure(
        o?.namespace === "official" &&
          o.node.ref === ref &&
          group &&
          // This first native seating package owns complete two-body occurrences.
          // Compound carriers remain refused until their complete ownership is wired.
          group.occurrenceIds.length === 1 &&
          (group.id === joint.bodyA || group.id === joint.bodyB) &&
          nearlyPhysical(o.transform) &&
          local &&
          packet &&
          !local.unsupported &&
          local.namespace === "official" &&
          local.occurrenceId === id &&
          local.revision === revision &&
          JSON.stringify(local.frame) === JSON.stringify(o.transform) &&
          packet.dependencies.every((dep) => !shadow.has(dep)),
        "INVALID_INPUT",
        failure,
      );
      const frame = orthonormalized(o.transform),
        anchor = (
          group.id === joint.bodyA ? joint.anchorA : joint.anchorB
        ) as Vec3;
      ensure(
        Array.isArray(anchor) &&
          anchor.length === 3 &&
          anchor.every(Number.isFinite),
        "INVALID_INPUT",
        failure,
      );
      ensure(
        gap(point(group.frame, anchor), point(frame, [...center])) <= 1e-5,
        "INVALID_INPUT",
        "Native seating must retain both actual source anchors.",
      );
      ensure(
        (await reviewedGeometryDigest(local)) === packet.canonicalSurfaceSha256,
        "INVALID_INPUT",
        failure,
      );
      const nativeAnchor = point(inverse(frame), point(group.frame, anchor));
      Object.freeze(frame.position);
      Object.freeze(frame.basis);
      Object.freeze(frame);
      Object.freeze(nativeAnchor);
      for (const c of packet.classes) {
        for (const piece of c.pieces) {
          for (const p of piece) Object.freeze(p);
          Object.freeze(piece);
        }
        Object.freeze(c.pieces);
        Object.freeze(c);
      }
      Object.freeze(packet.classes);
      Object.freeze(packet.dependencies);
      Object.freeze(packet);
      members.push(
        Object.freeze({
          id,
          groupId: group.id,
          frame,
          anchor: nativeAnchor,
          local,
          packet,
          vertices: local.vertices,
          indices: local.indices,
          authoredFrame: JSON.stringify(o.transform),
        }),
      );
    }
    const [ball, socket] = members;
    ensure(
      ball.groupId !== socket.groupId &&
        !used.has(ball.id) &&
        !used.has(`${socket.id}:${d.socketEndpoint}`),
      "INVALID_INPUT",
      failure,
    );
    used.add(ball.id);
    used.add(`${socket.id}:${d.socketEndpoint}`);
    const initialGapLdu = gap(
      point(ball.frame, ball.anchor),
      point(socket.frame, socket.anchor),
    );
    ensure(
      initialGapLdu > 1e-5 &&
        initialGapLdu <= AROCS_BALL_SEATING_LIMITS.initialGapLdu,
      "INVALID_INPUT",
      "The declared source ball assembly is outside the reviewed seating range.",
    );
    const childCount = ball.packet.childCount + socket.packet.childCount;
    children += childCount;
    ensure(
      children <= 4096,
      "LIMIT_EXCEEDED",
      "This mechanism is too complex to check safely. Try fewer moving parts.",
    );
    const prepared = Object.freeze({
      jointId: joint.id,
      initialGapLdu,
      childCount,
    });
    seals.set(
      prepared,
      Object.freeze({
        source,
        revision,
        state,
        ball,
        socket,
        endpoint: d.socketEndpoint,
      }),
    );
    result.push(prepared);
  }
  for (const prepared of result) readPreparedArocsBallRest(prepared);
  return Object.freeze(result);
}

/** Read-only compiler handoff. Forged tokens, edits and buffer replacements fail. */
export function readPreparedArocsBallRest(
  prepared: PreparedArocsBallRest,
): Sealed {
  const s = seals.get(prepared);
  ensure(
    s,
    "INVALID_INPUT",
    "Native ball seating requires verified source preflight.",
  );
  ensure(
    s.source.project.revision === s.revision &&
      JSON.stringify(s.source.project.motionRigs[s.source.rigId]) === s.state,
    "REVISION_CONFLICT",
    "The build changed after its native assembly was checked.",
  );
  const actual = new Map(occurrences(s.source.project).map((o) => [o.id, o]));
  for (const m of [s.ball, s.socket]) {
    const o = actual.get(m.id);
    ensure(
      s.source.memberLocals?.[m.id] === m.local &&
        m.local.revision === s.revision &&
        m.local.vertices === m.vertices &&
        m.local.indices === m.indices &&
        JSON.stringify(m.local.frame) === m.authoredFrame &&
        o?.namespace === "official" &&
        o.node.ref === m.packet.ref &&
        JSON.stringify(o.transform) === m.authoredFrame,
      "REVISION_CONFLICT",
      "Native assembly geometry changed after preflight.",
    );
  }
  return s;
}
