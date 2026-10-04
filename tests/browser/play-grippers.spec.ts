import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import type { Transform, Vec3 } from "../../src/core/types";
import { add, inverse, mv } from "../../src/core/math";
import type { MotionRig } from "../../src/mechanisms/types";
import { refusePointerLock } from "./helpers/pointer";
import { openMode } from "./helpers/mode";
import { openRemoteControls } from "./helpers/play";

function fixture(): {
  bytes: number[];
  rigs: Record<string, MotionRig>;
  bounds: Record<string, Record<string, { min: Vec3; max: Vec3 }>>;
} {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
    import {gripperFixture} from './src/mechanisms/gripper-fixture';
    import {encodeNative} from './src/persistence/native';
    import {playSources} from './tests/helpers/play-dynamic-source';
    const {project}=gripperFixture();
    Promise.all([encodeNative(project),playSources(project,['crane','cargo'])]).then(([bytes,p])=>process.stdout.write(JSON.stringify({bytes:Array.from(bytes),rigs:project.motionRigs,bounds:Object.fromEntries(p.sources.map(source=>[source.rigId,Object.fromEntries(Object.entries(source.groups).map(([id,mesh])=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<mesh.vertices.length;i++){const k=i%3;min[k]=Math.min(min[k],mesh.vertices[i]);max[k]=Math.max(max[k],mesh.vertices[i]);}return[id,{min,max}];}))]))})));
  `,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
}
for (const [width, height] of [
  [1440, 1000],
  [1080, 1800],
  [360, 600],
  [411, 685],
  [390, 844],
  [686, 411],
] as const)
  test(`native gripper lifts carries and releases a foreign loose group ${width}×${height}`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    const f = fixture(),
      context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width !== 1440,
        isMobile: width !== 1440,
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
          ),
          inventory = await api.inventory.preview({
            expectedRevision: query.revision,
            scope: { kind: "all" },
            format: "bricklink-wanted-xml",
            acceptDerivedMappings: true,
            acceptUnknownColors: true,
            errorPolicy: "export-resolved",
          });
        return { query, source, inventory };
      }, f.bytes);
      expect(before.query.occurrences).toHaveLength(5);
      await openMode(page, "Play");
      await page.evaluate(async () => {
        await window.brickEditor!.play.enter({
          rigIds: ["crane", "cargo"],
          dynamicRigIds: ["crane", "cargo"],
          realtime: false,
          position: [300, -0.3, 300],
        });
      });
      await openRemoteControls(page);
      const grab = page.getByRole("button", {
        name: "Grab crate",
        exact: true,
      });
      await expect(grab).toBeVisible();
      expect((await grab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const rest = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      await grab.click();
      const release = page.getByRole("button", {
        name: "Release crate",
        exact: true,
      });
      await expect(release).toBeVisible();
      expect((await release.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(grab).toHaveCount(0);
      const attached = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(attached.mechanisms!.cargo.groupFrames).toEqual(
        rest.mechanisms!.cargo.groupFrames,
      );
      expect(attached.mechanisms!.crane.groupFrames).toEqual(
        rest.mechanisms!.crane.groupFrames,
      );
      await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.play.setJointTarget({
          rigId: "crane",
          jointId: "lift",
          target: 60,
          speed: 60,
        });
        await api.play.stepTicks(300);
        await api.play.setJointTarget({
          rigId: "crane",
          jointId: "carry",
          target: 60,
          speed: 60,
        });
        await api.play.stepTicks(300);
      });
      const witness = await page.evaluate(async () => ({
        snapshot: await window.brickEditor!.play.snapshot(),
        view: await window.brickEditor!.play.view(),
      }));
      expect(
        witness.snapshot.mechanisms!.crane.grippers!.claw.held,
      ).toMatchObject({ rigId: "cargo", groupId: "crate" });
      expect(
        witness.snapshot.mechanisms!.cargo.groupFrames.crate.position[0],
      ).toBeGreaterThan(55);
      expect(
        witness.snapshot.mechanisms!.cargo.groupFrames.crate.position[1],
      ).toBeLessThan(-130);
      const layout = await page.evaluate(() => {
        const r = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON();
        return {
          canvas: r(".viewport canvas"),
          header: r(".site-header"),
          hud: r(".play-top"),
          sheet: r(".play-mechanism"),
          grip: r(".play-gripper-control button"),
        };
      });
      expect(layout.grip.height).toBeGreaterThanOrEqual(44);
      expect(layout.grip.x).toBeGreaterThanOrEqual(layout.sheet.x);
      expect(layout.grip.right).toBeLessThanOrEqual(layout.sheet.right);
      expect(layout.grip.y).toBeGreaterThanOrEqual(layout.sheet.y);
      expect(layout.grip.bottom).toBeLessThanOrEqual(layout.sheet.bottom);
      const viewport = layout.canvas,
        clearTop = Math.max(
          viewport.y,
          layout.header.bottom,
          layout.hud.bottom + 12,
        ),
        left = Math.max(0, layout.sheet.x - viewport.x - 12),
        above = Math.max(0, layout.sheet.y - 12 - clearTop),
        beside = left * (viewport.bottom - clearTop) > viewport.width * above,
        clear = {
          x: viewport.x,
          y: clearTop,
          right: beside ? viewport.x + left : viewport.right,
          bottom: beside ? viewport.bottom : clearTop + above,
        };
      const spec = witness.view.camera,
        camera = new PerspectiveCamera(
          spec.fovDeg,
          viewport.width / viewport.height,
          spec.near,
          spec.far,
        );
      camera.position.set(...spec.position);
      camera.up.set(...spec.up);
      camera.lookAt(new Vector3(...spec.target));
      camera.updateMatrixWorld();
      const projected: Array<{
        rigId: string;
        groupId: string;
        x: number;
        y: number;
      }> = [];
      for (const rig of Object.values(f.rigs))
        for (const group of rig.groups) {
          const local = inverse(group.frame),
            bounds = f.bounds[rig.id][group.id],
            live: Transform =
              witness.snapshot.mechanisms![rig.id].groupFrames[group.id];
          for (let i = 0; i < 8; i++) {
            const world = [0, 1, 2].map((k) =>
                i & (1 << k) ? bounds.max[k] : bounds.min[k],
              ) as Vec3,
              p = new Vector3(
                ...add(
                  live.position,
                  mv(live.basis, add(local.position, mv(local.basis, world))),
                ),
              ).project(camera),
              x = viewport.x + ((p.x + 1) * viewport.width) / 2,
              y = viewport.y + ((1 - p.y) * viewport.height) / 2;
            expect(x, `${rig.id}/${group.id}`).toBeGreaterThanOrEqual(clear.x);
            expect(x).toBeLessThanOrEqual(clear.right);
            expect(y).toBeGreaterThanOrEqual(clear.y);
            expect(y).toBeLessThanOrEqual(clear.bottom);
            projected.push({ rigId: rig.id, groupId: group.id, x, y });
          }
        }
      writeFileSync(
        testInfo.outputPath("gripper-fit.json"),
        JSON.stringify(
          { viewport: { width, height }, layout, clear, projected },
          null,
          2,
        ),
      );
      await page.screenshot({
        path: testInfo.outputPath("gripper-holding.png"),
      });
      const paused = await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.play.pause(true);
        const before = await api.play.snapshot();
        let reason = "";
        try {
          await api.play.release({ rigId: "crane", gripperId: "claw" });
        } catch (e) {
          reason = String(e);
        }
        const after = await api.play.snapshot();
        await api.play.pause(false);
        return { before, after, reason };
      });
      expect(paused.after).toEqual(paused.before);
      expect(paused.reason).toMatch(/Resume/);
      const posed = await page.evaluate(() =>
        window.brickEditor!.play.exportPosedModel(),
      );
      expect(posed.warnings.join(" ")).toMatch(/temporary Play attachment/);
      const fitted = witness.view.camera;
      await release.click();
      await expect(release).toHaveCount(0);
      await expect(grab).toBeVisible();
      const releasedView = await page.evaluate(() =>
        window.brickEditor!.play.view(),
      );
      expect(releasedView.camera).not.toEqual(fitted);
      await page.evaluate(() => window.brickEditor!.play.stepTicks(30));
      const free = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      );
      expect(
        free.mechanisms!.cargo.groupFrames.crate.position[1],
      ).toBeGreaterThan(
        witness.snapshot.mechanisms!.cargo.groupFrames.crate.position[1] + 40,
      );
      await expect(grab).toHaveCount(0);
      const after = await page.evaluate(async () => {
        const api = window.brickEditor!;
        await api.play.exit();
        const query = await api.query(),
          source = new TextDecoder().decode(
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
        return { query, source, inventory };
      });
      expect(after).toEqual(before);
      const restored = await page.evaluate(
        async ({ text, bytes }) => {
          const api = window.brickEditor!;
          await api.project.import({
            format: "ldraw",
            name: "held-pose.mpd",
            text,
          });
          await api.ready({ strict: true });
          const posedQuery = await api.query();
          await api.project.import({ format: "native", bytes });
          await api.ready({ strict: true });
          await api.play.enter({
            rigIds: ["crane", "cargo"],
            dynamicRigIds: ["crane", "cargo"],
            realtime: false,
            position: [300, -0.3, 300],
          });
          const fresh = await api.play.snapshot();
          await api.play.grab({
            rigId: "crane",
            gripperId: "claw",
            target: { rigId: "cargo", groupId: "crate" },
          });
          await api.dispatch({
            schemaVersion: 1,
            commandId: "revise-gripper-source",
            expectedRevision: fresh.sourceRevision,
            type: "project.rename",
            payload: { title: "Revised lift" },
          });
          let reason = "";
          try {
            await api.play.release({ rigId: "crane", gripperId: "claw" });
          } catch (e) {
            reason = String(e);
          }
          return { posedQuery, fresh, reason };
        },
        { text: posed.text, bytes: f.bytes },
      );
      expect(restored.posedQuery.occurrences).toHaveLength(5);
      expect(restored.fresh.mechanisms!.crane.grippers!.claw.state).toBe(
        "ready",
      );
      expect(restored.reason).toMatch(/Enter Play first|changed|re-enter/);
      for (const [i, o] of before.query.occurrences.entries()) {
        const t = Object.values(witness.snapshot.mechanisms!).find(
            (r) => r.transforms[o.id],
          )!.transforms[o.id],
          p = restored.posedQuery.occurrences[i].transform;
        for (let k = 0; k < 3; k++)
          expect(p.position[k]).toBeCloseTo(t.position[k], 4);
        for (let k = 0; k < 9; k++)
          expect(p.basis[k]).toBeCloseTo(t.basis[k], 4);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
