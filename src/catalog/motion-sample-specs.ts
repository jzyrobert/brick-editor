/** Plain metadata shared by the chooser, Play hints and build scripts. */
export const MOTION_SAMPLES = {
  "large-motor": {
    title: "Large motor",
    file: "large-motor.mpd",
    hint: "Open Controls. Change power and direction to turn the red axle.",
  },
  "twin-drive": {
    title: "Twin motor table",
    file: "twin-drive.mpd",
    hint: "Open Controls. Compare the red reduction and blue direct drive.",
  },
  "motor-gears": {
    title: "Motor & gears",
    file: "motor-gears.mpd",
    hint: "Open Controls. Use the mounted motor to turn the gears.",
  },
  "rack-drive": {
    title: "Rack guide",
    file: "rack-drive.mpd",
    hint: "Open Controls. Slide the blue rack inside its guide by hand.",
  },
} as const;
export type MotionSampleName = keyof typeof MOTION_SAMPLES;
export const isMotionSample = (name: string): name is MotionSampleName =>
  Object.hasOwn(MOTION_SAMPLES, name);
