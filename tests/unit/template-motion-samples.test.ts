import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MOTION_SAMPLES,
  type MotionSampleName,
} from "../../src/catalog/motion-samples";
import { template } from "../../src/catalog/templates";
import {
  SAMPLE_TEMPLATES,
  TEMPLATE_CARDS,
} from "../../src/catalog/template-names";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { templateLibraryFiles } from "../../scripts/offline-plugin";
import { occurrences } from "../../src/core/document";
import { exportLDraw } from "../../src/ldraw/io";
import { decodeNative, encodeNative } from "../../src/persistence/native";
import { validateRig } from "../../src/mechanisms/kinematic";
import { validate } from "../../src/core/validate";
import { partsList } from "../../src/inventory/parts-list";

beforeAll(() => expect(registerFullLibraryFromDisk()).toBe(true));
describe("ready-to-play motion samples", () => {
  for (const name of Object.keys(MOTION_SAMPLES) as MotionSampleName[])
    it(`${name} is selectable, source-exact and retains functional rigs in native saves`, async () => {
      const p = template(name);
      expect(SAMPLE_TEMPLATES).toContain(name);
      expect(TEMPLATE_CARDS.find((c) => c.name === name)?.title).toBe(p.title);
      validate("importRequest", { format: "template", template: name });
      for (const rig of Object.values(p.motionRigs)) validateRig(p, rig);
      expect(p.scene?.playHint).toBe(MOTION_SAMPLES[name].hint);
      expect(p.scene?.backdrop).toBe("studio");
      expect(occurrences(p)).toHaveLength(
        {
          "motor-gears": 13,
          "rack-drive": 8,
          "crank-slider": 4,
          "grab-lift": 5,
        }[name],
      );
      expect(
        readFileSync(
          "fixtures/ldraw/templates/" + MOTION_SAMPLES[name].file,
          "utf8",
        ),
      ).toBe(exportLDraw(p));
      const restored = await decodeNative(await encodeNative(p));
      expect(restored.motionRigs).toEqual(p.motionRigs);
      expect(restored.scene).toEqual(p.scene);
      expect(exportLDraw(restored)).toBe(exportLDraw(p));
      expect(partsList(restored, occurrences(restored))).toEqual(
        partsList(p, occurrences(p)),
      );
      if (name === "motor-gears") {
        expect(p.motionRigs["technic-drive"].transmissions).toMatchObject([
          { kind: "spur", teethA: 8, teethB: 24 },
        ]);
        expect(
          p.motionRigs["technic-drive"].joints.filter(
            (j) => j.kind === "revolute",
          ),
        ).toHaveLength(4);
      }
      if (name === "rack-drive")
        expect(p.motionRigs["rack-drive"].transmissions).toMatchObject([
          { kind: "rack", pitchRadiusLdu: -30 },
        ]);
      if (name === "crank-slider")
        expect(p.motionRigs["slider-crank"].loopClosures).toHaveLength(1);
      if (name === "grab-lift") {
        expect(p.motionRigs.crane.dynamics?.startDynamic).toBe(true);
        expect(p.motionRigs.crane.grippers).toHaveLength(1);
        expect(p.motionRigs.cargo.dynamics?.groups?.crate.anchored).toBe(false);
      }
    });
  it("precaches the full official part closure used by Technic samples", () => {
    const files = templateLibraryFiles(),
      manifest = JSON.parse(
        readFileSync(
          "public/libraries/ldraw-full-2026-09-28/manifest.json",
          "utf8",
        ),
      ),
      index = JSON.parse(
        readFileSync(
          "public/libraries/ldraw-full-2026-09-28/" + manifest.index.path,
          "utf8",
        ),
      );
    expect(files).toContain("libraries/ldraw-full-2026-09-28/manifest.json");
    const connectorLock = JSON.parse(
      readFileSync("src/catalog/full-connectors-lock.json", "utf8"),
    );
    expect(files).toContain(
      `libraries/${connectorLock.connectorPackId}/manifest.json`,
    );
    for (const name of ["motor-gears", "rack-drive"] as const)
      for (const o of occurrences(template(name)))
        for (const chunk of index.parts[o.node.ref]?.[0] ?? [])
          expect(files).toContain(
            "libraries/ldraw-full-2026-09-28/chunks/" +
              index.chunks[chunk][0] +
              ".bin",
          );
  });
});
