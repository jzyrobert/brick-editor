import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const root = "public/libraries/starter-2026-09-27/";
const digest = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
const manifest = JSON.parse(readFileSync(root + "manifest.json", "utf8"));
for (const f of manifest.files) {
  const bytes = readFileSync(root + f.path);
  f.sha256 = digest(bytes);
  f.bytes = bytes.length;
}
writeFileSync(root + "manifest.json", JSON.stringify(manifest, null, 2) + "\n");
const info = [
  ["3001", "Brick 2 × 4", 80, 40, 24],
  ["3003", "Brick 2 × 2", 40, 40, 24],
  ["3004", "Brick 1 × 2", 40, 20, 24],
  ["3005", "Brick 1 × 1", 20, 20, 24],
  ["3020", "Plate 2 × 4", 80, 40, 8],
  ["3022", "Plate 2 × 2", 40, 40, 8],
];
const catalog = Object.fromEntries(
  info.map(([id, name, x, z, h]) => [
    id + ".dat",
    {
      id: id + ".dat",
      name,
      width: x,
      depth: z,
      height: h,
      category: h === 8 ? "Plates" : "Bricks",
      source: "official",
      snapVerified: false,
      inventoryBoundary: true,
      geometryHash: manifest.files.find(
        (f: any) => f.path === `parts/${id}.dat`,
      ).sha256,
    },
  ]),
);
const mapping = {
  id: "curated-starter-1",
  version: 1,
  license: "CC0-1.0 (original curated factual correspondences)",
  verifiedDate: "2026-09-27",
  source:
    "Individually reviewed public catalogue identities; no bulk catalogue copied",
  sources: info.map(
    ([id]) => "https://www.bricklink.com/v2/catalog/catalogitem.page?P=" + id,
  ),
  colorSource: "https://www.bricklink.com/catalogColors.asp",
  parts: Object.fromEntries(
    info.map(([id]) => [
      "official:" + id + ".dat",
      { itemId: String(id), verifiedColors: ["0", "1", "4", "14", "15"] },
    ]),
  ),
  colors: {
    "0": "11",
    "1": "7",
    "4": "5",
    "14": "3",
    "15": "1",
    "2": "6",
    "19": "2",
    "71": "86",
    "72": "85",
    "40": "12",
  },
};
writeFileSync(
  "src/catalog/mappings.json",
  JSON.stringify(mapping, null, 2) + "\n",
);
const lock = {
  releaseId: manifest.releaseId,
  manifestSha256: digest(readFileSync(root + "manifest.json")),
  colorConfigSha256: digest(readFileSync(root + "LDConfig.ldr")),
};
writeFileSync(
  "src/catalog/data.json",
  JSON.stringify(
    {
      catalog,
      libraryLock: lock,
      mappingLock: {
        mappingPackId: mapping.id,
        mappingPackSha256: digest(readFileSync("src/catalog/mappings.json")),
      },
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  "public/notices/LDRAW.txt",
  "LDraw starter subset; originals retain author and licence headers.\nCC BY 4.0: https://creativecommons.org/licenses/by/4.0/\nSource: https://library.ldraw.org/\nNo geometry modifications. See library manifest for individual authors and hashes.\n" +
    manifest.files
      .map(
        (f: any) =>
          `${f.path}: ${f.authors.join("; ")} — ${f.license.join("; ")}`,
      )
      .join("\n") +
    "\n",
);
