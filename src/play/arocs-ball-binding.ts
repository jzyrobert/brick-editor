import { occurrences } from "../core/document";
import { add, mv, nearlyPhysical, orthonormalized } from "../core/math";
import { ensure, type Transform, type Vec3 } from "../core/types";
import type { RigidGroup } from "../mechanisms/types";
import type { PlayMechanismSource } from "./mechanism";
import type { PlayMemberLocalGeometry } from "./types";
import { reviewedGeometryDigest } from "./reviewed-geometry-binding";

type Packet = {
  ref: string;
  canonicalSurfaceSha256: string;
  dependencies: string[];
  classes: Array<{ id: string; endpoint?: number; pieces: Vec3[][] }>;
  childCount: number;
};
type Member = {
  local: PlayMemberLocalGeometry;
  vertices: Float64Array;
  indices: Uint32Array;
  frame: string;
  packet: Packet;
};
type Pair = {
  jointId: string;
  ball: string;
  socket: string;
  ballGroup: string;
  socketGroup: string;
  ballAnchor: Vec3;
  socketAnchor: Vec3;
  endpoint: number;
};
type Binding = {
  revision: number;
  rig: string;
  members: Map<string, Member>;
  pairs: Pair[];
};
const bindings = new WeakMap<PlayMechanismSource, Binding>();
const message =
  "This ball joint needs matching reviewed parts and seated anchors to move safely.";
const point = (f: Transform, p: Vec3) => add(f.position, mv(f.basis, p));
const gap = (a: Vec3, b: Vec3) => Math.hypot(...a.map((v, k) => v - b[k]));
const candidates = (source: PlayMechanismSource) => {
  const rig = source.project.motionRigs[source.rigId];
  ensure(
    rig,
    "INVALID_INPUT",
    "Moving geometry requires an existing mechanism",
  );
  ensure(
    rig.groups.length <= 64 &&
      rig.joints.length <= 64 &&
      rig.groups.reduce((n, g) => n + g.occurrenceIds.length, 0) <= 512,
    "LIMIT_EXCEEDED",
    "This mechanism is too complex to check safely. Try fewer moving parts.",
  );
  let work = 0;
  const lookup =
    source.lookup ?? new Map(occurrences(source.project).map((o) => [o.id, o]));
  const pairs: Pair[] = [];
  for (const joint of rig.joints) {
    if (joint.kind !== "spherical") continue;
    const a = rig.groups.find((g) => g.id === joint.bodyA)!,
      b = rig.groups.find((g) => g.id === joint.bodyB)!;
    if (!a || !b) continue;
    for (const [ballGroup, socketGroup, ballAnchor, socketAnchor] of [
      [a, b, joint.anchorA, joint.anchorB],
      [b, a, joint.anchorB, joint.anchorA],
    ] as const) {
      for (const ball of ballGroup.occurrenceIds)
        for (const socket of socketGroup.occurrenceIds) {
          ensure(
            ++work <= 100000,
            "LIMIT_EXCEEDED",
            "This mechanism is too complex to check safely. Try fewer moving parts.",
          );
          const bo = lookup.get(ball),
            so = lookup.get(socket);
          if (
            bo?.namespace !== "official" ||
            so?.namespace !== "official" ||
            bo.node.ref !== "6628.dat" ||
            so.node.ref !== "32005.dat"
          )
            continue;
          ensure(
            nearlyPhysical(bo.transform) && nearlyPhysical(so.transform),
            "INVALID_INPUT",
            message,
          );
          const bf = orthonormalized(bo.transform),
            sf = orthonormalized(so.transform),
            bp = point(bf, [-10, 0, 0]);
          const endpoint = [0, 1].find(
            (e) =>
              gap(
                point(socketGroup.frame, socketAnchor),
                point(sf, [0, 0, e * 100]),
              ) <= 1e-5,
          );
          if (
            endpoint === undefined ||
            gap(point(ballGroup.frame, ballAnchor), bp) > 1e-5
          )
            continue;
          ensure(
            gap(bp, point(sf, [0, 0, endpoint * 100])) <= 1e-5,
            "INVALID_INPUT",
            message,
          );
          pairs.push({
            jointId: joint.id,
            ball,
            socket,
            ballGroup: ballGroup.id,
            socketGroup: socketGroup.id,
            ballAnchor: [...ballAnchor],
            socketAnchor: [...socketAnchor],
            endpoint,
          });
        }
    }
  }
  ensure(
    pairs.length <= 64,
    "LIMIT_EXCEEDED",
    "Too many ball joints to check safely.",
  );
  const used = new Set<string>();
  for (const pair of pairs) {
    ensure(
      !used.has(pair.ball) && !used.has(`${pair.socket}:${pair.endpoint}`),
      "INVALID_INPUT",
      "A ball or socket cannot belong to two bearings.",
    );
    used.add(pair.ball);
    used.add(`${pair.socket}:${pair.endpoint}`);
  }
  return { rig, lookup, pairs };
};
/** Preflight is source-bound and completes before allocating a native world.
 * Only the reviewed6628/32005 seated spherical pair obtains this profile. */
export async function loadArocsBallContacts(
  sources: readonly PlayMechanismSource[],
): Promise<void> {
  ensure(
    sources.length <= 32,
    "LIMIT_EXCEEDED",
    "Too many moving mechanisms to check safely.",
  );
  const requests = sources
    .map((source) => ({
      source,
      revision: source.project.revision,
      rigState: JSON.stringify(source.project.motionRigs[source.rigId]),
      ...candidates(source),
    }))
    .filter((r) => r.pairs.length);
  if (!requests.length) return;
  const data = await import("./generated/arocs-ball-contacts.json");
  ensure(data.version === 1, "INVALID_INPUT", message);
  const packets = new Map(
    (data.packets as unknown as Packet[]).map((p) => [p.ref, p]),
  );
  const pending: Array<[PlayMechanismSource, Binding]> = [];
  let children = 0,
    membersCount = 0;
  const hashes = new WeakMap<PlayMemberLocalGeometry, Promise<string>>();
  for (const { source, revision, rigState, lookup, pairs } of requests) {
    const members = new Map<string, Member>(),
      shadows = new Set(
        Object.entries(source.project.models)
          .flatMap(([id, m]) => [id, m.name])
          .map((n) => n.toLowerCase().replaceAll("\\", "/")),
      );
    for (const id of new Set(pairs.flatMap((p) => [p.ball, p.socket]))) {
      const o = lookup.get(id)!,
        local = source.memberLocals?.[id],
        packet = packets.get(o.node.ref)!;
      ensure(
        local &&
          packet &&
          !local.unsupported &&
          local.namespace === "official" &&
          local.occurrenceId === id &&
          local.revision === source.project.revision &&
          JSON.stringify(local.frame) === JSON.stringify(o.transform),
        "INVALID_INPUT",
        message,
      );
      ensure(
        packet.dependencies.every((ref) => !shadows.has(ref)),
        "INVALID_INPUT",
        "Project definitions replace a reviewed ball-joint dependency.",
      );
      children += packet.childCount;
      membersCount++;
      ensure(
        children <= 4096 && membersCount <= 512,
        "LIMIT_EXCEEDED",
        "This mechanism is too complex to check safely. Try fewer moving parts.",
      );
      let digest = hashes.get(local);
      if (!digest) {
        digest = reviewedGeometryDigest(local);
        hashes.set(local, digest);
      }
      ensure(
        (await digest) === packet.canonicalSurfaceSha256,
        "INVALID_INPUT",
        message,
      );
      ensure(
        source.memberLocals?.[id] === local &&
          local.revision === revision &&
          source.project.revision === revision &&
          JSON.stringify(source.project.motionRigs[source.rigId]) ===
            rigState &&
          JSON.stringify(local.frame) === JSON.stringify(o.transform),
        "REVISION_CONFLICT",
        "The build changed while its ball joints were loading.",
      );
      members.set(id, {
        local,
        vertices: local.vertices,
        indices: local.indices,
        frame: JSON.stringify(o.transform),
        packet,
      });
    }
    pending.push([
      source,
      {
        revision,
        rig: rigState,
        members,
        pairs,
      },
    ]);
  }
  for (const [source, binding] of pending) {
    ensure(
      source.project.revision === binding.revision &&
        JSON.stringify(source.project.motionRigs[source.rigId]) === binding.rig,
      "REVISION_CONFLICT",
      "The build changed while its ball joints were loading.",
    );
  }
  for (const [source, binding] of pending) {
    for (const pair of binding.pairs) {
      Object.freeze(pair.ballAnchor);
      Object.freeze(pair.socketAnchor);
      Object.freeze(pair);
    }
    Object.freeze(binding.pairs);
    for (const member of binding.members.values()) {
      for (const c of member.packet.classes) {
        for (const piece of c.pieces) {
          for (const p of piece) Object.freeze(p);
          Object.freeze(piece);
        }
        Object.freeze(c.pieces);
        Object.freeze(c);
      }
      Object.freeze(member.packet.classes);
      Object.freeze(member.packet.dependencies);
      Object.freeze(member.packet);
      Object.freeze(member);
    }
    Object.freeze(binding);
    bindings.set(source, binding);
  }
}
function bindingOf(source: PlayMechanismSource): Binding | undefined {
  const bound = bindings.get(source);
  if (!bound) return;
  ensure(
    bound.revision === source.project.revision &&
      bound.rig === JSON.stringify(source.project.motionRigs[source.rigId]),
    "REVISION_CONFLICT",
    "The build changed after its ball joints were checked.",
  );
  return bound;
}
/** Verified read-only geometry for the separate lazy native compiler. */
export function boundArocsBallMember(
  source: PlayMechanismSource,
  group: RigidGroup,
  id: string,
): Readonly<Member> | undefined {
  const bound = bindingOf(source),
    member = bound?.members.get(id);
  if (!member) {
    ensure(
      !candidates(source).pairs.some((p) => p.ball === id || p.socket === id),
      "INVALID_INPUT",
      message,
    );
    return;
  }
  ensure(
    JSON.stringify(
      source.project.motionRigs[source.rigId].groups.find(
        (g) => g.id === group.id,
      ),
    ) === JSON.stringify(group) && group.occurrenceIds.includes(id),
    "INVALID_INPUT",
    "A ball cover must belong to its checked source body.",
  );
  const local = source.memberLocals?.[id],
    o = (
      source.lookup ??
      new Map(occurrences(source.project).map((o) => [o.id, o]))
    ).get(id);
  ensure(
    local === member.local &&
      local.vertices === member.vertices &&
      local.indices === member.indices &&
      local.revision === bound!.revision &&
      o?.namespace === "official" &&
      JSON.stringify(o.transform) === member.frame &&
      JSON.stringify(local.frame) === member.frame,
    "REVISION_CONFLICT",
    "The ball-joint geometry changed after preflight.",
  );
  return member;
}
/** Read-only exact source pairs; no caller can publish admission metadata. */
export function boundArocsBallPairs(
  source: PlayMechanismSource,
): readonly Readonly<Pair>[] {
  return bindingOf(source)?.pairs ?? [];
}

/** Eligibility reads this lightweight seal without loading native physics. */
export function arocsBallJointIds(
  source: PlayMechanismSource,
): readonly string[] {
  return boundArocsBallPairs(source).map((p) => p.jointId);
}
