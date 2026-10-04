import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

describe("reviewed source-region reconstruction", () => {
  it("rebuilds both frozen coordinate streams and every native lower-rank support offline", () => {
    const directory = mkdtempSync(tmpdir() + "/brick-region-test-");
    try {
      execFileSync(
        process.execPath,
        [
          root + "node_modules/tsx/dist/cli.mjs",
          root + "scripts/build-reviewed-source-regions.ts",
          directory,
        ],
        { cwd: root },
      );
      for (const [
        ref,
        expectedRegions,
        expectedHash,
        expectedManifestHash,
        children,
        ranks,
        expectedNativeHash,
      ] of [
        [
          "18940.dat",
          900,
          "68be3f1c17e2b30cb82d09f9ea8a8ae94c1cd64f22cf2bfea1c0fb0b02472414",
          "8accfb04d89e4ace6d074a406bbc65711ec535dd3eb8b9f7dda0ac7e15eaf029",
          927,
          [0, 3, 26, 871],
          "d4ef6073722bed3a4568e491cc00cdc553977d2f8f850e7b8d7ca3b3f7f46ec9",
        ],
        [
          "18942.dat",
          1245,
          "51f01244f4af0cc600cc620ef81a5e40f86b872a3cd8f102c4888b4d27f68343",
          "8c808a1d2ce4cd7318e6fb79ba09f4c8b5ff1114a5996307d02d7adff4488537",
          1245,
          [0, 0, 0, 1245],
          "58da6a2b709d77151706db93faeac849156cdbc906ac6887de2dd4304511c95a",
        ],
      ] as const) {
        const input = directory + "/" + ref + ".json",
          output = directory + "/" + ref + ".native.json";
        const raw = readFileSync(input, "utf8"),
          manifest = JSON.parse(raw);
        expect(manifest.regions).toHaveLength(expectedRegions);
        expect(hash(JSON.stringify(manifest.regions))).toBe(expectedHash);
        expect(hash(raw)).toBe(expectedManifestHash);
        expect(manifest.source.ref).toBe(ref);
        expect(manifest.source.license).toBe("CC BY 4.0");
        execFileSync(
          "python3",
          [
            root + "scripts/build-reviewed-native-regions.py",
            "--input",
            input,
            "--output",
            output,
          ],
          { cwd: root },
        );
        const native = JSON.parse(readFileSync(output, "utf8"));
        expect(native.regionCount).toBe(expectedRegions);
        expect(native.childCount).toBe(children);
        expect(native.regionInputSha256).toBe(expectedManifestHash);
        expect(native.source).toEqual(manifest.source);
        expect(
          [0, 1, 2, 3].map(
            (rank) =>
              native.regions.filter((r: { rank: number }) => r.rank === rank)
                .length,
          ),
        ).toEqual(ranks);
        execFileSync(
          process.execPath,
          [
            root + "node_modules/prettier/bin/prettier.cjs",
            "--ignore-path",
            "/dev/null",
            "--write",
            output,
          ],
          { cwd: root },
        );
        expect(hash(readFileSync(output, "utf8"))).toBe(expectedNativeHash);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
