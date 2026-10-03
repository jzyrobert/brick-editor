import {
  galleryDuration,
  galleryFileUrl,
  type GalleryBuild,
  type GalleryIndex,
} from "./gallery-index";
/** Editorial labels; source agent/effort metadata is preserved separately. */
export const GALLERY_SAMPLES = [
  {
    id: "high",
    title: "The red pagoda",
    effort: "High",
    parts: 1965,
    tone: "peach",
    description: "A red-and-white pagoda, stone steps and a raked rock garden.",
  },
  {
    id: "xhigh",
    title: "The timber courtyard",
    effort: "Xhigh",
    parts: 1997,
    tone: "sage",
    description: "Bracketed eaves, a hip-and-gable hall and a gravel garden.",
  },
  {
    id: "max",
    title: "The temple compound",
    effort: "Max",
    parts: 2061,
    tone: "sand",
    description: "A tall pagoda, two-storey gate and a bell pavilion.",
  },
  {
    id: "low",
    title: "The garden hall",
    effort: "Low",
    parts: 2057,
    tone: "sand",
    description: "A timber-framed hall, deep hip roof and a garden gate.",
  },
  {
    id: "medium",
    title: "The walled pagoda",
    effort: "Medium",
    parts: 2098,
    tone: "peach",
    description: "A red pagoda, a garden hall and a walled lawn.",
  },
] as const;
export type GallerySample = (typeof GALLERY_SAMPLES)[number];
export type GallerySampleId = GallerySample["id"];
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
export type GalleryAngle = "iso" | "front" | "iso-back";
export const GALLERY_ANGLES: { id: GalleryAngle; label: string }[] = [
  { id: "iso", label: "Three-quarter" },
  { id: "front", label: "Front" },
  { id: "iso-back", label: "Back" },
];
export function galleryAsset(sample: GallerySample, file: string) {
  return `${import.meta.env.BASE_URL}gallery/japanese-temple/${sample.id}/${file}`;
}

// ---------------------------------------------------------------------------
// One shape for both sources: the built-in samples above and builds published
// to the gallery bucket (gallery-index.ts, docs/GALLERY-PLAN.md). Gallery
// shows published builds when the index loads, else the built-in samples.

export type GalleryTone = "peach" | "sage" | "sand";
export type GalleryEntry = {
  id: string;
  title: string;
  /** The model ("GPT-6.1-Sol") and its reasoning effort ("High"). */
  agent: string;
  effort?: string;
  parts: number;
  tone: GalleryTone;
  description: string;
  /** Detail-page facts, in order. */
  facts: [string, string][];
  images: Record<GalleryAngle, string>;
  source:
    | { kind: "sample"; sample: GallerySample }
    | { kind: "published"; build: GalleryBuild; files: string };
};
export type GalleryPromptView = {
  id: string;
  /** Short tab label ("Japanese temple") and the noun for it ("temple"). */
  name: string;
  noun: string;
  brief: string;
  targetParts?: number;
  heading: string;
  /** The generation notes on a detail page. */
  notes: string;
  /** A prompt with no builds yet, shown as a placeholder. */
  placeholder?: boolean;
  entries: GalleryEntry[];
};

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
];
const takes = (n: number) =>
  `${NUMBER_WORDS[n] ?? n.toLocaleString("en")} take${n === 1 ? "" : "s"}.`;

/** The built-in samples (bundled, offline) as a prompt list. */
export function samplePrompts(): GalleryPromptView[] {
  const angles = (s: GallerySample) =>
    Object.fromEntries(
      GALLERY_ANGLES.map((a) => [a.id, galleryAsset(s, `${a.id}.png`)]),
    ) as Record<GalleryAngle, string>;
  return [
    {
      id: "temple",
      name: "Japanese temple",
      noun: "temple",
      brief: "a japanese buddhist temple",
      targetParts: 2000,
      heading: "One temple. Five takes.",
      notes:
        "“a japanese buddhist temple” · Target: 2,000 parts ± 5%. GPT-6.1-Sol, 2 October 2026. Every effort was accepted after a second reply. Warning diagnostics still apply.",
      entries: GALLERY_SAMPLES.map((s) => ({
        id: s.id,
        title: s.title,
        agent: "GPT-6.1-Sol",
        effort: s.effort,
        parts: s.parts,
        tone: s.tone,
        description: s.description,
        facts: [
          ["Parts", s.parts.toLocaleString("en")],
          ["Generation", "One-shot + repair"],
          ["Source", "Geometry-rules run"],
        ],
        images: angles(s),
        source: { kind: "sample", sample: s },
      })),
    },
    {
      id: "village",
      name: "Seaside village",
      noun: "village",
      brief: "a seaside village",
      heading: "This world is still waiting.",
      notes: "",
      placeholder: true,
      entries: [],
    },
    {
      id: "station",
      name: "Space station",
      noun: "station",
      brief: "a space station",
      heading: "This world is still waiting.",
      notes: "",
      placeholder: true,
      entries: [],
    },
  ];
}

const EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"];
const TONES: GalleryTone[] = ["peach", "sage", "sand"];

/** Published builds as a prompt list: per prompt, grouped by model and
 * ordered by effort. */
export function publishedPrompts(index: GalleryIndex): GalleryPromptView[] {
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
      const name = sentenceCase(p.brief.replace(/^(a|an|the)\s+/i, ""));
      const target = p.targetParts
        ? ` · Target: ${p.targetParts.toLocaleString("en")} parts.`
        : ".";
      return {
        id: p.id,
        name,
        noun: name.split(" ").at(-1)!.toLowerCase(),
        brief: p.brief,
        targetParts: p.targetParts,
        heading: `One brief. ${takes(builds.length)}`,
        notes: `“${p.brief}”${target} Each model wrote a build script that this app compiled into real parts; accepted builds may still carry warnings.`,
        entries: builds.map((b, i) => {
          const a = agents.get(b.agent);
          const facts: [string, string][] = [
            ["Parts", b.parts.toLocaleString("en")],
          ];
          if (b.seconds !== undefined)
            facts.push(["Time", galleryDuration(b.seconds)]);
          if (b.costUsd !== undefined)
            facts.push(["Cost", `$${b.costUsd.toFixed(2)}`]);
          if (b.attempts !== undefined)
            facts.push(["Replies", String(b.attempts)]);
          facts.push(["Warnings", String(b.warnings)]);
          if (b.source) facts.push(["Source", b.source]);
          const details = [
            b.attempts === undefined
              ? ""
              : b.attempts === 1
                ? "Accepted on its first reply."
                : `Accepted after ${b.attempts} replies.`,
            b.seconds === undefined
              ? ""
              : `${galleryDuration(b.seconds)} of model time.`,
          ].filter(Boolean);
          return {
            id: b.id,
            title: b.title ?? `${a?.model ?? b.agent}’s ${name.toLowerCase()}`,
            agent: a?.model ?? a?.name ?? b.agent,
            effort: a?.effort ? sentenceCase(a.effort) : undefined,
            parts: b.parts,
            tone: TONES[i % TONES.length],
            description: details.join(" "),
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
            source: { kind: "published", build: b, files: index.files },
          };
        }),
      };
    })
    .filter((p) => p.entries.length);
}
