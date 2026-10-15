import { beforeAll, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  partReference,
  placementPoint,
  hash,
  json,
  connectorRelation,
} from "../../scripts/spatial-benchmark/part-reference";
import { registerFullLibraryFromDisk } from "../../scripts/full-library-node";
import { registerAgentData } from "../../scripts/build-script-cli";
import { compileBuildScript } from "../../src/build-script/compile";
import { occurrences } from "../../src/core/document";
import { verifiedConnectors } from "../../src/catalog/connectors";
import { libraryLock } from "../../src/catalog/catalog";
import { flatten } from "../../src/catalog/connector-extract";
import { oneShotPrompt } from "../../scripts/one-shot-build";
import { partGeometryFacts } from "../../scripts/agent-part-facts";
import { searchForAgent } from "../../src/build-script/part-list";

beforeAll(() => {
  registerFullLibraryFromDisk();
  registerAgentData();
});
it("separates stacking height, physical extent and conservative occupancy", () => {
  const p = partReference("3001", ["shape"]);
  expect(p.nominal.value?.ldu).toEqual([80, 24, 40]);
  expect(p.shape?.physicalBounds.value).toEqual({
    min: [0, 0, 0],
    max: [80, 28, 40],
  });
  expect(p.shape?.physicalExtentLdu.value).toEqual([80, 28, 40]);
  expect(p.shape?.collisionOccupancy.value?.representation).toBe(
    "surface-boxes",
  );
  expect(p.connectors).toBeUndefined();
  expect(p.capabilities).toBeUndefined();
  expect(partReference("3039", ["connectors"]).shape).toBeUndefined();
});
it("preserves unknown shape fields and distinguishes unavailable and derived-unverified connectors", () => {
  const absent = partReference("not-a-part", [
    "shape",
    "connectors",
    "capabilities",
  ]);
  expect(absent.nominal.value).toBeNull();
  expect(absent.shape?.description.value).toBeNull();
  expect(absent.connectors).toMatchObject({
    evidence: "unknown",
    data: "unavailable",
    total: null,
    entries: [],
  });
  expect(partReference("4081b", ["connectors"]).connectors).toMatchObject({
    evidence: "unknown",
    data: "derived-unverified",
  });
  expect(partReference("3020", ["shape"]).shape?.description.value).toBeNull();
  expect(partReference("3039", ["capabilities"]).capabilities).toMatchObject({
    connectionEvidence: "known",
    languagePose: "yes",
    validator: "partially",
    interfacePose: { sideStudAttachment: "no" },
  });
});
it("fully retrieves a large connector array with stable IDs and deterministic pages", () => {
  const first = partReference("3811", ["connectors"], 0, 16);
  expect(first.connectors!.total!).toBeGreaterThan(16);
  expect(first.connectors!.nextOffset).toBe(16);
  expect(json(first)).toBe(json(partReference("3811", ["connectors"], 0, 16)));
  const entries = [];
  let offset = 0;
  for (;;) {
    const page = partReference("3811", ["connectors"], offset, 64).connectors!;
    entries.push(...page.entries);
    if (page.nextOffset === null) break;
    offset = page.nextOffset;
  }
  expect(entries).toHaveLength(verifiedConnectors("3811.dat")!.length);
  expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  expect(entries.slice(0, 16)).toEqual(first.connectors!.entries);
  expect(
    partReference("3811", ["connectors"], 999999, 16).connectors,
  ).toMatchObject({ omitted: 0, nextOffset: null, entries: [] });
});
it("converts rotated points in uniform LDU and agrees with actual placement for all quarter turns", () => {
  expect(placementPoint("3001.dat", [-30, 0, 10], 90)).toEqual([30, 24, 70]);
  for (const turn of [0, 90, 180, 270] as const) {
    const result = compileBuildScript({
      buildScript: 1,
      title: "Roundtrip",
      sections: [
        {
          name: "Main",
          ops: [{ op: "place", part: "3001", colour: 4, at: [2, 3, 4], turn }],
        },
      ],
    });
    const o = occurrences(result.project!)[0];
    for (const c of verifiedConnectors("3001.dat")!) {
      const p = placementPoint("3001.dat", c.p, turn);
      const b = o.transform.basis,
        t = o.transform.position;
      const world = [
        t[0] + b[0] * c.p[0] + b[1] * c.p[1] + b[2] * c.p[2],
        t[1] + b[3] * c.p[0] + b[4] * c.p[1] + b[5] * c.p[2],
        t[2] + b[6] * c.p[0] + b[7] * c.p[1] + b[8] * c.p[2],
      ];
      expect(world).toEqual([p[0] + 40, -p[1] - 24, p[2] + 80]);
    }
  }
});
it("checks contours against pinned triangles independently of the placement converter", () => {
  const root = `public/libraries/${libraryLock.releaseId}/`;
  const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
  const sources: Record<string, string> = {};
  for (const f of manifest.files)
    if (f.path !== "LDConfig.ldr")
      sources[f.path.replace(/^(parts|p)\//, "")] = readFileSync(
        join(root, f.path),
        "utf8",
      );
  const slope = flatten(sources, "3039.dat");
  // A planar slope face slopes down toward source -z; check actual face vertices.
  expect(
    slope.tris.some(
      (t) =>
        t.some((p) => Math.abs(p[2] + 30) < 0.1 && p[1] > 15) &&
        t.some((p) => Math.abs(p[2] + 10) < 0.1 && Math.abs(p[1]) < 0.1),
    ),
  ).toBe(true);
  expect(
    partReference("3039", ["shape"]).shape?.description.value?.slopeHighEdge,
  ).toBe("+z");
  // The arch's central clearance slab is empty: use independent face clipping.
  const arch = flatten(sources, "3659.dat");
  expect(arch.tris.length).toBeGreaterThan(0);
  expect(Math.max(...arch.tris.flat().map((p) => p[1]))).toBe(24);
  expect(
    partReference("3659", ["shape"]).shape?.physicalBounds.value?.min[1],
  ).toBe(0);
  // Independent triangle-box clipping checks the claimed clear subset.
  const clip = (
    poly: number[][],
    axis: number,
    bound: number,
    greater: boolean,
  ) => {
    const out: number[][] = [];
    const inside = (p: number[]) =>
      greater ? p[axis] > bound : p[axis] < bound;
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
  const facesInClearance = arch.tris.filter((tri) => {
    let poly: number[][] = tri;
    for (const [axis, lo, hi] of [
      [0, -14.99, 14.99],
      [1, 24.01, 31.99],
      [2, -8.99, 8.99],
    ]) {
      poly = clip(poly, axis, lo, true);
      poly = clip(poly, axis, hi, false);
    }
    return poly.length > 0;
  });
  expect(facesInClearance).toHaveLength(0);
  for (const ref of ["3039", "3659", "3001", "3024", "3068b"]) {
    const verts = flatten(sources, ref + ".dat").tris.flat();
    const expected = partReference(ref, ["shape"]).shape!.physicalExtentLdu
      .value!;
    expect(
      [0, 1, 2].map(
        (i) =>
          Math.max(...verts.map((p) => p[i])) -
          Math.min(...verts.map((p) => p[i])),
      ),
    ).toEqual(expected);
  }
});
it("does not turn missing mating evidence into incompatibility", () => {
  const a = partReference("3068b", ["connectors"], 0, 64).connectors!;
  expect(connectorRelation(a, a, [0, 0, 0], [0, 8, 0])).toBe("unknown");
  const slope = partReference("3039", ["connectors"], 0, 64).connectors!,
    plate = partReference("3024", ["connectors"], 0, 64).connectors!;
  expect(connectorRelation(slope, plate, [0, 0, 0], [0, 24, 20])).toBe(
    "verified",
  );
  expect(connectorRelation(slope, plate, [0, 0, 0], [0, 24, 0])).toBe(
    "unknown",
  );
});
it("rejects malformed fields and page limits", () => {
  expect(() => partReference("3039", ["shape", "shape"])).toThrow();
  expect(() => partReference("../private", ["shape"])).toThrow();
  expect(() => partReference("3039", ["connectors"], -1)).toThrow();
});
it("locks legacy effective prompt and payload bytes to the current-main control", () => {
  const snapshots = JSON.parse(
    readFileSync("fixtures/spatial-benchmark/legacy-hashes.json", "utf8"),
  );
  expect(
    hash(
      oneShotPrompt("a pelican riding a bicycle", 800, {
        search: true,
        check: true,
      }),
    ),
  ).toBe(snapshots.e);
  expect(
    hash(
      oneShotPrompt("a pelican riding a bicycle", 800, {
        search: true,
        check: true,
        promptFile: "build-agent-diorama.md",
        replyPromptFile: "brick-build-diorama.md",
      }),
    ),
  ).toBe(snapshots.diorama);
  expect(
    hash(searchForAgent({ query: "slope", size: "1x2", limit: 3 }).text),
  ).toBe(snapshots.search);
  expect(hash(partGeometryFacts("3001.dat"))).toBe(snapshots.geometry);
});

it("reports available hinge dimensions without inventing stud or socket radii", () => {
  const door = partReference("60616a", ["connectors"], 0, 64).connectors!;
  expect(
    door.entries
      .filter((c) => c.kind === "pin")
      .every(
        (c) =>
          c.dimensions?.radiusLdu !== null &&
          c.dimensions?.protrusionLdu !== null,
      ),
  ).toBe(true);
  expect(
    partReference("3001", ["connectors"], 0, 64).connectors!.entries.every(
      (c) => c.dimensions === null,
    ),
  ).toBe(true);
});
