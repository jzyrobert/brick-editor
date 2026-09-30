import { AppError, ensure, type Project } from "./types";

/**
 * Scene backdrops: the world drawn around a build in the editor, in Play and in
 * captures. A backdrop is view data saved with the project (`project.scene`);
 * it is never exported to LDraw and never adds collision (Play keeps its
 * session-only ground plane at Y=0). The three.js side lives in
 * environment.ts; this module is plain data so it can be validated anywhere.
 */
export const BACKDROP_NAMES = [
  "blank",
  "grass",
  "street",
  "beach",
  "night",
  "studio",
] as const;
export type BackdropName = (typeof BACKDROP_NAMES)[number];

export type BackdropSpec = {
  name: BackdropName;
  label: string;
  /** One line for the picker's hint. */
  hint: string;
  /** CSS background for the picker swatch. */
  swatch: string;
  /** Sky gradient, sRGB hex: zenith, horizon (also the ground's far colour). */
  sky?: { top: string; horizon: string };
  /** Fallback background colour (orthographic views, before the sky draws). */
  background: string;
  /** Opacity of the editor grid overlay on this backdrop's ground. */
  gridOpacity: number;
};

export const BACKDROPS: Record<BackdropName, BackdropSpec> = {
  blank: {
    name: "blank",
    label: "Blank",
    hint: "Plain light background with the build grid.",
    swatch: "linear-gradient(#e9edef, #d1d9de)",
    background: "#e9edef",
    gridOpacity: 1,
  },
  grass: {
    name: "grass",
    label: "Meadow",
    hint: "Grassy meadow with hills and trees on the horizon.",
    swatch: "linear-gradient(#9cc8ef 0 45%, #5f9a3c 45%)",
    sky: { top: "#5d9fdc", horizon: "#cfe3ee" },
    background: "#b4d4ec",
    gridOpacity: 0.35,
  },
  street: {
    name: "street",
    label: "Street map",
    hint: "Toy play-mat town: roads, crossings, parking and parks.",
    swatch:
      "linear-gradient(90deg, #6fae4a 0 30%, #55595e 30% 70%, #6fae4a 70%)",
    sky: { top: "#6aa8e0", horizon: "#d6e6ee" },
    background: "#bcd8ec",
    gridOpacity: 0.3,
  },
  beach: {
    name: "beach",
    label: "Beach",
    hint: "Sandy beach and the sea beyond.",
    swatch: "linear-gradient(#8fd0f0 0 35%, #3f93c6 35% 55%, #e9d39c 55%)",
    sky: { top: "#58aee8", horizon: "#e2f1f6" },
    background: "#aad8f2",
    gridOpacity: 0.4,
  },
  night: {
    name: "night",
    label: "Night city",
    hint: "Streets at night under the stars, a lit skyline far away.",
    swatch: "linear-gradient(#0d1633 0 50%, #2b2f3a 50%)",
    sky: { top: "#050a1e", horizon: "#27335a" },
    background: "#141c38",
    gridOpacity: 0.14,
  },
  studio: {
    name: "studio",
    label: "Studio",
    hint: "Neutral grey studio sweep.",
    swatch: "linear-gradient(#fafafa, #c9cbcd)",
    sky: { top: "#f4f5f6", horizon: "#d9dbdd" },
    background: "#e6e7e8",
    gridOpacity: 0.5,
  },
};

export const DEFAULT_BACKDROP: BackdropName = "blank";

export function isBackdropName(value: unknown): value is BackdropName {
  return (
    typeof value === "string" && BACKDROP_NAMES.includes(value as BackdropName)
  );
}

export function requireBackdrop(value: unknown): BackdropName {
  if (!isBackdropName(value))
    throw new AppError(
      "INVALID_INPUT",
      `Backdrop must be one of ${BACKDROP_NAMES.join(", ")}`,
    );
  return value;
}

/** Longest Play hint a project may carry (one short line on a phone). */
export const PLAY_HINT_MAX_LENGTH = 80;

/** Per-project scene settings (view data; never part of an LDraw export). */
export type ProjectScene = {
  /** Backdrop drawn around the build; absent means "blank". */
  backdrop?: BackdropName;
  /** One short line shown when Play starts, e.g. "Push the crates!". */
  playHint?: string;
};

export function backdropOf(p: Pick<Project, "scene">): BackdropName {
  return p.scene?.backdrop ?? DEFAULT_BACKDROP;
}

export function validateScene(p: Project) {
  const s = p.scene;
  if (s === undefined) return;
  ensure(
    !!s && typeof s === "object" && !Array.isArray(s),
    "INVALID_INPUT",
    "Scene settings must be an object",
  );
  ensure(
    Object.keys(s).every((k) => k === "backdrop" || k === "playHint"),
    "INVALID_INPUT",
    "Scene settings take backdrop and playHint",
  );
  if (s.backdrop !== undefined) requireBackdrop(s.backdrop);
  if (s.playHint !== undefined)
    ensure(
      typeof s.playHint === "string" &&
        s.playHint.length <= PLAY_HINT_MAX_LENGTH &&
        !/[\r\n\0]/.test(s.playHint),
      "INVALID_INPUT",
      `A Play hint is one line of at most ${PLAY_HINT_MAX_LENGTH} characters`,
    );
}

/**
 * `scene.set` command: `{ backdrop?, playHint? }`; `null` clears a field. The
 * default backdrop and an empty hint are not stored, so projects that never
 * chose a backdrop stay byte-identical on disk.
 */
export function applySceneCommand(p: Project, payload: Record<string, any>) {
  ensure(
    Object.keys(payload).length > 0 &&
      Object.keys(payload).every((k) => k === "backdrop" || k === "playHint"),
    "INVALID_INPUT",
    "scene.set takes backdrop and playHint",
  );
  const scene: ProjectScene = { ...(p.scene ?? {}) };
  if (payload.backdrop !== undefined) {
    if (payload.backdrop === null) delete scene.backdrop;
    else scene.backdrop = requireBackdrop(payload.backdrop);
  }
  if (payload.playHint !== undefined) {
    if (payload.playHint === null || payload.playHint === "")
      delete scene.playHint;
    else scene.playHint = payload.playHint;
  }
  if (scene.backdrop === DEFAULT_BACKDROP) delete scene.backdrop;
  if (Object.keys(scene).length) p.scene = scene;
  else delete p.scene;
  validateScene(p);
}
