import type { BrowserPlay } from "../play/browser";
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
      <button
        className="primary"
        disabled={!eligibility.eligible}
        onClick={() =>
          action(() => play.enterVehicle({ rigId: rig.id, seatId: seat.id }))
        }
      >
        Enter driver seat
      </button>
      <small>{rig.name} · open-bench seat. Entry checks clearance.</small>
      {message && <small role="status">{message}</small>}
      {eligibility.reason && <small role="status">{eligibility.reason}</small>}
      <button
        className="play-seat-remote"
        disabled={collision?.supported === false}
        onClick={() => action(() => play.controlVehicle(rig.id))}
      >
        Control vehicle from here
      </button>
      <small>
        {collision?.supported === false
          ? collision.reason
          : "Remote control keeps you on foot."}
      </small>
    </>
  );
}
