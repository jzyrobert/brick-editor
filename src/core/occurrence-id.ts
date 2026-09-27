import { ensure } from "./types";
export const NODE_ID_MAX_CODEPOINTS = 1024;
export const OCCURRENCE_PATH_MAX_DEPTH = 64;
/** JSON escaping can expand one node code point into six ASCII characters. */
export const OCCURRENCE_ID_MAX_LENGTH =
  OCCURRENCE_PATH_MAX_DEPTH * (6 * NODE_ID_MAX_CODEPOINTS + 3) + 1;
/** Kept self-contained apart from the three constants for standalone AJV generation. */
export function isOccurrenceId(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length > OCCURRENCE_ID_MAX_LENGTH ||
    value.length < 5
  )
    return false;
  try {
    const path: unknown = JSON.parse(value);
    if (
      !Array.isArray(path) ||
      path.length < 1 ||
      path.length > OCCURRENCE_PATH_MAX_DEPTH
    )
      return false;
    for (const segment of path) {
      if (typeof segment !== "string" || !segment.length) return false;
      let count = 0;
      for (const _ of segment)
        if (++count > NODE_ID_MAX_CODEPOINTS) return false;
    }
    return JSON.stringify(path) === value;
  } catch {
    return false;
  }
}
export function parseOccurrenceId(value: unknown): string[] {
  ensure(
    isOccurrenceId(value),
    "INVALID_INPUT",
    "Occurrence ID must be a canonical JSON path of 1–64 nonempty node IDs (at most 1,024 Unicode code points each)",
  );
  return JSON.parse(value) as string[];
}
