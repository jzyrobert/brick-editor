import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { refusePointerLock } from "./helpers/pointer";
const text = readFileSync(
  new URL("../../fixtures/ldraw/rack-motion.mpd", import.meta.url),
  "utf8",
);
for (const dynamic of [false, true])
  test(`rendered ${dynamic ? "dynamic" : "kinematic"} guided rack preserves travel, source and inventory`, async ({
    page,
  }) => {
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const loaded = await page.evaluate(async (text) => {
      const api = window.brickEditor!;
      await api.project.import({
        format: "ldraw",
        name: "rack-motion.mpd",
        text,
      });
      await api.ready({ strict: true });
      const before = await api.query();
      const p = await api.mechanisms.propose({
        id: "rack-drive",
        name: "Guided rack",
        expectedRevision: before.revision,
        frameOccurrenceIds: [0, 1, 2].map((i) => before.occurrences[i].id),
        motors: {
          [before.occurrences[3].id]: {
            mode: "velocity",
            target: 90,
            maxEffort: { value: 50, unit: "N*m" },
          },
        },
      });
      await api.dispatch({
        schemaVersion: 1,
        commandId: "save-rack",
        expectedRevision: before.revision,
        type: "rigs.upsert",
        payload: { rig: p.rig! },
      });
      await api.ready({ strict: true });
      await api.camera.fit();
      return {
        p,
        before,
        source: new TextDecoder().decode(
          (await api.project.export({ format: "ldraw" })).bytes,
        ),
      };
    }, text);
    expect(loaded.p.unresolved).toEqual([]);
    expect(loaded.p.rig!.transmissions).toMatchObject([
      { kind: "rack", pitchRadiusLdu: -10 },
    ]);
    const result = await page.evaluate(async (dynamic) => {
      const api = window.brickEditor!;
      await api.play.enter({
        rigIds: ["rack-drive"],
        ...(dynamic ? { dynamicRigIds: ["rack-drive"] } : {}),
        realtime: false,
        position: [200, -0.3, 200],
      });
      const rest = await api.play.snapshot();
      const capture = async () => {
        const r = await api.render.image({
          revision: rest.sourceRevision,
          width: 256,
          height: 256,
          format: "png",
          visibility: { mode: "all" },
          background: { type: "solid", color: "#ffffff" },
          quality: "fast",
          strict: true,
        });
        return Array.from(new Uint8Array(await r.blob.arrayBuffer()));
      };
      const restImage = await capture();
      await api.play.setJointTarget({
        rigId: "rack-drive",
        jointId: "joint-0",
        target: 720,
        speed: 180,
      });
      await api.play.stepTicks(900);
      const moved = await api.play.snapshot(),
        movedImage = await capture();
      await api.play.setJointTarget({
        rigId: "rack-drive",
        jointId: "joint-1",
        target: 100,
        speed: 40,
      });
      await api.play.stepTicks(900);
      const reversed = await api.play.snapshot(),
        posed = await api.play.exportPosedModel();
      await api.play.exit();
      return {
        rest,
        moved,
        reversed,
        restImage,
        movedImage,
        posed,
        after: await api.query(),
        source: new TextDecoder().decode(
          (await api.project.export({ format: "ldraw" })).bytes,
        ),
      };
    }, dynamic);
    const moved = result.moved.mechanisms!["rack-drive"],
      reversed = result.reversed.mechanisms!["rack-drive"];
    expect(moved.pose.jointPositions["joint-0"]).toBeCloseTo(720, 0);
    expect(moved.pose.jointPositions["joint-1"]).toBeCloseTo(-40 * Math.PI, 0);
    expect(moved.jointTargets["joint-0"].status).toBe("complete");
    expect(reversed.pose.jointPositions["joint-1"]).toBeCloseTo(100, 0);
    expect(reversed.jointTargets["joint-1"].status).toBe("complete");
    expect(result.movedImage).not.toEqual(result.restImage);
    expect(
      moved.transforms[loaded.before.occurrences[7].id].position[0],
    ).toBeCloseTo(-40 * Math.PI, 0);
    expect(result.posed.posedOccurrenceIds).toHaveLength(8);
    expect(result.posed.text).not.toBe(loaded.source);
    expect(result.after.occurrences).toEqual(loaded.before.occurrences);
    expect(result.source).toBe(loaded.source);
  });
