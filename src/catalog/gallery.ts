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
