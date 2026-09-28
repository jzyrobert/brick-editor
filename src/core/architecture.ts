import { ensure, uid, type Project, type Vec3 } from "./types";
/** Architectural authoring aids (spec §20.2). They are document metadata: saved in
 * native projects, autosave and checkpoints, but never exported as LDraw geometry
 * and never used to reorder construction or delete parts. */
export type FloorGuide = {
  id: string;
  name: string;
  /** LDraw height of the floor level (its lowest point; −Y is up). */
  y: number;
};
export type RoomLabel = {
  id: string;
  text: string;
  /** LDraw anchor; the label stands on this point. */
  position: Vec3;
  /** Optional floor the room belongs to, so floor focus hides it with its floor. */
  floorId?: string;
};
/** Show one floor: hide floors above; show floors below ghosted (or plainly). */
export type FloorFocus = { floorId: string; ghostBelow: boolean };
export type Architecture = {
  floors: FloorGuide[];
  labels: RoomLabel[];
  /** Floor focus saved with a camera bookmark, keyed by bookmark name. */
  views: Record<string, FloorFocus>;
};
export const ARCHITECTURE_LIMITS = Object.freeze({
  floors: 64,
  labels: 500,
  nameLength: 60,
  textLength: 80,
});
/** Parts whose lowest point is at most this far below a floor level belong to it. */
export const FLOOR_TOLERANCE = 4;
export function architectureOf(p: Project): Architecture {
  return p.architecture ?? { floors: [], labels: [], views: {} };
}
/** Floors ordered bottom-up (larger LDraw y is lower). */
export function sortedFloors(floors: readonly FloorGuide[]) {
  return [...floors].sort((a, b) => b.y - a.y);
}
/** Index into bottom-up `floors` of the highest level a point or part bottom rests on;
 * −1 when it is below the lowest floor. */
export function floorIndex(y: number, floors: readonly FloorGuide[]) {
  let index = -1;
  floors.forEach((floor, i) => {
    if (y <= floor.y + FLOOR_TOLERANCE) index = i;
  });
  return index;
}
const cleanText = (value: unknown, max: number, what: string) => {
  ensure(
    typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= max &&
      !/[\r\n\0]/.test(value),
    "INVALID_INPUT",
    `${what} must be 1–${max} characters on one line.`,
  );
  return (value as string).trim();
};
const finite = (value: unknown, what: string) => {
  ensure(
    typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) <= 1e7,
    "INVALID_INPUT",
    `${what} must be a finite LDU value.`,
  );
  return value as number;
};
export function validateArchitecture(p: Project) {
  const a = p.architecture;
  if (a === undefined) return;
  ensure(
    a &&
      Array.isArray(a.floors) &&
      Array.isArray(a.labels) &&
      a.views &&
      typeof a.views === "object",
    "INVALID_INPUT",
    "Architecture aids need floors, labels and views.",
  );
  ensure(
    a.floors.length <= ARCHITECTURE_LIMITS.floors &&
      a.labels.length <= ARCHITECTURE_LIMITS.labels,
    "LIMIT_EXCEEDED",
    `At most ${ARCHITECTURE_LIMITS.floors} floors and ${ARCHITECTURE_LIMITS.labels} room labels.`,
  );
  const floorIds = new Set<string>(),
    labelIds = new Set<string>();
  for (const floor of a.floors) {
    ensure(!floorIds.has(floor.id), "INVALID_INPUT", "Duplicate floor ID");
    floorIds.add(floor.id);
    cleanText(floor.name, ARCHITECTURE_LIMITS.nameLength, "A floor name");
    finite(floor.y, "A floor height");
  }
  for (const label of a.labels) {
    ensure(!labelIds.has(label.id), "INVALID_INPUT", "Duplicate label ID");
    labelIds.add(label.id);
    cleanText(label.text, ARCHITECTURE_LIMITS.textLength, "A room label");
    label.position.forEach((v) => finite(v, "A label position"));
    ensure(
      label.floorId === undefined || floorIds.has(label.floorId),
      "INVALID_INPUT",
      "A room label refers to an unknown floor.",
    );
  }
  for (const [name, view] of Object.entries(a.views)) {
    ensure(
      Object.hasOwn(p.cameraBookmarks, name),
      "INVALID_INPUT",
      "A floor view refers to an unknown camera bookmark.",
    );
    ensure(
      floorIds.has(view.floorId) && typeof view.ghostBelow === "boolean",
      "INVALID_INPUT",
      "A camera floor view refers to an unknown floor.",
    );
  }
}
const allowOnly = (payload: Record<string, unknown>, keys: string[]) =>
  ensure(
    Object.keys(payload).every((k) => keys.includes(k)),
    "INVALID_INPUT",
    "Unknown command payload field",
  );
function store(p: Project) {
  p.architecture ??= { floors: [], labels: [], views: {} };
  return p.architecture;
}
/** Drop an empty record so projects without aids stay unchanged on disk. */
function tidy(p: Project) {
  const a = p.architecture;
  if (a && !a.floors.length && !a.labels.length && !Object.keys(a.views).length)
    delete p.architecture;
}
export const ARCHITECTURE_COMMANDS = [
  "floors.set",
  "labels.add",
  "labels.update",
  "labels.remove",
  "camera.bookmark.focus",
] as const;
/** Mutate architectural aids. Never touches parts, layers or instruction order. */
export function applyArchitectureCommand(
  p: Project,
  type: (typeof ARCHITECTURE_COMMANDS)[number],
  v: Record<string, any>,
) {
  const a = store(p);
  switch (type) {
    case "floors.set": {
      allowOnly(v, ["floors"]);
      ensure(Array.isArray(v.floors), "INVALID_INPUT", "floors must be a list");
      a.floors = sortedFloors(
        (v.floors as FloorGuide[]).map((floor) => {
          allowOnly(floor, ["id", "name", "y"]);
          return {
            id: floor.id ?? uid(),
            name: cleanText(
              floor.name,
              ARCHITECTURE_LIMITS.nameLength,
              "A floor name",
            ),
            y: finite(floor.y, "A floor height"),
          };
        }),
      );
      // Removing a floor unties its labels and drops camera views that showed it.
      const kept = new Set(a.floors.map((f) => f.id));
      for (const label of a.labels)
        if (label.floorId && !kept.has(label.floorId)) delete label.floorId;
      for (const [name, view] of Object.entries(a.views))
        if (!kept.has(view.floorId)) delete a.views[name];
      break;
    }
    case "labels.add": {
      allowOnly(v, ["id", "text", "position", "floorId"]);
      const id = v.id ?? uid();
      ensure(
        !a.labels.some((l) => l.id === id),
        "INVALID_INPUT",
        "Label ID already exists",
      );
      const position = (v.position as Vec3).map((n) =>
        finite(n, "A label position"),
      ) as Vec3;
      // Untied labels join the floor they stand on, when floors are defined.
      const floors = sortedFloors(a.floors);
      const floorId =
        v.floorId === undefined
          ? floors[floorIndex(position[1], floors)]?.id
          : (v.floorId ?? undefined);
      a.labels.push({
        id,
        text: cleanText(v.text, ARCHITECTURE_LIMITS.textLength, "A room label"),
        position,
        ...(floorId ? { floorId } : {}),
      });
      break;
    }
    case "labels.update": {
      allowOnly(v, ["labelId", "text", "position", "floorId"]);
      const label = a.labels.find((l) => l.id === v.labelId);
      ensure(label, "INVALID_INPUT", "Unknown room label");
      if (v.text !== undefined)
        label.text = cleanText(
          v.text,
          ARCHITECTURE_LIMITS.textLength,
          "A room label",
        );
      if (v.position !== undefined)
        label.position = (v.position as Vec3).map((n) =>
          finite(n, "A label position"),
        ) as Vec3;
      if (v.floorId === null) delete label.floorId;
      else if (v.floorId !== undefined) label.floorId = v.floorId;
      break;
    }
    case "labels.remove": {
      allowOnly(v, ["labelId"]);
      const before = a.labels.length;
      a.labels = a.labels.filter((l) => l.id !== v.labelId);
      ensure(a.labels.length < before, "INVALID_INPUT", "Unknown room label");
      break;
    }
    case "camera.bookmark.focus": {
      allowOnly(v, ["name", "floorFocus"]);
      ensure(
        typeof v.name === "string" && Object.hasOwn(p.cameraBookmarks, v.name),
        "INVALID_INPUT",
        "Unknown camera bookmark",
      );
      if (v.floorFocus === null) delete a.views[v.name];
      else a.views[v.name] = { ...(v.floorFocus as FloorFocus) };
      break;
    }
  }
  tidy(p);
  validateArchitecture(p);
}
