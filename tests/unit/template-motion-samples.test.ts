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
          "twin-drive": 35,
          "large-motor": 13,
          "motor-gears": 15,
          "rack-drive": 2,
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
        ).toHaveLength(2);
      }
      if (name === "rack-drive") {
        expect(p.motionRigs["rack-drive"].transmissions ?? []).toEqual([]);
        expect(p.motionRigs["rack-drive"].joints).toMatchObject([
          { kind: "prismatic" },
        ]);
        expect(p.motionRigs["rack-drive"].joints[0].motor).toBeUndefined();
      }
      if (name === "large-motor") {
        const rig = p.motionRigs["pf-large-drive"];
        expect(rig.dynamics?.startDynamic).toBe(true);
        expect(rig.joints[0].motor?.binding?.profile).toBe(
          "power-functions-motor-l-v1",
        );
        expect(
          occurrences(p).filter((o) => o.node.ref === "99499.dat"),
        ).toHaveLength(1);
        expect(
          occurrences(p).find((o) => o.node.ref === "3707.dat")?.colorCode,
        ).toBe("4");
      }
      if (name === "twin-drive") {
        expect(p.motionRigs["twin-drive"].groups).toHaveLength(6);
        expect(p.motionRigs["twin-drive"].transmissions).toHaveLength(3);
        expect(
          p.motionRigs["twin-drive"].joints
            .filter((j) => j.motor)
            .map((j) => j.id),
        ).toEqual(["joint-0", "joint-3"]);
        for (const j of p.motionRigs["twin-drive"].joints.filter(
          (j) => j.motor,
        ))
          expect(j.motor!.binding?.profile).toBe("power-functions-motor-m-v1");
      }
      if (name === "motor-gears")
        expect(
          p.motionRigs["technic-drive"].joints[0].motor?.binding,
        ).toMatchObject({
          profile: "power-functions-motor-m-v1",
          occurrenceId: occurrences(p)[10].id,
        });
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
    const curated = JSON.parse(
      readFileSync("src/catalog/data.json", "utf8"),
    ).catalog;
    for (const name of Object.keys(MOTION_SAMPLES) as MotionSampleName[])
      for (const o of occurrences(template(name)))
        if (!curated[o.node.ref])
          for (const chunk of index.parts[o.node.ref]?.[0] ?? [])
            expect(files).toContain(
              "libraries/ldraw-full-2026-09-28/chunks/" +
                index.chunks[chunk][0] +
                ".bin",
            );
  });
});
