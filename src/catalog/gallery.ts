// Gallery view data: published agent builds (gallery-index.ts,
// docs/GALLERY-PLAN.md) mapped to what the Gallery draws.
import {
  galleryDuration,
  galleryFileUrl,
  type GalleryBuild,
  type GalleryIndex,
} from "./gallery-index";

export type ModelTool = "Build" | "Instructions" | "Photo" | "Project";
export const MODEL_TOOLS: { name: ModelTool; description: string }[] = [
  { name: "Build", description: "Edit parts, colours and layers" },
  {
    name: "Instructions",
    description: "Follow steps and check the parts list",
  },
  { name: "Photo", description: "Set up a view and render a picture" },
  { name: "Project", description: "Save a copy, import or export" },
];
/** Every view of an open model: Play first, then the four tools. */
export const MODEL_VIEWS: {
  name: ModelTool | "Play";
  description: string;
}[] = [
  { name: "Play", description: "Walk around inside the model" },
  ...MODEL_TOOLS,
];
export type GalleryAngle = "iso" | "front" | "iso-back";
export const GALLERY_ANGLES: { id: GalleryAngle; label: string }[] = [
  { id: "iso", label: "Three-quarter" },
  { id: "front", label: "Front" },
  { id: "iso-back", label: "Back" },
];

export type GalleryTone = "peach" | "sage" | "sand";
export type GalleryEntry = {
  id: string;
  title: string;
  /** The model ("GPT-6.1-Sol") and its reasoning effort ("High"). */
  agent: string;
  effort?: string;
  parts: number;
  tone: GalleryTone;
  /** One line for cards: "Accepted after 2 replies · 19 min". */
  summary: string;
  /** Detail-page facts, in order. */
  facts: [string, string][];
  images: Record<GalleryAngle, string>;
  build: GalleryBuild;
  files: string;
};
export type GalleryPromptView = {
  id: string;
  /** Short tab label ("Japanese buddhist temple"). */
  name: string;
  brief: string;
  targetParts?: number;
  heading: string;
  /** Who answered: "Claude Opus 5.5 and GPT-6.1-Sol, both at high effort,
   * answered this brief." */
  note: string;
  entries: GalleryEntry[];
};

export type GalleryFilters = {
  query: string;
  prompt: string;
  model: string;
  effort: string;
  sort: "newest" | "prompt";
};
export const DEFAULT_GALLERY_FILTERS: GalleryFilters = {
  query: "",
  prompt: "",
  model: "",
  effort: "",
  sort: "newest",
};
const searchable = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en");

/** Filter responses together with their brief, retaining prompt groups. Never
 * change the published order or source arrays used by model detail pages. */
export function filterGallery(
  prompts: GalleryPromptView[],
  filters: GalleryFilters,
): GalleryPromptView[] {
  const terms = searchable(filters.query).trim().split(/\s+/).filter(Boolean);
  return prompts
    .filter((p) => !filters.prompt || p.id === filters.prompt)
    .map((p) => ({
      ...p,
      entries: p.entries
        .filter((e) => {
          if (filters.model && e.agent !== filters.model) return false;
          if (filters.effort && e.effort !== filters.effort) return false;
          const text = searchable(
            `${p.name} ${p.brief} ${e.title} ${e.agent} ${e.effort ?? ""}`,
          );
          return terms.every((term) => text.includes(term));
        })
        .sort((a, b) =>
          filters.sort === "newest"
            ? b.build.created.localeCompare(a.build.created)
            : 0,
        ),
    }))
    .filter((p) => p.entries.length)
    .sort((a, b) => {
      if (filters.sort === "prompt") return a.name.localeCompare(b.name, "en");
      return (
        b.entries[0].build.created.localeCompare(a.entries[0].build.created) ||
        a.name.localeCompare(b.name, "en")
      );
    });
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const NUMBER_WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];
const counted = (n: number, word: string) =>
  `${NUMBER_WORDS[n] ?? n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;
const list = (items: string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"];
const TONES: GalleryTone[] = ["peach", "sage", "sand"];

/** Published builds per prompt: one or more per model, ordered by model,
 * then effort. Each prompt is a head-to-head of the models that answered. */
export function galleryPrompts(index: GalleryIndex): GalleryPromptView[] {
  const agents = new Map(index.agents.map((a) => [a.id, a]));
  return index.prompts
    .map((p): GalleryPromptView => {
      const builds = index.builds
        .filter((b) => b.prompt === p.id)
        .sort((a, b) => {
          const x = agents.get(a.agent),
            y = agents.get(b.agent);
          return (
            (x?.model ?? a.agent).localeCompare(y?.model ?? b.agent, "en") ||
            EFFORT_ORDER.indexOf(x?.effort ?? "") -
              EFFORT_ORDER.indexOf(y?.effort ?? "") ||
            b.created.localeCompare(a.created)
          );
        });
      const name =
        p.name ?? sentenceCase(p.brief.replace(/^(a|an|the)\s+/i, ""));
      const answered = builds.map((b) => agents.get(b.agent));
      const models = [
        ...new Set(answered.map((a, i) => a?.model ?? builds[i].agent)),
      ];
      const efforts = [...new Set(answered.map((a) => a?.effort))];
      const effort =
        efforts.length === 1 && efforts[0]
          ? `, ${models.length === 2 ? "both" : "all"} at ${efforts[0]} effort,`
          : "";
      return {
        id: p.id,
        name,
        brief: p.brief,
        targetParts: p.targetParts,
        heading:
          builds.length === models.length
            ? `One brief. ${counted(models.length, "model")}.`
            : `One brief. ${counted(builds.length, "take")}.`,
        note:
          models.length === 1
            ? `Every build here comes from ${models[0]}.`
            : `${list(models)}${effort} answered this brief.`,
        entries: builds.map((b, i) => {
          const a = agents.get(b.agent);
          const facts: [string, string][] = [
            ["Parts", b.parts.toLocaleString("en")],
          ];
          if (b.seconds !== undefined)
            facts.push(["Model time", galleryDuration(b.seconds)]);
          if (b.costUsd !== undefined)
            facts.push(["Cost", `$${b.costUsd.toFixed(2)}`]);
          if (b.attempts !== undefined)
            facts.push(["Replies", String(b.attempts)]);
          facts.push(["Warnings", String(b.warnings)]);
          const summary = [
            b.attempts === undefined
              ? ""
              : b.attempts === 1
                ? "Accepted on its first reply"
                : `Accepted after ${b.attempts} replies`,
            b.seconds === undefined ? "" : galleryDuration(b.seconds),
          ]
            .filter(Boolean)
            .join(" · ");
          return {
            id: b.id,
            title: b.title ?? `${a?.model ?? b.agent}’s ${name.toLowerCase()}`,
            agent: a?.model ?? a?.name ?? b.agent,
            effort: a?.effort ? sentenceCase(a.effort) : undefined,
            parts: b.parts,
            tone: TONES[i % TONES.length],
            summary,
            facts,
            images: Object.fromEntries(
              GALLERY_ANGLES.map((v) => [
                v.id,
                galleryFileUrl(
                  index.files,
                  "r",
                  b.renders[v.id] ?? b.renders.iso ?? "",
                ),
              ]),
            ) as Record<GalleryAngle, string>,
            build: b,
            files: index.files,
          };
        }),
      };
    })
    .filter((p) => p.entries.length);
}
