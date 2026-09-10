import type { NextRequest } from "next/server";
import { handleRoute } from "@/lib/api/respond";
import { GitHubApiError } from "@/lib/github/errors";
import {
  listOrgRepos,
  listSpecificRepos,
  listViewerRepos,
} from "@/lib/github/queries/repos";

export const dynamic = "force-dynamic";

/**
 * GET /api/repos?scope=viewer            — every repo the token's user can see
 * GET /api/repos?org=<login>             — every repo in one org
 * GET /api/repos?repos=owner/name,...    — an explicit list
 *
 * Returns the normalised repo list that drives the whole dashboard.
 */
export function GET(req: NextRequest) {
  return handleRoute(() => {
    const { searchParams } = req.nextUrl;
    const scope = searchParams.get("scope")?.trim();
    const org = searchParams.get("org")?.trim();
    const repos = searchParams.get("repos")?.trim();

    if (scope === "viewer") return listViewerRepos();
    if (org) return listOrgRepos(org);
    if (repos) return listSpecificRepos(repos.split(","));

    throw new GitHubApiError(
      "NOT_FOUND",
      "Provide ?scope=viewer, ?org=<name>, or ?repos=owner/name,owner/name",
    );
  });
}
