import type { ReactNode } from "react";

/**
 * Shared loading / empty / error presentations so every card behaves the same
 * way. The rule (from the spec): never leave a blank space.
 */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
      {label}
    </div>
  );
}

/** Skeleton rows for list-shaped cards. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded bg-slate-100"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title = "Nothing to show",
  hint,
}: {
  title?: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-6 text-sm text-danger">
      <p className="font-medium">Couldn&apos;t load this card</p>
      <p className="mt-1 text-danger/90">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-danger/30 bg-white px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5"
        >
          Retry
        </button>
      )}
    </div>
  );
}
