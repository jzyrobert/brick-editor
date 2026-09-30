// Project-level inventory decisions (spec §6.6): the user's purchasing choice
// for every occurrence of one part, made in the Export → parts list
// resolution list and stored in `project.marketplace.partDecisions` through
// the undoable `inventory.override` command. Pure helpers shared by the
// command validator, the inventory service and the UI.
import {
  ensure,
  type InventoryPartDecision,
  type Project,
} from "../core/types";

/** Shape of a BrickLink part item number: letters, digits and . _ -
 * (3001, 970c00pb0081, 10px6, 4592c02). The shape is all that can be checked
 * offline; typing a number does not verify it (spec §6.6). */
export const BRICKLINK_ITEM = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
/** Decision key of a part: its namespace and reference ("official:3001.dat").
 * A project-local file never shares an official part's decision. */
export const PART_KEY = /^(official|project|missing):[^\s:][^:]{0,1023}$/;
export const partKey = (o: { namespace: string; node: { ref: string } }) =>
  o.namespace + ":" + o.node.ref;

/** A kid-proof explanation of why a typed item number is not usable, or null. */
export function itemNumberProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return "Type the BrickLink part number, like 3001.";
  if (v.length > 40) return "That number is too long for a BrickLink part.";
  if (/\s/.test(v)) return "Part numbers have no spaces.";
  if (!BRICKLINK_ITEM.test(v))
    return "Use only letters, numbers, dots and dashes, like 3001 or 3626cpb0001.";
  return null;
}

/** Checks a decision before it is stored (the command's own validation). */
export function checkDecision(d: InventoryPartDecision) {
  ensure(
    d && typeof d === "object" && d.acknowledged === true,
    "INVALID_INPUT",
    "A parts-list decision must be acknowledged",
  );
  ensure(
    d.itemId === undefined || BRICKLINK_ITEM.test(d.itemId),
    "INVALID_INPUT",
    "Invalid BrickLink item number",
  );
  ensure(
    d.itemId === undefined || d.origin !== undefined,
    "INVALID_INPUT",
    "Say where the item number comes from",
  );
  ensure(
    d.exclude === undefined || typeof d.exclude === "boolean",
    "INVALID_INPUT",
    "Invalid exclusion",
  );
  ensure(
    !d.exclude || d.itemId === undefined,
    "INVALID_INPUT",
    "A left-out part has no item number",
  );
  ensure(
    d.acceptedColors === undefined ||
      (Array.isArray(d.acceptedColors) &&
        d.acceptedColors.every((c) => /^\d+$/.test(c))),
    "INVALID_INPUT",
    "Invalid accepted colours",
  );
}

/** Applies (or with null, clears) one part's decision. */
export function setPartDecision(
  p: Project,
  part: string,
  decision: InventoryPartDecision | null,
) {
  ensure(PART_KEY.test(part), "INVALID_INPUT", "Invalid part key");
  if (decision === null) {
    if (p.marketplace.partDecisions) {
      delete p.marketplace.partDecisions[part];
      if (!Object.keys(p.marketplace.partDecisions).length)
        delete p.marketplace.partDecisions;
    }
    return;
  }
  checkDecision(decision);
  const clean: InventoryPartDecision = { acknowledged: true };
  if (decision.itemId !== undefined) {
    clean.itemId = decision.itemId;
    clean.origin = decision.origin;
  }
  if (decision.checked) clean.checked = true;
  if (decision.exclude) clean.exclude = true;
  if (decision.acceptedColors?.length)
    clean.acceptedColors = [...new Set(decision.acceptedColors)].sort(
      (a, b) => Number(a) - Number(b),
    );
  (p.marketplace.partDecisions ??= {})[part] = clean;
}
