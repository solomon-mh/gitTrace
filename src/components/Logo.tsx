/**
 * gitStream brand mark.
 *
 * A hex badge framing a single commit line: three diamonds growing in size
 * as they climb toward the head commit, on one straight diagonal stroke.
 * All angles, no curves — the git graph is the mark, the diagonal is the
 * "stream".
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
        <linearGradient
          id="gs-flow"
          x1="9"
          y1="22"
          x2="23"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--ok))" />
        </linearGradient>
      </defs>
      {/* hex badge frame */}
      <path
        d="M16 3L27.3 9.5L27.3 22.5L16 29L4.7 22.5L4.7 9.5Z"
        fill="rgb(var(--canvas))"
        stroke="rgb(var(--ink-muted))"
        strokeOpacity="0.4"
        strokeWidth="1.4"
      />
      {/* one commit line, climbing toward the head */}
      <path
        d="M10 21.5L22 10.5"
        stroke="url(#gs-flow)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* three commits, growing toward the head */}
      <path d="M10 19.7L11.8 21.5L10 23.3L8.2 21.5Z" fill="url(#gs-flow)" />
      <path d="M16 13.3L18.3 16L16 18.7L13.7 16Z" fill="url(#gs-flow)" />
      <path d="M22 8.5L25 10.5L22 12.5L19 10.5Z" fill="url(#gs-flow)" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={22} />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        <span className="text-ink-muted">git</span>
        <span className="text-ink">Stream</span>
      </span>
    </span>
  );
}
