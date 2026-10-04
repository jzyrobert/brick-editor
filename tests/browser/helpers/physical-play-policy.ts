import { expect, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { execFileSync } from "node:child_process";
import { refusePointerLock } from "./pointer";

export function laboratoryFixture(expression: string): {
  bytes: number[];
  rigId: string;
} {
  // Only original repository-owned engine benches are serialized here. Ordinary
  // BrowserPlay remains the tested entry point: no laboratory bypass is added.
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
import {loopFixture} from './src/mechanisms/loop-fixture';
import {gripperFixture} from './src/mechanisms/gripper-fixture';
import {steeringFixture} from './src/mechanisms/steering-fixture';
import {movingPlatformFixture} from './src/mechanisms/platform-fixture';
import {mechanismFixture} from './src/mechanisms/fixtures';
import {encodeNative} from './src/persistence/native';
const result = ${expression};
const project = result.project ?? result;
const rigId = Object.keys(project.motionRigs)[0];
encodeNative(project).then(bytes=>process.stdout.write(JSON.stringify({bytes:Array.from(bytes),rigId})));
`,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    ),
  );
}

/** Unsupported authored connections remain lossless documents and static worlds. */
export async function checkPhysicalRefusal(
  page: Page,
  fixture: { bytes: number[]; rigId: string },
  reason: RegExp,
  dynamic = false,
) {
  await refusePointerLock(page);
  await page.goto("/?automation=1");
  await page.waitForFunction(() => !!window.brickEditor);
  await page.evaluate(async (bytes) => {
    await window.brickEditor!.project.import({ format: "native", bytes });
    await window.brickEditor!.ready({ strict: true });
  }, fixture.bytes);
  await checkLoadedPhysicalRefusal(page, fixture.rigId, reason, dynamic);
}

/** Review an already imported sample without changing its source or stored rigs. */
export async function checkLoadedPhysicalRefusal(
  page: Page,
  rigId: string,
  reason: RegExp,
  dynamic = false,
) {
  const result = await page.evaluate(
    async ({ rigId, dynamic }) => {
      const api = window.brickEditor!;
      const document = async () => {
        const query = await api.query();
        return {
          query,
          rigs: await api.mechanisms.list(),
          native: Array.from(
            (await api.project.export({ format: "native" })).bytes,
          ),
          ldraw: Array.from(
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
      };
      const before = await document();
      const rejection = await api.play
        .enter({
          rigIds: [rigId],
          ...(dynamic ? { dynamicRigIds: [rigId] } : {}),
          autoDoors: false,
          trains: false,
          realtime: false,
        })
        .then(
          () => null,
          (error: Error & { code?: string }) => ({
            message: error.message,
            code: error.code,
          }),
        );
      const refusedSnapshot = await api.play.snapshot().then(
        () => null,
        (error: Error) => error.message,
      );
      await api.play.enter({
        rigIds: [],
        autoDoors: false,
        trains: false,
        realtime: false,
        position: [500, -0.3, 500],
      });
      const staticSnapshot = await api.play.stepTicks(10);
      await api.play.exit();
      return {
        before,
        after: await document(),
        rejection,
        refusedSnapshot,
        staticSnapshot,
      };
    },
    { rigId, dynamic },
  );
  expect(result.rejection).not.toBeNull();
  expect(result.rejection!.message).toMatch(reason);
  expect(result.refusedSnapshot).toMatch(/active|session|Play/i);
  expect(Object.keys(result.staticSnapshot.mechanisms ?? {})).toHaveLength(0);
  expect(result.staticSnapshot.mechanism).toBeUndefined();
  const { native: beforeNative, ...before } = result.before;
  const { native: afterNative, ...after } = result.after;
  expect(after).toEqual(before);
  expect(nativeContents(afterNative)).toEqual(nativeContents(beforeNative));
}

export const nativeContents = (bytes: number[]) =>
  Object.fromEntries(
    Object.entries(unzipSync(new Uint8Array(bytes))).map(([name, data]) => [
      name,
      Array.from(data),
    ]),
  );
