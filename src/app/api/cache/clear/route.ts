import { NextResponse } from "next/server";
import { clearCache, cacheStats } from "@/lib/github/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/cache/clear
 *
 * Drops the entire in-memory response cache. The dashboard's "Refresh all"
 * button calls this before re-fetching every card, so a manual refresh really
 * does hit GitHub again rather than replaying cached data.
 */
export function POST() {
  const before = cacheStats();
  clearCache();
  return NextResponse.json({ ok: true, cleared: before.total });
}

/** GET is handy for eyeballing cache state during development. */
export function GET() {
  return NextResponse.json(cacheStats());
}
