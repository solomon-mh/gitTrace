"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, describeError } from "@/lib/api/client";
import type { VerifyResult } from "@/lib/github/queries/verify";
import { useDashboard } from "./DashboardContext";

type VerifyState =
  | { state: "loading" }
  | { state: "error"; message: string; kind: string }
  | { state: "ok"; data: VerifyResult };

/**
 * Top-of-page strip: who we're authenticated as, remaining GraphQL rate-limit
 * budget, and a "Refresh all" button (clears the server cache, then refetches
 * every card). If the token itself is the problem, we also render a full-width
 * setup banner so the user isn't left guessing why every card errored.
 */
export function StatusBar() {
  const { refreshAll, refreshNonce } = useDashboard();
  const [info, setInfo] = useState<VerifyState>({ state: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setInfo({ state: "loading" });
    apiGet<VerifyResult>("/api/verify")
      .then((data) => !cancelled && setInfo({ state: "ok", data }))
      .catch((err) => {
        if (cancelled) return;
        setInfo({
          state: "error",
          message: describeError(err),
          kind: err instanceof ApiError ? err.kind : "UNKNOWN",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }

  const authProblem =
    info.state === "error" &&
    (info.kind === "MISSING_TOKEN" || info.kind === "BAD_CREDENTIALS");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          {info.state === "loading" && (
            <span className="text-slate-400">Checking GitHub connection…</span>
          )}
          {info.state === "error" && (
            <span className="font-medium text-danger">
              GitHub: {info.message}
            </span>
          )}
          {info.state === "ok" && (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-ok" />
              <span className="text-slate-600">@{info.data.login}</span>
              <span className="text-slate-300">·</span>
              <RateLimit
                remaining={info.data.rateLimit.remaining}
                limit={info.data.rateLimit.limit}
                resetAt={info.data.rateLimit.resetAt}
              />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh all"}
        </button>
      </div>

      {authProblem && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <p className="font-semibold">GitHub token not working</p>
          <p className="mt-1 text-danger/90">{info.message}</p>
          <p className="mt-2 text-xs text-danger/80">
            Copy <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code>, set{" "}
            <code className="font-mono">GITHUB_TOKEN</code> to a PAT with the{" "}
            <code className="font-mono">repo</code> and{" "}
            <code className="font-mono">read:org</code> scopes, then restart the
            dev server. See the README for step-by-step instructions.
          </p>
        </div>
      )}
    </div>
  );
}

function RateLimit({
  remaining,
  limit,
  resetAt,
}: {
  remaining: number;
  limit: number;
  resetAt: string;
}) {
  const low = remaining < limit * 0.1;
  return (
    <span className={low ? "font-medium text-warn" : "text-slate-500"}>
      rate limit {remaining.toLocaleString()}/{limit.toLocaleString()}
      {low && <> · resets {new Date(resetAt).toLocaleTimeString()}</>}
    </span>
  );
}
