import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { getContributors } from "@/lib/github/queries/contributors";

export const dynamic = "force-dynamic";

/**
 * GET /api/contributors?repos=owner/name,owner/name&weeks=12
 * Per-repo contributor commit counts within the window, with bus-factor flags.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const repos = searchParams.get("repos")?.trim();
    const weeks = Number(searchParams.get("weeks") ?? "12");
    const excludeBots = searchParams.get("excludeBots") !== "false";
    if (!repos) throw new GitHubApiError("NOT_FOUND", "No repos specified.");
    return getContributors(repos.split(","), weeks, excludeBots);
  });
}
