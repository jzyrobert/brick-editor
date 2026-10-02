import { expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import {
  contextLocator,
  captureInstructionIllustration,
  illustrationHtml,
} from "../../src/instructions/illustrate";
import type { PreparedPlan } from "../../src/instructions/publish";
import type { RenderRequest } from "../../src/render/adapter";
import type { CameraSpec } from "../../src/core/types";
it("locates LDraw close-up targets using the renderer screen orientation", () => {
  const context: CameraSpec = {
    space: "ldraw",
    projection: "orthographic",
    position: [500, -650, 500],
    target: [0, 0, 0],
    up: [0, -1, 0],
    span: 1000,
    fovDeg: 45,
    near: 0.5,
    far: 5000,
  };
  const detail = {
    ...context,
    target: [210, -11.7, -80] as [number, number, number],
    span: 200,
  };
  const rect = contextLocator(detail, context, 240, 180)!;
  const camera = new OrthographicCamera(
    (-1000 * 240) / 180 / 2,
    (1000 * 240) / 180 / 2,
    500,
    -500,
    0.5,
    5000,
  );
  camera.position.set(500, 650, -500);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const projected = new Vector3(210, 11.7, 80).project(camera);
  expect(rect.x + rect.width / 2).toBeCloseTo((projected.x + 1) * 120);
  expect(rect.y + rect.height / 2).toBeCloseTo((1 - projected.y) * 90);
  expect(rect.width / rect.height).toBeCloseTo(240 / 180);
});

it("shows the actual receiving state before ordinary additions and completed joins", async () => {
  const camera: CameraSpec = {
    space: "ldraw",
    projection: "orthographic",
    position: [100, -150, 100],
    target: [0, 0, 0],
    up: [0, -1, 0],
    span: 100,
    fovDeg: 45,
    near: 0.5,
    far: 5000,
  };
  for (const joining of [false, true])
    for (const detail of [false, true]) {
      const requests: RenderRequest[] = [];
      const step: PreparedPlan["steps"][number] = {
        number: 1,
        addedIds: joining ? [] : ["new"],
        cumulativeIds: ["scenery", "receiver", "new"],
        displayIds: ["scenery", "receiver", "new"],
        highlightIds: ["new"],
        lots: [],
        partCount: joining ? 0 : 1,
        camera,
        alternateCamera: camera,
        alternateBeforePlacement: true,
        ...(detail ? { alternateDetailIds: ["receiver"] } : {}),
        ...(joining ? { incomingIds: ["new"] } : {}),
      };
      const illustration = await captureInstructionIllustration(
        0,
        step,
        {
          setCamera: () => {},
          image: async (request) => {
            requests.push(request);
            return { blob: new Blob([new Uint8Array([1])]) };
          },
        },
        { width: 640, height: 480, dimPrevious: true },
      );
      expect(requests[0].visibility).toEqual({
        mode: "occurrences",
        occurrenceIds: ["scenery", "receiver", "new"],
      });
      expect(requests[1].visibility).toEqual({
        mode: "occurrences",
        occurrenceIds: detail ? ["receiver"] : ["scenery", "receiver"],
      });
      expect(requests[1].instructionNewIds).toBeUndefined();
      if (detail)
        expect(illustrationHtml(step, illustration)).toContain(
          "surrounding model omitted, access unverified",
        );
      if (joining)
        expect(requests[2].visibility).toEqual({
          mode: "occurrences",
          occurrenceIds: ["new"],
        });
    }
});
