import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { refusePointerLock } from "./helpers/pointer";
const text = readFileSync(
  new URL("../../fixtures/ldraw/four-bar.mpd", import.meta.url),
  "utf8",
)
  .split("\n")
  .filter((line) => !/^1 .* link[23]\.dat$/.test(line))
  .map((line) =>
    /^1 4 .* link1\.dat$/.test(line)
      ? `1 4 0 -100 0 ${Math.cos(Math.PI / 6)} ${-Math.sin(Math.PI / 6)} 0 ${Math.sin(Math.PI / 6)} ${Math.cos(Math.PI / 6)} 0 0 0 1 link1.dat`
      : line,
  )
  .join("\n");
test("rendered cylindrical bearing spins under gravity, holds axial stops and survives native/posed export", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (text) => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      name: "force-link.mpd",
      text,
    });
    await api.ready({ strict: true });
    const before = await api.query();
    const names = ["frame", "load"],
      groups = before.occurrences.map((o, i) => ({
        id: names[i],
        occurrenceIds: [o.id],
        frame: structuredClone(o.transform),
        restTransforms: { [o.id]: structuredClone(o.transform) },
      }));
    const base = {
      id: "link",
      bodyA: "frame",
      bodyB: "load",
      anchorA: [0, 0, 30] as [number, number, number],
      anchorB: [0, 0, 0] as [number, number, number],
    };
    const link = {
      ...base,
      kind: "spring" as const,
      restLengthLdu: 0,
      stiffnessNewtonsPerMetre: 20,
      dampingNewtonsSecondsPerMetre: 10,
    };
    await api.dispatch({
      schemaVersion: 1,
      commandId: "save-force",
      expectedRevision: before.revision,
      type: "rigs.upsert",
      payload: {
        rig: {
          schemaVersion: 1,
          id: "load",
          name: "Cylindrical bearing",
          mode: "kinematic",
          groups,
          joints: [
            {
              id: "bearing",
              kind: "cylindrical",
              bodyA: "frame",
              bodyB: "load",
              anchorA: [0, 0, 0],
              anchorB: [0, 0, 0],
              axisA: [0, 0, 1],
              axisB: [0, 0, 1],
              translationLimitsLdu: [-10, 20],
            },
          ],
          forceLinks: [link],
          dynamics: {
            groups: {
              frame: { anchored: true },
              load: { anchored: false, massKg: 1 },
            },
          },
        },
      },
    });
    await api.ready({ strict: true });
    const native = Array.from(
        (await api.project.export({ format: "native" })).bytes,
      ),
      source = new TextDecoder().decode(
        (await api.project.export({ format: "ldraw" })).bytes,
      );
    const enter = async () =>
      api.play.enter({
        rigIds: ["load"],
        dynamicRigIds: ["load"],
        position: [200, -0.3, 200],
        realtime: false,
      });
    await enter();
    await api.play.stepTicks(600);
    const first = (await api.play.snapshot()).mechanisms!.load;
    const posed = await api.play.exportPosedModel();
    await api.play.exit();
    const after = new TextDecoder().decode(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    await api.project.import({
      format: "native",
      bytes: native,
    });
    await api.ready({ strict: true });
    await enter();
    await api.play.stepTicks(600);
    const second = (await api.play.snapshot()).mechanisms!.load;
    await api.play.exit();
    await api.project.import({
      format: "ldraw",
      name: "posed.mpd",
      text: posed.text,
    });
    await api.ready({ strict: true });
    const imported = await api.query();
    return {
      first,
      second,
      source,
      after,
      count: before.occurrences.length,
      posedTransforms: imported.occurrences.map((o) => o.transform),
    };
  }, text);
  expect(result.first.dynamics!.bodies.load.massKg).toBeCloseTo(1);
  expect(result.first.groupFrames).toEqual(result.second.groupFrames);
  expect(result.count).toBe(2);
  expect(result.posedTransforms).toHaveLength(2);
  expect(result.after).toBe(result.source);
  expect(result.first.dynamics!.bearings!.bearing.translationLdu).toBeCloseTo(
    20,
    1,
  );
  expect(
    Math.abs(result.first.dynamics!.bearings!.bearing.angleDegrees),
  ).toBeGreaterThan(30);
  expect(result.first.pose.jointPositions).toEqual({});
  Object.values(result.first.transforms).forEach((transform, i) =>
    transform.position.forEach((value, k) =>
      expect(result.posedTransforms[i].position[k]).toBeCloseTo(value, 4),
    ),
  );
});
