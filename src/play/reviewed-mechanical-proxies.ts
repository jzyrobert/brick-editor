import { occurrences } from "../core/document";
import { ensure } from "../core/types";
import type { PlayMechanismSource } from "./mechanism";
import type { PlayMemberLocalGeometry } from "./types";
import type { ReviewedConvexRegion } from "./reviewed-convex-packet";
import { reviewedGeometryDigest } from "./reviewed-geometry-binding";

export type ReviewedProxyPacket = {
  version: 1;
  derivation: string;
  source: {
    ref: string;
    canonicalSurfaceSha256: string;
    author: string;
    license: string;
  };
  regionInputSha256: string;
  regionCount: number;
  childCount: number;
  regions: ReviewedConvexRegion[];
};
type BoundMember = {
  packet: ReviewedProxyPacket;
  local: PlayMemberLocalGeometry;
  vertices: Float64Array;
  indices: Uint32Array;
  frame: string;
  ref: string;
};
const bindings = new WeakMap<
  PlayMechanismSource,
  {
    revision: number;
    members: Map<string, BoundMember>;
  }
>();
const refs = new Set(["18940.dat", "18942.dat"]);
const reason =
  "This rack needs matching reviewed geometry to move safely. Reload its original parts and try again.";

/** Bind lazy reviewed data to actual captured occurrence geometry before WASM
 * or worlds are allocated. This does not grant physical Play acceptance.
 * Canonical capture buffers are read-only by their producer contract. */
export async function loadReviewedMechanicalProxies(
  sources: readonly PlayMechanismSource[],
): Promise<void> {
  const requests: Array<{
    source: PlayMechanismSource;
    id: string;
    ref: string;
    local: PlayMemberLocalGeometry;
  }> = [];
  for (const source of sources) {
    const lookup =
      source.lookup ??
      new Map(occurrences(source.project).map((o) => [o.id, o]));
    const rig = source.project.motionRigs[source.rigId];
    ensure(
      rig,
      "INVALID_INPUT",
      "Moving geometry requires an existing mechanism",
    );
    for (const group of rig.groups)
      for (const id of group.occurrenceIds) {
        const occurrence = lookup.get(id),
          ref = occurrence?.node.ref.toLowerCase();
        if (!ref || !refs.has(ref)) continue;
        const local = source.memberLocals?.[id];
        ensure(
          local &&
            !local.unsupported &&
            local.revision === source.project.revision &&
            local.occurrenceId === id &&
            JSON.stringify(local.frame) ===
              JSON.stringify(occurrence!.transform),
          "INVALID_INPUT",
          reason,
        );
        requests.push({ source, id, ref, local });
        ensure(
          requests.length <= 512,
          "LIMIT_EXCEEDED",
          "This mechanism is too complex to check safely. Try fewer moving parts.",
        );
      }
  }
  if (!requests.length) return;
  const { reviewedRackPackets } = await import("./reviewed-rack-data");
  const packets = new Map(reviewedRackPackets.map((p) => [p.source.ref, p]));
  const pending = new Map<PlayMechanismSource, Map<string, BoundMember>>();
  // Cache only within this request and by actual captured record identity.
  const hashes = new WeakMap<PlayMemberLocalGeometry, Promise<string>>();
  for (const request of requests) {
    const { source, id, ref, local } = request,
      packet = packets.get(ref);
    ensure(
      packet?.version === 1 &&
        packet.regionCount === packet.regions.length &&
        packet.childCount <= 4096,
      "INVALID_INPUT",
      "Reviewed geometry is unavailable. Reload Play and try again.",
    );
    let digest = hashes.get(local);
    if (!digest) {
      digest = reviewedGeometryDigest(local);
      hashes.set(local, digest);
    }
    ensure(
      (await digest) === packet.source.canonicalSurfaceSha256,
      "INVALID_INPUT",
      reason,
      { occurrenceId: id, ref, stage: "reviewedGeometryBinding" },
    );
    // Recheck after the asynchronous hash; publish only complete sources.
    ensure(
      source.memberLocals?.[id] === local &&
        local.revision === source.project.revision,
      "REVISION_CONFLICT",
      "The build changed while its moving geometry was loading. Try Play again.",
    );
    const members = pending.get(source) ?? new Map<string, BoundMember>();
    members.set(id, {
      packet,
      local,
      vertices: local.vertices,
      indices: local.indices,
      frame: JSON.stringify(local.frame),
      ref,
    });
    pending.set(source, members);
  }
  for (const [source, members] of pending)
    bindings.set(source, { revision: source.project.revision, members });
}

/** Synchronous consumer requires the exact preflight source/capture identities;
 * missing preflight never falls back to a filled or thin-surface rack proxy. */
export function reviewedMechanicalMember(
  source: PlayMechanismSource,
  id: string,
): ReviewedProxyPacket | undefined {
  const entry = bindings.get(source),
    member = entry?.members.get(id);
  if (!member) return undefined;
  const local = source.memberLocals?.[id];
  ensure(
    entry!.revision === source.project.revision &&
      local === member.local &&
      local.vertices === member.vertices &&
      local.indices === member.indices &&
      local.revision === source.project.revision &&
      JSON.stringify(local.frame) === member.frame,
    "REVISION_CONFLICT",
    "The build changed after its moving geometry was checked. Try Play again.",
  );
  const occurrence =
    source.lookup?.get(id) ??
    occurrences(source.project).find((o) => o.id === id);
  ensure(
    occurrence?.node.ref.toLowerCase() === member.ref &&
      JSON.stringify(occurrence.transform) === member.frame,
    "REVISION_CONFLICT",
    "The build changed after its moving geometry was checked. Try Play again.",
  );
  return member.packet;
}
