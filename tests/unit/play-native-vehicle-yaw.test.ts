import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  fullLibrarySources,
  registerFullLibraryFromDisk,
} from "../../scripts/full-library-node";
import { carProject } from "../../src/catalog/builds/car";
import { jeepProject } from "../../src/catalog/builds/jeep";
import { occurrences } from "../../src/core/document";
import { mv, rotationY } from "../../src/core/math";
import { importLDraw, exportLDraw } from "../../src/ldraw/io";
import { partsList } from "../../src/inventory/parts-list";
import { deriveVehicleRigs } from "../../src/play/auto-vehicles";
import { PlaySession } from "../../src/play/session";
import { playSources } from "../helpers/play-dynamic-source";

registerFullLibraryFromDisk();
const cases = [
  ...["31027", "30572"].flatMap((number) =>
    [37, 90, 180].map((yaw) => ({
      name: `${number} at ${yaw} degrees`,
      project: () => {
        const text = readFileSync(
            `fixtures/play/official-cars/${number}-car.mpd`,
            "utf8",
          ),
          root = /^0 FILE (.+)$/m.exec(text)![1].trim();
        return importLDraw(
          `0 FILE yawed.ldr\n1 16 0 0 0 ${rotationY(yaw).join(" ")} ${root}\n${text}`,
        );
      },
    })),
  ),
  { name: "unrotated Roadster", project: carProject },
  { name: "unrotated Jeep", project: jeepProject },
];
for (const fixture of cases)
  it(`${fixture.name} native wheels follow rest-forward on default ground, reverse and steer`, async () => {
    const project = fixture.project(),
      before = JSON.stringify(project),
      source = exportLDraw(project),
      inventory = partsList(project, occurrences(project)),
      derived = Object.keys(project.motionRigs).length
        ? { rigs: project.motionRigs }
        : deriveVehicleRigs(project, {
            reserved: new Set(),
            maxRigs: 32,
            maxGroups: 128,
          }),
      id = Object.keys(derived.rigs)[0],
      rig = derived.rigs[id],
      forward = mv(rig.groups[0].frame.basis, [0, 0, -1]),
      dot = (p: number[]) => p.reduce((n, v, k) => n + v * forward[k], 0),
      prepared = await playSources(
        { ...project, motionRigs: derived.rigs },
        [id],
        fullLibrarySources(occurrences(project).map((o) => o.node.ref)),
      ),
      play = await PlaySession.create(
        prepared.geometry,
        { rigIds: [id], dynamicRigIds: [id], position: [400, -0.3, 400] },
        prepared.sources,
      );
    try {
      play.stepTicks(60);
      const rest = play.snapshot().mechanisms![id];
      play.setMechanismVehicleInput({ throttle: 1, steering: 0 }, id);
      const driven = play.stepTicks(90).mechanisms![id],
        displacement = driven.pose.vehicle!.position.map(
          (n, k) => n - rest.pose.vehicle!.position[k],
        );
      expect(dot(displacement)).toBeGreaterThan(30);
      expect(dot(displacement) / Math.hypot(...displacement)).toBeGreaterThan(
        0.95,
      );
      expect(driven.dynamics!.speed).toBeGreaterThan(10);
      // Native force limiting permits discrete acceleration overshoot; the
      // old world-axis sign let a 90-degree vehicle exceed 200 at a 160 cap.
      expect(driven.dynamics!.speed).toBeLessThan(rig.vehicle!.maxSpeed + 10);
      expect(Math.abs(driven.pose.vehicle!.headingDegrees)).toBeLessThan(1);
      expect(
        Object.values(driven.dynamics!.wheels!).filter((w) => w.contact).length,
      ).toBeGreaterThanOrEqual(2);
      play.setMechanismVehicleInput({ throttle: -1, steering: 0 }, id);
      const reversed = play.stepTicks(180).mechanisms![id];
      expect(
        dot(
          reversed.pose.vehicle!.position.map(
            (n, k) => n - driven.pose.vehicle!.position[k],
          ),
        ),
      ).toBeLessThan(-30);
      expect(reversed.dynamics!.speed).toBeLessThan(-10);
      expect(reversed.dynamics!.speed).toBeGreaterThan(
        -rig.vehicle!.maxSpeed - 10,
      );
      play.setMechanismVehicleInput({ throttle: 1, steering: 0.5 }, id);
      const turned = play.stepTicks(180).mechanisms![id];
      expect(Math.abs(turned.pose.vehicle!.headingDegrees)).toBeGreaterThan(1);
      expect(Number.isFinite(turned.dynamics!.speed)).toBe(true);
      expect(JSON.stringify(project)).toBe(before);
      expect(exportLDraw(project)).toBe(source);
      expect(partsList(project, occurrences(project))).toEqual(inventory);
    } finally {
      play.dispose();
    }
  }, 60000);
