import type { ReactNode } from "react";

/**
 * The one card shell every dashboard metric sits in. Keeps the header, spacing,
 * and the "one card per metric category" layout consistent.
 */
export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-border bg-surface shadow-sm ${className}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}
