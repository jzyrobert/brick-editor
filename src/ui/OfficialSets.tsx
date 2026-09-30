import { useEffect, useMemo, useState } from "react";
import {
  OMR_HOME,
  OMR_LICENSE_NAME,
  OMR_LICENSE_URL,
  omrSetPage,
  searchOmr,
  type OmrAttribution,
  type OmrSet,
} from "../catalog/omr";
import { loadOmrIndex } from "../catalog/omr-loader";

/** Search and open official LEGO set models from the LDraw OMR
 * (docs/OFFICIAL-MODELS.md). Results appear only while searching. */
export function OfficialSets({
  open,
  credit,
  busy,
}: {
  open: (set: OmrSet) => void;
  /** Attribution of the open project when it is an OMR model. */
  credit?: { attribution: OmrAttribution; set?: OmrSet };
  busy: boolean;
}) {
  const [sets, setSets] = useState<OmrSet[]>(),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    loadOmrIndex()
      .then((i) => live && setSets(i.sets))
      .catch(() => live && setError("The set list could not be loaded."));
    return () => {
      live = false;
    };
  }, []);
  const results = useMemo(
    () => (sets ? searchOmr(sets, query, 20) : []),
    [sets, query],
  );
  return (
    <section className="official-sets" aria-labelledby="official-sets-title">
      <h3 id="official-sets-title">Official LEGO sets</h3>
      {credit && (
        <p className="omr-credit" data-testid="omr-credit">
          This model:{" "}
          {credit.set ? (
            <a href={omrSetPage(credit.set.id)} target="_blank" rel="noopener">
              {credit.set.number} {credit.set.name}
            </a>
          ) : (
            (credit.attribution.name ?? "LDraw OMR model")
          )}{" "}
          by {credit.attribution.authors.join(", ") || "an unknown author"},{" "}
          <a href={OMR_LICENSE_URL} target="_blank" rel="noopener license">
            {OMR_LICENSE_NAME}
          </a>
          .
        </p>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Set number, name, theme or year"
        aria-label="Search official sets"
        enterKeyHint="search"
        disabled={!sets}
      />
      {query.trim() && sets && (
        <ul className="set-results" aria-label="Matching sets">
          {results.map((set) => (
            <li key={set.number}>
              <button disabled={busy} onClick={() => open(set)}>
                <span className="set-number">{set.number}</span>
                <span className="set-name">{set.name}</span>
                <span className="set-meta">
                  {set.theme.split(" > ").at(-1)} · {set.year}
                </span>
              </button>
            </li>
          ))}
          {!results.length && <li className="muted">No sets match.</li>}
        </ul>
      )}
      <p className="muted">
        {sets ? sets.length.toLocaleString("en") + " " : ""}fan-made models of
        real sets from the{" "}
        <a href={OMR_HOME} target="_blank" rel="noopener">
          LDraw Official Model Repository
        </a>
        , loaded from LDraw.org. {OMR_LICENSE_NAME}; each file credits its
        author.
      </p>
      {error && <p role="status">{error}</p>}
    </section>
  );
}
