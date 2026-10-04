import { useState } from "react";
import type { BrowserPlay } from "../play/browser";
import type { PlayGripperReport } from "../play/types";
const label = (id: string) => id.replace(/[-_]/g, " ");
const key = (target: { rigId: string; groupId: string }) =>
  JSON.stringify([target.rigId, target.groupId]);

/** Contextual actions share the motor sheet; empty zones add no canvas chrome. */
export function PlayGripperControls({
  play,
  rigId,
  reports,
  onError,
}: {
  play: BrowserPlay;
  rigId: string;
  reports: Record<string, PlayGripperReport>;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const attempt = (action: () => unknown) => {
    try {
      action();
      onError("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <>
      {Object.entries(reports)
        .filter(([, report]) => report.held || report.candidates.length)
        .map(([gripperId, report]) => {
          const target =
            report.candidates.find((c) => key(c) === selected[gripperId]) ??
            report.candidates[0];
          return (
            <div className="play-gripper-control" key={gripperId}>
              {report.held ? (
                <>
                  <span role="status">
                    Holding {label(report.held.groupId)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      attempt(() => play.release({ rigId, gripperId }))
                    }
                  >
                    Release {label(report.held.groupId)}
                  </button>
                </>
              ) : target ? (
                <>
                  {report.candidates.length > 1 && (
                    <label>
                      Part to grab
                      <select
                        aria-label={`Part to grab with ${label(gripperId)}`}
                        value={key(target)}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            [gripperId]: e.target.value,
                          })
                        }
                      >
                        {report.candidates.map((c) => (
                          <option key={key(c)} value={key(c)}>
                            {label(c.groupId)} · {label(c.rigId)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      attempt(() =>
                        play.grab({
                          rigId,
                          gripperId,
                          target: {
                            rigId: target.rigId,
                            groupId: target.groupId,
                          },
                        }),
                      )
                    }
                  >
                    Grab {label(target.groupId)}
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
    </>
  );
}
