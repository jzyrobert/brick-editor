/**
 * Sample builds offered in the template chooser (and the blank canvas). Each
 * is generated from official LDraw parts by src/catalog/builds/ (see
 * docs/TEMPLATES.md).
 */
export const SAMPLE_TEMPLATES = [
  "blank",
  "house",
  "castle",
  "car",
  "jeep",
  "windmill",
  "lighthouse",
  "cafe",
  "playground",
  "train",
  "town",
  "cathedral",
  "harbour",
] as const;
/**
 * Older technical starts kept only as test fixtures for the automation API
 * and the test suites. They are not offered in the chooser.
 */
export const FIXTURE_TEMPLATES = [
  "room",
  "wall",
  "200",
  "explore",
  "mechanisms",
  "seated-vehicle",
  "door-room",
  "physics",
] as const;
/** Built-in template identifiers (automation `project.import`). */
export const TEMPLATE_NAMES = [
  ...SAMPLE_TEMPLATES,
  ...FIXTURE_TEMPLATES,
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];
export type SampleTemplateName = (typeof SAMPLE_TEMPLATES)[number];

/**
 * Template chooser cards, in display order. Preview images are rendered by
 * `npm run templates` (scripts/build-templates.ts) into public/templates/.
 */
export const TEMPLATE_CARDS: { name: SampleTemplateName; title: string }[] = [
  { name: "town", title: "Market town" },
  { name: "cathedral", title: "Cathedral" },
  { name: "harbour", title: "Harbour" },
  { name: "cafe", title: "Corner café" },
  { name: "windmill", title: "Windmill farm" },
  { name: "lighthouse", title: "Lighthouse" },
  { name: "jeep", title: "Off-road jeep" },
  { name: "train", title: "Railway station" },
  { name: "playground", title: "Playground park" },
  { name: "house", title: "House with garden" },
  { name: "castle", title: "Small castle" },
  { name: "car", title: "Roadster car" },
  { name: "blank", title: "Blank canvas" },
];
/** The sample the welcome card opens. */
export const SHOWCASE_TEMPLATE: SampleTemplateName = "cafe";
export const templatePreview = (name: TemplateName) =>
  name === "blank" ? null : `templates/${name}.webp`;
