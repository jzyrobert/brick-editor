import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { PerspectiveCamera, Vector3 } from "three";
import { add, inverse, mv } from "../../src/core/math";
import type { Transform, Vec3 } from "../../src/core/types";
import type { MotionRig } from "../../src/mechanisms/types";
import { openMode } from "./helpers/mode";
import { closeRemoteControls, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";

/** Two original CC0 spur arrangements, 400 LDU apart, share one fixed frame.
 * Use the TS loader for the generated catalogue imports, as linked controls do.
 * The complete pinned group bounds provide independent camera-fit witnesses. */
function combinedFixture(): {
  bytes: number[];
  rig: MotionRig;
  bounds: Record<string, { min: Vec3; max: Vec3 }>;
} {
  const original = readFileSync(
    new URL("../../fixtures/ldraw/technic-motion.mpd", import.meta.url),
    "utf8",
  )
    .split("\n")
    .filter((line) => line.startsWith("1 "));
  const copy = original.map((line) => {
    const fields = line.split(/\s+/);
    fields[2] = String(Number(fields[2]) + 400);
    return fields.join(" ");
  });
  const source = [
    "0 Original CC0-1.0 combined Technic controls acceptance arrangement",
    ...original,
    ...copy,
  ].join("\n");
  const script = `
    import { encodeNative } from './src/persistence/native';
    import { importLDraw } from './src/ldraw/io';
    import { occurrences } from './src/core/document';
    import { proposeMechanicalRig } from './src/mechanisms/mechanical-proposals';
    import { fullLibrarySources, registerFullLibraryFromDisk } from './scripts/full-library-node';
    import { playSources } from './tests/helpers/play-dynamic-source';
    registerFullLibraryFromDisk();
    const project = importLDraw(${JSON.stringify(source)});
    const all = occurrences(project);
    const proposal = proposeMechanicalRig(project, {
      id: 'combined-drive', name: 'Two linked spur assemblies',
      expectedRevision: project.revision,
      frameOccurrenceIds: [0,1,10,13,14,23].map(i => all[i].id),
      motors: Object.fromEntries([2,15].map(i => [all[i].id, {
        mode: 'velocity', target: 90,
        maxEffort: {value: 50, unit: 'N*m'},
      }])),
    });
    if (proposal.unresolved.length) throw new Error(JSON.stringify(proposal.unresolved));
    const rig = proposal.rig;
    rig.dynamics = { groups: Object.fromEntries(rig.groups.filter(g => g.id !== 'frame').map(g => [g.id, {massKg: 1}])) };
    project.motionRigs[rig.id] = rig;
    Promise.all([
      encodeNative(project),
      playSources(project,[rig.id],fullLibrarySources(all.map(o => o.node.ref))),
    ]).then(([bytes,prepared]) => process.stdout.write(JSON.stringify({
      bytes: Array.from(bytes), rig,
      bounds: Object.fromEntries(Object.entries(prepared.sources[0].groups).map(([id,mesh]) => {
        const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
        for(let i=0;i<mesh.vertices.length;i++) { const k=i%3; min[k]=Math.min(min[k],mesh.vertices[i]); max[k]=Math.max(max[k],mesh.vertices[i]); }
        return [id,{min,max}];
      })),
    })));
  `;
  return JSON.parse(
    execFileSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "--eval", script],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
}

for (const [width, height] of [
  [1440, 1000],
  [360, 600],
] as const)
  for (const dynamic of [false, true])
    test(`combined spur overview fits both assemblies ${width}×${height} ${dynamic ? "dynamic" : "kinematic"}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      test.setTimeout(120000);
      const fixture = combinedFixture(),
        { rig } = fixture,
        drivers = rig.joints.filter((joint) => joint.motor),
        outputs = rig.transmissions!.map((relation) => relation.jointB),
        independent = rig.joints.filter((joint) => !outputs.includes(joint.id));
      expect(rig.groups).toHaveLength(9);
      expect(drivers).toHaveLength(2);
      expect(outputs).toHaveLength(2);
      const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: width === 360,
        isMobile: width === 360,
      });
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await refusePointerLock(page);
      try {
        await page.goto(`${baseURL}/?automation=1`);
        await page.waitForFunction(() => !!window.brickEditor);
        const before = await page.evaluate(async (bytes) => {
          const api = window.brickEditor!;
          await api.project.import({ format: "native", bytes });
          await api.ready({ strict: true });
          const query = await api.query();
          return {
            query,
            source: new TextDecoder().decode(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            inventory: await api.inventory.preview({
              expectedRevision: query.revision,
              scope: { kind: "all" },
              format: "bricklink-wanted-xml",
              acceptDerivedMappings: true,
              acceptUnknownColors: true,
              errorPolicy: "export-resolved",
            }),
          };
        }, fixture.bytes);
        expect(before.query.occurrences).toHaveLength(26);
        await openMode(page, "Play");
        await page.evaluate(
          async ({ rigId, dynamic, drivers }) => {
            const api = window.brickEditor!;
            await api.play.enter({
              rigIds: [rigId],
              dynamicRigIds: dynamic ? [rigId] : [],
              realtime: false,
              position: [1200, -0.3, 300],
            });
            for (const jointId of drivers)
              await api.play.setMotor({
                rigId,
                jointId,
                enabled: true,
                input: 0,
              });
            await api.play.stepTicks(30);
          },
          { rigId: rig.id, dynamic, drivers: drivers.map((joint) => joint.id) },
        );
        await openRemoteControls(page);
        const picker = page.getByLabel("Part control", { exact: true });
        expect(
          await picker
            .locator("option")
            .evaluateAll((options) =>
              options.map((option) => (option as HTMLOptionElement).value),
            ),
        ).toEqual(independent.map((joint) => joint.id));
        await expect(picker.locator("option")).toHaveCount(6);
        await expect(
          page.getByRole("group", { name: "Movement joystick", exact: true }),
        ).toHaveCount(0);
        await expect(page.locator(".play-interaction")).toHaveCount(0);
        const poseBefore = await page.evaluate(() =>
          window.brickEditor!.play.snapshot(),
        );
        for (let index = 0; index < drivers.length; index++) {
          await picker.selectOption(drivers[index].id);
          const forward = page.getByRole("button", {
            name: `Hold motor ${index + 1} forward`,
            exact: true,
          });
          await expect(forward).toBeEnabled();
          await forward.focus();
          await page.keyboard.down("Enter");
          await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
          await page.keyboard.up("Enter");
          const report = (
            await page.evaluate(() => window.brickEditor!.play.snapshot())
          ).mechanisms![rig.id];
          expect(report.pose.jointPositions[drivers[index].id]).toBeGreaterThan(
            poseBefore.mechanisms![rig.id].pose.jointPositions[
              drivers[index].id
            ] + 10,
          );
          expect(report.motors![drivers[index].id].input).toBe(0);
          const relation = rig.transmissions!.find(
            (transmission) => transmission.jointA === drivers[index].id,
          )!;
          expect(report.pose.jointPositions[relation.jointB]).toBeCloseTo(
            -report.pose.jointPositions[relation.jointA] / 3,
            0,
          );
        }
        const fittedCamera = (
          await page.evaluate(() => window.brickEditor!.play.view())
        ).camera;
        // A closer view can crop the system; Fit must restore the overview
        // after both zoom directions before checking whole-system containment.
        for (const factor of [2.5, 0.5]) {
          await page.evaluate(
            (factor) => window.brickEditor!.play.zoomCamera(factor),
            factor,
          );
          expect(
            (await page.evaluate(() => window.brickEditor!.play.view())).camera,
          ).not.toEqual(fittedCamera);
          await page
            .getByRole("button", { name: "Fit build", exact: true })
            .click();
          expect(
            (await page.evaluate(() => window.brickEditor!.play.view())).camera,
          ).toEqual(fittedCamera);
        }
        await expect
          .poll(
            async () =>
              (await page.evaluate(() => window.brickEditor!.play.view()))
                .mechanismOverview,
          )
          .toBe(rig.id);
        const layout = await page.evaluate(() => {
          const rect = (selector: string) =>
            document.querySelector(selector)!.getBoundingClientRect().toJSON();
          return {
            canvas: rect(".viewport canvas"),
            header: rect(".site-header"),
            hud: rect(".play-top"),
            sheet: rect(".play-mechanism"),
          };
        });
        const witness = await page.evaluate(async () => ({
          view: await window.brickEditor!.play.view(),
          snapshot: await window.brickEditor!.play.snapshot(),
        }));
        expect(witness.view.camera).toEqual(fittedCamera);
        const viewport = layout.canvas,
          sheet = layout.sheet,
          left = Math.max(0, sheet.x - viewport.x - 12),
          above = Math.max(0, sheet.y - viewport.y - 12),
          beside = left * viewport.height > viewport.width * above,
          clear = {
            x: viewport.x,
            y: Math.max(
              viewport.y,
              layout.header.bottom,
              layout.hud.bottom + 12,
            ),
            right: beside ? viewport.x + left : viewport.right,
            bottom: beside ? viewport.bottom : viewport.y + above,
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
        const frames = witness.snapshot.mechanisms![rig.id].groupFrames,
          projected: Array<{ groupId: string; x: number; y: number }> = [];
        for (const group of rig.groups) {
          const restInverse = inverse(group.frame),
            bounds = fixture.bounds[group.id],
            live: Transform = frames[group.id];
          for (let corner = 0; corner < 8; corner++) {
            const world = [0, 1, 2].map((k) =>
                corner & (1 << k) ? bounds.max[k] : bounds.min[k],
              ) as Vec3,
              local = add(restInverse.position, mv(restInverse.basis, world)),
              p = new Vector3(
                ...add(live.position, mv(live.basis, local)),
              ).project(camera),
              x = viewport.x + ((p.x + 1) * viewport.width) / 2,
              y = viewport.y + ((1 - p.y) * viewport.height) / 2;
            expect(x, group.id).toBeGreaterThanOrEqual(clear.x);
            expect(x, group.id).toBeLessThanOrEqual(clear.right);
            expect(y, group.id).toBeGreaterThanOrEqual(clear.y);
            expect(y, group.id).toBeLessThanOrEqual(clear.bottom);
            expect(p.z, group.id).toBeGreaterThan(-1);
            expect(p.z, group.id).toBeLessThan(1);
            projected.push({ groupId: group.id, x, y });
          }
        }
        const proofPath = testInfo.outputPath("whole-system-fit.json");
        writeFileSync(
          proofPath,
          JSON.stringify({ layout, clear, projected, witness }, null, 2),
        );
        await testInfo.attach("whole-system-fit", {
          path: proofPath,
          contentType: "application/json",
        });
        await page.screenshot({
          path: testInfo.outputPath("combined-overview.png"),
        });
        await closeRemoteControls(page);
        await expect(
          page.getByRole("group", { name: "Movement joystick", exact: true }),
        ).toBeVisible();
        await page.evaluate(() => window.brickEditor!.play.exit());
        const after = await page.evaluate(async () => {
          const api = window.brickEditor!,
            query = await api.query();
          return {
            query,
            source: new TextDecoder().decode(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            inventory: await api.inventory.preview({
              expectedRevision: query.revision,
              scope: { kind: "all" },
              format: "bricklink-wanted-xml",
              acceptDerivedMappings: true,
              acceptUnknownColors: true,
              errorPolicy: "export-resolved",
            }),
          };
        });
        expect(after).toEqual(before);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
