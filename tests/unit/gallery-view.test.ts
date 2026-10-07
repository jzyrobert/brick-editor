import { expect, test } from "vitest";
import { galleryPrompts } from "../../src/catalog/gallery";
import type {
  GalleryBuild,
  GalleryIndex,
} from "../../src/catalog/gallery-index";

const build = (id: string, prompt: string, agent: string): GalleryBuild => ({
  id,
  prompt,
  agent,
  mpd: id.padEnd(64, "0"),
  mpdBytes: 100,
  renders: { iso: "a".repeat(64) },
  parts: 800,
  warnings: 0,
  library: { release: "lib", hash: "h" },
  created: "2026-10-07T20:00:00Z",
});
const index: GalleryIndex = {
  v: 1,
  generated: "2026-10-07T20:00:00Z",
  files: "https://gallery.example",
  prompts: [
    {
      id: "pelican-riding-a-bicycle-800",
      name: "Pelican on a bicycle",
      brief: "a pelican riding a bicycle",
      targetParts: 800,
      arena: true,
    },
    { id: "a-dragon-1000", brief: "a dragon", targetParts: 1000, arena: true },
  ],
  agents: [
    {
      id: "codex/gpt-6-1-sol/high",
      name: "GPT-6.1-Sol (high)",
      model: "GPT-6.1-Sol",
      effort: "high",
    },
    {
      id: "claude/claude-opus-5-5/high",
      name: "Claude Opus 5.5 (high)",
      model: "Claude Opus 5.5",
      effort: "high",
    },
    {
      id: "claude/claude-opus-5-5/medium",
      name: "Claude Opus 5.5 (medium)",
      model: "Claude Opus 5.5",
      effort: "medium",
    },
  ],
  builds: [
    build(
      "aaaaaaaaaaaa",
      "pelican-riding-a-bicycle-800",
      "codex/gpt-6-1-sol/high",
    ),
    build(
      "bbbbbbbbbbbb",
      "pelican-riding-a-bicycle-800",
      "claude/claude-opus-5-5/high",
    ),
    build("cccccccccccc", "a-dragon-1000", "claude/claude-opus-5-5/high"),
    build("dddddddddddd", "a-dragon-1000", "claude/claude-opus-5-5/medium"),
  ],
};

test("each prompt is a head-to-head of the models that answered it", () => {
  const [pelican, dragon] = galleryPrompts(index);
  expect(pelican.name).toBe("Pelican on a bicycle");
  expect(pelican.heading).toBe("One brief. Two models.");
  expect(pelican.note).toBe(
    "Claude Opus 5.5 and GPT-6.1-Sol, both at high effort, answered this brief.",
  );
  expect(pelican.entries.map((e) => e.agent)).toEqual([
    "Claude Opus 5.5",
    "GPT-6.1-Sol",
  ]);
  // Without a name the brief is the label; repeat takes by one model say so.
  expect(dragon.name).toBe("Dragon");
  expect(dragon.heading).toBe("One brief. Two takes.");
  expect(dragon.note).toBe("Every build here comes from Claude Opus 5.5.");
  expect(dragon.entries.map((e) => e.effort)).toEqual(["Medium", "High"]);
});
