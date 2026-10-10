import { expect, test } from "vitest";
import {
  DEFAULT_GALLERY_FILTERS,
  filterGallery,
  galleryPrompts,
} from "../../src/catalog/gallery";
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

test("gallery search combines prompt, title, model and effort without changing the source", () => {
  const prompts = galleryPrompts(index);
  const before = JSON.stringify(prompts);
  expect(
    filterGallery(prompts, {
      ...DEFAULT_GALLERY_FILTERS,
      query: "  PELICAN   gpt high  ",
    }).flatMap((p) => p.entries.map((e) => e.id)),
  ).toEqual(["aaaaaaaaaaaa"]);
  expect(
    filterGallery(prompts, {
      ...DEFAULT_GALLERY_FILTERS,
      prompt: "a-dragon-1000",
      model: "Claude Opus 5.5",
      effort: "Medium",
    }).flatMap((p) => p.entries.map((e) => e.id)),
  ).toEqual(["dddddddddddd"]);
  expect(
    filterGallery(prompts, {
      ...DEFAULT_GALLERY_FILTERS,
      prompt: "a-dragon-1000",
      model: "GPT-6.1-Sol",
    }),
  ).toEqual([]);
  expect(JSON.stringify(prompts)).toBe(before);
});

test("gallery search reads full briefs and accent-insensitive titles, including missing efforts", () => {
  const prompts = galleryPrompts(index);
  prompts[0].entries[0].title = "Café by the sea";
  prompts[0].entries[0].effort = undefined;
  const find = (query: string) =>
    filterGallery(prompts, { ...DEFAULT_GALLERY_FILTERS, query });
  expect(find("cafe sea")[0].entries[0].title).toBe("Café by the sea");
  expect(find("riding bicycle")[0].id).toBe(prompts[0].id);
  expect(find("not published")).toEqual([]);
  expect(find(" \n ")).toHaveLength(2);
});

test("gallery sorts prompt groups by their matching builds and offers alphabetical browsing", () => {
  const prompts = galleryPrompts(index);
  prompts[0].entries[1].build = {
    ...prompts[0].entries[1].build,
    created: "2026-10-09T20:00:00Z",
  };
  const latest = filterGallery(prompts, DEFAULT_GALLERY_FILTERS);
  expect(latest[0].name).toBe("Pelican on a bicycle");
  expect(latest[0].entries[0].agent).toBe("GPT-6.1-Sol");
  expect(
    filterGallery(prompts, { ...DEFAULT_GALLERY_FILTERS, sort: "prompt" }).map(
      (p) => p.name,
    ),
  ).toEqual(["Dragon", "Pelican on a bicycle"]);
  expect(filterGallery([], DEFAULT_GALLERY_FILTERS)).toEqual([]);
});

test("latest selects the featured generation even when F is newer; history combines with other filters", () => {
  const collection: GalleryIndex = {
    ...index,
    generations: [
      {
        id: "e-fresh",
        name: "E · fresh builds",
        description: "Empty directory",
        order: 3,
        default: true,
      },
      {
        id: "f-fresh",
        name: "F · fresh builds",
        description: "Empty directory",
        order: 2,
      },
      {
        id: "e-revision",
        name: "E · source revisions",
        description: "Supplied source",
        order: 1,
      },
    ],
    builds: index.builds.map((b, i) => ({
      ...b,
      generation: i < 2 ? "e-fresh" : i === 2 ? "f-fresh" : "e-revision",
      created: i === 2 ? "2026-10-11T20:00:00Z" : b.created,
    })),
  };
  const prompts = galleryPrompts(collection);
  const ids = (generation: string, extra = {}) =>
    filterGallery(prompts, {
      ...DEFAULT_GALLERY_FILTERS,
      generation,
      ...extra,
    }).flatMap((p) => p.entries.map((e) => e.id));
  expect(ids("latest")).toEqual(["bbbbbbbbbbbb", "aaaaaaaaaaaa"]);
  expect(ids("")).toHaveLength(4);
  expect(
    ids("e-revision", {
      model: "Claude Opus 5.5",
      effort: "Medium",
      query: "source revisions",
    }),
  ).toEqual(["dddddddddddd"]);
  expect(ids("f-fresh", { prompt: "pelican-riding-a-bicycle-800" })).toEqual(
    [],
  );
  expect(prompts[1].entries[0].facts).toContainEqual([
    "Prompt generation",
    "E · source revisions",
  ]);
});
