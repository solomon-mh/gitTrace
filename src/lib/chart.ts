/**
 * Shared charting constants for every Recharts card.
 *
 * Palette: the validated categorical order from the data-viz method
 * (blue, orange, aqua, yellow, magenta, green, violet, red), stepped for a DARK
 * surface — GitStream commits to a single dark look (see globals.css). Hues are
 * assigned in fixed order and never cycled; a 9th series folds into "Other".
 */
export const SERIES_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#3fb950", // green
  "#9085e9", // violet
  "#e66767", // red
] as const;

/** Single-hue blue for one-series magnitude charts (the aggregate bar chart). */
export const PRIMARY_HUE = "#3987e5";

/** Neutral colour for the folded "Other" series. */
export const MUTED_SERIES = "#7c828e";

/** Max distinct series before we fold the rest into an "Other" bucket. */
export const MAX_SERIES = 7;

// Tuned for the dark canvas (see globals.css tokens).
export const AXIS_COLOR = "#3a3f4a";
export const GRID_COLOR = "#262a33";
export const TEXT_COLOR = "#9aa1ac";

/** Common Recharts props for a recessive cartesian grid. */
export const gridProps = {
  stroke: GRID_COLOR,
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export const axisProps = {
  stroke: AXIS_COLOR,
  tick: { fill: TEXT_COLOR, fontSize: 11 },
  tickLine: false,
} as const;

/**
 * Disable Recharts' entry animation. The dashboard reloads charts on every
 * filter change, so the grow-in animation just adds latency and jank — and it
 * makes headless screenshots capture empty axes. Static marks are the right
 * call here.
 */
export const NO_ANIM = { isAnimationActive: false } as const;

/** Just the repo name from "owner/name". */
export function shortRepo(nameWithOwner: string): string {
  const i = nameWithOwner.indexOf("/");
  return i === -1 ? nameWithOwner : nameWithOwner.slice(i + 1);
}

/** Tooltip container styling shared by all charts. */
export const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #2a2e37",
    background: "#1e2128",
    color: "#e6e8eb",
    fontSize: 12,
    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
  },
  labelStyle: { color: "#e6e8eb", fontWeight: 600 },
  itemStyle: { color: "#c3c7ce" },
} as const;
