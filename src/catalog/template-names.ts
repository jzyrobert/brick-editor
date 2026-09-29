/** Built-in template identifiers (automation `project.import` and the UI). */
export const TEMPLATE_NAMES = [
  "blank",
  "house",
  "castle",
  "car",
  "room",
  "wall",
  "200",
  "explore",
  "mechanisms",
  "seated-vehicle",
  "door-room",
  "physics",
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/**
 * Template chooser cards, in display order. Preview images are rendered by
 * `npm run templates` (scripts/build-templates.ts) into public/templates/.
 */
export const TEMPLATE_CARDS: { name: TemplateName; title: string }[] = [
  { name: "house", title: "House with garden" },
  { name: "castle", title: "Small castle" },
  { name: "car", title: "Roadster car" },
  { name: "room", title: "Courtyard studio" },
  { name: "explore", title: "Exploration room" },
  { name: "door-room", title: "Door room" },
  { name: "mechanisms", title: "Door & vehicle" },
  { name: "seated-vehicle", title: "Open-bench vehicle" },
  { name: "physics", title: "Physics playground" },
  { name: "wall", title: "Simple wall" },
  { name: "200", title: "200-part build" },
  { name: "blank", title: "Blank canvas" },
];
export const templatePreview = (name: TemplateName) =>
  name === "blank" ? null : `templates/${name}.webp`;
