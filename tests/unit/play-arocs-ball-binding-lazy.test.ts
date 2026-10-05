import { expect, it, vi } from "vitest";
vi.mock("@dimforge/rapier3d-compat", () => {
  throw new Error("Eligibility must not import native physics");
});
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import {
  arocsBallJointIds,
  loadArocsBallContacts,
} from "../../src/play/arocs-ball-binding";
import type { PlayMechanismSource } from "../../src/play/mechanism";
it("reads unbound eligibility and skips unrelated source preparation without importing native physics", async () => {
  const project = importLDraw(
      "0 Simple source body\n1 7 0 -24 0 1 0 0 0 1 0 0 0 1 3010.dat\n",
    ),
    o = occurrences(project)[0];
  project.motionRigs.body = {
    schemaVersion: 1,
    id: "body",
    name: "Source body",
    mode: "kinematic",
    groups: [
      {
        id: "body",
        frame: o.transform,
        occurrenceIds: [o.id],
        restTransforms: { [o.id]: o.transform },
      },
    ],
    joints: [],
  };
  const source: PlayMechanismSource = { project, rigId: "body", groups: {} };
  // An arbitrary property cannot mint the private preflight witness.
  Object.assign(source, { ballJointIds: ["invented"], reviewedBall: true });
  expect(arocsBallJointIds(source)).toEqual([]);
  await loadArocsBallContacts([source]);
  expect(arocsBallJointIds(source)).toEqual([]);
});
