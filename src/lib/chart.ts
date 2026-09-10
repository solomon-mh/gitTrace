/**
 * Shared charting constants for every Recharts card.
 *
 * Palette: the validated categorical order from the data-viz method
 * (blue, orange, aqua, yellow, magenta, green, violet, red). Light-mode steps —
 * GitStream commits to a single light look (see globals.css). Hues are assigned
 * in fixed order and never cycled; a 9th series folds into "Other".
 */
export const SERIES_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

/** Single-hue sequential blue for one-series magnitude charts (aggregate). */
export const PRIMARY_HUE = "#2a78d6";

/** Max distinct series before we fold the rest into an "Other" bucket. */
export const MAX_SERIES = 7;

export const AXIS_COLOR = "#94a3b8"; // slate-400
export const GRID_COLOR = "#e2e8f0"; // slate-200
export const TEXT_COLOR = "#475569"; // slate-600

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

/** Just the repo name from "owner/name". */
export function shortRepo(nameWithOwner: string): string {
  const i = nameWithOwner.indexOf("/");
  return i === -1 ? nameWithOwner : nameWithOwner.slice(i + 1);
}

/** Tooltip container styling shared by all charts. */
export const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
  },
  labelStyle: { color: "#0f172a", fontWeight: 600 },
} as const;
