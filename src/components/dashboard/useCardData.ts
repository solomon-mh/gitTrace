"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, describeError } from "@/lib/api/client";
import { useDashboard } from "./DashboardContext";
import { useVerify } from "./useVerify";

/**
 * Shared fetch lifecycle for every metric card.
 *
 * - waits for the one shared `/api/verify` check before firing its own request
 *   — if the token is broken, every card would otherwise fire its own doomed
 *   request and render its own copy of the same "token rejected" error. Instead
 *   cards go straight to `blocked` and point at the one banner that explains it
 *   (see ScopeHint.tsx) — one message, one place.
 * - refetches whenever `path` changes (i.e. selection / window changed) or the
 *   global "Refresh all" nonce bumps
 * - cancels stale responses so a fast selection change can't render old data
 * - exposes { status, data, error, reload }
 *
 * Pass `path = null` to represent "nothing to load yet" (e.g. no repos selected);
 * the hook then reports status "empty" without hitting the network.
 */
export type CardStatus = "loading" | "empty" | "blocked" | "error" | "ok";

export interface CardData<T> {
  status: CardStatus;
  data: T | null;
  error: string | null;
  reload: () => void;
}

export function useCardData<T>(path: string | null): CardData<T> {
  const { refreshNonce } = useDashboard();
  const verify = useVerify();
  const authBlocked =
    verify.state === "error" &&
    (verify.kind === "MISSING_TOKEN" || verify.kind === "BAD_CREDENTIALS");

  const [state, setState] = useState<{
    status: CardStatus;
    data: T | null;
    error: string | null;
  }>({ status: "loading", data: null, error: null });

  const reqId = useRef(0);

  const run = useCallback(() => {
    if (verify.state === "loading") {
      // Wait for the one auth check to settle before any card fires its own
      // request — avoids N redundant 401s on a broken token.
      setState({ status: "loading", data: null, error: null });
      return;
    }
    if (authBlocked) {
      setState({ status: "blocked", data: null, error: null });
      return;
    }
    if (!path) {
      setState({ status: "empty", data: null, error: null });
      return;
    }
    const id = ++reqId.current;
    setState((s) => ({ ...s, status: "loading", error: null }));

    apiGet<T>(path)
      .then((data) => {
        if (id === reqId.current) setState({ status: "ok", data, error: null });
      })
      .catch((err) => {
        if (id === reqId.current)
          setState({ status: "error", data: null, error: describeError(err) });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, verify.state, authBlocked]);

  useEffect(() => {
    run();
    // refreshNonce intentionally in deps: bump => refetch.
  }, [run, refreshNonce]);

  return { ...state, reload: run };
}

/** Build a `?repos=a/b,c/d&...` query string, stable for use as a fetch key. */
export function reposQuery(
  repos: string[],
  extra: Record<string, string | number> = {},
): string {
  const params = new URLSearchParams();
  params.set("repos", [...repos].sort().join(","));
  for (const [k, v] of Object.entries(extra)) params.set(k, String(v));
  return params.toString();
}
