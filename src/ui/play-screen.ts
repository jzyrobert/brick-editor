/**
 * Phone screen handling for Play: fullscreen and a landscape lock where the
 * browser allows them (Android Chrome), graceful no-ops elsewhere (iOS Safari
 * has no element fullscreen or orientation lock; the rotate prompt covers it).
 */

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

/** A touch phone: coarse pointer and a short side under 600 CSS px. Tablets
 * play comfortably either way up, so they are left alone. */
export function isPlayPhone() {
  if (typeof matchMedia !== "function") return false;
  return (
    matchMedia("(pointer: coarse)").matches &&
    Math.min(innerWidth, innerHeight) < 600
  );
}

export function isPortrait() {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(orientation: portrait)").matches
  );
}

/** Set once the player chooses portrait, so Play does not ask again during this visit. */
let portraitChosen = false;
export const portraitWasChosen = () => portraitChosen;
export function choosePortrait() {
  portraitChosen = true;
  unlockOrientation();
}

let ownFullscreen = false;

const orientation = () =>
  (typeof screen !== "undefined" ? screen.orientation : undefined) as
    | LockableOrientation
    | undefined;

function lockLandscape() {
  if (portraitChosen) return;
  try {
    void orientation()
      ?.lock?.("landscape")
      .catch(() => undefined);
  } catch {
    // Unsupported: the rotate prompt explains instead.
  }
}

function unlockOrientation() {
  try {
    orientation()?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}

/**
 * Called from the Enter Play tap (a user gesture). Automated browsers keep
 * the viewport they asked for, so tests and agents are never resized.
 */
export function enterPlayScreen() {
  if (typeof navigator !== "undefined" && navigator.webdriver) return;
  const root = document.documentElement;
  if (document.fullscreenElement || !root.requestFullscreen) {
    lockLandscape();
    return;
  }
  root
    .requestFullscreen({ navigationUI: "hide" })
    .then(() => {
      ownFullscreen = true;
      lockLandscape();
    })
    .catch(() => undefined);
}

/** Leave fullscreen (only if Play entered it) and release the lock. */
export function leavePlayScreen() {
  unlockOrientation();
  if (ownFullscreen && document.fullscreenElement)
    void document.exitFullscreen().catch(() => undefined);
  ownFullscreen = false;
}
