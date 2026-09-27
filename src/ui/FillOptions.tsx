import { catalog } from "../catalog/catalog";
export type FillOptionsState = {
  enabled: boolean;
  height: number;
  allowedRefs: string[];
  orientations: number[];
  maskText: string;
};
export const defaultFillOptions: FillOptionsState = {
  enabled: false,
  height: 24,
  allowedRefs: ["3001.dat", "3003.dat", "3004.dat", "3005.dat"],
  orientations: [0, 90],
  maskText: "",
};
export function FillOptions({
  value,
  onChange,
}: {
  value: FillOptionsState;
  onChange: (value: FillOptionsState) => void;
}) {
  const height = value.height;
  return (
    <div className="fill-options">
      <label className="check-row">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Fill using an allowed part set
      </label>
      {value.enabled && (
        <>
          <p>
            Columns and rows are 20-LDU stud cells. The origin is the centre of
            the first cell. Largest fitting parts are tried first; this is
            deterministic, not an optimal packing guarantee.
          </p>
          <label>
            Body height
            <select
              aria-label="Fill body height"
              value={height}
              onChange={(e) =>
                onChange({
                  ...value,
                  height: Number(e.target.value),
                  allowedRefs: Object.values(catalog)
                    .filter((p) => p.height === Number(e.target.value))
                    .map((p) => p.id),
                })
              }
            >
              {[...new Set(Object.values(catalog).map((p) => p.height))]
                .sort((a, b) => a - b)
                .map((h) => (
                  <option key={h} value={h}>
                    {h} LDU · {h === 24 ? "bricks" : "plates"}
                  </option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>Allowed parts</legend>
            {Object.values(catalog)
              .filter((p) => p.height === height)
              .map((p) => (
                <label key={p.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={value.allowedRefs.includes(p.id)}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        allowedRefs: e.target.checked
                          ? [...value.allowedRefs, p.id]
                          : value.allowedRefs.filter((id) => id !== p.id),
                      })
                    }
                  />
                  {p.name}
                </label>
              ))}
          </fieldset>
          <fieldset>
            <legend>Allowed turns around the workplane normal</legend>
            {[0, 90, 180, 270].map((degrees) => (
              <label className="check-row" key={degrees}>
                <input
                  type="checkbox"
                  checked={value.orientations.includes(degrees)}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      orientations: e.target.checked
                        ? [...value.orientations, degrees]
                        : value.orientations.filter((d) => d !== degrees),
                    })
                  }
                />
                {degrees} degrees
              </label>
            ))}
          </fieldset>
          <details>
            <summary>Optional cell mask</summary>
            <p>
              Use one row per fill row: 1 includes a cell, 0 leaves a hole.
              Leave blank to fill the whole rectangle.
            </p>
            <label>
              Cell mask
              <textarea
                aria-label="Fill cell mask"
                value={value.maskText}
                onChange={(e) =>
                  onChange({ ...value, maskText: e.target.value })
                }
                rows={4}
                maxLength={21000}
                placeholder={"1111\n1001\n1111"}
              />
            </label>
          </details>
        </>
      )}
    </div>
  );
}
