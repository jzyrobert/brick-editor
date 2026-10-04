import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import type {
  FullPackIndex,
  FullPackManifest,
} from "../../src/catalog/full-pack";
import { openMenuTab } from "./helpers/mode";
import { refusePointerLock } from "./helpers/pointer";

const text = readFileSync(
  new URL("../../fixtures/ldraw/rack-motion.mpd", import.meta.url),
  "utf8",
);
const lock = JSON.parse(
  readFileSync(
    new URL("../../src/catalog/full-library-lock.json", import.meta.url),
    "utf8",
  ),
) as { releaseId: string };
const libraryRoot = new URL(
  `../../public/libraries/${lock.releaseId}/`,
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
const refs = [
  ...new Set(
    [...text.matchAll(/^1\s+\S+(?:\s+\S+){12}\s+(.+)$/gm)].map((m) =>
      m[1].toLowerCase(),
    ),
  ),
];
const requiredChunks = [
  ...new Set(
    refs.filter((ref) => !curated[ref]).flatMap((ref) => index.parts[ref][0]),
  ),
].map((i) => `/libraries/${lock.releaseId}/chunks/${index.chunks[i][0]}.bin`);
const assetsRoot = new URL("../../dist/assets/", import.meta.url),
  assets = readdirSync(assetsRoot);
const rackAssets = assets.filter((name) =>
  /^reviewed-rack-data-.*\.js$/.test(name),
);
const wasmAsset = assets.find(
  (name) =>
    name.endsWith(".js") &&
    readFileSync(new URL(name, assetsRoot), "utf8").includes("AGFzbQE"),
);

test("installed offline snapshot moves the reviewed guided rack in both modes after a cold reload", async ({
  page,
  context,
}, testInfo) => {
  const errors: string[] = [],
    csp: string[] = [],
    responses: { path: string; serviceWorker: boolean }[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      /Content Security Policy|Refused to.*(?:script|connect|worker)/i.test(
        message.text(),
      )
    )
      csp.push(message.text());
  });
  page.on("response", (response) =>
    responses.push({
      path: new URL(response.url()).pathname,
      serviceWorker: response.fromServiceWorker(),
    }),
  );
  await refusePointerLock(page);
  await page.goto("./?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  // Import, propose and save the actual pinned fixture. No Play session or
  // reviewed native data may satisfy the online/cold-cache part of this witness.
  const online = await page.evaluate(async (text) => {
    const api = window.brickEditor!;
    await api.project.import({
      format: "ldraw",
      name: "rack-motion.mpd",
      text,
    });
    await api.ready({ strict: true });
    const before = await api.query();
    const proposal = await api.mechanisms.propose({
      id: "offline-rack",
      name: "Offline guided rack",
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
      commandId: "save-offline-rack",
      expectedRevision: before.revision,
      type: "rigs.upsert",
      payload: { rig: proposal.rig! },
    });
    await api.ready({ strict: true });
    return {
      proposal,
      occurrences: before.occurrences,
      native: Array.from(
        (await api.project.export({ format: "native" })).bytes,
      ),
    };
  }, text);
  expect(online.occurrences).toHaveLength(8);
  expect(online.proposal.unresolved).toEqual([]);
  expect(online.proposal.rig!.transmissions).toMatchObject([
    { kind: "rack", pitchRadiusLdu: -30 },
  ]);
  expect(rackAssets).toHaveLength(1);
  expect(wasmAsset).toBeDefined();
  const rackPath = `/assets/${rackAssets[0]}`,
    wasmPath = `/assets/${wasmAsset}`;
  expect(
    responses.some((r) => r.path === rackPath || r.path === wasmPath),
  ).toBe(false);

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
    const paths = async (prefix: string) => {
      const name = names.find((n) => n.startsWith(prefix))!;
      return (await (await caches.open(name)).keys()).map(
        (r) => new URL(r.url).pathname,
      );
    };
    return {
      snapshot: await paths("brick-editor-offline:"),
      library: await paths("brick-editor-ldraw-full:"),
    };
  });
  expect(cached.snapshot).toContain(rackPath);
  expect(cached.snapshot).toContain(wasmPath);
  expect(requiredChunks.length).toBeGreaterThan(0);
  for (const chunk of requiredChunks) expect(cached.library).toContain(chunk);

  await context.setOffline(true);
  try {
    responses.length = 0;
    await page.reload();
    await page.waitForFunction(() => !!window.brickEditor);
    // Restore the saved native project into a fresh JS realm: no online loader,
    // canonical buffers or native packet module can survive this reload.
    const before = await page.evaluate(async (bytes) => {
      const api = window.brickEditor!;
      await api.project.import({
        format: "native",
        bytes,
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
    }, online.native);
    expect(before.query.occurrences).toEqual(online.occurrences);
    expect(
      responses.some((r) => r.path === rackPath || r.path === wasmPath),
    ).toBe(false);
    const evidence = [];
    for (const dynamic of [false, true]) {
      const result = await page.evaluate(async (dynamic) => {
        const api = window.brickEditor!;
        await api.play.enter({
          rigIds: ["offline-rack"],
          ...(dynamic ? { dynamicRigIds: ["offline-rack"] } : {}),
          realtime: false,
          position: [200, -0.3, 200],
        });
        const rest = await api.play.snapshot();
        const drive = async (
          jointId: string,
          target: number,
          speed: number,
        ) => {
          await api.play.setJointTarget({
            rigId: "offline-rack",
            jointId,
            target,
            speed,
          });
          // Match the online native acceptance hold: the actual 24-tooth
          // pinion advances 150 degrees, then the slider reverses to +8 LDU.
          await api.play.stepTicks(900);
          return { ticks: 900, snapshot: await api.play.snapshot() };
        };
        const moved = await drive("joint-0", 150, 180),
          reversed = await drive("joint-1", 8, 40);
        await api.play.exit();
        const query = await api.query();
        return {
          rest,
          moved,
          reversed,
          after: {
            query,
            source: Array.from(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            inventory: await api.inventory.preview({
              expectedRevision: query.revision,
              format: "bricklink-wanted-xml",
              scope: { kind: "all" },
            }),
          },
        };
      }, dynamic);
      expect(result.rest.collisionReady).toBe(true);
      const rest = result.rest.mechanisms!["offline-rack"];
      expect(rest.pose.jointPositions["joint-1"]).toBeCloseTo(0, 0);
      for (const [leg, jointId, target, rackTarget, pinionTarget] of [
        [result.moved, "joint-0", 150, -25 * Math.PI, 150],
        [result.reversed, "joint-1", 8, 8, -48 / Math.PI],
      ] as const) {
        const report = leg.snapshot.mechanisms!["offline-rack"];
        expect(report.jointTargets[jointId].status).toBe("complete");
        expect(report.pose.jointPositions[jointId]).toBeCloseTo(target, 0);
        expect(report.pose.jointPositions["joint-0"]).toBeCloseTo(
          pinionTarget,
          0,
        );
        expect(report.pose.jointPositions["joint-1"]).toBeCloseTo(
          rackTarget,
          0,
        );
        expect(
          Math.abs(
            report.pose.jointPositions["joint-0"] +
              (report.pose.jointPositions["joint-1"] * 180) / (30 * Math.PI),
          ),
        ).toBeLessThan(1);
        expect(!!report.dynamics).toBe(dynamic);
      }
      expect(
        result.moved.snapshot.mechanisms!["offline-rack"].transforms[
          before.query.occurrences[7].id
        ],
      ).not.toEqual(rest.transforms[before.query.occurrences[7].id]);
      expect(
        result.moved.snapshot.mechanisms!["offline-rack"].transforms[
          before.query.occurrences[7].id
        ].position[0],
      ).toBeCloseTo(-40 - 25 * Math.PI, 0);
      expect(result.after).toEqual(before);
      evidence.push({
        dynamic,
        forwardTicks: result.moved.ticks,
        reverseTicks: result.reversed.ticks,
        forward: result.moved.snapshot.mechanisms!["offline-rack"],
        reverse: result.reversed.snapshot.mechanisms!["offline-rack"],
      });
    }
    expect(responses.some((r) => r.path === rackPath && r.serviceWorker)).toBe(
      true,
    );
    expect(responses.some((r) => r.path === wasmPath && r.serviceWorker)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    expect(csp).toEqual([]);
    await testInfo.attach("offline-rack-evidence.json", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          rackAsset: rackAssets[0],
          wasmAsset,
          cachedDependencyChunks: requiredChunks.length,
          responses,
          evidence,
          preservedOccurrences: before.query.occurrences.length,
          preservedInventory: before.inventory.resolvedPhysicalUnitCount,
        },
        null,
        2,
      ),
    });
  } finally {
    await context.setOffline(false);
  }
});
