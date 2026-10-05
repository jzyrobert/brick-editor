import { expect, it } from "vitest";
import { arocsRestFixture } from "../helpers/arocs-ball-rest-source";
import {
  hasNativeRestDeclaration,
  prepareNativeRestSources,
} from "../../src/play/native-rest-sources";
import { requireArocsBallRestConstruction } from "../../src/play/arocs-ball-rest";

it("prepares the complete actual source once and retains the same sealed construction tokens", async () => {
  const { source, project } = await arocsRestFixture(),
    original = JSON.stringify(project);
  expect(hasNativeRestDeclaration(source)).toBe(true);
  await prepareNativeRestSources([source], [source.rigId]);
  const prepared = source.nativeRest;
  expect(requireArocsBallRestConstruction(source)).toBe(prepared);
  expect(prepared).toHaveLength(1);
  expect(prepared![0].initialGapLdu).toBeGreaterThan(1.9);
  await prepareNativeRestSources([source], [source.rigId]);
  expect(source.nativeRest).toBe(prepared);
  expect(JSON.stringify(project)).toBe(original);
});

it("refuses Kinematic seating before binding a witness", async () => {
  const { source } = await arocsRestFixture();
  await expect(prepareNativeRestSources([source], [])).rejects.toThrow(
    /Dynamic Play/,
  );
  expect(source.nativeRest).toBeUndefined();
});

it("refuses copied tokens and exact tokens transplanted onto another source", async () => {
  const { source } = await arocsRestFixture();
  await prepareNativeRestSources([source], [source.rigId]);
  const token = source.nativeRest![0];
  source.nativeRest = [structuredClone(token)];
  await expect(
    prepareNativeRestSources([source], [source.rigId]),
  ).rejects.toThrow();
  const other = (await arocsRestFixture()).source;
  other.nativeRest = [token];
  await expect(
    prepareNativeRestSources([other], [other.rigId]),
  ).rejects.toThrow(/exact checked source/);
});

it("refuses a stale supplied token rather than overwriting it with a fresh one", async () => {
  const { source } = await arocsRestFixture();
  await prepareNativeRestSources([source], [source.rigId]);
  const original = source.nativeRest;
  source.project.revision++;
  await expect(
    prepareNativeRestSources([source], [source.rigId]),
  ).rejects.toThrow();
  expect(source.nativeRest).toBe(original);
});

it("never publishes a partial roster when another source fails preflight", async () => {
  const first = (await arocsRestFixture()).source,
    second = (await arocsRestFixture()).source;
  second.project.motionRigs.seat.joints[0].anchorB[0] += 10;
  await expect(
    prepareNativeRestSources([first, second], ["seat"]),
  ).rejects.toThrow();
  expect(first.nativeRest).toBeUndefined();
  expect(second.nativeRest).toBeUndefined();
});

it("refuses a construction witness left on an undeclared source", async () => {
  const { source } = await arocsRestFixture();
  await prepareNativeRestSources([source], [source.rigId]);
  delete source.project.motionRigs.seat.joints[0].restAssembly;
  expect(hasNativeRestDeclaration(source)).toBe(false);
  await expect(
    prepareNativeRestSources([source], [source.rigId]),
  ).rejects.toThrow(/declared source joints/);
});
