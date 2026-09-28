import { useEffect, useState } from "react";
import type { Vec3 } from "../core/types";
import {
  defineWorkplane,
  planeRoll,
  validateWorkplane,
  worldWorkplane,
  type Workplane,
} from "../edit/workplane";
export function WorkplanePanel({
  value,
  onChange,
  onPickFace,
  pickingFace,
  onCancelPick,
}: {
  value: Workplane;
  onChange: (plane: Workplane) => void;
  onPickFace: () => void;
  pickingFace: boolean;
  onCancelPick: () => void;
}) {
  const [origin, setOrigin] = useState<Vec3>(value.origin),
    [normal, setNormal] = useState<Vec3>(value.normal),
    [roll, setRoll] = useState(planeRoll(value)),
    [error, setError] = useState("");
  useEffect(() => {
    setOrigin(value.origin);
    setNormal(value.normal);
    setRoll(planeRoll(value));
  }, [value.origin, value.normal, value.u]);
  const run = (fn: () => Workplane) => {
    try {
      const p = fn();
      validateWorkplane(p);
      onChange(p);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const field = (
    label: string,
    n: number,
    update: (v: number) => void,
    step: number,
  ) => (
    <label className="number-field">
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        step={step}
        value={Number.isFinite(n) ? n : ""}
        onChange={(e) => update(e.target.valueAsNumber)}
      />
    </label>
  );
  return (
    <section className="workplane" aria-label="Workplane settings">
      <h3>Workplane</h3>
      <div className="panel-tabs">
        {(["XZ", "XY", "YZ"] as const).map((axis) => (
          <button
            key={axis}
            aria-pressed={
              value.origin.every((n) => Math.abs(n) < 1e-8) &&
              worldWorkplane(axis, value).normal.every(
                (n, i) => Math.abs(n - value.normal[i]) < 1e-8,
              ) &&
              worldWorkplane(axis, value).u.every(
                (n, i) => Math.abs(n - value.u[i]) < 1e-8,
              )
            }
            className={
              value.origin.every((n) => Math.abs(n) < 1e-8) &&
              worldWorkplane(axis, value).normal.every(
                (n, i) => Math.abs(n - value.normal[i]) < 1e-8,
              ) &&
              worldWorkplane(axis, value).u.every(
                (n, i) => Math.abs(n - value.u[i]) < 1e-8,
              )
                ? "active"
                : ""
            }
            onClick={() => run(() => worldWorkplane(axis, value))}
          >
            {axis} plane
          </button>
        ))}
      </div>
      <button
        className="wide"
        onClick={pickingFace ? onCancelPick : onPickFace}
      >
        {pickingFace ? "Cancel face picking" : "Pick a model face"}
      </button>
      {pickingFace && (
        <p role="status">
          Tap a visible model face. Its actual triangle defines the plane; this
          does not certify a connector.
        </p>
      )}
      {field(
        "Plane elevation (LDU)",
        value.elevation,
        (n) => run(() => ({ ...value, elevation: n })),
        8,
      )}
      {field(
        "Grid increment (LDU)",
        value.grid,
        (n) => run(() => ({ ...value, grid: n })),
        1,
      )}
      {field(
        "Rotation increment (degrees)",
        value.rotationIncrement,
        (n) => run(() => ({ ...value, rotationIncrement: n })),
        1,
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={value.free}
          onChange={(e) => onChange({ ...value, free: e.target.checked })}
        />
        Free placement
      </label>
      <p className="muted">
        Grid {value.grid} LDU = {Number((value.grid / 20).toFixed(3))} studs · 8
        LDU = 1 plate.
      </p>
      <details className="layer-folders">
        <summary>Numerical plane</summary>
        {(["X", "Y", "Z"] as const).map((axis, i) => (
          <div key={axis} className="numeric-row">
            {field(
              `Plane origin ${axis}`,
              origin[i],
              (n) =>
                setOrigin((v) => v.map((x, j) => (i === j ? n : x)) as Vec3),
              1,
            )}
            {field(
              `Plane normal ${axis}`,
              normal[i],
              (n) =>
                setNormal((v) => v.map((x, j) => (i === j ? n : x)) as Vec3),
              0.1,
            )}
          </div>
        ))}
        {field("Plane roll (degrees)", roll, setRoll, 1)}
        <button
          className="wide"
          onClick={() =>
            run(() => defineWorkplane(origin, normal, roll, value))
          }
        >
          Apply numerical plane
        </button>
        <p className="muted">
          Connector alignment is unavailable: no verified connector metadata is
          installed.
        </p>
      </details>
      <p role="status">{error}</p>
    </section>
  );
}
