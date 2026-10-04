import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import type {
  FullPackIndex,
  FullPackManifest,
} from "../../src/catalog/full-pack";
import { openMenuTab, openMode } from "./helpers/mode";
import { openRemoteControls } from "./helpers/play";
import { refusePointerLock } from "./helpers/pointer";

const text = readFileSync(
  new URL("../../fixtures/ldraw/technic-motion.mpd", import.meta.url),
  "utf8",
);

const libraryLock = JSON.parse(
  readFileSync(
    new URL("../../src/catalog/full-library-lock.json", import.meta.url),
    "utf8",
  ),
) as { releaseId: string };
const libraryRoot = new URL(
  `../../public/libraries/${libraryLock.releaseId}/`,
  import.meta.url,
);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", libraryRoot), "utf8"),
) as FullPackManifest;
const index = JSON.parse(
  readFileSync(new URL(manifest.index.path, libraryRoot), "utf8"),
) as FullPackIndex;
const curated = JSON.parse(
  readFileSync(new URL("../../src/catalog/data.json", import.meta.url), "utf8"),
).catalog as Record<string, unknown>;
const fixtureRefs = [
  ...new Set(
    [...text.matchAll(/^1\s+\S+(?:\s+\S+){12}\s+(.+)$/gm)].map((m) =>
      m[1].toLowerCase(),
    ),
  ),
];
const requiredChunks = [
  ...new Set(
    fixtureRefs
      .filter((ref) => !curated[ref])
      .flatMap((ref) => index.parts[ref][0]),
  ),
].map(
  (i) => `/libraries/${libraryLock.releaseId}/chunks/${index.chunks[i][0]}.bin`,
);

// Rapier's compatibility WASM is embedded in an emitted JavaScript asset;
// inspect the production bundle rather than assuming a separate .wasm file.
const assetsRoot = new URL("../../dist/assets/", import.meta.url);
const wasmAsset = readdirSync(assetsRoot).find(
  (name) =>
    name.endsWith(".js") &&
    readFileSync(new URL(name, assetsRoot), "utf8").includes("AGFzbQE"),
);

test("installed offline snapshot drives pinned Technic gears and pin arm after reload", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [],
    offlineResponses: { url: string; serviceWorker: boolean }[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await refusePointerLock(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Render the exact source closure online, without entering Play. The first
  // Rapier initialization is deliberately left until the offline reload.
  const loaded = await page.evaluate(async (text) => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      name: "technic-motion.mpd",
      text,
    });
    await api.ready({ strict: true });
    const q = await api.query();
    const proposal = await api.mechanisms.propose({
      id: "offline-drive",
      name: "Offline Technic drive",
      expectedRevision: q.revision,
      frameOccurrenceIds: [0, 1, 10].map((i) => q.occurrences[i].id),
      motors: {
        [q.occurrences[2].id]: {
          mode: "velocity",
          target: 90,
          maxEffort: { value: 50, unit: "N*m" },
        },
      },
    });
    await api.dispatch({
      schemaVersion: 1,
      commandId: "save-offline-drive",
      expectedRevision: q.revision,
      type: "rigs.upsert",
      payload: { rig: proposal.rig! },
    });
    await api.ready({ strict: true });
    return { rig: proposal.rig!, occurrences: q.occurrences };
  }, text);
  expect(loaded.occurrences).toHaveLength(13);
  await openMenuTab(page, "Project", "Settings");
  await page
    .getByRole("button", { name: "Download / check for updates", exact: true })
    .click();
  await expect(page.getByText(/Ready offline\./)).toBeVisible({
    timeout: 45000,
  });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const snapshot = names.find((name) =>
      name.startsWith("brick-editor-offline:"),
    )!;
    const paths = (await (await caches.open(snapshot)).keys()).map(
      (r) => new URL(r.url).pathname,
    );
    const library = names.find((name) =>
      name.startsWith("brick-editor-ldraw-full:"),
    )!;
    const partPaths = (await (await caches.open(library)).keys()).map(
      (r) => new URL(r.url).pathname,
    );
    return { paths, partPaths };
  });
  expect(wasmAsset).toBeDefined();
  expect(cached.paths).toContain(`/assets/${wasmAsset}`);
  expect(requiredChunks.length).toBeGreaterThan(0);
  for (const path of requiredChunks) expect(cached.partPaths).toContain(path);
  page.on("response", (response) =>
    offlineResponses.push({
      url: response.url(),
      serviceWorker: response.fromServiceWorker(),
    }),
  );
  await context.setOffline(true);
  try {
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    // Re-import in a fresh page so no online source or compiled-geometry memory
    // can satisfy this witness. Library files are re-verified from Cache Storage.
    const before = await page.evaluate(
      async ({ text, rig }) => {
        const api = window.brickEditor!;
        await api.project.import({
          format: "ldraw",
          name: "technic-motion.mpd",
          text,
        });
        await api.ready({ strict: true });
        const q = await api.query();
        await api.dispatch({
          schemaVersion: 1,
          commandId: "restore-offline-drive",
          expectedRevision: q.revision,
          type: "rigs.upsert",
          payload: { rig },
        });
        await api.ready({ strict: true });
        const query = await api.query();
        return {
          query,
          source: Array.from(
            (await api.project.export({ format: "ldraw" })).bytes,
          ),
          inventory: await api.inventory.preview({
            expectedRevision: query.revision,
            format: "bricklink-wanted-xml",
            scope: { kind: "all" },
          }),
        };
      },
      { text, rig: loaded.rig },
    );
    // Reload/import must not pull in the physics bundle. Entering Play is the
    // boundary that requests the cached WASM-bearing lazy asset.
    expect(
      offlineResponses.some(
        (r) => new URL(r.url).pathname === `/assets/${wasmAsset}`,
      ),
    ).toBe(false);
    await openMode(page, "Play");
    const rest = await page.evaluate(async () => {
      await window.brickEditor!.play.enter({
        rigIds: ["offline-drive"],
        dynamicRigIds: ["offline-drive"],
        position: [200, -0.3, 200],
        realtime: false,
      });
      return window.brickEditor!.play.snapshot();
    });
    await openRemoteControls(page);
    const forward = page.getByRole("button", {
      name: "Hold motor 1 forward",
      exact: true,
    });
    await forward.focus();
    await page.keyboard.down("Enter");
    await page.evaluate(() => window.brickEditor!.play.stepTicks(120));
    await page.keyboard.up("Enter");
    const driven = await page.evaluate(() =>
        window.brickEditor!.play.snapshot(),
      ),
      relation = loaded.rig.transmissions![0],
      moved = driven.mechanisms!["offline-drive"];
    expect(driven.collisionReady).toBe(true);
    expect(moved.dynamics).toBeDefined();
    expect(moved.pose.jointPositions[relation.jointA]).toBeGreaterThan(90);
    expect(moved.pose.jointPositions[relation.jointB]).toBeCloseTo(
      -moved.pose.jointPositions[relation.jointA] / 3,
      0,
    );
    expect(moved.motors![relation.jointA].input).toBe(0);
    for (const i of [2, 3, 4, 5, 6, 7, 8, 9]) {
      const id = before.query.occurrences[i].id;
      expect(moved.transforms[id]).not.toEqual(
        rest.mechanisms!["offline-drive"].transforms[id],
      );
    }
    const articulated = await page.evaluate(
      async ({ pin, arm }) => {
        const api = window.brickEditor!;
        await api.play.setJointTarget({
          rigId: "offline-drive",
          jointId: pin,
          target: 0,
          speed: 90,
        });
        await api.play.setJointTarget({
          rigId: "offline-drive",
          jointId: arm,
          target: 45,
          speed: 90,
        });
        await api.play.stepTicks(600);
        return api.play.snapshot();
      },
      { pin: loaded.rig.joints[2].id, arm: loaded.rig.joints[3].id },
    );
    expect(
      articulated.mechanisms!["offline-drive"].pose.jointPositions[
        loaded.rig.joints[3].id
      ],
    ).toBeCloseTo(45, 0);
    const after = await page.evaluate(async () => {
      const api = window.brickEditor!;
      await api.play.exit();
      const query = await api.query();
      return {
        query,
        source: Array.from(
          (await api.project.export({ format: "ldraw" })).bytes,
        ),
        inventory: await api.inventory.preview({
          expectedRevision: query.revision,
          format: "bricklink-wanted-xml",
          scope: { kind: "all" },
        }),
      };
    });
    expect(after).toEqual(before);
    expect(
      offlineResponses.some(
        (r) =>
          new URL(r.url).pathname === `/assets/${wasmAsset}` && r.serviceWorker,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await testInfo.attach("offline-mechanism-evidence.json", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          wasmAsset,
          cachedDependencyChunks: requiredChunks.length,
          offlineResponses,
          inputDegrees: moved.pose.jointPositions[relation.jointA],
          outputDegrees: moved.pose.jointPositions[relation.jointB],
          armDegrees:
            articulated.mechanisms!["offline-drive"].pose.jointPositions[
              loaded.rig.joints[3].id
            ],
          preservedOccurrences: after.query.occurrences.length,
          preservedInventory: after.inventory.resolvedPhysicalUnitCount,
        },
        null,
        2,
      ),
    });
  } finally {
    await context.setOffline(false);
  }
});
