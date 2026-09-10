"use client";

import { useEffect, useState } from "react";
import { apiGet, describeError } from "@/lib/api/client";
import type { VerifyResult } from "@/lib/github/queries/verify";
import { useDashboard } from "./DashboardContext";

/**
 * Top-of-page strip: who we're authenticated as, remaining GraphQL rate-limit
 * budget, and a "Refresh all" button that busts the client-side view and lets
 * every card refetch.
 */
export function StatusBar() {
  const { refreshAll, refreshNonce } = useDashboard();
  const [info, setInfo] = useState<
    | { state: "loading" }
    | { state: "error"; message: string }
    | { state: "ok"; data: VerifyResult }
  >({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    setInfo({ state: "loading" });
    apiGet<VerifyResult>("/api/verify")
      .then((data) => !cancelled && setInfo({ state: "ok", data }))
      .catch(
        (err) =>
          !cancelled &&
          setInfo({ state: "error", message: describeError(err) }),
      );
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  return (
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
            <span className="text-slate-600">
              @{info.data.login}
            </span>
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
        onClick={refreshAll}
        className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-600 hover:bg-slate-50"
      >
        Refresh all
      </button>
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
      {low && (
        <> · resets {new Date(resetAt).toLocaleTimeString()}</>
      )}
    </span>
  );
}
