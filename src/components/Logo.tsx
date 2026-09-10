/**
 * GitStream brand mark.
 *
 * Three flowing currents (a stream) with a commit node riding the middle one
 * (git). Reads as moving water + a commit graph at once, and stays legible at
 * favicon size.
 */

export function LogoMark({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gs-flow" x1="2" y1="16" x2="30" y2="16">
          <stop offset="0" stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--ok))" />
        </linearGradient>
      </defs>
      {/* three currents */}
      <path
        d="M3 9c4-3 7 3 11 0s7-3 8 0"
        stroke="rgb(var(--accent))"
        strokeOpacity="0.5"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M4 16c4.5-3.5 8 3.5 12.5 0S25 12.5 29 16"
        stroke="url(#gs-flow)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M6 23c4-3 7 3 11 0s7-3 8 0"
        stroke="rgb(var(--accent))"
        strokeOpacity="0.5"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {/* commit node on the main current */}
      <circle cx="16.5" cy="16" r="3.4" fill="rgb(var(--canvas))" />
      <circle cx="16.5" cy="16" r="2.6" fill="rgb(var(--accent))" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={22} />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        <span className="text-ink-muted">Git</span>
        <span className="text-ink">Stream</span>
      </span>
    </span>
  );
}
