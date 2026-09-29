import { readFileSync } from "node:fs";
import lock from "../../src/play/avatar-pack-lock.json";
import {
  avatarSourcesFromPack,
  buildAvatarGeometry,
  type AvatarGeometry,
} from "../../src/play/avatar";

let cached: Promise<AvatarGeometry> | undefined;
/** The Play figure compiled from the committed pack (as the app does). */
export function avatarGeometryFromDisk() {
  const dir = `public/libraries/${lock.releaseId}/`;
  cached ??= avatarSourcesFromPack(
    readFileSync(dir + "manifest.json", "utf8"),
    new Uint8Array(readFileSync(dir + "bundle.txt")),
  ).then(buildAvatarGeometry);
  return cached;
}
