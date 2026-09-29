// Checks the colour-availability pack (scripts/build-color-availability.ts):
// hash lock, bound library, part names, colour codes and the picker palette.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  COLOR_AVAILABILITY_FORMAT,
  colorAvailabilityLock,
  paletteColors,
  type ColorAvailabilityPack,
} from "../src/catalog/color-availability";
import { fullLibraryLock } from "../src/catalog/full-library";
import { parseLDConfig } from "./color-joins";

export function validateColorAvailability() {
  const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  const bytes = readFileSync("src/catalog/color-availability.json");
  if (
    hash(bytes) !== colorAvailabilityLock.sha256 ||
    bytes.length !== colorAvailabilityLock.bytes
  )
    throw new Error(
      "Colour availability pack does not match its lock; run npm run library:colors",
    );
  const pack = JSON.parse(bytes.toString()) as ColorAvailabilityPack;
  if (
    pack.format !== COLOR_AVAILABILITY_FORMAT ||
    pack.packId !== colorAvailabilityLock.packId
  )
    throw new Error("Colour availability pack identity mismatch");
  if (
    pack.library.releaseId !== fullLibraryLock.releaseId ||
    pack.library.manifestSha256 !== fullLibraryLock.manifestSha256
  )
    throw new Error("Colour availability pack is bound to another library");
  const root = `public/libraries/${fullLibraryLock.releaseId}/`;
  const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
  const names = new Set(
    (
      JSON.parse(
        readFileSync(root + manifest.catalog.path, "utf8"),
      ) as string[][]
    ).map((e) => e[0]),
  );
  const ldraw = new Map(
    parseLDConfig(readFileSync(root + "LDConfig.ldr", "utf8")).map((c) => [
      c.code,
      c,
    ]),
  );
  const used = new Set<string>();
  for (const [name, p] of Object.entries(pack.parts)) {
    if (!names.has(name)) throw new Error("Availability for unknown " + name);
    if (!p.v?.length && !p.d?.length)
      throw new Error("Empty availability entry " + name);
    if (p.v?.length && !p.bl) throw new Error("Verified without item " + name);
    if (p.d?.length && !p.rb) throw new Error("Derived without part " + name);
    for (const c of [...(p.v ?? []), ...(p.d ?? [])]) {
      if (!ldraw.has(String(c)))
        throw new Error(`Unknown colour ${c} for ${name}`);
      used.add(String(c));
    }
  }
  const snapshot = JSON.parse(
    readFileSync("scripts/rebrickable-snapshot.json", "utf8"),
  ) as { retrieved: string; files: Record<string, { sha256: string }> };
  const derived = pack.sources.derived as {
    retrieved: string;
    sha256: Record<string, string>;
  };
  if (derived.retrieved !== snapshot.retrieved)
    throw new Error("Colour availability pack is from another snapshot");
  for (const [k, f] of Object.entries(snapshot.files))
    if (derived.sha256[k] !== f.sha256)
      throw new Error("Snapshot hash mismatch for " + k);
  if (new Set(paletteColors.map((c) => c.hex)).size !== paletteColors.length)
    throw new Error("Palette swatch hex values must be unique (glass tint)");
  const codes = new Set<string>();
  for (const c of paletteColors) {
    const def = ldraw.get(c.code);
    if (!def) throw new Error("Palette colour missing from LDConfig " + c.code);
    if (codes.has(c.code)) throw new Error("Palette colour twice " + c.code);
    codes.add(c.code);
    if (!!c.transparent !== (def.finish === "transparent"))
      throw new Error("Palette transparency differs from LDConfig " + c.code);
    if (!c.quick && !used.has(c.code))
      throw new Error("Palette colour without availability " + c.code);
  }
  return {
    packId: pack.packId,
    parts: Object.keys(pack.parts).length,
    palette: paletteColors.length,
  };
}
