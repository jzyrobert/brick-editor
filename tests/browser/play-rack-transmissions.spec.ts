import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import type { MotionRig } from "../../src/mechanisms/types";
import { nativeContents } from "./helpers/physical-play-policy";
import { refusePointerLock } from "./helpers/pointer";
const fixture: { bytes: number[]; rig: MotionRig } = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "node_modules/tsx/dist/cli.mjs",
      "--eval",
      `
import {registerFullLibraryFromDisk} from './scripts/full-library-node';
import {manualRackFixture} from './src/mechanisms/rack-guide-fixture';
import {encodeNative} from './src/persistence/native';
registerFullLibraryFromDisk();
const {project,proposal}=manualRackFixture();
if(proposal.unresolved.length)throw Error(JSON.stringify(proposal.unresolved));
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify({bytes:Array.from(bytes),rig:proposal.rig})));
`,
    ],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
  ),
);
for (const dynamic of [false, true])
  test(`rendered ${dynamic ? "dynamic" : "kinematic"} real manual rack guide preserves travel, source and inventory`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await refusePointerLock(page);
    await page.goto("/?automation=1");
    await page.waitForFunction(() => !!window.brickEditor);
    const loaded = await page.evaluate(async (fixture) => {
      const api = window.brickEditor!;
      await api.project.import({
        format: "native",
        bytes: fixture.bytes,
      });
      await api.ready({ strict: true });
      const before = await api.query();
      await api.camera.fit();
      return {
        before,
        inventory: await api.inventory.preview({
          expectedRevision: before.revision,
          scope: { kind: "all" },
          format: "bricklink-wanted-xml",
          acceptDerivedMappings: true,
          acceptUnknownColors: true,
          errorPolicy: "export-resolved",
        }),
        native: Array.from(
          (await api.project.export({ format: "native" })).bytes,
        ),
        source: new TextDecoder().decode(
          (await api.project.export({ format: "ldraw" })).bytes,
        ),
      };
    }, fixture);
    expect(loaded.before.unresolvedReferenceIds).toEqual([]);
    expect(loaded.before.occurrences).toHaveLength(2);
    expect(fixture.rig.joints).toHaveLength(1);
    expect(fixture.rig.joints[0]).toMatchObject({
      id: "joint-0",
      kind: "prismatic",
      limits: [-110, 10],
    });
    expect(fixture.rig.joints[0].motor).toBeUndefined();
    expect(fixture.rig.transmissions ?? []).toEqual([]);
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
        target: -60,
        speed: 40,
      });
      await api.play.stepTicks(900);
      const moved = await api.play.snapshot(),
        movedImage = await capture(),
        posed = await api.play.exportPosedModel();
      await api.play.setJointTarget({
        rigId: "rack-drive",
        jointId: "joint-0",
        target: 0,
        speed: 40,
      });
      await api.play.stepTicks(900);
      const reversed = await api.play.snapshot();
      await api.play.exit();
      return {
        rest,
        moved,
        reversed,
        restImage,
        movedImage,
        posed,
        after: await api.query(),
        inventory: await api.inventory.preview({
          expectedRevision: (await api.query()).revision,
          scope: { kind: "all" },
          format: "bricklink-wanted-xml",
          acceptDerivedMappings: true,
          acceptUnknownColors: true,
          errorPolicy: "export-resolved",
        }),
        native: Array.from(
          (await api.project.export({ format: "native" })).bytes,
        ),
        source: new TextDecoder().decode(
          (await api.project.export({ format: "ldraw" })).bytes,
        ),
      };
    }, dynamic);
    const moved = result.moved.mechanisms!["rack-drive"],
      reversed = result.reversed.mechanisms!["rack-drive"];
    expect(moved.pose.jointPositions["joint-0"]).toBeCloseTo(-60, 0);
    expect(moved.jointTargets["joint-0"].status).toBe("complete");
    expect(reversed.pose.jointPositions["joint-0"]).toBeCloseTo(0, 0);
    expect(reversed.jointTargets["joint-0"].status).toBe("complete");
    expect(result.movedImage).not.toEqual(result.restImage);
    expect(
      moved.transforms[loaded.before.occurrences[1].id].position[0],
    ).toBeCloseTo(-100, 0);
    expect(
      reversed.transforms[loaded.before.occurrences[1].id].position[0],
    ).toBeCloseTo(-40, 0);
    expect(result.posed.posedOccurrenceIds).toHaveLength(2);
    expect(result.posed.text).not.toBe(loaded.source);
    expect(result.after.occurrences).toEqual(loaded.before.occurrences);
    expect(result.after).toEqual(loaded.before);
    expect(result.inventory).toEqual(loaded.inventory);
    expect(result.source).toBe(loaded.source);
    expect(nativeContents(result.native)).toEqual(
      nativeContents(loaded.native),
    );
  });
