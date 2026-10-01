/**
 * Third-person zoom input (docs/API.md, "Camera zoom"). Returns a
 * multiplicative factor for the follow distance: below 1 zooms in.
 *
 * - A mouse wheel notch (deltaY ±100 px, or ±3 lines) is about 16%.
 * - Trackpad pinch arrives as ctrl+wheel with small pixel deltas; it is
 *   scaled up so a pinch feels like the fingers' spread.
 * - One event never changes the distance by more than a factor of e^0.5.
 */
export function wheelZoomFactor(e: {
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
}) {
  if (!Number.isFinite(e.deltaY) || e.deltaY === 0) return 1;
  // DOM_DELTA_LINE and DOM_DELTA_PAGE to pixels.
  const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 600 : 1);
  const k = e.ctrlKey ? 0.01 : 0.0015;
  return Math.exp(Math.max(-0.5, Math.min(0.5, px * k)));
}
/** Two-finger pinch: spreading the fingers (distance grows) zooms in. */
export function pinchZoomFactor(previous: number, current: number) {
  if (!(previous > 0) || !(current > 0)) return 1;
  return Math.max(0.6, Math.min(1 / 0.6, previous / current));
}
