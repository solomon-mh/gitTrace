"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, describeError } from "@/lib/api/client";
import { useDashboard } from "./DashboardContext";

/**
 * Shared fetch lifecycle for every metric card.
 *
 * - refetches whenever `path` changes (i.e. selection / window changed) or the
 *   global "Refresh all" nonce bumps
 * - cancels stale responses so a fast selection change can't render old data
 * - exposes { status, data, error, reload }
 *
 * Pass `path = null` to represent "nothing to load yet" (e.g. no repos selected);
 * the hook then reports status "empty" without hitting the network.
 */
export type CardStatus = "loading" | "empty" | "error" | "ok";

export interface CardData<T> {
  status: CardStatus;
  data: T | null;
  error: string | null;
  reload: () => void;
}

export function useCardData<T>(path: string | null): CardData<T> {
  const { refreshNonce } = useDashboard();
  const [state, setState] = useState<{
    status: CardStatus;
    data: T | null;
    error: string | null;
  }>({ status: path ? "loading" : "empty", data: null, error: null });

  const reqId = useRef(0);

  const run = useCallback(() => {
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
  }, [path]);

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
