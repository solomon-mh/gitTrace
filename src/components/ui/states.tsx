import type { ReactNode } from "react";

/**
 * Shared loading / empty / error presentations so every card behaves the same
 * way. The rule (from the spec): never leave a blank space.
 */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-8 text-sm text-ink-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-ink-muted" />
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
          className="h-8 animate-pulse rounded bg-surface-2"
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
    <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

/**
 * Shown instead of ErrorState when the *token itself* is broken — every card
 * would otherwise render its own copy of the same "token rejected" message.
 * One explanation lives in the banner at the top of the page; every card just
 * points at it.
 */
export function BlockedState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink-muted">
        Waiting on your GitHub token
      </p>
      <p className="mt-1 text-xs text-ink-subtle">
        See the notice at the top of the page.
      </p>
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
    <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-6 text-sm text-danger">
      <p className="font-medium">Couldn&apos;t load this card</p>
      <p className="mt-1 text-danger/90">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-danger/40 bg-surface px-3 py-1 text-xs font-medium text-danger hover:bg-danger/5"
        >
          Retry
        </button>
      )}
    </div>
  );
}
