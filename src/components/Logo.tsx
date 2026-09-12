/**
 * gitTrace brand mark.
 *
 * A hex badge framing a traced path: three waypoints, growing in size as the
 * trace climbs toward the head commit. Commit history as a signal you follow
 * from origin to HEAD, not a stream you watch go by.
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
          id="gt-trace"
          x1="9"
          y1="22"
          x2="23"
          y2="9"
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
      {/* the trace, bending up toward the head */}
      <path
        d="M10 21.5L13 13L22 10.5"
        stroke="url(#gt-trace)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* three waypoints, growing toward the head */}
      <rect
        x="8.4"
        y="19.9"
        width="3.2"
        height="3.2"
        rx="0.7"
        fill="url(#gt-trace)"
      />
      <rect
        x="11"
        y="11"
        width="4"
        height="4"
        rx="0.8"
        fill="url(#gt-trace)"
      />
      <rect
        x="19.4"
        y="7.9"
        width="5.2"
        height="5.2"
        rx="1"
        fill="url(#gt-trace)"
      />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={22} />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        <span className="text-ink-muted">git</span>
        <span className="text-ink">Trace</span>
      </span>
    </span>
  );
}
