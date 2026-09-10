import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { getStaleBranches } from "@/lib/github/queries/branches";

export const dynamic = "force-dynamic";

/**
 * GET /api/branches?repos=owner/name,owner/name&staleDays=30
 * Branches across the given repos, stalest-first, flagged against the threshold.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const repos = searchParams.get("repos")?.trim();
    const staleDays = Number(searchParams.get("staleDays") ?? "30");
    if (!repos) throw new GitHubApiError("NOT_FOUND", "No repos specified.");
    return getStaleBranches(repos.split(","), staleDays);
  });
}
