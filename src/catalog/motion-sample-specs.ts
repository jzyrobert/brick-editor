/** Plain metadata shared by the chooser, Play hints and build scripts. */
export const MOTION_SAMPLES = {
  "motor-gears": {
    title: "Motor & gears",
    file: "motor-gears.mpd",
    hint: "Use the mounted motor to turn the gears. Open controls from Pause.",
  },
  "rack-drive": {
    title: "Rack guide",
    file: "rack-drive.mpd",
    hint: "Open controls from Pause. Slide the blue rack inside its guide by hand.",
  },
} as const;
export type MotionSampleName = keyof typeof MOTION_SAMPLES;
export const isMotionSample = (name: string): name is MotionSampleName =>
  Object.hasOwn(MOTION_SAMPLES, name);
