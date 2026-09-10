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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          {info.state === "loading" && (
            <span className="text-ink-subtle">Checking GitHub connection…</span>
          )}
          {info.state === "error" && (
            <span className="font-medium text-danger">
              GitHub: {info.message}
            </span>
          )}
          {info.state === "ok" && (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-ok" />
              <span className="text-ink-muted">@{info.data.login}</span>
              <span className="text-ink-subtle">·</span>
              <RateLimit
                remaining={info.data.rateLimit.remaining}
                limit={info.data.rateLimit.limit}
                resetAt={info.data.rateLimit.resetAt}
              />
              <span className="text-ink-subtle">·</span>
              <TokenScopes data={info.data} />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded-md border border-border px-2.5 py-1 font-medium text-ink-muted hover:bg-surface-2 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh all"}
        </button>
      </div>

      {authProblem && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
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

      {info.state === "ok" && <ScopeHint data={info.data} />}
    </div>
  );
}

function TokenScopes({ data }: { data: VerifyResult }) {
  if (data.tokenScopes == null) {
    return <span className="text-ink-subtle">fine-grained token</span>;
  }
  if (data.tokenScopes.length === 0) {
    return <span className="text-warn">token has no scopes</span>;
  }
  return (
    <span className="font-mono text-ink-subtle">
      {data.tokenScopes.join(" ")}
    </span>
  );
}

/**
 * Explains why private repos / orgs might be missing — the #1 support question.
 * GitStream never filters by visibility; this is always a token-permission issue.
 */
function ScopeHint({ data }: { data: VerifyResult }) {
  const fineGrained = data.tokenScopes == null;

  if (fineGrained) {
    // Fine-grained tokens are scoped to ONE owner and can't span orgs.
    if (data.organizations.length > 0) return null;
    return (
      <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-xs text-warn">
        This is a <strong>fine-grained token</strong> — it only sees the one
        account (user or org) it was created for, and only repos you granted it
        with <code className="font-mono">Metadata</code> +{" "}
        <code className="font-mono">Contents: Read</code>. To cover an
        organization, create the token under that org (or use a{" "}
        <strong>classic</strong> PAT with{" "}
        <code className="font-mono">repo</code> +{" "}
        <code className="font-mono">read:org</code>, which spans everything you
        can access). Nothing is filtered here — private repos show when the token
        can read them.
      </div>
    );
  }

  const missing: string[] = [];
  if (data.canReadPrivate === false)
    missing.push("`repo` — private repositories");
  if (data.canReadOrgs === false)
    missing.push("`read:org` — organization repositories");
  if (missing.length === 0) return null;

  return (
    <div className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-xs text-warn">
      Your token is missing scopes:{" "}
      {missing.map((m, i) => (
        <span key={m}>
          {i > 0 && ", "}
          <code className="font-mono">{m.split(" — ")[0]}</code> ({m.split(" — ")[1]})
        </span>
      ))}
      . Regenerate it (GitHub → Settings → Developer settings → Tokens
      (classic)), update <code className="font-mono">.env.local</code>, restart.
      Private repos aren&apos;t filtered — they show when the token can read them.
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
    <span className={low ? "font-medium text-warn" : "text-ink-muted"}>
      rate limit {remaining.toLocaleString()}/{limit.toLocaleString()}
      {low && <> · resets {new Date(resetAt).toLocaleTimeString()}</>}
    </span>
  );
}
