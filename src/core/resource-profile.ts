import { ensure } from "./types";

/**
 * Application resource profiles (spec §21.2). These are policy defaults, not browser
 * guarantees. The effective profile is trusted session state chosen by the device or the
 * user; it is never read from imported project content.
 */
export type ResourceProfileName = "desktop" | "mobile";
export type ResourceLimits = {
  /** Imported source or archive bytes, rejected before expensive processing. */
  importBytes: number;
  /** Total decompressed archive bytes, enforced incrementally. */
  decompressedBytes: number;
  /** Embedded source/archive files. */
  embeddedFiles: number;
  referenceDepth: number;
  /** Expanded placed occurrences (leaves). */
  occurrences: number;
  /** Net occurrences a single command may add. */
  additionsPerCommand: number;
  /** Output image pixels per capture. */
  imagePixels: number;
};
const Mi = 1024 * 1024;
export const RESOURCE_PROFILES: Readonly<
  Record<ResourceProfileName, Readonly<ResourceLimits>>
> = Object.freeze({
  desktop: Object.freeze({
    importBytes: 25 * Mi,
    decompressedBytes: 100 * Mi,
    embeddedFiles: 10000,
    referenceDepth: 64,
    occurrences: 100000,
    additionsPerCommand: 10000,
    imagePixels: 16000000,
  }),
  mobile: Object.freeze({
    importBytes: 10 * Mi,
    decompressedBytes: 40 * Mi,
    embeddedFiles: 5000,
    referenceDepth: 64,
    occurrences: 25000,
    additionsPerCommand: 2000,
    imagePixels: 4000000,
  }),
});
export function isResourceProfile(
  value: unknown,
): value is ResourceProfileName {
  return value === "desktop" || value === "mobile";
}
export function resourceLimits(
  profile: ResourceProfileName = "desktop",
): ResourceLimits {
  ensure(
    isResourceProfile(profile),
    "INVALID_INPUT",
    "Unknown resource profile",
  );
  return { ...RESOURCE_PROFILES[profile] };
}

export type DeviceHints = {
  /** `(pointer: coarse)` matches for the primary pointer. */
  coarsePointer: boolean;
  /** Shorter side of the screen in CSS pixels. */
  screenShortSide: number;
  /** navigator.deviceMemory in GiB, where the browser exposes it. */
  deviceMemory?: number;
};
/** Phone-class devices get the mobile profile; tablets and desktops keep desktop. */
export function detectResourceProfile(hints: DeviceHints): {
  profile: ResourceProfileName;
  reason: string;
} {
  if (
    hints.deviceMemory !== undefined &&
    Number.isFinite(hints.deviceMemory) &&
    hints.deviceMemory > 0 &&
    hints.deviceMemory <= 2
  )
    return {
      profile: "mobile",
      reason: `This device reports ${hints.deviceMemory} GB of memory, so phone limits apply.`,
    };
  if (hints.coarsePointer && hints.screenShortSide < 600)
    return {
      profile: "mobile",
      reason:
        "This looks like a phone, so phone limits keep large builds from exhausting its memory.",
    };
  return {
    profile: "desktop",
    reason: hints.coarsePointer
      ? "This looks like a tablet or large touch screen."
      : "This looks like a desktop or laptop.",
  };
}

export type ResourcePreference = "auto" | ResourceProfileName;
export type EffectiveResourceProfile = {
  profile: ResourceProfileName;
  preference: ResourcePreference;
  detected: ResourceProfileName;
  reason: string;
  /** The user chose limits above what this device was detected to support. */
  raisedAboveDevice: boolean;
  limits: ResourceLimits;
};
export function effectiveResourceProfile(
  preference: ResourcePreference,
  hints: DeviceHints,
): EffectiveResourceProfile {
  const detected = detectResourceProfile(hints);
  const profile = preference === "auto" ? detected.profile : preference;
  return {
    profile,
    preference,
    detected: detected.profile,
    reason: detected.reason,
    raisedAboveDevice: detected.profile === "mobile" && profile === "desktop",
    limits: resourceLimits(profile),
  };
}
