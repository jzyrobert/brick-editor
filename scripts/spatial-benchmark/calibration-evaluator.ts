// Evaluator-only module. Never imported by the generation/session/compiler paths.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { importLDraw } from "../../src/ldraw/io";
import { occurrences } from "../../src/core/document";
import { checkBuild } from "../../src/catalog/builds/check";
import { localBounds } from "../../src/catalog/builds/kit";
import { registerFullLibraryFromDisk } from "../full-library-node";
import { registerAgentData } from "../build-script-cli";
import { ROOT, verifyFile } from "./sandbox";
import type { FrozenRun } from "./session";
import type { Vec3 } from "../../src/core/types";
export type Witness = {
  task: string;
  places: { part: string; at: number[]; turn: number }[];
  origins: number[][];
  bases: number[][];
  contacts: number;
  overlaps: number;
  extentLdu?: number[];
  perturb: { index: number; at: number[] };
  perturbedContacts: number;
  perturbedOverlaps: number;
};
export async function witnesses(): Promise<Witness[]> {
  return JSON.parse(
    await readFile(
      join(ROOT, "fixtures/spatial-benchmark/evaluator/witnesses.json"),
      "utf8",
    ),
  );
}
// Independent corner multiplication in LDraw units; no kit anchor conversion.
export function inspectCalibration(
  ldraw: string,
  w: Witness,
  poseOrder: "given" | "any" = "given",
) {
  registerFullLibraryFromDisk();
  registerAgentData();
  const project = importLDraw(ldraw, "calibration.mpd");
  const all = occurrences(project),
    checked = checkBuild(project);
  const equal = (a: number[], b: number[]) =>
    a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
  const matches = (index: number, expected: number) =>
    all[index].node.ref === w.places[expected].part + ".dat" &&
    equal(all[index].transform.position, w.origins[expected]) &&
    equal(all[index].transform.basis, w.bases[expected]);
  let poses = all.length === w.places.length;
  if (poses && poseOrder === "given")
    poses = w.places.every((_, i) => matches(i, i));
  if (poses && poseOrder === "any") {
    const unused = new Set(all.map((_, i) => i));
    for (let expected = 0; expected < w.places.length; expected++) {
      const index = [...unused].find((i) => matches(i, expected));
      if (index === undefined) {
        poses = false;
        break;
      }
      unused.delete(index);
    }
  }
  const points: Vec3[] = [];
  for (const o of all) {
    const b = localBounds(o.node.ref),
      r = o.transform.basis,
      t = o.transform.position;
    for (const x of [b.min[0], b.max[0]])
      for (const y of [b.min[1], b.max[1]])
        for (const z of [b.min[2], b.max[2]])
          points.push([
            t[0] + r[0] * x + r[1] * y + r[2] * z,
            t[1] + r[3] * x + r[4] * y + r[5] * z,
            t[2] + r[6] * x + r[7] * y + r[8] * z,
          ]);
  }
  const extent = [0, 1, 2].map(
    (i) =>
      Math.max(...points.map((p) => p[i])) -
      Math.min(...points.map((p) => p[i])),
  );
  return {
    version:
      poseOrder === "given"
        ? "calibration-evaluator/1"
        : "calibration-evaluator/2",
    task: w.task,
    records: [
      { property: "specified-poses", status: poses ? "verified" : "invalid" },
      {
        property: "supported-contact-count",
        status: checked.uncovered
          ? "unknown"
          : checked.studContacts === w.contacts
            ? "verified"
            : "invalid",
        expected: w.contacts,
        observed: checked.studContacts,
        interpretation:
          "No contact detected is not proof of incompatible parts.",
      },
      {
        property: "surface-occupancy-intersection",
        status: checked.unmeasured.length
          ? "unknown"
          : checked.overlaps.length === w.overlaps
            ? "verified"
            : "invalid",
        observed: checked.overlaps.length,
        certainty: "surface boxes; physical solid intersection unverified",
      },
      ...(w.extentLdu
        ? [
            {
              property: "physical-envelope",
              status: equal(extent, w.extentLdu) ? "verified" : "invalid",
              expected: w.extentLdu,
              observed: extent,
            },
          ]
        : []),
    ],
    coverage: {
      covered: checked.covered,
      uncovered: checked.uncovered,
      unmeasured: checked.unmeasured,
    },
    untested: ["structural stability", "clutch strength", "assembly sequence"],
    visualEvaluation: false,
  };
}
export async function evaluateCalibration(runDir: string, taskId: string) {
  const freeze = JSON.parse(
    await readFile(join(runDir, "freeze.json"), "utf8"),
  ) as FrozenRun;
  if (freeze.state !== "frozen" || !freeze.files["build.mpd"])
    throw new Error("No frozen compiled geometry");
  for (const [file, sha] of Object.entries(freeze.files)) {
    if (!["submission.txt", "compilation.json", "build.mpd"].includes(file))
      throw new Error("Invalid freeze path");
    await verifyFile(join(runDir, file), sha);
  }
  const witness = (await witnesses()).find((w) => w.task === taskId);
  if (!witness) throw new Error("Unknown calibration task");
  return inspectCalibration(
    await readFile(join(runDir, "build.mpd"), "utf8"),
    witness,
  );
}
