import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { openMode } from "./helpers/mode";
import { closeRemoteControls, openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

function fixture(kind: "gripper-only" | "combined"): number[] {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
import {readFileSync} from 'node:fs';
import {gripperFixture} from './src/mechanisms/gripper-fixture';
import {encodeNative} from './src/persistence/native';
import {importLDraw} from './src/ldraw/io';
import {uid} from './src/core/types';
const {project,crane}=gripperFixture();
if (${JSON.stringify(kind)} === 'gripper-only') {
  crane.name='Crate gripper';
  crane.groups=crane.groups.filter(g=>g.id==='head');
  crane.joints=[];
  crane.dynamics={startDynamic:true,groups:{head:{anchored:true}}};
  project.models[project.rootModelId].nodes[3].transform.position[0]=200;
} else {
  const spur=importLDraw(readFileSync('fixtures/ldraw/technic-motion.mpd','utf8'));
  for (const node of spur.models[spur.rootModelId].nodes) {
    node.id=uid(); delete node.sourceRecordId;
    node.transform.position[0]+=500;
    project.models[project.rootModelId].nodes.push(node);
  }
}
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify(Array.from(bytes))));
`,
      ],
      { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
}

async function source(page: Page) {
  return page.evaluate(async () => {
    const api = window.brickEditor!,
      query = await api.query();
    return {
      query,
      ldraw: await api.project.export({ format: "ldraw" }),
      native: Array.from(
        (await api.project.export({ format: "native" })).bytes,
      ),
      rigs: await api.mechanisms.list(),
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
}
function expectSameSource(
  before: Awaited<ReturnType<typeof source>>,
  after: Awaited<ReturnType<typeof source>>,
) {
  expect(after.query).toEqual(before.query);
  expect(after.ldraw).toEqual(before.ldraw);
  expect(after.rigs).toEqual(before.rigs);
  expect(after.inventory).toEqual(before.inventory);
  const project = (bytes: number[]) =>
    strFromU8(unzipSync(new Uint8Array(bytes))["project.json"]);
  expect(project(after.native)).toBe(project(before.native));
}

test("a native gripper-only rig has usable phone controls, an empty closable overview, and no Kinematic controls", async ({
  page,
}, testInfo) => {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (bytes) => {
    await window.brickEditor!.project.import({ format: "native", bytes });
    await window.brickEditor!.ready({ strict: true });
  }, fixture("gripper-only"));
  const before = await source(page);
  await openMode(page, "Play");
  const ready = await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["crane", "cargo"],
      dynamicRigIds: ["crane", "cargo"],
      realtime: false,
      ground: false,
      position: [300, -0.3, 300],
    }),
  );
  expect(ready.mechanisms!.crane.grippers!.claw.state).toBe("ready");
  expect(before.rigs.find((r) => r.id === "crane")!.joints).toEqual([]);
  await openRemoteControls(page);
  const grab = page.getByRole("button", { name: "Grab crate", exact: true });
  await expect(grab).toBeVisible();
  expect((await grab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await grab.click();
  const release = page.getByRole("button", {
    name: "Release crate",
    exact: true,
  });
  await expect(release).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Forward", exact: true }),
  ).toHaveCount(0);
  const held = await page.evaluate(() => window.brickEditor!.play.snapshot());
  expect(held.mechanisms!.crane.grippers!.claw.held).toMatchObject({
    rigId: "cargo",
    groupId: "crate",
  });
  expect(held.mechanisms!.cargo.groupFrames).toEqual(
    ready.mechanisms!.cargo.groupFrames,
  );
  const layout = await page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().toJSON();
    return {
      sheet: rect(".play-mechanism"),
      action: rect(".play-gripper-control button"),
      header: rect(".site-header"),
      hud: rect(".play-top"),
    };
  });
  expect(layout.action.height).toBeGreaterThanOrEqual(44);
  expect(layout.action.width).toBeGreaterThanOrEqual(44);
  expect(layout.action.y).toBeGreaterThanOrEqual(layout.sheet.y);
  expect(layout.action.bottom).toBeLessThanOrEqual(layout.sheet.bottom);
  expect(layout.sheet.y).toBeGreaterThan(layout.hud.bottom);
  expect(layout.sheet.bottom).toBeLessThanOrEqual(844);
  writeFileSync(
    testInfo.outputPath("gripper-only-layout.json"),
    JSON.stringify(layout, null, 2),
  );
  await page.screenshot({
    path: testInfo.outputPath("gripper-only-holding.png"),
  });
  await release.click();
  await page.evaluate(() => window.brickEditor!.play.stepTicks(60));
  const empty = await page.evaluate(() => window.brickEditor!.play.snapshot());
  expect(empty.mechanisms!.crane.grippers!.claw.state).toBe("empty");
  await expect(grab).toHaveCount(0);
  await expect(release).toHaveCount(0);
  await expect(page.locator(".play-mechanism")).toBeVisible();
  await closeRemoteControls(page);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expectSameSource(before, await source(page));
  const kinematic = await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["crane", "cargo"],
      dynamicRigIds: [],
      realtime: false,
      position: [300, -0.3, 300],
    }),
  );
  expect(kinematic.mechanisms!.crane.mode).toBe("kinematic");
  expect(kinematic.mechanisms!.crane.grippers).toBeUndefined();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.locator(".play-menu .play-tile").filter({ hasText: /controls$/ }),
  ).toHaveCount(0);
  await expect(grab).toHaveCount(0);
  await page.evaluate(() => window.brickEditor!.play.exit());
  expectSameSource(before, await source(page));
});

test("a reviewed unsaved Dynamic spur session replaces an authored held crane without old grip actions or payload bounds", async ({
  page,
}) => {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (bytes) => {
    await window.brickEditor!.project.import({ format: "native", bytes });
    await window.brickEditor!.ready({ strict: true });
  }, fixture("combined"));
  const before = await source(page);
  expect(before.query.occurrences).toHaveLength(18);
  await openMode(page, "Play");
  await page.evaluate(() =>
    window.brickEditor!.play.enter({
      rigIds: ["crane", "cargo"],
      dynamicRigIds: ["crane", "cargo"],
      realtime: false,
      position: [300, -0.3, 300],
    }),
  );
  await openRemoteControls(page);
  await page.getByRole("button", { name: "Grab crate", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Release crate", exact: true }),
  ).toBeVisible();
  const oldView = await page.evaluate(() => window.brickEditor!.play.view());
  const replacement = await page.evaluate(async () => {
    const api = window.brickEditor!,
      query = await api.query(),
      selected = query.occurrences.filter((o) => o.transform.position[0] > 400);
    const request = {
      id: "unsaved-spur",
      name: "Unsaved spur",
      expectedRevision: query.revision,
      occurrenceIds: selected.map((o) => o.id),
      frameOccurrenceIds: [0, 1, 10].map((i) => selected[i].id),
      motors: {
        [selected[2].id]: {
          mode: "velocity" as const,
          target: 90,
          maxEffort: { value: 50, unit: "N*m" as const },
        },
      },
    };
    const proposal = await api.mechanisms.propose(request);
    const entered = await api.mechanisms.tryProposal(
      request,
      { realtime: false, position: [300, -0.3, 300] },
      "dynamic",
    );
    let grabReason = "",
      releaseReason = "";
    try {
      await api.play.grab({
        rigId: "crane",
        gripperId: "claw",
        target: { rigId: "cargo", groupId: "crate" },
      });
    } catch (e) {
      grabReason = String(e);
    }
    try {
      await api.play.release({ rigId: "crane", gripperId: "claw" });
    } catch (e) {
      releaseReason = String(e);
    }
    return {
      proposal,
      entered,
      retained: await api.play.snapshot(),
      grabReason,
      releaseReason,
    };
  });
  expect(replacement.proposal.unresolved).toEqual([]);
  expect(Object.keys(replacement.entered.mechanisms!)).toEqual([
    "unsaved-spur",
  ]);
  expect(replacement.retained).toEqual(replacement.entered);
  expect(replacement.grabReason).toMatch(/Unknown active Dynamic gripper/);
  expect(replacement.releaseReason).toMatch(/Unknown active Dynamic gripper/);
  await expect(
    page.getByRole("button", { name: /^(Grab|Release) crate$/ }),
  ).toHaveCount(0);
  await expect(page.locator(".play-mechanism")).toHaveCount(0);
  await openRemoteControls(page);
  await expect(page.locator(".play-mechanism")).toContainText("Unsaved spur");
  const moved = await page.evaluate(async () => {
    const api = window.brickEditor!;
    const snapshot = await api.play.stepTicks(120),
      view = await api.play.view(),
      posed = await api.play.exportPosedModel();
    await api.play.exit();
    return { snapshot, view, posed };
  });
  const rig = replacement.proposal.rig!,
    input = rig.transmissions![0].jointA;
  expect(moved.snapshot.mechanisms![rig.id].mode).toBe("dynamic");
  expect(
    moved.snapshot.mechanisms![rig.id].pose.jointPositions[input],
  ).toBeGreaterThan(90);
  expect(moved.view.camera.target[0]).toBeGreaterThan(450);
  expect(moved.view.camera).not.toEqual(oldView.camera);
  expect(moved.posed.rigIds).toEqual([rig.id]);
  expect(moved.posed.warnings.join(" ")).not.toMatch(
    /temporary Play attachment/,
  );
  expectSameSource(before, await source(page));
});
