#!/usr/bin/env node
// Deterministic data audit, no model, network or renderer calls.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { catalog } from "../src/catalog/catalog";
import { partSize } from "../src/build-script/part-search";
import { placement } from "../src/build-script/part-list";
import { registerAgentData } from "./build-script-cli";
import { registerFullLibraryFromDisk } from "./full-library-node";
import { hash } from "./spatial-benchmark/part-reference";
import { placementSize, REFERENCE_V2 } from "./spatial-benchmark/reference-v2";
export function auditReference() {
  registerFullLibraryFromDisk();
  registerAgentData();
  const rows = Object.values(catalog).map((p) => {
    const legacy = partSize(p),
      actual = placement(p.id),
      corrected = placementSize(p.id);
    const expected = { w: actual.x, d: actual.z, h: actual.plates };
    return {
      part: p.id,
      legacySearch: legacy,
      compilerPlacement: expected,
      correctedSearch: corrected,
      legacyAgrees: JSON.stringify(legacy) === JSON.stringify(expected),
      correctedAgrees: JSON.stringify(corrected) === JSON.stringify(expected),
    };
  });
  const files = [
    "prompts/build-agent.md",
    "prompts/brick-build.md",
    "src/catalog/data.json",
    "src/catalog/bounds.json",
    "src/build-script/part-search.ts",
    "src/build-script/part-list.ts",
    "src/catalog/builds/kit.ts",
    "scripts/spatial-benchmark/reference-v2.ts",
    "scripts/spatial-reference-audit.ts",
  ];
  return {
    version: "spatial-reference-audit/1",
    reference: REFERENCE_V2,
    scope:
      "curated nominal dimensions versus compiler placement; not physical geometry certification",
    sourceHashes: Object.fromEntries(
      files.map((p) => [p, hash(readFileSync(p))]),
    ),
    checked: rows.length,
    legacyDisagreements: rows.filter((r) => !r.legacyAgrees).length,
    correctedDisagreements: rows.filter((r) => !r.correctedAgrees).length,
    rows,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const out = process.argv.slice(2);
  if (out.length !== 2 || out[0] !== "--out")
    throw new Error(
      "Usage: npx tsx scripts/spatial-reference-audit.ts --out NEW_FILE.json",
    );
  const report = auditReference();
  writeFileSync(out[1], JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      checked: report.checked,
      legacyDisagreements: report.legacyDisagreements,
      correctedDisagreements: report.correctedDisagreements,
    }),
  );
}
