import {
  PLAYER_SCALE_PRESETS,
  PLAYER_SCALE_STEPS,
  formatScale,
  nearestPlayerScaleStep,
  playerScaleLabel,
  type PlayerScaleSuggestion,
} from "../play/player-scale";
import { CHARACTER_PROFILE } from "../play/types";

/** One line saying what a size means, in bricks a child can picture. */
export function playerSizeLine(scale: number) {
  if (scale === 1) return "Minifigure size, as LEGO buildings are made.";
  const bricks = (CHARACTER_PROFILE.height * scale) / 24;
  const tall =
    bricks < 1.5
      ? "about one brick tall"
      : `about ${Math.round(bricks)} bricks tall`;
  return `${formatScale(scale)} × a minifigure, ${tall}.`;
}

/**
 * Player size: four named sizes, the suggested one marked, and every step
 * under "More sizes". The engine scales the explorer only; the build stays
 * as it is (src/play/player-scale.ts).
 */
export function PlayPlayerSize({
  value,
  suggestion,
  disabledReason,
  onChange,
  idPrefix = "play-size",
}: {
  value: number;
  suggestion?: PlayerScaleSuggestion;
  /** Why the size cannot change right now (seated, riding…). */
  disabledReason?: string;
  onChange: (scale: number) => void;
  idPrefix?: string;
}) {
  const disabled = !!disabledReason;
  const step = nearestPlayerScaleStep(value);
  const offer =
    suggestion && suggestion.scale !== value ? suggestion : undefined;
  return (
    <div className="play-size">
      <p className="play-size-intro">
        Make your explorer smaller for tiny builds or bigger for giant ones.
        Your build doesn’t change.
      </p>
      <div
        className="segmented play-size-presets"
        role="group"
        aria-label="Player size"
      >
        {PLAYER_SCALE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={value === preset.scale}
            disabled={disabled}
            onClick={() => onChange(preset.scale)}
          >
            {preset.label}
            {suggestion?.scale === preset.scale && (
              <span className="play-size-badge">Suggested</span>
            )}
          </button>
        ))}
      </div>
      <p className="play-size-now" aria-live="polite">
        {playerSizeLine(value)}
      </p>
      {offer && (
        <div className="play-size-suggestion">
          <p>
            <strong>Try {playerScaleLabel(offer.scale)}.</strong> {offer.reason}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(offer.scale)}
          >
            Use {playerScaleLabel(offer.scale)}
          </button>
        </div>
      )}
      {disabledReason && <p className="play-size-note">{disabledReason}</p>}
      <details className="play-size-more">
        <summary>More sizes</summary>
        <label className="play-size-slider" htmlFor={`${idPrefix}-slider`}>
          <span>
            Size: <strong>{formatScale(PLAYER_SCALE_STEPS[step])}×</strong>
          </span>
          <input
            id={`${idPrefix}-slider`}
            type="range"
            min={0}
            max={PLAYER_SCALE_STEPS.length - 1}
            step={1}
            value={step}
            disabled={disabled}
            aria-valuetext={`${formatScale(PLAYER_SCALE_STEPS[step])} times a minifigure`}
            onChange={(e) =>
              onChange(PLAYER_SCALE_STEPS[Number(e.target.value)])
            }
          />
          <span className="play-size-ends" aria-hidden="true">
            <span>¼×</span>
            <span>8×</span>
          </span>
        </label>
        <p className="play-size-note">
          Speed, jumps, steps and reach grow with you. Seats and train cabs only
          fit Minifigure size. Very big explorers can be slower in big builds.
        </p>
      </details>
    </div>
  );
}
