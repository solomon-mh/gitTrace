"use client";

import { useState } from "react";
import type { VerifyResult } from "@/lib/github/queries/verify";
import { useDashboard } from "./DashboardContext";
import { useVerify } from "./useVerify";

/**
 * The main-column header (sits next to the sidebar). Left: what the dashboard is
 * currently showing. Right: who we're authed as, rate-limit budget, token type,
 * and the global refresh.
 */
export function TopBar() {
  const { source, selectedRepos, repos, refreshAll } = useDashboard();
  const info = useVerify();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }

  const scopeLabel =
    source?.type === "viewer"
      ? "All your repositories"
      : source?.type === "org"
        ? `${source.value}`
        : source?.type === "repos"
          ? `${source.value.length} selected repositories`
          : "No source loaded";

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-canvas/80 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="min-w-0">
        <h1 className="font-display text-base font-semibold tracking-tight text-ink">
          Organization health
        </h1>
        <p className="truncate text-xs text-ink-subtle">
          {scopeLabel}
          {repos.length > 0 && (
            <> · {selectedRepos.length}/{repos.length} in view</>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2.5 text-xs">
        {info.state === "loading" && (
          <span className="text-ink-subtle">connecting…</span>
        )}
        {info.state === "error" && (
          <span className="font-medium text-danger">{info.message}</span>
        )}
        {info.state === "ok" && (
          <span className="hidden items-center gap-2 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            <span className="text-ink-muted">@{info.data.login}</span>
            <span className="text-ink-subtle">·</span>
            <RateLimit rl={info.data.rateLimit} />
            <span className="text-ink-subtle">·</span>
            <TokenBadge data={info.data} />
          </span>
        )}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </header>
  );
}

function RateLimit({
  rl,
}: {
  rl: VerifyResult["rateLimit"];
}) {
  const low = rl.remaining < rl.limit * 0.1;
  return (
    <span
      className={`font-mono ${low ? "font-medium text-warn" : "text-ink-subtle"}`}
    >
      {rl.remaining.toLocaleString()}/{rl.limit.toLocaleString()}
      {low && (
        <> · resets {new Date(rl.resetAt).toLocaleTimeString()}</>
      )}
    </span>
  );
}

function TokenBadge({ data }: { data: VerifyResult }) {
  if (data.tokenScopes == null) {
    return <span className="text-ink-subtle">fine-grained token</span>;
  }
  if (data.tokenScopes.length === 0) {
    return <span className="text-warn">no scopes</span>;
  }
  return (
    <span className="font-mono text-ink-subtle">
      {data.tokenScopes.join(" ")}
    </span>
  );
}
