"use client";

import { useDashboard } from "./DashboardContext";
import type { VerifyState } from "./DashboardContext";

/**
 * The shared `/api/verify` result. Fetched once by `DashboardProvider` (not
 * per-component) — this is just a thin selector so every consumer reads the
 * same state instead of each firing its own request.
 */
export function useVerify(): VerifyState {
  return useDashboard().verify;
}
