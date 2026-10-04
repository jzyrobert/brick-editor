import { expect, test } from "@playwright/test";
import { nativeContents } from "./helpers/physical-play-policy";
import { realMotorFixture } from "./helpers/real-mechanisms";
import { refusePointerLock } from "./helpers/pointer";
const fixture = realMotorFixture();
for (const dynamic of [false, true])
  test(`rendered ${dynamic ? "Dynamic" : "Kinematic"} mounted Power Functions motor preserves 8:24 phase and source`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const result = await page.evaluate(
      async ({ fixture, dynamic }) => {
        const api = window.brickEditor!;
        await api.project.import({ format: "native", bytes: fixture.bytes });
        await api.ready({ strict: true });
        const inventory = await api.inventory.preview({
          expectedRevision: (await api.query()).revision,
          scope: { kind: "all" },
          format: "bricklink-wanted-xml",
          acceptDerivedMappings: true,
          acceptUnknownColors: true,
          errorPolicy: "export-resolved",
        });
        const before = await api.query(),
          source = Array.from(
            (await api.project.export({ format: "ldraw" })).bytes,
          ),
          native = Array.from(
            (await api.project.export({ format: "native" })).bytes,
          );
        const relation = fixture.rig.transmissions![0];
        await api.play.enter({
          rigIds: [fixture.rig.id],
          ...(dynamic ? { dynamicRigIds: [fixture.rig.id] } : {}),
          position: [200, -0.3, 200],
          realtime: false,
        });
        const rest = await api.play.snapshot();
        const capture = async () => {
          const r = await api.render.image({
            revision: before.revision,
            width: 256,
            height: 256,
            format: "png",
            visibility: { mode: "all" },
            background: { type: "solid", color: "#ffffff" },
            quality: "fast",
            strict: true,
          });
          return {
            bytes: Array.from(new Uint8Array(await r.blob.arrayBuffer())),
            manifest: r.manifest,
          };
        };
        const restImage = await capture();
        await api.play.setJointTarget({
          rigId: fixture.rig.id,
          jointId: relation.jointA,
          target: 765,
          speed: 180,
        });
        await api.play.stepTicks(900);
        const moved = await api.play.snapshot(),
          movedImage = await capture();
        await api.play.setJointTarget({
          rigId: fixture.rig.id,
          jointId: relation.jointB,
          target: 270,
          speed: 90,
        });
        await api.play.stepTicks(1200);
        const reversed = await api.play.snapshot(),
          posed = await api.play.exportPosedModel();
        await api.play.exit();
        return {
          before,
          inventory,
          afterInventory: await api.inventory.preview({
            expectedRevision: (await api.query()).revision,
            scope: { kind: "all" },
            format: "bricklink-wanted-xml",
            acceptDerivedMappings: true,
            acceptUnknownColors: true,
            errorPolicy: "export-resolved",
          }),
          after: await api.query(),
          source,
          afterSource: Array.from(
            (await api.project.export({ format: "ldraw" })).bytes,
          ),
          native,
          afterNative: Array.from(
            (await api.project.export({ format: "native" })).bytes,
          ),
          rest,
          moved,
          reversed,
          posed,
          restImage,
          movedImage,
          relation,
        };
      },
      { fixture, dynamic },
    );
    const { jointA: input, jointB: output } = result.relation;
    expect(fixture.rig.joints.filter((j) => j.motor)).toHaveLength(1);
    expect(
      fixture.rig.joints.find((j) => j.id === input)!.motor!.binding,
    ).toBeDefined();
    const report = (s: typeof result.moved) => s.mechanisms![fixture.rig.id];
    expect(report(result.moved).pose.jointPositions[input]).toBeCloseTo(765, 0);
    expect(report(result.moved).pose.jointPositions[output]).toBeCloseTo(
      -255,
      0,
    );
    expect(report(result.moved).jointTargets[input].status).toBe("complete");
    expect(report(result.reversed).pose.jointPositions[output]).toBeCloseTo(
      270,
      0,
    );
    expect(report(result.reversed).pose.jointPositions[input]).toBeCloseTo(
      -810,
      0,
    );
    expect(report(result.reversed).jointTargets[output].status).toBe(
      "complete",
    );
    expect(result.movedImage.bytes).not.toEqual(result.restImage.bytes);
    expect(result.posed.posedOccurrenceIds.length).toBeGreaterThan(0);
    expect(result.posed.text).not.toEqual(
      new TextDecoder().decode(new Uint8Array(result.source)),
    );
    expect(result.after).toEqual(result.before);
    expect(result.afterInventory).toEqual(result.inventory);
    expect(result.afterSource).toEqual(result.source);
    expect(nativeContents(result.afterNative)).toEqual(
      nativeContents(result.native),
    );
  });
