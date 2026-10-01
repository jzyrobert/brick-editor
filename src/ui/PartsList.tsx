import { strToU8 } from "fflate";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  loadColorAvailability,
  partAvailability,
} from "../catalog/color-availability";
import { partSpec } from "../catalog/extended";
import type { Occurrence, Project } from "../core/types";
import {
  filterParts,
  groupParts,
  partsList,
  partsListCSV,
  rebrickableCSV,
  sortParts,
  type PartsGroup,
  type PartsSort,
} from "../inventory/parts-list";
import { Icon } from "./icons";
import { GenericThumb, PartThumb } from "./PartThumbs";

/** Rows drawn at first; more follow as the list scrolls (150,000-part
 * models have a few thousand lots). */
const PAGE = 150;

/**
 * Parts list of the loaded model (docs/INSTRUCTIONS.md): every part × colour
 * with counts, searchable, grouped by category or colour, exportable as CSV
 * or Rebrickable CSV. The BrickLink Wanted List stays in the export dialog,
 * which checks each part's BrickLink number first.
 */
export function PartsList({
  project,
  all,
  onClose,
  onBrickLink,
  download,
  onStatus,
}: {
  project: Project;
  all: readonly Occurrence[];
  onClose: () => void;
  onBrickLink?: () => void;
  download: (name: string, bytes: Uint8Array, mime: string) => void;
  onStatus: (message: string) => void;
}) {
  const list = useMemo(() => partsList(project, all), [project, all]);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [group, setGroup] = useState<PartsGroup>("category");
  const [sort, setSort] = useState<PartsSort>("count");
  const [limit, setLimit] = useState(PAGE);
  const [saved, setSaved] = useState("");
  const say = (message: string) => {
    setSaved(message);
    onStatus(message);
  };
  const shown = useMemo(
    () => sortParts(filterParts(list.rows, deferred), sort),
    [list, deferred, sort],
  );
  const sections = useMemo(() => groupParts(shown, group), [shown, group]);
  useEffect(() => setLimit(PAGE), [deferred, group, sort]);
  const more = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = more.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE);
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sections, limit]);
  const title = (project.title || "model").replace(/[^\w.-]+/g, "-");
  const kinds = list.rows.length;
  let budget = limit;
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dialog parts-list-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="parts-list-title"
      >
        <div className="dialog-heading">
          <div>
            <h2 id="parts-list-title">Parts list</h2>
            <p className="parts-list-total">
              <b>{list.total.toLocaleString("en")}</b> parts ·{" "}
              {kinds.toLocaleString("en")} kinds
            </p>
          </div>
          <button onClick={onClose} aria-label="Close parts list">
            <Icon name="close" />
          </button>
        </div>
        <div className="parts-list-tools">
          <label className="parts-list-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              aria-label="Search parts"
              placeholder="Search name, number or colour"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span>Group</span>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value as PartsGroup)}
            >
              <option value="category">By category</option>
              <option value="colour">By colour</option>
              <option value="none">No groups</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as PartsSort)}
            >
              <option value="count">Most used</option>
              <option value="number">Part number</option>
              <option value="name">Name</option>
              <option value="colour">Colour</option>
            </select>
          </label>
        </div>
        {list.primitives > 0 && (
          <p className="muted parts-list-note">
            {list.primitives.toLocaleString("en")} loose drawing shapes are not
            parts and are not listed.
          </p>
        )}
        <div className="parts-list-body">
          {!shown.length && (
            <p className="muted">
              {list.rows.length
                ? "No parts match your search."
                : "This model has no parts yet."}
            </p>
          )}
          {sections.map((section) => {
            if (budget <= 0) return null;
            const rows = section.rows.slice(0, budget);
            budget -= rows.length;
            return (
              <section key={section.title || "all"}>
                {section.title && (
                  <h3>
                    {section.title}
                    <small>{section.count.toLocaleString("en")}</small>
                  </h3>
                )}
                <ul>
                  {rows.map((row) => {
                    const spec = row.custom ? undefined : partSpec(row.ref);
                    return (
                      <li key={row.ref + "\u0000" + row.colorCode}>
                        {spec ? (
                          <PartThumb part={spec} color={row.colorHex} />
                        ) : (
                          <GenericThumb />
                        )}
                        <span className="parts-list-name">
                          <strong>{row.name}</strong>
                          <small>
                            <i
                              className="parts-list-swatch"
                              style={{ background: row.colorHex ?? "#bac4cb" }}
                              aria-hidden="true"
                            />
                            {row.colorName} · {row.number}
                          </small>
                        </span>
                        <b className="parts-list-count">
                          ×{row.count.toLocaleString("en")}
                        </b>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {budget <= 0 && shown.length > limit && (
            <ul>
              <li ref={more} className="parts-list-more">
                <button onClick={() => setLimit((n) => n + PAGE * 4)}>
                  Show more ({(shown.length - limit).toLocaleString("en")})
                </button>
              </li>
            </ul>
          )}
        </div>
        <div className="parts-list-actions">
          <button
            className="primary"
            onClick={() => {
              download(
                `${title}-parts.csv`,
                strToU8("﻿" + partsListCSV(shown)),
                "text/csv",
              );
              say(
                `Parts list saved: ${shown.length.toLocaleString("en")} rows${deferred ? " matching your search" : ""}.`,
              );
            }}
          >
            <Icon name="export" size={16} /> Download CSV
          </button>
          <button
            onClick={async () => {
              try {
                await loadColorAvailability();
              } catch {
                /* Without the pack LDraw numbers are used. */
              }
              const rb = rebrickableCSV(shown, (ref) => {
                const a = partAvailability(ref);
                return a.status === "known" ? a.rebrickablePart : undefined;
              });
              download(`${title}-rebrickable.csv`, strToU8(rb.csv), "text/csv");
              say(
                rb.skipped.length
                  ? `Rebrickable CSV saved. ${rb.skipped.length} rows left out (custom parts or colours without a Rebrickable match).`
                  : "Rebrickable CSV saved: import it on Rebrickable as a parts list.",
              );
            }}
          >
            Rebrickable CSV
          </button>
          {onBrickLink && (
            <button onClick={onBrickLink}>BrickLink list…</button>
          )}
          {saved && (
            <p className="parts-list-saved" role="status">
              {saved}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
