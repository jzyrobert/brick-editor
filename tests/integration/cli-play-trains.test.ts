import { it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../scripts/brick-cli";

it(
  "CLI play runs the railway station's train with a throttle and points",
  { timeout: 300000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "brick-cli-trains-"));
    try {
      const output = join(dir, "train.png"),
        report = join(dir, "train.json"),
        posed = join(dir, "train.ldr");
      await main([
        "play",
        "--input",
        "fixtures/ldraw/templates/railway-station.mpd",
        "--output",
        output,
        "--report",
        report,
        "--train-throttle",
        "1",
        "--ticks",
        "300",
        "--ride-train",
        "--camera-mode",
        "third-person",
        "--width",
        "160",
        "--height",
        "96",
        "--posed-output",
        posed,
      ]);
      const r = JSON.parse(await readFile(report, "utf8"));
      expect(r.playRun.trainThrottle).toBe(1);
      const start = r.playRun.initial.trains,
        end = r.playRun.final.trains;
      expect(start.trains[0].status).toBe("stopped");
      expect(start.switches).toHaveLength(1);
      expect(end.riding).toBe("train:1");
      expect(end.trains[0].status).toBe("running");
      // 5 s from rest: accelerate for 2.67 s, then 480 LDU/s.
      expect(end.trains[0].odometer).toBeGreaterThan(1500);
      // The posed MPD puts the loco where it ran to.
      expect(await readFile(posed, "utf8")).toMatch(/2924bc01\.dat/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
);
