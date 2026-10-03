import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { refusePointerLock } from "./helpers/pointer";

const text = readFileSync(
  new URL("../../fixtures/ldraw/technic-motion.mpd", import.meta.url),
  "utf8",
);
for (const dynamic of [false, true]) {
  test(`rendered ${dynamic ? "dynamic" : "kinematic"} 8:24 drive preserves phase, accessories and source`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const loaded = await page.evaluate(async (text) => {
      const api = window.brickEditor!;
      await api.project.import({
        format: "ldraw",
        name: "technic-drive.mpd",
        text,
      });
      await api.ready({ strict: true });
      const before = await api.query();
      const proposal = await api.mechanisms.propose({
        id: "technic-drive",
        name: "Technic 8:24 drive",
        expectedRevision: before.revision,
        frameOccurrenceIds: [0, 1, 10].map((i) => before.occurrences[i].id),
        motors: {
          [before.occurrences[2].id]: {
            mode: "velocity",
            target: 90,
            maxEffort: { value: 50, unit: "N*m" },
          },
        },
      });
      await api.dispatch({
        schemaVersion: 1,
        commandId: "save-drive",
        expectedRevision: before.revision,
        type: "rigs.upsert",
        payload: { rig: proposal.rig! },
      });
      await api.ready({ strict: true });
      await api.camera.fit();
      const source = new TextDecoder().decode(
        (await api.project.export({ format: "ldraw" })).bytes,
      );
      return { proposal, before, source };
    }, text);
    expect(loaded.proposal.unresolved).toEqual([]);
    const relation = loaded.proposal.rig!.transmissions![0];
    expect(loaded.proposal.rig!.joints.filter((j) => j.motor)).toHaveLength(1);
    const result = await page.evaluate(
      async ({ dynamic, input, output, pin, arm }) => {
        const api = window.brickEditor!;
        await api.play.enter({
          rigIds: ["technic-drive"],
          ...(dynamic ? { dynamicRigIds: ["technic-drive"] } : {}),
          position: [200, -0.3, 200],
          realtime: false,
        });
        const rest = await api.play.snapshot();
        const capture = async () => {
          const image = await api.render.image({
            revision: rest.sourceRevision,
            width: 256,
            height: 256,
            format: "png",
            visibility: { mode: "all" },
            background: { type: "solid", color: "#ffffff" },
            quality: "fast",
            strict: true,
          });
          return {
            bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
            manifest: image.manifest,
          };
        };
        const restImage = await capture();
        await api.play.setJointTarget({
          rigId: "technic-drive",
          jointId: input,
          target: 765,
          speed: 180,
        });
        await api.play.stepTicks(900);
        const moved = await api.play.snapshot();
        const movedImage = await capture();
        await api.play.setJointTarget({
          rigId: "technic-drive",
          jointId: output,
          target: 270,
          speed: 90,
        });
        await api.play.stepTicks(1200);
        const reversed = await api.play.snapshot();
        // The plain pin has two rotational bearings. Hold the pin in the
        // frame while turning the separate arm around the receiving bearing.
        await api.play.setJointTarget({
          rigId: "technic-drive",
          jointId: pin,
          target: 0,
          speed: 90,
        });
        await api.play.setJointTarget({
          rigId: "technic-drive",
          jointId: arm,
          target: 45,
          speed: 90,
        });
        // Allow the effort-limited arm to settle after free motion under
        // gravity; reaching a commanded angle is not an instantaneous pose.
        await api.play.stepTicks(600);
        const articulated = await api.play.snapshot();
        const posed = await api.play.exportPosedModel();
        await api.play.exit();
        const after = await api.query();
        return {
          rest,
          moved,
          reversed,
          articulated,
          restImage,
          movedImage,
          posed,
          after,
          source: new TextDecoder().decode(
            (await api.project.export({ format: "ldraw" })).bytes,
          ),
        };
      },
      {
        dynamic,
        input: relation.jointA,
        output: relation.jointB,
        pin: loaded.proposal.rig!.joints[2].id,
        arm: loaded.proposal.rig!.joints[3].id,
      },
    );
    const moved = result.moved.mechanisms!["technic-drive"];
    const reversed = result.reversed.mechanisms!["technic-drive"];
    expect(moved.pose.jointPositions[relation.jointA]).toBeCloseTo(765, 0);
    expect(moved.pose.jointPositions[relation.jointB]).toBeCloseTo(-255, 0);
    expect(moved.jointTargets[relation.jointA].status).toBe("complete");
    expect(reversed.pose.jointPositions[relation.jointA]).toBeCloseTo(-810, 0);
    expect(reversed.pose.jointPositions[relation.jointB]).toBeCloseTo(270, 0);
    expect(reversed.jointTargets[relation.jointB].status).toBe("complete");
    const articulated = result.articulated.mechanisms!["technic-drive"];
    expect(
      articulated.pose.jointPositions[loaded.proposal.rig!.joints[3].id],
    ).toBeCloseTo(45, 0);
    expect(
      articulated.jointTargets[loaded.proposal.rig!.joints[2].id].status,
    ).toBe("complete");
    expect(
      articulated.jointTargets[loaded.proposal.rig!.joints[3].id].status,
    ).toBe("complete");
    const armMember = loaded.before.occurrences[12].id;
    expect(articulated.transforms[armMember]).not.toEqual(
      result.rest.mechanisms!["technic-drive"].transforms[armMember],
    );
    expect(result.movedImage.bytes).not.toEqual(result.restImage.bytes);
    for (const i of [2, 3, 4, 5, 6, 7, 8, 9]) {
      const id = loaded.before.occurrences[i].id;
      expect(moved.transforms[id]).not.toEqual(
        result.rest.mechanisms!["technic-drive"].transforms[id],
      );
    }
    expect(result.posed.posedOccurrenceIds).toHaveLength(13);
    expect(result.posed.text).not.toEqual(loaded.source);
    expect(result.after.occurrences).toEqual(loaded.before.occurrences);
    expect(result.source).toBe(loaded.source);
  });
}
