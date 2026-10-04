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
for (const kind of ["spring", "rope"] as const)
  test(`rendered native ${kind} holds its load and survives native/posed export`, async ({
    page,
  }) => {
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const result = await page.evaluate(
      async ({ text, kind }) => {
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
        const mount = groups[1].frame.position.map(
          (v, k) => v - groups[0].frame.position[k],
        ) as [number, number, number];
        const base = {
          id: "link",
          bodyA: "frame",
          bodyB: "load",
          anchorA: [mount[0], mount[1] - 20, mount[2]] as [
            number,
            number,
            number,
          ],
          anchorB: [0, 0, 0] as [number, number, number],
        };
        const link =
          kind === "spring"
            ? {
                ...base,
                kind: "spring" as const,
                restLengthLdu: 20,
                stiffnessNewtonsPerMetre: 100,
                dampingNewtonsSecondsPerMetre: 10,
              }
            : { ...base, kind: "rope" as const, maxLengthLdu: 30 };
        await api.dispatch({
          schemaVersion: 1,
          commandId: "save-force",
          expectedRevision: before.revision,
          type: "rigs.upsert",
          payload: {
            rig: {
              schemaVersion: 1,
              id: "load",
              name: kind,
              mode: "kinematic",
              groups,
              joints: [],
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
      },
      { text, kind },
    );
    expect(result.first.dynamics!.bodies.load.massKg).toBeCloseTo(1);
    expect(result.first.groupFrames).toEqual(result.second.groupFrames);
    expect(result.count).toBe(2);
    expect(result.posedTransforms).toHaveLength(2);
    expect(result.after).toBe(result.source);
    const load = result.first.groupFrames.load.position[1],
      length = load + 120;
    expect(Math.abs(length - (kind === "spring" ? 24.905 : 30))).toBeLessThan(
      0.1,
    );
    Object.values(result.first.transforms).forEach((transform, i) =>
      transform.position.forEach((value, k) =>
        expect(result.posedTransforms[i].position[k]).toBeCloseTo(value, 4),
      ),
    );
  });
