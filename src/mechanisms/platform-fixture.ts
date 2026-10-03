import { importLDraw } from "../ldraw/io";
import { occurrences } from "../core/document";
import type { Vec3 } from "../core/types";
import type { MotionRig } from "./types";

/** Original CC0 moving-platform probes; no private or third-party model. */
export function movingPlatformFixture(kind: "lift" | "turntable" = "lift") {
  const lines = [
    "0 FILE platforms.ldr",
    "0 Moving platform probes",
    "0 !LICENSE CC0-1.0",
    "1 7 0 0 0 1 0 0 0 1 0 0 0 1 post.dat",
    "1 14 0 -24 0 1 0 0 0 1 0 0 0 1 deck.dat",
  ];
  const box = (name: string, a: Vec3, b: Vec3) => {
    lines.push(
      `0 FILE ${name}`,
      "0 !LDRAW_ORG Unofficial_Part",
      "0 !LICENSE CC0-1.0",
      "0 BFC CERTIFY CCW",
    );
    const p = [
      [a[0], a[1], a[2]],
      [b[0], a[1], a[2]],
      [b[0], b[1], a[2]],
      [a[0], b[1], a[2]],
      [a[0], a[1], b[2]],
      [b[0], a[1], b[2]],
      [b[0], b[1], b[2]],
      [a[0], b[1], b[2]],
    ];
    for (const f of [
      [0, 3, 2, 1],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 7, 6, 2],
      [0, 4, 7, 3],
      [1, 2, 6, 5],
    ])
      lines.push(`4 16 ${f.flatMap((i) => p[i]).join(" ")}`);
  };
  box("post.dat", [-20, -12, -20], [20, 0, 20]);
  box("deck.dat", [-150, -4, -150], [150, 4, 150]);
  lines.push("0 NOFILE");
  const project = importLDraw(lines.join("\n"), "platforms.mpd");
  const all = occurrences(project);
  const groups = all.map((o, i) => ({
    id: i ? "deck" : "post",
    occurrenceIds: [o.id],
    frame: structuredClone(o.transform),
    restTransforms: { [o.id]: structuredClone(o.transform) },
  }));
  const rig: MotionRig = {
    schemaVersion: 1,
    id: "platform",
    name: kind === "lift" ? "Moving lift" : "Turning platform",
    mode: "kinematic",
    dynamics: { groups: { deck: { massKg: 20 } } },
    groups,
    joints: [
      {
        id: "motion",
        kind: kind === "lift" ? "prismatic" : "revolute",
        bodyA: "post",
        bodyB: "deck",
        anchorA: [0, -24, 0],
        anchorB: [0, 0, 0],
        axisA: [0, -1, 0],
        axisB: [0, -1, 0],
        ...(kind === "lift" ? { limits: [0, 200] as [number, number] } : {}),
        motor: {
          mode: "velocity",
          target: kind === "lift" ? 30 : 45,
          maxEffort: { value: 10000, unit: kind === "lift" ? "N" : "N*m" },
        },
      },
    ],
  };
  project.motionRigs = { platform: rig };
  return project;
}
