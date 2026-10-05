import { readFileSync } from "node:fs";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { add, compose, mv, orthonormalized } from "../../src/core/math";
import type { Transform } from "../../src/core/types";
import { playSources } from "./play-dynamic-source";
registerFullLibraryFromDisk();
/** Actual coincident source pair; authored positions are never repaired. */
export async function arocsBallFixture(pose?: Transform, mobile = false) {
  const project = importLDraw(
    readFileSync(
      "fixtures/play/official-cars/42043-ball-link-interfaces.ldr",
      "utf8",
    ),
  );
  if (pose)
    for (const node of project.models[project.rootModelId].nodes)
      if (node.kind === "part") node.transform = compose(pose, node.transform);
  const all = occurrences(project),
    ball = all.find(
      (o) =>
        o.node.ref === "6628.dat" &&
        all.some(
          (s) =>
            s.node.ref === "32005.dat" &&
            Math.hypot(
              ...add(
                o.transform.position,
                mv(o.transform.basis, [-10, 0, 0]),
              ).map((v, k) => v - s.transform.position[k]),
            ) < 1e-8,
        ),
    )!,
    socket = all.find(
      (o) =>
        o.node.ref === "32005.dat" &&
        Math.hypot(
          ...add(
            ball.transform.position,
            mv(ball.transform.basis, [-10, 0, 0]),
          ).map((v, k) => v - o.transform.position[k]),
        ) < 1e-8,
    )!;
  const groups = [ball, socket].map((o, i) => ({
    id: i ? "socket" : "ball",
    occurrenceIds: [o.id],
    frame: orthonormalized(o.transform),
    restTransforms: { [o.id]: structuredClone(o.transform) },
  }));
  project.motionRigs.ball = {
    schemaVersion: 1,
    id: "ball",
    name: "Actual source bearing",
    mode: "kinematic",
    groups,
    joints: [
      {
        id: "bearing",
        kind: "spherical",
        bodyA: "socket",
        bodyB: "ball",
        anchorA: [0, 0, 0],
        anchorB: [-10, 0, 0],
      },
    ],
    dynamics: {
      groups: { socket: { anchored: !mobile }, ball: { anchored: false } },
    },
  };
  const { sources, geometry } = await playSources(
    project,
    ["ball"],
    fullLibrarySources(all.map((o) => o.node.ref)),
  );
  return { project, source: sources[0], geometry, groups, ball, socket };
}
