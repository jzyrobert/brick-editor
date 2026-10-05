import type { Project } from "../core/types";
import { physicalMotorFixture } from "../mechanisms/motor-fixture";
import { manualRackFixture } from "../mechanisms/rack-guide-fixture";
import { twinDriveFixture } from "../mechanisms/twin-drive-fixture";
import { physicalPfLargeMotorFixture } from "../mechanisms/pf-large-motor-fixture";
export {
  MOTION_SAMPLES,
  isMotionSample,
  type MotionSampleName,
} from "./motion-sample-specs";
import { MOTION_SAMPLES, type MotionSampleName } from "./motion-sample-specs";

/** Separate, source-connected samples keep the native contact budget bounded. */
export function motionSample(name: MotionSampleName): Project {
  const project =
    name === "large-motor"
      ? physicalPfLargeMotorFixture().project
      : name === "twin-drive"
        ? twinDriveFixture().project
        : name === "motor-gears"
          ? physicalMotorFixture().project
          : manualRackFixture().project;
  if (name === "large-motor")
    project.motionRigs["pf-large-drive"].dynamics = { startDynamic: true };
  if (name !== "twin-drive" && name !== "large-motor") {
    const colors =
      name === "motor-gears"
        ? [7, 7, 4, 4, 7, 7, 1, 1, 7, 7, 7, 7, 7, 7, 7]
        : [7, 1];
    project.models[project.rootModelId].nodes.forEach((node, i) => {
      if (node.kind === "part") node.colorCode = String(colors[i]);
    });
  }
  project.title = MOTION_SAMPLES[name].title;
  project.scene = { backdrop: "studio", playHint: MOTION_SAMPLES[name].hint };
  return project;
}
