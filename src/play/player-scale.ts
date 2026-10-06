/**
 * Player size in Play: one session-only factor that scales the explorer (its
 * figure, collider, eye, steps, jumps, speeds, reach and camera) so builds
 * that are not at minifigure scale (micro-scale towns, giant sculptures) can
 * be explored at their own scale. The world itself never changes: its
 * collision, gravity on mechanisms and trains, and every authored part stay
 * exactly as built. See docs/PLAY-PHYSICS.md ("Player size").
 */
import { ensure } from "../core/types";
import { CHARACTER_PROFILE, type CharacterProfile } from "./types";
export type { CharacterProfile };

export const PLAYER_SCALE_LIMITS = Object.freeze({ min: 0.25, max: 8 });
/** The slider's steps: roughly even on a log scale, with round values. */
export const PLAYER_SCALE_STEPS = Object.freeze([
  0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8,
] as const);
/** Named sizes for the segmented control (plain words first). */
export const PLAYER_SCALE_PRESETS = Object.freeze([
  { id: "tiny", label: "Tiny", scale: 0.25 },
  { id: "minifigure", label: "Minifigure", scale: 1 },
  { id: "big", label: "Big", scale: 3 },
  { id: "giant", label: "Giant", scale: 8 },
] as const);

/** A finite factor within PLAYER_SCALE_LIMITS (1 when omitted). */
export function validatePlayerScale(scale: unknown = 1): number {
  ensure(
    typeof scale === "number" &&
      Number.isFinite(scale) &&
      scale >= PLAYER_SCALE_LIMITS.min &&
      scale <= PLAYER_SCALE_LIMITS.max,
    "INVALID_INPUT",
    `Player size must be between ${PLAYER_SCALE_LIMITS.min} and ${PLAYER_SCALE_LIMITS.max} times a minifigure.`,
  );
  return scale;
}

/**
 * The character profile at `scale` times minifigure size. Every length and
 * speed scales linearly, and so does the explorer's own gravity: the figure
 * moves exactly like a minifigure in a world resized around it (a jump is as
 * high relative to its body and lasts as long; strides keep their rhythm).
 * Slopes and the LDU-to-metre scale of the world do not change.
 */
export function scaledCharacterProfile(scale = 1): CharacterProfile {
  validatePlayerScale(scale);
  const P = CHARACTER_PROFILE;
  if (scale === 1) return P;
  return Object.freeze({
    ...P,
    radius: P.radius * scale,
    height: P.height * scale,
    eyeHeight: P.eyeHeight * scale,
    stepHeight: P.stepHeight * scale,
    walkSpeed: P.walkSpeed * scale,
    runSpeed: P.runSpeed * scale,
    flySpeed: P.flySpeed * scale,
    jumpSpeed: P.jumpSpeed * scale,
    gravity: P.gravity * scale,
    strideLength: P.strideLength * scale,
  });
}

/** The nearest slider step to a factor (for display and the slider). */
export function nearestPlayerScaleStep(scale: number) {
  let best = 0;
  PLAYER_SCALE_STEPS.forEach((step, i) => {
    if (
      Math.abs(Math.log(step / scale)) <
      Math.abs(Math.log(PLAYER_SCALE_STEPS[best] / scale))
    )
      best = i;
  });
  return best;
}

/** "Tiny", "Minifigure", … for a preset factor, else e.g. "1.5×". */
export function playerScaleLabel(scale: number) {
  const preset = PLAYER_SCALE_PRESETS.find((p) => p.scale === scale);
  return preset ? preset.label : `${formatScale(scale)}×`;
}
export function formatScale(scale: number) {
  return scale === 0.25
    ? "¼"
    : scale === 0.5
      ? "½"
      : scale === 0.75
        ? "¾"
        : String(Number(scale.toFixed(2)));
}

/** Facts about a build, read from its parts before entering Play. */
export type BuildScaleEvidence = {
  /** Placed parts. */
  parts: number;
  /** Official minifigure doors, gates and window leaves (door-parts.json). */
  doors: number;
  /** Minifigure body parts (heads, torsos, hips and legs). */
  minifigParts: number;
  /** World bounds of the parts, LDU (LDraw: −Y is up). */
  bounds?: { min: [number, number, number]; max: [number, number, number] };
};
export type PlayerScaleSuggestion = { scale: number; reason: string };

const FIGURE = CHARACTER_PROFILE.height;
const stepAtOrBelow = (scale: number) =>
  [...PLAYER_SCALE_STEPS].reverse().find((s) => s <= scale) ??
  PLAYER_SCALE_STEPS[0];

/**
 * A size worth suggesting, with the reason in plain words, or nothing when
 * there is no clear sign. Minifigure doors or figures mean minifigure scale.
 * Otherwise the build's overall height decides: a wide build no taller than
 * about two minifigures looks micro-scale (a town whose houses are a few
 * bricks high), and one taller than about fifteen minifigures with no doors
 * looks like a big sculpture that is best seen by a bigger explorer.
 * Suggestions are only offered; Play never changes size by itself.
 */
export function suggestPlayerScale(
  e: BuildScaleEvidence,
): PlayerScaleSuggestion | undefined {
  if (!e.parts || !e.bounds) return undefined;
  if (e.doors > 0)
    return {
      scale: 1,
      reason: "It has minifigure doors, so it is built for minifigures.",
    };
  if (e.minifigParts > 0)
    return {
      scale: 1,
      reason: "It has minifigures in it, so it is built for them.",
    };
  const { min, max } = e.bounds;
  const height = max[1] - min[1],
    footprint = Math.max(max[0] - min[0], max[2] - min[2]);
  if (!(height > 0) || !(footprint > 0)) return undefined;
  // Micro-scale: houses a few bricks high, spread wider than a small model.
  if (height >= 40 && height <= FIGURE * 2 && footprint >= 400) {
    if (footprint < height * 3) return undefined;
    // Its houses would be minifigure-scale streets about six figures tall:
    // the smallest size (a quarter) is the closest.
    return {
      scale: PLAYER_SCALE_LIMITS.min,
      reason:
        "The whole build is only a few bricks high but spreads wide, like a micro-scale town.",
    };
  }
  // A giant sculpture: let the explorer stand about an eighth of its height.
  if (height >= FIGURE * 15) {
    const scale = Math.min(
      PLAYER_SCALE_LIMITS.max,
      Math.max(2, stepAtOrBelow(height / (FIGURE * 8))),
    );
    return {
      scale,
      reason: `It is about ${Math.round(height / FIGURE)} minifigures tall with no minifigure doors, so a bigger explorer can see it whole.`,
    };
  }
  return undefined;
}
