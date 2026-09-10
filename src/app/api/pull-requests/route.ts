import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { getOpenPullRequests } from "@/lib/github/queries/pullRequests";

export const dynamic = "force-dynamic";

/**
 * GET /api/pull-requests?repos=owner/name,owner/name
 * All open PRs across the given repos, oldest-first, with stale flags.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const repos = req.nextUrl.searchParams.get("repos")?.trim();
    if (!repos) throw new GitHubApiError("NOT_FOUND", "No repos specified.");
    return getOpenPullRequests(repos.split(","));
  });
}
