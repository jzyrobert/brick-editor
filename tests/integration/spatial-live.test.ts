import { expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const mock = vi.hoisted(() => ({ quota: vi.fn(), start: vi.fn() }));
vi.mock("../../scripts/spatial-benchmark/codex-quota", async (original) => ({
  ...(await original<
    typeof import("../../scripts/spatial-benchmark/codex-quota")
  >()),
  readCodexQuota: mock.quota,
}));
vi.mock("../../scripts/spatial-benchmark/codex-channel", () => ({
  CODEX_TRANSPORT_VERSION: "mock-transport/no-model-calls",
  codexChannel: mock.start,
}));
import { main } from "../../scripts/spatial-benchmark-live";
async function launch(configure: () => void) {
  const dir = await mkdtemp(join(tmpdir(), "brick-live-test-"));
  try {
    const manifest = JSON.parse(
      await readFile(
        "fixtures/spatial-benchmark/manifests/calibration.json",
        "utf8",
      ),
    );
    manifest.tasks = [manifest.tasks[0]];
    manifest.repetitions = 2;
    manifest.model.id = "gpt-6.1-sol";
    manifest.model.effort = "high";
    const file = join(dir, "manifest.json"),
      out = join(dir, "runs");
    await writeFile(file, JSON.stringify(manifest));
    mock.quota.mockReset().mockResolvedValue({
      checkedAt: "2026-10-11T00:00:00Z",
      ordinaryUsageAllowed: true,
      weeklyRemaining: 51,
      reached: false,
      windows: [{ usedPercent: 49, windowDurationMins: 10080, resetsAt: null }],
    });
    mock.start.mockReset();
    configure();
    await main(["--manifest", file, "--out", out, "--authorised-cases", "1"]);
    return {
      results: JSON.parse(await readFile(join(out, "results.json"), "utf8")),
      status: JSON.parse(await readFile(join(out, "run-status.json"), "utf8")),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
it("retains a native startup failure inside the generation seal without a retry", async () => {
  const r = await launch(() =>
    mock.start.mockRejectedValue(new Error("client unavailable")),
  );
  expect(r.results.completed).toBe(1);
  expect(r.results.results[0].status).toBe("infrastructure-failure");
  expect(r.results.results[0].state).toBe("frozen");
  expect(mock.start).toHaveBeenCalledTimes(1);
  expect(r.status.stopReason).toMatch(/Infrastructure failure/);
}, 30000);
it("blocks missing quota before starting a model and records every scheduled case", async () => {
  const r = await launch(() =>
    mock.quota.mockRejectedValue(new Error("quota unavailable")),
  );
  expect(r.results.completed).toBe(0);
  expect(r.status.planned).toBe(2);
  expect(r.status.stopReason).toMatch(/Quota unavailable/);
  expect(mock.start).not.toHaveBeenCalled();
}, 30000);
it("records an authorised subset as a stopped evaluation boundary", async () => {
  const r = await launch(() =>
    mock.start.mockResolvedValue({
      channel: async () =>
        JSON.stringify({
          tool: "brick.build",
          input: {
            code: 'section("Fixture",[place({part:"3039",at:[0,0,0],colour:4}),place({part:"3024",at:[0,3,1],colour:4})]);',
            seed: 1,
          },
        }),
      close: async () => {},
    }),
  );
  expect(r.results.results[0].status).toBe("submitted");
  expect(r.status.completed).toBe(1);
  expect(r.status.stopReason).toMatch(/Authorised case limit/);
}, 30000);
it("retains a submitted source if quota becomes unavailable after the case", async () => {
  const r = await launch(() => {
    mock.quota
      .mockReset()
      .mockResolvedValueOnce({
        checkedAt: "2026-10-11T00:00:00Z",
        ordinaryUsageAllowed: true,
        weeklyRemaining: 51,
        reached: false,
        windows: [
          { usedPercent: 49, windowDurationMins: 10080, resetsAt: null },
        ],
      })
      .mockRejectedValue(new Error("after-case outage"));
    mock.start.mockResolvedValue({
      channel: async () =>
        JSON.stringify({
          tool: "brick.build",
          input: {
            code: 'section("Fixture",[place({part:"3039",at:[0,0,0],colour:4}),place({part:"3024",at:[0,3,1],colour:4})]);',
            seed: 1,
          },
        }),
      close: async () => {},
    });
  });
  expect(r.results.completed).toBe(1);
  expect(r.results.results[0].status).toBe("submitted");
  expect(r.results.results[0].quotaAfter).toBeNull();
  expect(r.status.stopReason).toMatch(/Quota unavailable after frozen case/);
}, 30000);
