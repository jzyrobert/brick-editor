import { useEffect, useId, useRef, useState } from "react";
import type { Editor } from "../core/commands";
import {
  RESOURCE_PROFILES,
  type ResourcePreference,
} from "../core/resource-profile";
import {
  applyResourcePreference,
  resourceStatus,
} from "../persistence/resource-preference";

const number = (n: number) => n.toLocaleString("en");
const rows = [
  [
    "Parts and shapes per project",
    (l: typeof RESOURCE_PROFILES.desktop) => number(l.occurrences),
  ],
  [
    "Parts added in one action",
    (l: typeof RESOURCE_PROFILES.desktop) => number(l.additionsPerCommand),
  ],
  [
    "File size to open",
    (l: typeof RESOURCE_PROFILES.desktop) =>
      `${l.importBytes / 1024 / 1024} MB`,
  ],
  [
    "Image export",
    (l: typeof RESOURCE_PROFILES.desktop) => `${l.imagePixels / 1e6} MP`,
  ],
] as const;
const labels: Record<ResourcePreference, string> = {
  auto: "Automatic",
  mobile: "Phone limits",
  desktop: "Desktop limits",
};

/** Shows the effective device limits and lets the user change them, with an explicit
 * impact acknowledgement before raising limits above what this device was detected for. */
export function ResourceProfilePanel({
  editor,
  onStatus,
  headingLevel = 3,
  desktopRequest = 0,
  onBackup,
}: {
  editor: Editor;
  onStatus?: (message: string) => void;
  headingLevel?: 2 | 3;
  /** Incrementing opens the desktop-limits confirmation and scrolls to it. */
  desktopRequest?: number;
  onBackup?: () => unknown;
}) {
  const id = useId();
  const [status, setStatus] = useState(() => resourceStatus(editor));
  const [pending, setPending] = useState<ResourcePreference>();
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => editor.subscribe(() => setStatus(resourceStatus(editor))),
    [editor],
  );
  const warning = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!desktopRequest) return;
    setPending("desktop");
    setUnderstood(false);
  }, [desktopRequest]);
  useEffect(() => {
    if (pending === "desktop")
      warning.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pending, desktopRequest]);
  const choose = (
    preference: ResourcePreference,
    acknowledgeImpact = false,
  ) => {
    setError("");
    try {
      const next = applyResourcePreference(editor, preference, {
        acknowledgeImpact,
      });
      setStatus(next);
      setPending(undefined);
      setUnderstood(false);
      onStatus?.(
        `${labels[preference]} on: up to ${number(next.limits.occurrences)} parts and shapes per project` +
          (next.saved
            ? "."
            : " for this session; the choice could not be saved."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const select = (preference: ResourcePreference) => {
    if (status.detected === "mobile" && preference === "desktop") {
      setPending(preference);
      setUnderstood(false);
      return;
    }
    choose(preference);
  };
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const parts = status.project.occurrences;
  return (
    <section aria-labelledby={id + "-title"} className="resource-profile">
      <Heading id={id + "-title"}>Device limits</Heading>
      <p className="muted">
        {status.reason} Active: <strong>{labels[status.profile]}</strong>
        {status.preference === "auto"
          ? " (automatic)"
          : " (chosen on this device)"}
        . This project has {number(parts)} parts and shapes.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Limit</th>
              <th scope="col">Phone</th>
              <th scope="col">Desktop</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value(RESOURCE_PROFILES.mobile)}</td>
                <td>{value(RESOURCE_PROFILES.desktop)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <fieldset>
        <legend>Limits on this device</legend>
        {(["auto", "mobile", "desktop"] as const).map((preference) => (
          <label key={preference} className="check">
            <input
              type="radio"
              name={id + "-profile"}
              checked={(pending ?? status.preference) === preference}
              onChange={() => select(preference)}
            />
            {labels[preference]}
            {preference === "auto" ? " (recommended)" : ""}
          </label>
        ))}
      </fieldset>
      {pending === "desktop" && (
        <div role="alert" className="resource-warning warning" ref={warning}>
          <p>
            <strong>Desktop limits on a phone.</strong> Projects of up to{" "}
            {number(RESOURCE_PROFILES.desktop.occurrences)} parts and shapes
            will open
            {parts > RESOURCE_PROFILES.mobile.occurrences
              ? `, including this one (${number(parts)})`
              : ""}
            . Large builds can run slowly, stop responding, or make the browser
            close the tab and lose changes that are not yet saved. Download a
            backup first.
          </p>
          {onBackup && (
            <button className="wide" onClick={() => void onBackup()}>
              Download backup
            </button>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            I understand the risk
          </label>
          <div className="button-row">
            <button
              className="confirm-risk"
              disabled={!understood}
              onClick={() => choose("desktop", true)}
            >
              Use desktop limits
            </button>
            <button onClick={() => setPending(undefined)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
