import { expect, test } from "vitest";
import { zipSync, strToU8, strFromU8 } from "fflate";
import {
  encodeNative,
  decodeNative,
  boundedUnzip,
} from "../../src/persistence/native";
import { template } from "../../src/catalog/templates";
test("native bundle exposes checksummed custom sources and embedded asset strings", async () => {
  const p = template("explore");
  p.assets["original-image"] = "data:image/png;base64,aGVsbG8=";
  const files = boundedUnzip(await encodeNative(p));
  expect(strFromU8(files["sources/project.mpd"])).toContain("Exploration room");
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  expect(strFromU8(files[manifest.assetFiles["original-image"]])).toBe(
    p.assets["original-image"],
  );
  expect(await decodeNative(zipSync(files))).toEqual(p);
  files["sources/project.mpd"] = strToU8("tampered");
  await expect(decodeNative(zipSync(files))).rejects.toThrow("checksum");
});
