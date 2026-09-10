import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import { listOrgRepos, listSpecificRepos } from "@/lib/github/queries/repos";

export const dynamic = "force-dynamic";

/**
 * GET /api/repos?org=<login>
 * GET /api/repos?repos=owner/name,owner/name
 *
 * Returns the normalised repo list that drives the whole dashboard.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const org = searchParams.get("org")?.trim();
    const repos = searchParams.get("repos")?.trim();

    if (org) return listOrgRepos(org);
    if (repos) return listSpecificRepos(repos.split(","));

    throw new GitHubApiError(
      "NOT_FOUND",
      "Provide either ?org=<name> or ?repos=owner/name,owner/name",
    );
  });
}
