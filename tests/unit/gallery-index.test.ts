import { expect, test } from "vitest";
import { gzipSync, strToU8 } from "fflate";
import {
  decodeGalleryIndex,
  galleryIndexEnabled,
  galleryAgentId,
  galleryAgentName,
  galleryBuildId,
  galleryFileUrl,
  galleryIndexFromRows,
  galleryPromptId,
  galleryStats,
  verifyGalleryBuild,
  type GalleryRow,
} from "../../src/catalog/gallery-index";
import { sha256 } from "../../src/core/hash";

const lock = { releaseId: "lib-1", manifestSha256: "f".repeat(64) };
const MPD = "0 FILE main.ldr\n1 4 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat\n";

async function row(over: Partial<GalleryRow> = {}): Promise<GalleryRow> {
  const sha = await sha256(MPD);
  return {
    build_id: galleryBuildId(sha),
    prompt_id: "japanese-buddhist-temple-2000",
    prompt_name: "Japanese temple",
    brief: "a japanese buddhist temple",
    target_parts: 2000,
    arena: 1,
    agent_id: "claude/claude-opus-5-5/high",
    display_name: "Claude Opus 5.5 (high)",
    model: "claude-opus-5-5",
    effort: "high",
    title: "Horyu-ji temple",
    mpd_sha: sha,
    mpd_bytes: strToU8(MPD).length,
    script_sha: "a".repeat(64),
    report_sha: null,
    renders: JSON.stringify({ iso: "b".repeat(64) }),
    parts: 1921,
    attempts: 2,
    seconds: 1148,
    cost_usd: 2.84,
    output_tokens: null,
    source: "japanese-temple-one-shot-claude",
    library_release: lock.releaseId,
    library_hash: lock.manifestSha256,
    warnings: 1,
    created_at: 1_790_000_000,
    ...over,
  };
}

test("prompt and agent ids are plain, stable slugs", () => {
  expect(galleryPromptId("a japanese buddhist temple", 2000)).toBe(
    "japanese-buddhist-temple-2000",
  );
  expect(galleryPromptId("  Château & Moat!  ")).toBe("chateau-moat");
  expect(() => galleryPromptId("!!!")).toThrow();
  expect(galleryAgentId("claude", "claude-opus-5-5", "high")).toBe(
    "claude/claude-opus-5-5/high",
  );
  expect(galleryAgentId("codex", "GPT 6.1 Sol")).toBe("codex/gpt-6-1-sol");
  expect(galleryAgentName("claude-opus-5-5", "xhigh")).toBe(
    "Claude Opus 5.5 (xhigh)",
  );
  expect(galleryAgentName("gpt-6.1-sol", "low")).toBe("GPT-6.1-Sol (low)");
  expect(galleryAgentName("mystery")).toBe("mystery");
});

test("generation metadata round-trips and unknown generations cannot appear as latest", async () => {
  const r = await row({
    generation_id: "e-fresh",
    generation_name: "E · fresh builds",
    generation_description: "Empty directory",
    generation_order: 90,
    generation_default: 1,
  });
  const index = galleryIndexFromRows([r], "https://files.example", new Date());
  expect(decodeGalleryIndex(index).generations).toEqual([
    {
      id: "e-fresh",
      name: "E · fresh builds",
      description: "Empty directory",
      order: 90,
      default: true,
    },
  ]);
  expect(index.builds[0].generation).toBe("e-fresh");
  expect(() =>
    decodeGalleryIndex({
      ...index,
      builds: [{ ...index.builds[0], generation: "unknown" }],
    }),
  ).toThrow("invalid");
  expect(
    decodeGalleryIndex({
      ...index,
      generations: index.generations!.map((g) => ({ ...g, default: false })),
      builds: [{ ...index.builds[0], generation: "unknown" }],
    }).builds,
  ).toEqual([]);
  expect(() =>
    decodeGalleryIndex({
      ...index,
      generations: [
        ...index.generations!,
        { ...index.generations![0], id: "f-fresh" },
      ],
    }),
  ).toThrow("invalid");
  const legacy = galleryIndexFromRows(
    [await row()],
    "https://files.example",
    new Date(),
  );
  expect(decodeGalleryIndex(legacy).builds).toHaveLength(1);
  expect(legacy).not.toHaveProperty("generations");
});

test("index generation from D1 rows round-trips through the decoder", async () => {
  const older = await row(),
    newer = await row({
      build_id: "0123456789ab",
      mpd_sha: "0123456789ab" + "0".repeat(52),
      agent_id: "codex/gpt-6-1-sol/low",
      display_name: "GPT-6.1-Sol (low)",
      model: "gpt-6.1-sol",
      effort: "low",
      cost_usd: null,
      created_at: 1_790_000_100,
    });
  const index = galleryIndexFromRows(
    [older, newer],
    "https://files.example",
    new Date("2026-10-03T18:00:00.123Z"),
  );
  expect(index.generated).toBe("2026-10-03T18:00:00Z");
  expect(index.builds.map((b) => b.id)).toEqual([
    "0123456789ab",
    older.build_id,
  ]);
  expect(index.builds[0]).not.toHaveProperty("costUsd");
  expect(index.builds[1]).toMatchObject({
    title: "Horyu-ji temple",
    costUsd: 2.84,
    warnings: 1,
    renders: { iso: "b".repeat(64) },
  });
  expect(index.builds[1]).not.toHaveProperty("report");
  expect(index.prompts).toEqual([
    {
      id: "japanese-buddhist-temple-2000",
      name: "Japanese temple",
      brief: "a japanese buddhist temple",
      targetParts: 2000,
      arena: true,
    },
  ]);
  expect(index.agents).toEqual([
    {
      id: "claude/claude-opus-5-5/high",
      name: "Claude Opus 5.5 (high)",
      model: "Claude Opus 5.5",
      effort: "high",
    },
    {
      id: "codex/gpt-6-1-sol/low",
      name: "GPT-6.1-Sol (low)",
      model: "GPT-6.1-Sol",
      effort: "low",
    },
  ]);
  expect(decodeGalleryIndex(JSON.parse(JSON.stringify(index)))).toEqual(index);
});

test("the decoder rejects bad envelopes and drops inconsistent builds", async () => {
  const index = galleryIndexFromRows(
    [await row()],
    "https://f.example",
    new Date(),
  );
  expect(() => decodeGalleryIndex(null)).toThrow(/invalid/);
  expect(() => decodeGalleryIndex({ ...index, v: 2 })).toThrow(/invalid/);
  expect(() =>
    decodeGalleryIndex({ ...index, files: "javascript:alert(1)" }),
  ).toThrow(/invalid/);
  const b = index.builds[0];
  for (const broken of [
    { ...b, id: "000000000000" }, // id is not the MPD hash prefix
    { ...b, agent: "nobody" },
    { ...b, renders: { iso: "../../etc" } },
    { ...b, mpdBytes: 1.5 },
  ])
    expect(decodeGalleryIndex({ ...index, builds: [broken] }).builds).toEqual(
      [],
    );
});

test("downloads are checked for size, hash and library release", async () => {
  const index = galleryIndexFromRows(
    [await row()],
    "https://f.example",
    new Date(),
  );
  const build = index.builds[0],
    gz = gzipSync(strToU8(MPD), { level: 9, mtime: 0 });
  const o = { maxBytes: 1 << 20, locks: [lock] };
  expect(await verifyGalleryBuild(build, gz, o)).toBe(MPD);
  await expect(
    verifyGalleryBuild(build, gzipSync(strToU8(MPD + "0\n")), o),
  ).rejects.toThrow(/does not match|limit/);
  await expect(
    verifyGalleryBuild(build, gzipSync(strToU8(MPD.replace("4", "1"))), o),
  ).rejects.toThrow(/checksum/);
  await expect(
    verifyGalleryBuild(build, new Uint8Array([1, 2, 3]), o),
  ).rejects.toThrow(/damaged|does not match/);
  await expect(
    verifyGalleryBuild(build, gz, { ...o, locks: [] }),
  ).rejects.toThrow(/library/);
  await expect(
    verifyGalleryBuild(build, gz, { ...o, maxBytes: 10 }),
  ).rejects.toThrow(/limit/);
  expect(galleryFileUrl("https://f.example/", "b", build.mpd)).toBe(
    `https://f.example/b/${build.mpd}.mpd.gz`,
  );
  expect(galleryStats(build)).toBe("1,921 parts · 19 min · $2.84");
});

test("only https pages (or an explicit request) read the published index", () => {
  expect(galleryIndexEnabled({ protocol: "https:", search: "" })).toBe(true);
  expect(galleryIndexEnabled({ protocol: "http:", search: "" })).toBe(false);
  expect(
    galleryIndexEnabled({ protocol: "http:", search: "?galleryIndex=1" }),
  ).toBe(true);
});
