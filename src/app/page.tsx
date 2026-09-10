"use client";

import { useEffect, useState } from "react";
import { apiGet, describeError } from "@/lib/api/client";
import type { VerifyResult } from "@/lib/github/queries/verify";

/**
 * Step 1 UI.
 *
 * This page will be replaced by the full dashboard in later steps. For now it
 * exists only to prove the round-trip works:
 *   browser  ->  /api/verify  ->  GitHub GraphQL  ->  back to the browser
 */
export default function HomePage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; data: VerifyResult }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    apiGet<VerifyResult>("/api/verify")
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ status: "error", message: describeError(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">GitStream</h1>
      <p className="mt-1 text-slate-600">
        GitHub organization health dashboard — build step 1: API auth check.
      </p>

      <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          GitHub connection
        </h2>

        {state.status === "loading" && (
          <p className="mt-4 animate-pulse text-slate-500">
            Contacting GitHub…
          </p>
        )}

        {state.status === "error" && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            <p className="font-medium">Could not connect</p>
            <p className="mt-1">{state.message}</p>
          </div>
        )}

        {state.status === "ok" && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-ok align-middle" />{" "}
              Authenticated as{" "}
              <strong>{state.data.name ?? state.data.login}</strong> (@
              {state.data.login})
            </p>
            <p className="text-xs text-slate-500">
              GraphQL rate limit: {state.data.rateLimit.remaining}/
              {state.data.rateLimit.limit} points remaining · resets{" "}
              {new Date(state.data.rateLimit.resetAt).toLocaleTimeString()}
            </p>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recently pushed repos
              </h3>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {state.data.repos.map((r) => (
                  <li
                    key={r.nameWithOwner}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="font-mono">{r.nameWithOwner}</span>
                    <span className="text-xs text-slate-400">
                      {r.isPrivate ? "private" : "public"}
                      {r.pushedAt
                        ? ` · ${new Date(r.pushedAt).toLocaleDateString()}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
