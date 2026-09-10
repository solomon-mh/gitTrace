/** Small date/number formatting helpers shared across cards. */

const DAY = 86_400_000;

/** "3d ago", "5w ago", "2mo ago" — compact relative time. */
export function timeAgo(iso: string | number | Date): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "—";
  if (diff < 0) return "just now";
  const days = Math.floor(diff / DAY);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Whole days between a date and now (floored, never negative). */
export function daysSince(iso: string | number | Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.max(0, Math.floor((Date.now() - then) / DAY));
}

/** "1,234" */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Short calendar date, e.g. "Sep 10". */
export function shortDate(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** "2.3 days", "18 hours" — humanised duration from milliseconds. */
export function humanizeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const hours = ms / 3_600_000;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} hours`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)} days`;
}
