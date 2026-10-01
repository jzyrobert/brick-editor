import { useState, useSyncExternalStore } from "react";
import type { MechanismBrowser } from "../mechanisms/browser";
import type { MotionRig } from "../mechanisms/types";
export function MechanismPanel({
  mechanisms,
  rigs,
}: {
  mechanisms: MechanismBrowser;
  rigs: Record<string, MotionRig>;
}) {
  const state = useSyncExternalStore(mechanisms.subscribe, mechanisms.getState),
    [selected, setSelected] = useState(Object.keys(rigs)[0] ?? ""),
    [message, setMessage] = useState(""),
    [throttle, setThrottle] = useState(0),
    [steering, setSteering] = useState(0);
  const selectedId = rigs[selected] ? selected : (Object.keys(rigs)[0] ?? ""),
    rig = rigs[state.report?.rigId ?? selectedId];
  const attempt = (action: () => unknown) => {
    try {
      const result = action();
      if (result instanceof Promise)
        void result
          .then(() => setMessage(""))
          .catch((e) => setMessage(e.message));
      else setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const drive = (t: number, s: number) => {
    setThrottle(t);
    setSteering(s);
    attempt(() => mechanisms.setVehicleInput({ throttle: t, steering: s }));
  };
  return (
    <section aria-label="Mechanisms" className="mechanism-panel">
      <h3>Mechanisms</h3>
      <p>
        Preview authored hinges and planar vehicles. Your build stays at rest
        until you apply a pose.
      </p>
      {!Object.keys(rigs).length ? (
        <p>
          Open the “Door & vehicle” template to try two original rigs. Rig
          authoring is available in Build → Inspector → Tools → Create or edit a
          rig.
        </p>
      ) : (
        <>
          <label>
            Authored rig{" "}
            <select
              value={selectedId}
              disabled={state.active || state.loading}
              onChange={(e) => setSelected(e.target.value)}
            >
              {Object.values(rigs).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {!state.active ? (
            <button
              disabled={state.loading}
              onClick={() => attempt(() => mechanisms.enter(selectedId))}
            >
              {state.loading ? "Preparing mechanism…" : "Preview mechanism"}
            </button>
          ) : (
            <>
              <p role="status">
                Kinematic preview · tick {state.report?.tick} · source revision{" "}
                {state.report?.sourceRevision}
              </p>
              {rig?.joints
                .filter((j) => j.kind === "revolute" || j.kind === "prismatic")
                .map((j) => (
                  <label
                    key={j.id}
                    style={{ display: "block", margin: "12px 0" }}
                  >
                    {j.id} ·{" "}
                    {(state.report?.pose.jointPositions[j.id] ?? 0).toFixed(1)}{" "}
                    {j.kind === "revolute" ? "degrees" : "LDU"}
                    <input
                      aria-label={`${j.id} position`}
                      type="range"
                      min={
                        j.limits?.[0] ?? (j.kind === "revolute" ? -180 : -200)
                      }
                      max={j.limits?.[1] ?? (j.kind === "revolute" ? 180 : 200)}
                      step="1"
                      value={state.report?.pose.jointPositions[j.id] ?? 0}
                      onChange={(e) =>
                        attempt(() =>
                          mechanisms.setJointPosition(
                            j.id,
                            Number(e.target.value),
                          ),
                        )
                      }
                      style={{ width: "100%", minHeight: 44 }}
                    />
                  </label>
                ))}
              {rig?.vehicle && (
                <>
                  <label style={{ display: "block" }}>
                    Throttle · {throttle.toFixed(2)}
                    <input
                      aria-label="Vehicle throttle"
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={throttle}
                      onChange={(e) => drive(Number(e.target.value), steering)}
                      style={{ width: "100%", minHeight: 44 }}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    Steering · {steering.toFixed(2)}
                    <input
                      aria-label="Vehicle steering"
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={steering}
                      onChange={(e) => drive(throttle, Number(e.target.value))}
                      style={{ width: "100%", minHeight: 44 }}
                    />
                  </label>
                  <div className="button-row">
                    <button
                      onClick={() => attempt(() => mechanisms.stepTicks(1))}
                    >
                      Step 1 tick
                    </button>
                    <button
                      onClick={() => attempt(() => mechanisms.stepTicks(60))}
                    >
                      Advance 1 second
                    </button>
                    <button onClick={() => drive(0, 0)}>
                      Clear drive input
                    </button>
                  </div>
                </>
              )}
              {state.report?.warnings.map((w) => (
                <p key={w} className="notice">
                  {w}
                </p>
              ))}
              <div className="button-row">
                <button
                  onClick={() =>
                    attempt(() => {
                      mechanisms.applyPose();
                      setMessage(
                        "Pose applied. Undo restores the previous authored rest pose.",
                      );
                    })
                  }
                >
                  Apply pose to build
                </button>
                <button onClick={() => mechanisms.exit()}>Exit preview</button>
              </div>
            </>
          )}
        </>
      )}
      {(message || state.error) && <p role="alert">{message || state.error}</p>}
    </section>
  );
}
