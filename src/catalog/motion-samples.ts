import type { Project } from "../core/types";
import { technicFixture } from "../mechanisms/technic-fixture";
import { rackFixture } from "../mechanisms/rack-fixture";
import { loopFixture } from "../mechanisms/loop-fixture";
import { gripperFixture } from "../mechanisms/gripper-fixture";

/** Small, separate ready-to-play showcases keep native contact budgets bounded.
 * Their mechanics are the same reviewed arrangements used by acceptance tests. */
export {
  MOTION_SAMPLES,
  isMotionSample,
  type MotionSampleName,
} from "./motion-sample-specs";
import { MOTION_SAMPLES, type MotionSampleName } from "./motion-sample-specs";

export function motionSample(name: MotionSampleName): Project {
  const project =
    name === "motor-gears"
      ? technicFixture().project
      : name === "rack-drive"
        ? rackFixture().project
        : name === "crank-slider"
          ? loopFixture("slider-crank").project
          : gripperFixture().project;
  // Colour identifies the driver, output and independent arm without labels
  // covering the build. Only colour changes; source geometry and rest stay exact.
  const colors =
    name === "motor-gears"
      ? [7, 7, 4, 4, 7, 7, 1, 1, 7, 7, 7, 7, 14]
      : name === "rack-drive"
        ? [7, 7, 7, 4, 4, 7, 7, 1]
        : undefined;
  if (colors)
    project.models[project.rootModelId].nodes.forEach((node, i) => {
      if (node.kind === "part") node.colorCode = String(colors[i]);
    });
  if (name === "motor-gears") {
    // These independent joints have no transmission references. Give their
    // controls useful names while retaining the reviewed joint geometry.
    const joints = project.motionRigs["technic-drive"].joints;
    joints[2].id = "retaining-pin";
    joints[3].id = "pin-arm";
  }
  project.title = MOTION_SAMPLES[name].title;
  project.scene = { backdrop: "studio", playHint: MOTION_SAMPLES[name].hint };
  return project;
}
