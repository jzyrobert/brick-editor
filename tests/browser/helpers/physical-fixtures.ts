import { execFileSync } from "node:child_process";
import type { MotionRig } from "../../../src/mechanisms/types";
let cached: { text: string; bytes: number[]; rig: MotionRig } | undefined;
/** Use tsx for generated catalogue JSON imports; source producers are fixed code. */
export function mountedMotorFixture() {
  cached ??= JSON.parse(
    execFileSync(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "--eval",
        `
    import { registerFullLibraryFromDisk } from './scripts/full-library-node';
    import { physicalMotorFixture } from './src/mechanisms/motor-fixture';
    import { encodeNative } from './src/persistence/native';
    registerFullLibraryFromDisk();
    const {project,text}=physicalMotorFixture();
    encodeNative(project).then(bytes => process.stdout.write(JSON.stringify({text,bytes:Array.from(bytes),rig:Object.values(project.motionRigs)[0]})));
  `,
      ],
      { encoding: "utf8" },
    ),
  );
  return cached!;
}
