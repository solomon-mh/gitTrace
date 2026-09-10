"use client";

/**
 * App-level error boundary. Catches render/runtime errors in the dashboard tree
 * so a bug in one card doesn't leave the user staring at a blank white page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">
        Something broke while rendering the dashboard
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {error.message || "An unexpected client-side error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Try again
      </button>
    </main>
  );
}
