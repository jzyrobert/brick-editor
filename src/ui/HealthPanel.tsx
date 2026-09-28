import { useId, useState } from "react";
import type { BrickEditorAPI } from "../automation/api";
import type { HealthReport } from "../core/health";
import { Icon } from "./icons";

const basisLabel = {
  exact: "",
  approximate: "Approximate",
  "not-verified": "Not verified",
} as const;

/** Model health (spec §20.3): each check states its status and how certain it is. */
export function HealthPanel({
  api,
  revision,
  select,
}: {
  api: BrickEditorAPI;
  revision: number;
  select: (occurrenceIds: string[]) => void;
}) {
  const id = useId();
  const [report, setReport] = useState<HealthReport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stale = report && report.revision !== revision;
  return (
    <section className="health" aria-labelledby={id + "-title"}>
      <h3 id={id + "-title"}>Model health</h3>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            setReport(await api.health.check());
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : report ? "Check again" : "Check model"}
      </button>
      {error && <p role="alert">{error}</p>}
      {stale && <p className="muted">The build changed since this check.</p>}
      {report && (
        <ul className="health-list">
          {report.checks.map((c) => (
            <li key={c.id} className={"health-" + c.status}>
              <span className="health-mark" aria-hidden="true">
                <Icon
                  name={
                    c.status === "ok"
                      ? "check"
                      : c.status === "unknown"
                        ? "info"
                        : "close"
                  }
                  size={16}
                />
              </span>
              <div>
                <strong>
                  {c.title}
                  {basisLabel[c.basis] && (
                    <small className="health-basis">
                      {" "}
                      · {basisLabel[c.basis]}
                    </small>
                  )}
                </strong>
                <p>{c.detail}</p>
                {c.occurrenceIds.length > 0 && !stale && (
                  <button onClick={() => select(c.occurrenceIds)}>
                    Select {c.occurrenceIds.length} part
                    {c.occurrenceIds.length === 1 ? "" : "s"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
