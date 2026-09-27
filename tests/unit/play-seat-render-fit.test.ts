import { expect, it } from "vitest";
import { Mesh, Vector3 } from "three";
import { BrickAvatar } from "../../src/play/avatar";
import { PlaySession } from "../../src/play/session";
import { openBenchFixture } from "../../src/mechanisms/fixtures";
import { movingSource } from "../helpers/play-moving-source";
import { conversion, inverse, mv } from "../../src/core/math";
import { seatPlacement } from "../../src/play/vehicle-seat";
import type { Vec3 } from "../../src/core/types";

it("rendered seated avatar stays inside declared body boxes at rotated seat headings", async () => {
  for (const yawDegrees of [0, 90, -135]) {
    const project = openBenchFixture();
    const seat = project.motionRigs.vehicle.vehicle!.driverSeat!;
    seat.yawDegrees = yawDegrees;
    // Raise the seat to isolate renderer/profile parity from bench fit.
    seat.pelvisPosition[1] = -60;
    const source = await movingSource("vehicle", project);
    const play = await PlaySession.create(
      source.geometry,
      {
        rigId: "vehicle",
        position: [80, -0.3, -188],
        cameraMode: "third-person",
      },
      source.mechanism,
    );
    const avatar = new BrickAvatar();
    try {
      play.enterVehicle({ rigId: "vehicle", seatId: seat.id });
      for (const offset of [-0.7, 0, 0.7]) {
        play.setInput({ yaw: (yawDegrees * Math.PI) / 180 + offset });
        const report = play.snapshot();
        avatar.update(report);
        avatar.group.updateMatrixWorld(true);
        const placement = seatPlacement(
          report.mechanism!.groupFrames[
            project.motionRigs.vehicle.vehicle!.chassisGroup
          ],
          seat,
        );
        let checked = 0;
        avatar.group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const vertices = object.geometry.getAttribute("position");
          for (let i = 0; i < vertices.count; i++) {
            const render = new Vector3()
              .fromBufferAttribute(vertices, i)
              .applyMatrix4(object.matrixWorld);
            const world = conversion(render.toArray() as Vec3);
            expect(
              placement.envelopes.some((box) => {
                const local = mv(
                  inverse(box.frame).basis,
                  world.map((v, k) => v - box.frame.position[k]) as Vec3,
                );
                return local.every(
                  (v, k) => Math.abs(v) <= box.halfExtents[k] + 1e-7,
                );
              }),
            ).toBe(true);
            checked++;
          }
        });
        expect(checked).toBeGreaterThan(100);
      }
    } finally {
      avatar.dispose();
      play.dispose();
    }
  }
});
