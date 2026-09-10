"use client";

import { useEffect, useState } from "react";
import { ApiError, apiGet, describeError } from "@/lib/api/client";
import type { VerifyResult } from "@/lib/github/queries/verify";
import { useDashboard } from "./DashboardContext";

export type VerifyState =
  | { state: "loading" }
  | { state: "error"; message: string; kind: string }
  | { state: "ok"; data: VerifyResult };

/**
 * Shared `/api/verify` fetch — used by the top bar (identity, rate limit, token
 * type) and the scope hint banner. Re-runs on the global refresh nonce.
 */
export function useVerify(): VerifyState {
  const { refreshNonce } = useDashboard();
  const [info, setInfo] = useState<VerifyState>({ state: "loading" });

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

  return info;
}
