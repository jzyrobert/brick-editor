import { readFileSync } from "node:fs";
import { occurrences } from "../../src/core/document";
import { compose, orthonormalized } from "../../src/core/math";
import type { Transform } from "../../src/core/types";
import { importLDraw } from "../../src/ldraw/io";
import type { JointSpec } from "../../src/mechanisms/types";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { playSources } from "./play-dynamic-source";
registerFullLibraryFromDisk();
export const arocsRestFits = [
  {
    ball: '["n55"]',
    socket: '["n77"]',
    endpoint: 1 as const,
    gap: 1.9804892215,
  },
  {
    ball: '["n53"]',
    socket: '["n79"]',
    endpoint: 0 as const,
    gap: 1.9803807715,
  },
  {
    ball: '["n75"]',
    socket: '["n79"]',
    endpoint: 1 as const,
    gap: 0.0199962344,
  },
];
export async function arocsRestFixture(
  fit = arocsRestFits[0],
  pose?: Transform,
) {
  const project = importLDraw(
    readFileSync(
      "fixtures/play/official-cars/42043-ball-link-interfaces.ldr",
      "utf8",
    ),
  );
  if (pose)
    for (const n of project.models[project.rootModelId].nodes)
      if (n.kind === "part") n.transform = compose(pose, n.transform);
  const all = occurrences(project),
    ball = all.find((o) => o.id === fit.ball)!,
    socket = all.find((o) => o.id === fit.socket)!,
    groups = [ball, socket].map((o, i) => ({
      id: i ? "socket" : "ball",
      occurrenceIds: [o.id],
      frame: orthonormalized(o.transform),
      restTransforms: { [o.id]: structuredClone(o.transform) },
    }));
  project.motionRigs.seat = {
    schemaVersion: 1,
    id: "seat",
    name: "Actual noncoincident source bearing",
    mode: "kinematic",
    groups,
    joints: [
      {
        id: "bearing",
        kind: "spherical",
        bodyA: "socket",
        bodyB: "ball",
        anchorA: [0, 0, fit.endpoint * 100],
        anchorB: [-10, 0, 0],
        restAssembly: {
          profile: "arocs-ball-native-seat-v1",
          ballOccurrenceId: ball.id,
          socketOccurrenceId: socket.id,
          socketEndpoint: fit.endpoint,
        },
      } as unknown as JointSpec,
    ],
  };
  const { sources } = await playSources(
    project,
    ["seat"],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  return { project, source: sources[0], ball, socket };
}
