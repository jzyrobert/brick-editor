import type { BrowserPlay } from "../play/browser";
import { Icon } from "./icons";
import type { MotionRig } from "../mechanisms/types";
import type { PlaySnapshotReport } from "../play/types";

/** One driving action for every certified vehicle; detailed seat rigs remain
 * available through the explicit seated API. Possession invents no seat weld. */
export function PlaySeatEntry({
  play,
  rig,
  report,
  action,
  eligibility,
  message,
}: {
  play: BrowserPlay;
  rig: MotionRig;
  report: PlaySnapshotReport;
  action: (run: () => unknown) => void;
  eligibility: { eligible: boolean; reason?: string };
  message?: string;
}) {
  const collision = (report.mechanisms?.[rig.id] ?? report.mechanism)
    ?.vehicleCollision;
  return (
    <>
      {message && (
        <small className="play-note" role="status">
          {message}
        </small>
      )}
      {collision?.supported === false && eligibility.reason && (
        <small className="play-note" role="status">
          {eligibility.reason}
        </small>
      )}
      <small className="play-caption">
        {collision?.supported === false ? collision.reason : rig.name}
      </small>
      <div className="play-prompt-row">
        <button
          className="play-prompt is-commit"
          disabled={!eligibility.eligible || collision?.supported === false}
          onClick={() => action(() => play.controlVehicle(rig.id))}
        >
          <Icon name="wheel" />
          Get in
        </button>
      </div>
    </>
  );
}
