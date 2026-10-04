import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { refusePointerLock } from "./helpers/pointer";
import { openMode } from "./helpers/mode";
import { openRemoteControls } from "./helpers/play";
import type { MotionRig } from "../../src/mechanisms/types";

function fixture(): { bytes: number[]; rig: MotionRig } {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
    import {steeringFixture} from './src/mechanisms/steering-fixture';
    import {encodeNative} from './src/persistence/native';
    const {project,rig}=steeringFixture();
    encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify({bytes:Array.from(bytes),rig})));
  `,
      ],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
    ),
  );
}
for (const [width, height] of [
  [1440, 1000],
  [360, 600],
] as const)
  for (const dynamic of [false, true])
    test(`rendered twin-loop steering ${width}×${height} ${dynamic ? "native" : "kinematic"} preserves source and wheel inventory`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const f = fixture(),
        context = await browser.newContext({
          viewport: { width, height },
          hasTouch: width === 360,
          isMobile: width === 360,
        }),
        page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await refusePointerLock(page);
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        const before = await page.evaluate(async (bytes) => {
          const api = window.brickEditor!;
          await api.project.import({ format: "native", bytes });
          await api.ready({ strict: true });
          await api.camera.fit();
          const query = await api.query(),
            source = new TextDecoder().decode(
              (await api.project.export({ format: "ldraw" })).bytes,
            );
          const inventory = await api.inventory.preview({
            expectedRevision: query.revision,
            scope: { kind: "all" },
            format: "bricklink-wanted-xml",
            acceptDerivedMappings: true,
            acceptUnknownColors: true,
            errorPolicy: "export-resolved",
          });
          return { query, source, inventory };
        }, f.bytes);
        expect(before.query.occurrences).toHaveLength(8);
        await openMode(page, "Play");
        await page.evaluate(async (dynamic) => {
          const api = window.brickEditor!;
          await api.play.enter({
            rigIds: ["steering"],
            dynamicRigIds: dynamic ? ["steering"] : [],
            realtime: false,
            position: [300, -0.3, 300],
          });
        }, dynamic);
        await openRemoteControls(page);
        await expect(
          page.getByLabel("Part control", { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", {
            name: "Hold motor 1 forward",
            exact: true,
          }),
        ).toBeVisible();
        const result = await page.evaluate(async (rig) => {
          const api = window.brickEditor!,
            rest = await api.play.snapshot();
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
            return Array.from(new Uint8Array(await image.blob.arrayBuffer()));
          };
          const restImage = await capture();
          await api.play.setJointTarget({
            rigId: "steering",
            jointId: "drive",
            target: 25,
            speed: 60,
          });
          await api.play.stepTicks(600);
          const moved = await api.play.snapshot(),
            report = moved.mechanisms!.steering,
            movedImage = await capture();
          const errors = rig.loopClosures!.map((c) => {
            const point = (id: string, p: number[]) => {
              const f = report.groupFrames[id];
              return f.position.map(
                (x, k) =>
                  x +
                  f.basis[k * 3] * p[0] +
                  f.basis[k * 3 + 1] * p[1] +
                  f.basis[k * 3 + 2] * p[2],
              );
            };
            const a = point(c.bodyA, c.anchorA),
              b = point(c.bodyB, c.anchorB);
            return Math.hypot(...a.map((x, k) => x - b[k]));
          });
          const posed = await api.play.exportPosedModel();
          await api.play.exit();
          const query = await api.query(),
            after = new TextDecoder().decode(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            inventory = await api.inventory.preview({
              expectedRevision: query.revision,
              scope: { kind: "all" },
              format: "bricklink-wanted-xml",
              acceptDerivedMappings: true,
              acceptUnknownColors: true,
              errorPolicy: "export-resolved",
            });
          await api.project.import({
            format: "ldraw",
            name: "steering-posed.mpd",
            text: posed.text,
          });
          await api.ready({ strict: true });
          const imported = await api.query();
          return {
            report,
            rest: rest.mechanisms!.steering,
            restImage,
            movedImage,
            errors,
            query,
            after,
            inventory,
            imported,
          };
        }, f.rig);
        expect(result.report.jointTargets.drive.status).toBe("complete");
        expect(result.report.pose.jointPositions.drive).toBeCloseTo(25, 0);
        for (const error of result.errors)
          expect(error).toBeLessThan(dynamic ? 0.1 : 0.002);
        expect(result.report.pose.jointPositions.leftSteer).toBeGreaterThan(5);
        expect(result.report.pose.jointPositions.rightSteer).toBeGreaterThan(1);
        expect(result.movedImage).not.toEqual(result.restImage);
        expect(result.report.transforms).not.toEqual(result.rest.transforms);
        expect(result.query).toEqual(before.query);
        expect(result.after).toBe(before.source);
        expect(result.inventory).toEqual(before.inventory);
        expect(result.imported.occurrences).toHaveLength(8);
        for (const [i, o] of before.query.occurrences.entries()) {
          const t = result.report.transforms[o.id],
            p = result.imported.occurrences[i].transform;
          for (let k = 0; k < 3; k++)
            expect(p.position[k]).toBeCloseTo(t.position[k], 4);
          for (let k = 0; k < 9; k++)
            expect(p.basis[k]).toBeCloseTo(t.basis[k], 4);
        }
        writeFileSync(
          testInfo.outputPath("steering-moved.png"),
          Buffer.from(result.movedImage),
        );
        await page.screenshot({
          path: testInfo.outputPath("steering-restored.png"),
        });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
