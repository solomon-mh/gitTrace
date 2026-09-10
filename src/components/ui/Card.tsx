import type { ReactNode } from "react";

/**
 * The shell every metric card sits in. One consistent header treatment:
 * a small status-coloured dot, the title in the display face, an optional
 * subtitle, and a right-aligned slot for controls.
 */
export function Card({
  title,
  subtitle,
  actions,
  accent = "accent",
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  accent?: "accent" | "ok" | "warn" | "danger";
  children: ReactNode;
  className?: string;
}) {
  const dot =
    accent === "ok"
      ? "bg-ok"
      : accent === "warn"
        ? "bg-warn"
        : accent === "danger"
          ? "bg-danger"
          : "bg-accent";

  return (
    <section
      className={`relative flex flex-col rounded-xl border border-border bg-surface ${className}`}
    >
      <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
          <div>
            <h2 className="font-display text-[13px] font-semibold leading-none text-ink">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1.5 text-xs text-ink-subtle">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="border-t border-border p-5">{children}</div>
    </section>
  );
}
