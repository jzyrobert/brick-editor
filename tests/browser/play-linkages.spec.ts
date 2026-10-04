import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { refusePointerLock } from "./helpers/pointer";
for (const kind of ["four-bar", "slider-crank"] as const)
  for (const dynamic of [false, true])
    test(`rendered ${dynamic ? "dynamic" : "kinematic"} ${kind} closes without changing source or inventory`, async ({
      page,
    }) => {
      await refusePointerLock(page);
      await page.goto("/?automation=1");
      await page.waitForFunction(() => !!window.brickEditor);
      const text = readFileSync(
        new URL(`../../fixtures/ldraw/${kind}.mpd`, import.meta.url),
        "utf8",
      );
      const result = await page.evaluate(
        async ({ text, kind, dynamic }) => {
          const api = window.brickEditor!;
          await api.project.import({
            format: "ldraw",
            name: `${kind}.mpd`,
            text,
          });
          await api.ready({ strict: true });
          const before = await api.query(),
            names = ["frame", "input", "rod", "output"],
            groups = before.occurrences.map((o, i) => ({
              id: names[i],
              occurrenceIds: [o.id],
              frame: structuredClone(o.transform),
              restTransforms: { [o.id]: structuredClone(o.transform) },
            }));
          const hinge = (
            id: string,
            bodyA: string,
            bodyB: string,
            anchorA: [number, number, number],
            anchorB: [number, number, number],
          ) => ({
            id,
            kind: "revolute" as const,
            bodyA,
            bodyB,
            anchorA: [
              anchorA[0],
              anchorA[1],
              -groups[names.indexOf(bodyA)].frame.position[2],
            ] as [number, number, number],
            anchorB: [
              anchorB[0],
              anchorB[1],
              -groups[names.indexOf(bodyB)].frame.position[2],
            ] as [number, number, number],
            axisA: [0, 0, 1] as [number, number, number],
            axisB: [0, 0, 1] as [number, number, number],
          });
          const drive = {
            ...hinge("drive", "frame", "input", [0, 0, 0], [0, 0, 0]),
            motor: {
              mode: "velocity" as const,
              target: 30,
              maxEffort: { value: 100, unit: "N*m" as const },
            },
          };
          const joints =
            kind === "four-bar"
              ? [
                  drive,
                  hinge("rod", "input", "rod", [0, -40, 0], [0, 0, 0]),
                  hinge("output", "rod", "output", [100, 0, 0], [0, 0, 0]),
                ]
              : [
                  drive,
                  hinge("rod", "input", "rod", [20, -20, 0], [0, 0, 0]),
                  {
                    id: "output",
                    kind: "prismatic" as const,
                    bodyA: "frame",
                    bodyB: "output",
                    anchorA: [80, 0, -groups[0].frame.position[2]] as [
                      number,
                      number,
                      number,
                    ],
                    anchorB: [0, 0, -groups[3].frame.position[2]] as [
                      number,
                      number,
                      number,
                    ],
                    axisA: [1, 0, 0] as [number, number, number],
                    axisB: [1, 0, 0] as [number, number, number],
                    limits: [-70, 20] as [number, number],
                  },
                ];
          const closure = {
            ...hinge(
              "closure",
              kind === "four-bar" ? "frame" : "rod",
              "output",
              kind === "four-bar" ? [100, 0, 0] : [60, 20, 0],
              kind === "four-bar" ? [0, 40, 0] : [0, 0, 0],
            ),
            dependentJointIds: ["rod", "output"],
          };
          const rig = {
            schemaVersion: 1 as const,
            id: kind,
            name: kind,
            mode: "kinematic" as const,
            groups,
            joints,
            loopClosures: [closure],
            dynamics: {
              groups: {
                frame: { anchored: true },
                input: { massKg: 1 },
                rod: { massKg: 1 },
                output: { massKg: 1 },
              },
            },
          };
          await api.dispatch({
            schemaVersion: 1,
            commandId: "save-loop",
            expectedRevision: before.revision,
            type: "rigs.upsert",
            payload: { rig },
          });
          await api.ready({ strict: true });
          await api.camera.fit();
          const source = new TextDecoder().decode(
            (await api.project.export({ format: "ldraw" })).bytes,
          );
          await api.play.enter({
            rigIds: [kind],
            ...(dynamic ? { dynamicRigIds: [kind] } : {}),
            position: [200, -0.3, 200],
            realtime: false,
          });
          const rest = await api.play.snapshot();
          const capture = async () => {
            const image = await api.render.image({
              revision: rest.sourceRevision,
              width: 256,
              height: 256,
              format: "png",
              visibility: { mode: "all" },
              background: { type: "solid", color: "#ffffff" },
              quality: "fast",
              strict: true,
            });
            return {
              bytes: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
              manifest: image.manifest,
            };
          };
          const restImage = await capture();
          await api.play.setJointTarget({
            rigId: kind,
            jointId: "drive",
            target: 45,
            speed: 90,
          });
          await api.play.stepTicks(600);
          const moved = await api.play.snapshot(),
            movedImage = await capture();
          const report = moved.mechanisms![kind],
            point = (body: string, p: number[]) => {
              const f = report.groupFrames[body];
              return f.position.map(
                (v, k) =>
                  v +
                  f.basis[k * 3] * p[0] +
                  f.basis[k * 3 + 1] * p[1] +
                  f.basis[k * 3 + 2] * p[2],
              );
            },
            a = point(closure.bodyA, closure.anchorA),
            b = point(closure.bodyB, closure.anchorB),
            error = Math.hypot(...a.map((v, k) => v - b[k]));
          const posed = await api.play.exportPosedModel();
          await api.play.exit();
          const after = new TextDecoder().decode(
              (await api.project.export({ format: "ldraw" })).bytes,
            ),
            unchanged = await api.query();
          await api.project.import({
            format: "ldraw",
            name: "posed.mpd",
            text: posed.text,
          });
          await api.ready({ strict: true });
          const imported = await api.query();
          return {
            report,
            error,
            restImage,
            movedImage,
            source,
            after,
            count: before.occurrences.length,
            unchangedCount: unchanged.occurrences.length,
            posedCount: imported.occurrences.length,
            restTransforms: rest.mechanisms![kind].transforms,
            posedTransforms: imported.occurrences.map((o) => o.transform),
          };
        },
        { text, kind, dynamic },
      );
      expect(result.report.jointTargets.drive.status).toBe("complete");
      expect(result.report.pose.jointPositions.drive).toBeCloseTo(45, 0);
      expect(result.error).toBeLessThan(dynamic ? 0.1 : 0.002);
      expect(result.movedImage.bytes).not.toEqual(result.restImage.bytes);
      expect(result.report.transforms).not.toEqual(result.restTransforms);
      expect(result.after).toBe(result.source);
      expect(result.count).toBe(4);
      expect(result.unchangedCount).toBe(4);
      expect(result.posedCount).toBe(4);
      Object.values(result.report.transforms).forEach((transform, i) => {
        transform.position.forEach((value, k) =>
          expect(result.posedTransforms[i].position[k]).toBeCloseTo(value, 4),
        );
        transform.basis.forEach((value, k) =>
          expect(result.posedTransforms[i].basis[k]).toBeCloseTo(value, 4),
        );
      });
    });
