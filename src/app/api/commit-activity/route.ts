import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { getCommitActivity } from "@/lib/github/queries/commitActivity";

export const dynamic = "force-dynamic";

/**
 * GET /api/commit-activity?repos=owner/name,owner/name&weeks=12
 * Weekly commit counts per repo + an aggregate series.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const repos = searchParams.get("repos")?.trim();
    const weeks = Number(searchParams.get("weeks") ?? "12");
    if (!repos) {
      throw new GitHubApiError("NOT_FOUND", "No repos specified.");
    }
    return getCommitActivity(repos.split(","), weeks);
  });
}
