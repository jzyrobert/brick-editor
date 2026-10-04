/** Plain metadata shared by the chooser, Play hints and build scripts. */
export const MOTION_SAMPLES = {
  "motor-gears": {
    title: "Motor & gears",
    file: "motor-gears.mpd",
    hint: "Open controls from Pause. Turn the gears or choose the pin arm.",
  },
  "rack-drive": {
    title: "Rack drive",
    file: "rack-drive.mpd",
    hint: "Open controls from Pause. Hold Forward or Reverse to slide the rack.",
  },
  "crank-slider": {
    title: "Crank & slider",
    file: "crank-slider.mpd",
    hint: "Open controls from Pause. Turn the crank to move the custom blue slider.",
  },
  "grab-lift": {
    title: "Grab & lift",
    file: "grab-lift.mpd",
    hint: "Open controls from Pause. Grab crate; Motor 2 lifts, Motor 1 carries.",
  },
} as const;
export type MotionSampleName = keyof typeof MOTION_SAMPLES;
export const isMotionSample = (name: string): name is MotionSampleName =>
  Object.hasOwn(MOTION_SAMPLES, name);
