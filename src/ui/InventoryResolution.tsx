// Export → parts list → "Check your parts": every part and colour of the
// preview with its BrickLink match and whether the colour was made, needing
// attention first. Choices (pick a candidate, accept or replace a match, say
// you checked it, accept a colour, leave a part out) are part-level inventory
// decisions: one undoable `inventory.override` command each, saved with the
// project (spec §6.6). Nothing here verifies a number against BrickLink.
import { useEffect, useMemo, useState } from "react";
import type { InventoryPartDecision } from "../core/types";
import type { Preview, ResolutionRow } from "../inventory/service";
import { itemNumberProblem } from "../inventory/decisions";
import { catalog, colors } from "../catalog/catalog";
import { fullCatalog, onFullLibraryChange } from "../catalog/full-library";
import { loadFullCatalog } from "../catalog/full-library-loader";
import { Icon } from "./icons";

type Filter = "attention" | "all";

const colourMade: Record<ResolutionRow["colorExistence"], string> = {
  verified: "Yes, BrickLink lists it",
  derived: "Probably: Rebrickable lists it",
  unknown: "Not sure: no one lists this part",
  "not-recorded": "Not sure: no list has this colour",
  "not-produced": "No, it was never made in this colour",
};

/** One short badge per row: what it is, or the first thing to do. */
function badge(row: ResolutionRow): { text: string; tone: string } {
  if (row.status === "excluded") return { text: "Left out", tone: "muted" };
  if (row.status === "ready") return { text: "Ready", tone: "ok" };
  if (row.status === "accepted")
    return {
      text: row.mapping === "user" ? "Your choice" : "Accepted",
      tone: "ok",
    };
  const p = row.problems;
  if (p.includes("AMBIGUOUS_MAPPING")) return { text: "Pick one", tone: "act" };
  if (p.includes("NON_ORDERABLE_GEOMETRY"))
    return { text: "Custom part", tone: "act" };
  if (p.includes("UNMAPPED_PART")) return { text: "No match", tone: "act" };
  if (p.includes("REVIEWED_MAPPING"))
    return { text: "Check match", tone: "act" };
  if (p.includes("DERIVED_MAPPING"))
    return { text: "Check match", tone: "act" };
  if (p.includes("INVALID_PART_COLOR"))
    return { text: "Colour not made", tone: "act" };
  if (p.includes("UNVERIFIED_PART_COLOR"))
    return { text: "Check colour", tone: "act" };
  if (p.includes("UNMAPPED_COLOR"))
    return { text: "Colour has no match", tone: "act" };
  if (p.includes("NONPHYSICAL_TRANSFORM"))
    return { text: "Mirrored copy", tone: "act" };
  return { text: "Needs a look", tone: "act" };
}

/** What the list knows about the match, in plain words. */
function matchText(row: ResolutionRow) {
  const id = row.itemId;
  switch (row.mapping) {
    case "verified":
      return `Matched to BrickLink ${id}, checked against BrickLink's catalogue.`;
    case "reviewed":
      return `BrickLink ${id}: the LDraw part file says so and Rebrickable agrees. Not checked on BrickLink itself.`;
    case "derived":
      return `BrickLink ${id}: the LDraw part file says so, but nobody has checked it yet.`;
    case "ambiguous":
      return "This part could be one of these BrickLink parts. Pick the one you want.";
    case "unmapped":
      return "We don't know this part's BrickLink number yet. If you know it, type it below.";
    case "custom":
      return "This is a custom part made in this project, so it can't be bought. Leave it out, or type a real part number.";
    case "user":
      return `You chose BrickLink ${id}${row.suggestedItemId && row.suggestedItemId !== id ? ` (the list suggested ${row.suggestedItemId})` : ""}.`;
    case "override":
      return `One copy has its own number (${id ?? "set by hand"}); change it under Technical details.`;
    case "excluded":
      return "You left this part out of the list.";
  }
}

const brickLinkPage = (id: string) =>
  "https://www.bricklink.com/v2/catalog/catalogitem.page?P=" +
  encodeURIComponent(id);

export function InventoryResolution({
  preview,
  decisions,
  decide,
  show,
}: {
  preview: Preview;
  decisions: Record<string, InventoryPartDecision>;
  /** Stores (or with null clears) a part's decision; one undoable command. */
  decide: (part: string, decision: InventoryPartDecision | null) => void;
  /** Selects these occurrences in the build. */
  show: (ids: string[]) => void;
}) {
  const rows = preview.resolution;
  const attention = rows.filter((r) => r.status === "needs-attention");
  const [filter, setFilter] = useState<Filter>(
    attention.length ? "attention" : "all",
  );
  const [open, setOpen] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const [titlesVersion, setTitlesVersion] = useState(0);
  // Complete-library titles (loaded once; curated names need nothing).
  useEffect(() => {
    if (rows.every((r) => catalog[r.ref] || r.namespace !== "official")) return;
    const off = onFullLibraryChange(() => setTitlesVersion((v) => v + 1));
    loadFullCatalog()
      .then(() => setTitlesVersion((v) => v + 1))
      .catch(() => undefined);
    return off;
  }, [rows]);
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of fullCatalog() ?? [])
      map.set(e[0], e[1].replace(/^[=_~]+/, ""));
    return map;
  }, [titlesVersion]);
  const title = (row: ResolutionRow) =>
    catalog[row.ref]?.name ??
    titles.get(row.ref) ??
    row.ref.replace(/\.dat$/i, "");
  // Fall back to all rows once nothing needs attention.
  useEffect(() => {
    if (!attention.length && filter === "attention") setFilter("all");
  }, [attention.length, filter]);
  const shown = filter === "attention" ? attention : rows;
  const key = (r: ResolutionRow) => r.part + "|" + r.colorCode;
  const change = (
    row: ResolutionRow,
    patch: Partial<InventoryPartDecision> | null,
  ) => {
    if (patch === null) return decide(row.part, null);
    const next: InventoryPartDecision = {
      ...(decisions[row.part] ?? {}),
      ...patch,
      acknowledged: true,
    };
    for (const k of Object.keys(next) as (keyof InventoryPartDecision)[])
      if (next[k] === undefined) delete next[k];
    // Nothing left to decide: clear the part's decision.
    decide(row.part, Object.keys(next).length > 1 ? next : null);
  };
  const colour = (code: string) => colors.find((c) => c.code === code);

  return (
    <section className="resolution-list" aria-label="Check your parts">
      <div className="resolution-head">
        <h3>Check your parts</h3>
        <div className="segmented" role="group" aria-label="Show">
          <button
            aria-pressed={filter === "attention"}
            disabled={!attention.length}
            onClick={() => setFilter("attention")}
          >
            Needs attention ({attention.length})
          </button>
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All ({rows.length})
          </button>
        </div>
      </div>
      {!attention.length && (
        <p className="resolution-done">
          <Icon name="check" size={16} /> Every part has a match. You can
          download the list.
        </p>
      )}
      <ul>
        {shown.map((row) => {
          const k = key(row);
          const expanded = open === k;
          const b = badge(row);
          const c = colour(row.colorCode);
          const decision = decisions[row.part];
          const uncertainColour =
            row.problems.includes("UNVERIFIED_PART_COLOR") &&
            !row.colorAccepted;
          const canAccept =
            (row.mapping === "derived" || row.mapping === "reviewed") &&
            !!row.itemId;
          return (
            <li key={k} className={"resolution-row tone-" + b.tone}>
              <button
                className="resolution-summary"
                aria-expanded={expanded}
                onClick={() => {
                  setOpen(expanded ? null : k);
                  setTyped("");
                  setTypedError(null);
                }}
              >
                <span
                  className="resolution-swatch"
                  style={{ background: c?.hex ?? "transparent" }}
                  aria-hidden="true"
                />
                <span className="resolution-name">
                  <strong>{title(row)}</strong>
                  <small>
                    {row.ref.replace(/\.dat$/i, "")} ·{" "}
                    {c?.name ?? "Colour " + row.colorCode} · ×{row.quantity}
                  </small>
                </span>
                <span className={"resolution-badge badge-" + b.tone}>
                  {b.text}
                </span>
              </button>
              {expanded && (
                <div className="resolution-detail">
                  <p>{matchText(row)}</p>
                  {row.mapping === "ambiguous" && row.candidates && (
                    <div className="resolution-candidates">
                      {row.candidates.map((id) => (
                        <div key={id} className="resolution-candidate">
                          <button
                            className="primary"
                            onClick={() =>
                              change(row, {
                                itemId: id,
                                origin: "candidate",
                                exclude: undefined,
                              })
                            }
                          >
                            Use {id}
                          </button>
                          <a
                            href={brickLinkPage(id)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            See it on BrickLink{" "}
                            <Icon name="external" size={14} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                  {row.mapping !== "excluded" && (
                    <p className="resolution-colour">
                      Made in {c?.name ?? "this colour"}?{" "}
                      <strong>
                        {row.colorAccepted
                          ? "You said to buy it anyway"
                          : colourMade[row.colorExistence]}
                      </strong>
                    </p>
                  )}
                  <div className="resolution-actions">
                    {canAccept && (
                      <button
                        className="primary"
                        onClick={() =>
                          change(row, {
                            itemId: row.itemId,
                            origin: row.mapping as "derived" | "reviewed",
                          })
                        }
                      >
                        Looks right: use {row.itemId}
                      </button>
                    )}
                    {row.itemId &&
                      row.mapping !== "excluded" &&
                      row.mapping !== "override" &&
                      !decision?.checked && (
                        <button
                          onClick={() =>
                            change(row, {
                              itemId: row.itemId,
                              origin:
                                decision?.origin ??
                                (row.mapping === "derived" ||
                                row.mapping === "reviewed"
                                  ? row.mapping
                                  : "user"),
                              checked: true,
                            })
                          }
                        >
                          I checked it on BrickLink
                        </button>
                      )}
                    {uncertainColour && (
                      <button
                        onClick={() =>
                          change(row, {
                            acceptedColors: [
                              ...(decision?.acceptedColors ?? []),
                              row.colorCode,
                            ],
                          })
                        }
                      >
                        Buy this colour anyway
                      </button>
                    )}
                    {row.mapping === "excluded" ? (
                      <button
                        onClick={() => change(row, { exclude: undefined })}
                      >
                        Put it back in the list
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          change(row, {
                            exclude: true,
                            itemId: undefined,
                            origin: undefined,
                            checked: undefined,
                          })
                        }
                      >
                        Leave it out
                      </button>
                    )}
                    {decision && (
                      <button onClick={() => change(row, null)}>
                        Undo my choice
                      </button>
                    )}
                    <button
                      className="link-button"
                      onClick={() => show(row.occurrenceIds)}
                    >
                      Show in build
                    </button>
                  </div>
                  {row.mapping !== "excluded" && (
                    <form
                      className="resolution-own"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const problem = itemNumberProblem(typed);
                        setTypedError(problem);
                        if (problem) return;
                        change(row, {
                          itemId: typed.trim(),
                          origin: row.candidates?.includes(typed.trim())
                            ? "candidate"
                            : "user",
                          exclude: undefined,
                        });
                        setTyped("");
                      }}
                    >
                      <label>
                        Use a different BrickLink number
                        <span>
                          <input
                            value={typed}
                            inputMode="text"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="e.g. 3001"
                            aria-invalid={!!typedError}
                            aria-describedby={
                              typedError ? "resolution-own-error" : undefined
                            }
                            onChange={(e) => {
                              setTyped(e.target.value);
                              if (typedError)
                                setTypedError(
                                  itemNumberProblem(e.target.value),
                                );
                            }}
                          />
                          <button type="submit">Use it</button>
                        </span>
                      </label>
                      {typedError && (
                        <small
                          id="resolution-own-error"
                          className="warning-text"
                          role="alert"
                        >
                          {typedError}
                        </small>
                      )}
                      <small className="muted">
                        Typing a number is your choice; the list can't check it
                        against BrickLink.
                      </small>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
