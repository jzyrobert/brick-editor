import type { Transform } from "../../src/core/types";
import { occurrences } from "../../src/core/document";
import { orthonormalized } from "../../src/core/math";
import { fullLibrarySources } from "../../scripts/full-library-node";
import { arocsRestFits, arocsRestFixture } from "./arocs-ball-rest-source";
import { playSources } from "./play-dynamic-source";

/** Actual opposite endpoints of the SAME original Arocs 32005 occurrence.
 * Each source occurrence remains one body; endpoint ownership never clones
 * the physical socket or welds the two source ball holders together. */
export async function arocsBallLinkFixture(mobile = false, pose?: Transform) {
  const f = await arocsRestFixture(arocsRestFits[1], pose),
    project = f.project,
    all = occurrences(project),
    fits = [arocsRestFits[1], arocsRestFits[2]],
    balls = fits.map((fit) => all.find((o) => o.id === fit.ball)!),
    socket = f.socket;
  project.motionRigs.seat.groups = [socket, ...balls].map((o, i) => ({
    id: i ? `ball${i - 1}` : "socket",
    occurrenceIds: [o.id],
    frame: orthonormalized(o.transform),
    restTransforms: { [o.id]: structuredClone(o.transform) },
  }));
  project.motionRigs.seat.joints = fits.map((fit, i) => ({
    id: `bearing${i}`,
    kind: "spherical",
    bodyA: "socket",
    bodyB: `ball${i}`,
    anchorA: [0, 0, fit.endpoint * 100],
    anchorB: [-10, 0, 0],
    restAssembly: {
      profile: "arocs-ball-native-seat-v1",
      ballOccurrenceId: fit.ball,
      socketOccurrenceId: fit.socket,
      socketEndpoint: fit.endpoint,
    },
  }));
  if (mobile)
    project.motionRigs.seat.dynamics = {
      groups: { socket: { anchored: false } },
    };
  const { sources } = await playSources(
    project,
    ["seat"],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  return { project, source: sources[0], balls, socket };
}
