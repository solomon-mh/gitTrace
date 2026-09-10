import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { getIssueVelocity } from "@/lib/github/queries/issues";

export const dynamic = "force-dynamic";

/**
 * GET /api/issues?repos=owner/name,owner/name&weeks=12
 * Opened/closed issues per week + average time-to-close in the window.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const repos = searchParams.get("repos")?.trim();
    const weeks = Number(searchParams.get("weeks") ?? "12");
    if (!repos) throw new GitHubApiError("NOT_FOUND", "No repos specified.");
    return getIssueVelocity(repos.split(","), weeks);
  });
}
