/**
 * Shared charting constants for every Recharts card.
 *
 * Palette: the validated categorical order from the data-viz method
 * (blue, orange, aqua, yellow, magenta, green, violet, red), stepped for a DARK
 * surface — gitTrace commits to a single dark look (see globals.css). Hues are
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

/** The brand accent — used for single-series magnitude charts (aggregate bar). */
export const PRIMARY_HUE = "#38bdf8";

/** Neutral colour for the folded "Other" series. */
export const MUTED_SERIES = "#7c828e";

/** Max distinct series before we fold the rest into an "Other" bucket. */
export const MAX_SERIES = 7;

// Tuned for the dark canvas (see globals.css tokens).
export const AXIS_COLOR = "#3f3f46";
export const GRID_COLOR = "#27272d";
export const TEXT_COLOR = "#a1a1aa";

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
    borderRadius: 10,
    border: "1px solid #27272d",
    background: "#18181b",
    color: "#f4f4f5",
    fontSize: 12,
    boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
  },
  labelStyle: { color: "#f4f4f5", fontWeight: 600 },
  itemStyle: { color: "#d4d4d8" },
} as const;
