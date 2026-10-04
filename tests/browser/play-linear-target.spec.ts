import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { refusePointerLock } from "./helpers/pointer";
const text = readFileSync(
  new URL("../../fixtures/ldraw/four-bar.mpd", import.meta.url),
  "utf8",
)
  .split("\n")
  .filter((line) => !/^1 .* link[23]\.dat$/.test(line))
  .map((line) => {
    if (!/^1 .* link[01]\.dat$/.test(line)) return line;
    const fields = line.split(" ");
    // Source-authored layers keep all same-rig collision checks active.
    fields[4] = line.endsWith("link0.dat") ? "-40" : "0";
    return fields.join(" ");
  })
  .join("\n");
test("rendered linear target holds a spring load at the requested slow rate and reverses", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  const result = await page.evaluate(async (text) => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      name: "linear-load.mpd",
      text,
    });
    await api.ready({ strict: true });
    const before = await api.query(),
      names = ["frame", "load"],
      groups = before.occurrences.map((o, i) => ({
        id: names[i],
        occurrenceIds: [o.id],
        frame: structuredClone(o.transform),
        restTransforms: { [o.id]: structuredClone(o.transform) },
      }));
    const mount = groups[1].frame.position.map(
      (v, k) => v - groups[0].frame.position[k],
    ) as [number, number, number];
    await api.dispatch({
      schemaVersion: 1,
      commandId: "linear",
      expectedRevision: before.revision,
      type: "rigs.upsert",
      payload: {
        rig: {
          schemaVersion: 1,
          id: "linear",
          name: "Linear spring load",
          mode: "kinematic",
          groups,
          joints: [
            {
              id: "slide",
              kind: "prismatic",
              bodyA: "frame",
              bodyB: "load",
              anchorA: mount,
              anchorB: [0, 0, 0],
              axisA: [0, 1, 0],
              axisB: [0, 1, 0],
              limits: [-50, 50],
              motor: {
                mode: "position",
                target: 0,
                maxEffort: { value: 500, unit: "N" },
              },
            },
          ],
          forceLinks: [
            {
              id: "spring",
              kind: "spring",
              bodyA: "frame",
              bodyB: "load",
              anchorA: [mount[0], mount[1] - 20, mount[2]],
              anchorB: [0, 0, 0],
              restLengthLdu: 20,
              stiffnessNewtonsPerMetre: 100,
              dampingNewtonsSecondsPerMetre: 10,
            },
          ],
          dynamics: {
            groups: { frame: { anchored: true }, load: { massKg: 1 } },
          },
        },
      },
    });
    await api.ready({ strict: true });
    const source = new TextDecoder().decode(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    await api.play.enter({
      rigIds: ["linear"],
      dynamicRigIds: ["linear"],
      position: [200, -0.3, 200],
      realtime: false,
    });
    await api.play.setJointTarget({
      rigId: "linear",
      jointId: "slide",
      target: 10,
      speed: 2,
    });
    await api.play.stepTicks(600);
    const held = (await api.play.snapshot()).mechanisms!.linear;
    await api.play.setJointTarget({
      rigId: "linear",
      jointId: "slide",
      target: -10,
      speed: 5,
    });
    await api.play.stepTicks(600);
    const reversed = (await api.play.snapshot()).mechanisms!.linear;
    const posed = await api.play.exportPosedModel();
    await api.play.exit();
    const after = new TextDecoder().decode(
      (await api.project.export({ format: "ldraw" })).bytes,
    );
    await api.project.import({
      format: "ldraw",
      name: "posed.mpd",
      text: posed.text,
    });
    await api.ready({ strict: true });
    const imported = await api.query();
    return {
      held,
      reversed,
      source,
      after,
      posedTransforms: imported.occurrences.map((o) => o.transform),
    };
  }, text);
  expect(result.held.jointTargets.slide.status).toBe("complete");
  expect(result.held.pose.jointPositions.slide).toBeCloseTo(10, 1);
  expect(result.reversed.jointTargets.slide.status).toBe("complete");
  expect(result.reversed.pose.jointPositions.slide).toBeCloseTo(-10, 1);
  expect(result.after).toBe(result.source);
  expect(result.posedTransforms).toHaveLength(2);
  Object.values(result.reversed.transforms).forEach((transform, i) =>
    transform.position.forEach((v, k) =>
      expect(result.posedTransforms[i].position[k]).toBeCloseTo(v, 4),
    ),
  );
});
