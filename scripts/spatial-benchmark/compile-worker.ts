// Bundled and run in an empty Linux namespace. No renderer or evaluator imports.
import { readFileSync } from "node:fs";
import { runBrickBuild, withLine } from "../brick-build";
import { compileBuildScript } from "../../src/build-script/compile";
import {
  registerColorAvailability,
  type ColorAvailabilityPack,
} from "../../src/catalog/color-availability";
import colours from "../../src/catalog/color-availability.json";
import {
  registerFullLibraryFromDisk,
  fullLibraryOccupancy,
} from "../full-library-node";

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  registerColorAvailability(colours as ColorAvailabilityPack);
  registerFullLibraryFromDisk();
  const program = runBrickBuild(input.code, {
    seed: input.seed,
    timeoutMs: input.codeTimeoutMs,
  });
  if (input.aliases) {
    const walk = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [
            k,
            k === "part" &&
            typeof v === "string" &&
            Object.hasOwn(input.aliases, v)
              ? input.aliases[v]
              : walk(v),
          ]),
        );
      return value;
    };
    program.script = walk(program.script) as typeof program.script;
  }
  const result = compileBuildScript(program.script, {
    targetParts: input.target,
    occupancyFor: fullLibraryOccupancy,
    now: () => 0,
  });
  for (const p of result.report.problems)
    if (p.ops) p.ops = p.ops.map((op) => withLine(op, program.lines));
  process.stdout.write(
    JSON.stringify({
      script: program.script,
      report: result.report,
      ldraw: result.ldraw,
    }),
  );
} catch (e) {
  process.stdout.write(
    JSON.stringify({ failure: String((e as Error).message) }),
  );
}
