/** Authored 24px, 2px-stroke icon set: one weight and cap style across the HUD. */
const paths = {
  select: <path d="M6 3.5l12.5 7.3-5.6 1.7-2.4 5.9z" />,
  place: (
    <>
      <rect x="3" y="10" width="18" height="9" rx="1.5" />
      <path d="M7 10V7.5h3V10M14 10V7.5h3V10" />
    </>
  ),
  paint: (
    <path d="M12 3.5c3.2 4.2 6 7.2 6 10.3a6 6 0 0 1-12 0c0-3.1 2.8-6.1 6-10.3z" />
  ),
  navigate: (
    <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  redo: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </>
  ),
  view: (
    <>
      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  parts: (
    <>
      <rect x="3" y="10" width="18" height="9" rx="1.5" />
      <path d="M7 10V7.5h3V10M14 10V7.5h3V10" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  inspector: (
    <>
      <path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V3.5M7.5 8L12 3.5 16.5 8" />
      <path d="M5 12v7.5h14V12" />
    </>
  ),
  save: (
    <>
      <path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5" />
      <path d="M5 17v3h14v-3" />
    </>
  ),
  build: (
    <>
      <rect x="3" y="11" width="18" height="8" rx="1.5" />
      <path d="M7 11V8.5h3V11M14 11V8.5h3V11" />
    </>
  ),
  instructions: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" />
    </>
  ),
  photo: (
    <>
      <path d="M4 8h3.5l2-3h5l2 3H20v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7.5v6M12 13.5l-3.5 7M12 13.5l3.5 7M7 10.5l5-1.5 5 1.5" />
    </>
  ),
  project: (
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H10l2 2.5h7.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
  ),
  fill: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  canvas: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  expand: <path d="M7 14l5-5 5 5" />,
  collapse: <path d="M7 10l5 5 5-5" />,
  star: (
    <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.2 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  arrowRight: <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />,
  arrowLeft: <path d="M19.5 12h-15M10 6.5L4.5 12l5.5 5.5" />,
  arrowUp: <path d="M12 19.5v-15M6.5 10L12 4.5 17.5 10" />,
  arrowDown: <path d="M12 4.5v15M6.5 14l5.5 5.5 5.5-5.5" />,
  external: (
    <>
      <path d="M14 4.5h5.5V10M19.5 4.5L11 13" />
      <path d="M18 14v5.5H4.5V6H10" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </>
  ),
  measure: (
    <>
      <path d="M3.5 16.5L16.5 3.5l4 4-13 13z" />
      <path d="M7 13l2 2M10 10l1.5 1.5M13 7l2 2" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </>
  ),
  /* Play HUD. */
  pause: <path d="M9 5v14M15 5v14" />,
  resume: <path d="M8 5.5v13l10.5-6.5z" />,
  jump: <path d="M12 16V4.5M7 9.5l5-5 5 5M5 20h14" />,
  run: <path d="M5 6l6 6-6 6M13 6l6 6-6 6" />,
  fly: (
    <>
      <path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
      <path d="M10 10.5v1M14 10.5v1" />
    </>
  ),
  door: (
    <>
      <path d="M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21M3.5 21h17" />
      <path d="M14.5 11.5v1.5" />
    </>
  ),
  hand: (
    <path d="M9 11.5V5a1.5 1.5 0 0 1 3 0v5.5V4a1.5 1.5 0 0 1 3 0v6.5-4a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.6a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.4-2.1L9 15" />
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M3.5 12H10M14 12h6.5M12 14v6.5" />
    </>
  ),
  seat: <path d="M8 3.5V13h8.5l1.5 7.5M8 13l-1.5 7.5M8 9h5" />,
  exit: (
    <>
      <path d="M13 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H13" />
      <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  train: (
    <>
      <path d="M5 16V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V16z" />
      <path d="M5 11h14M9 5v6M15 5v6" />
      <circle cx="8.5" cy="18.5" r="1.5" />
      <circle cx="15.5" cy="18.5" r="1.5" />
    </>
  ),
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />,
  reverse: (
    <path d="M7 4.5 3.5 8 7 11.5M3.5 8H16M17 12.5l3.5 3.5-3.5 3.5M20.5 16H8" />
  ),
  horn: (
    <>
      <path d="M4 10v4h3l6 4V6L7 10z" />
      <path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  points: <path d="M6 20V4M6 12c0-4 12-4 12-8M18 20v-4" />,
  camera: (
    <>
      <path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 20,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
