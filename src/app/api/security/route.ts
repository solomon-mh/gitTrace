import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { getSecurity } from "@/lib/github/queries/security";

export const dynamic = "force-dynamic";

/**
 * GET /api/security?repos=owner/name,owner/name&weeks=12
 * Branch protection status, recent force-pushes, and merges with zero
 * approving reviews.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const repos = searchParams.get("repos")?.trim();
    const weeks = Number(searchParams.get("weeks") ?? "12");
    if (!repos) throw new GitHubApiError("NOT_FOUND", "No repos specified.");
    return getSecurity(repos.split(","), weeks);
  });
}
