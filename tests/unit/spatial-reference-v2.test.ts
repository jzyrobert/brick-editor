import { execFileSync } from "node:child_process";
import { compileBuildScript } from "../../src/build-script/compile";
import { occurrences } from "../../src/core/document";
import { emissionFacts } from "../../scripts/spatial-benchmark/reference-v2";
import { beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";
import {
  correctedSearch,
  referenceV2,
  placementSize,
  REFERENCE_V2,
} from "../../scripts/spatial-benchmark/reference-v2";
import { partReference } from "../../scripts/spatial-benchmark/part-reference";
import { catalog, libraryLock } from "../../src/catalog/catalog";
import { flatten } from "../../src/catalog/connector-extract";
import { placement } from "../../src/build-script/part-list";
import { searchParts } from "../../src/build-script/part-search";
import {
  validateManifest,
  effectivePrompt,
  schedule,
} from "../../scripts/spatial-benchmark/manifest";

beforeAll(() => {
  registerFullLibraryFromDisk();
  registerAgentData();
});
it("filters the palette before the global limit and keeps compiler dimensions", () => {
  const all = Object.keys(catalog);
  const top = new Set(searchParts({ limit: 200 }).map((p) => p.id));
  const missing = all.find((id) => !top.has(id))!;
  expect(missing).toBeDefined();
  expect(correctedSearch({}, [missing])).toHaveLength(1);
  for (const ref of all) {
    const result = correctedSearch({}, [ref])[0];
    expect(result.part).toBe(ref);
    const p = placement(ref);
    expect(result.nominal).toEqual({
      xStuds: p.x,
      zStuds: p.z,
      stackingPlates: p.plates,
    });
    expect(correctedSearch({ size: `${p.x}x${p.z}` }, [ref])).toHaveLength(1);
  }
});
it("reports unknown dimensions as null, preserves partial-match disclosures and alias names", () => {
  expect(placementSize("absent.dat")).toBeNull();
  const r = correctedSearch({ query: "brick flibberty" }, ["3001.dat"], true);
  expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ name: null, partial: true });
  expect(correctedSearch({ query: "tile" }, ["3001.dat"])).toHaveLength(0);
});
it("returns deterministic v2 facts without modifying v1 or claiming complete validation", () => {
  const original = JSON.stringify(partReference("3659", ["shape"]));
  const a = referenceV2("3659", ["shape", "capabilities"]);
  expect(a.version).toBe(REFERENCE_V2);
  expect(a.capabilities?.propertyCoverage.studMating).toBe("partially");
  expect(a.shape?.description.value?.opening).toMatchObject({
    min: [25, 0, -1],
    max: [55, 8, 21],
  });
  expect(JSON.stringify(partReference("3659", ["shape"]))).toBe(original);
  expect(a).toEqual(referenceV2("3659", ["shape", "capabilities"]));
});
it("checks the corrected arch passage through pinned faces and detects a shifted obstruction", () => {
  const root = `public/libraries/${libraryLock.releaseId}`;
  const manifest = JSON.parse(
    readFileSync(join(root, "manifest.json"), "utf8"),
  );
  const sources: Record<string, string> = {};
  for (const f of manifest.files)
    if (f.path !== "LDConfig.ldr")
      sources[f.path.replace(/^(parts|p)\//, "")] = readFileSync(
        join(root, f.path),
        "utf8",
      );
  const tris = flatten(sources, "3659.dat").tris;
  // Independent Sutherland–Hodgman clipping in source LDraw coordinates.
  const clip = (
    poly: number[][],
    axis: number,
    bound: number,
    greater: boolean,
  ) => {
    const inside = (p: number[]) =>
      greater ? p[axis] > bound : p[axis] < bound;
    const out: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        ia = inside(a),
        ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = (bound - a[axis]) / (b[axis] - a[axis]);
        out.push(a.map((v, j) => v + t * (b[j] - v)));
      }
    }
    return out;
  };
  const intersects = (min: number[], max: number[]) =>
    tris.some((tri) => {
      let poly: number[][] = tri;
      for (let i = 0; i < 3; i++) {
        poly = clip(poly, i, min[i] + 0.001, true);
        poly = clip(poly, i, max[i] - 0.001, false);
      }
      return poly.length > 0;
    });
  // Literal conversion: source x = local x - 40, y = 24 - local y, z = local z - 10.
  const opening = referenceV2("3659", ["shape"]).shape!.description.value!
    .opening!;
  expect(opening.min[1]).toBeGreaterThanOrEqual(0);
  expect(opening.max[1]).toBeGreaterThan(opening.min[1]);
  expect(opening.min[2]).toBeLessThan(0);
  expect(opening.max[2]).toBeGreaterThan(20);
  expect(
    intersects(
      [opening.min[0] - 40, 24 - opening.max[1], opening.min[2] - 10],
      [opening.max[0] - 40, 24 - opening.min[1], opening.max[2] - 10],
    ),
  ).toBe(false);
  expect(intersects([-15, 0, -11], [15, 8, 11])).toBe(true);
  expect(intersects([20, 16, -11], [40, 24, 11])).toBe(true);
});
it("validates a v2 exact-count manifest and supplies corrected baseline data independently of shape treatment", () => {
  const raw = JSON.parse(
    readFileSync(
      "fixtures/spatial-benchmark/manifests/calibration.json",
      "utf8",
    ),
  );
  raw.buildSeed = 7;
  raw.factsVersion = REFERENCE_V2;
  raw.tasks[0].sizePolicy = "exact";
  raw.conditions[0].facts = [];
  const m = validateManifest(raw),
    c = schedule(m)[0];
  const text = effectivePrompt(m, c);
  expect(text).toContain("Generation reference v2");
  expect(text).toContain("compiler-placement-reservation");
  expect(text).toContain("Task validity requires exactly");
  expect(text).not.toContain("do not trade design for an exact count");
  expect(text).not.toContain("clockwise seen from above");
  expect(text).toContain('"seed": 7');
  expect(text).not.toContain('"seed": 1');
  expect(text).not.toContain("Shape facts v2");
  raw.tasks[0].sizePolicy = "approximately";
  expect(() => validateManifest(raw)).toThrow(/size policy/);
});

it("reports auto panes, wheel expansion and origin-anchor behavior from actual compilation", () => {
  for (const part of ["60592.dat", "60593.dat", "60594.dat", "4600.dat"]) {
    for (const origin of [false, true]) {
      const meta = emissionFacts(part);
      const r = compileBuildScript({
        buildScript: 1,
        title: "Companions",
        sections: [
          {
            name: "Parts",
            ops: [
              {
                op: "place",
                part,
                at: [0, 2, 0],
                colour: 0,
                ...(origin ? { anchor: "origin" } : {}),
                ...(part === "4600.dat" ? { wheels: 4 } : {}),
              },
            ],
          },
        ],
      });
      expect(
        r.report.ok,
        JSON.stringify({ part, origin, problems: r.report.problems }),
      ).toBe(true);
      expect(r.report.stats.parts).toBe(
        origin
          ? meta.originAnchorInstances
          : (meta.withWheelsInstances ?? meta.defaultPlaceInstances),
      );
      const refs = occurrences(r.project!).map((o) => o.node.ref);
      for (const companion of meta.automaticCompanions)
        expect(refs.includes(companion)).toBe(!origin);
    }
  }
});

it("composes full-library inputs identically before and after host registration in a fresh process", () => {
  const code = `
    import { readFileSync } from "node:fs";
    import { validateManifest, schedule, effectivePrompt } from "./scripts/spatial-benchmark/manifest.ts";
    import { registerFullLibraryFromDisk } from "./scripts/full-library-node.ts";
    import { registerAgentData } from "./scripts/build-script-cli.ts";
    const raw=JSON.parse(readFileSync("fixtures/spatial-benchmark/manifests/reference-v2.json","utf8"));
    raw.tasks[0].palette=["3001p01.dat"];raw.tasks[0].inventory=null;
    const m=validateManifest(raw),c=schedule(m)[0];
    const before=effectivePrompt(m,c);registerFullLibraryFromDisk();registerAgentData();
    const after=effectivePrompt(m,c);
    console.log(JSON.stringify({same:before===after,known:before.includes('"xStuds":4'),unknown:before.includes('"nominal":{"value":null')}));
  `;
  expect(
    JSON.parse(
      execFileSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", code],
        { encoding: "utf8" },
      ),
    ),
  ).toEqual({ same: true, known: true, unknown: false });
}, 15000);
