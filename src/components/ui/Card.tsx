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
      className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}
