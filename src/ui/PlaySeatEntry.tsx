import type { BrowserPlay } from "../play/browser";
import { Icon } from "./icons";
import type { MotionRig } from "../mechanisms/types";
import type { PlaySnapshotReport } from "../play/types";

/** Physical entry is deliberately distinct from the existing on-foot remote action. */
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
  const seat = rig.vehicle!.driverSeat!;
  const collision = (report.mechanisms?.[rig.id] ?? report.mechanism)
    ?.vehicleCollision;
  return (
    <>
      {message && (
        <small className="play-note" role="status">
          {message}
        </small>
      )}
      {eligibility.reason && (
        <small className="play-note" role="status">
          {eligibility.reason}
        </small>
      )}
      <small className="play-caption">
        {collision?.supported === false ? collision.reason : rig.name}
      </small>
      <div className="play-prompt-row">
        {collision?.supported !== false && (
          <button
            className="play-prompt play-seat-remote"
            onClick={() => action(() => play.controlVehicle(rig.id))}
          >
            <Icon name="wheel" />
            Drive from here
          </button>
        )}
        <button
          className="play-prompt is-commit"
          disabled={!eligibility.eligible}
          onClick={() =>
            action(() => play.enterVehicle({ rigId: rig.id, seatId: seat.id }))
          }
        >
          <Icon name="seat" />
          Get in
        </button>
      </div>
    </>
  );
}
