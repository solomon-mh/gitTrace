/**
 * GitStream brand mark.
 *
 * The glyph is two branches weaving past each other — a braided current — with
 * a commit node where they cross. It reads as "git" (branch lanes + commit dot)
 * and "stream" (the flowing weave) at once, and stays legible down to 16px.
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
        <linearGradient id="gs-stroke" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--ok))" />
        </linearGradient>
      </defs>
      {/* two braided streams */}
      <path
        d="M8 3.5C8 12 24 12 24 20.5C24 25 24 27 24 28.5"
        stroke="url(#gs-stroke)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M24 3.5C24 12 8 12 8 20.5C8 25 8 27 8 28.5"
        stroke="rgb(var(--accent))"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* commit nodes */}
      <circle cx="16" cy="12" r="3" fill="rgb(var(--canvas))" />
      <circle cx="16" cy="12" r="2.4" fill="rgb(var(--accent))" />
      <circle cx="8" cy="3.5" r="1.7" fill="rgb(var(--accent))" />
      <circle cx="24" cy="28.5" r="1.7" fill="rgb(var(--ok))" />
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
