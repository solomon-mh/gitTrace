import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";
import type { Connection } from "@/lib/github/paginate";
import { GitHubApiError } from "@/lib/github/errors";
import type { Repo, RepoListResult } from "@/lib/github/types";

/**
 * Repo discovery — two modes:
 *   1. by org:   list every repository in an organization (paginated)
 *   2. by list:  resolve an explicit set of "owner/name" strings in one batched query
 */

// ---- Raw GraphQL node shape (shared by both modes) -------------------------

interface RepoNode {
  nameWithOwner: string;
  name: string;
  owner: { login: string };
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  defaultBranchRef: { name: string } | null;
  pushedAt: string | null;
  stargazerCount: number;
  issues: { totalCount: number };
  pullRequests: { totalCount: number };
}

const REPO_FIELDS = /* GraphQL */ `
  nameWithOwner
  name
  owner { login }
  description
  isPrivate
  isArchived
  isFork
  defaultBranchRef { name }
  pushedAt
  stargazerCount
  issues(states: OPEN) { totalCount }
  pullRequests(states: OPEN) { totalCount }
`;

function toRepo(node: RepoNode): Repo {
  return {
    nameWithOwner: node.nameWithOwner,
    owner: node.owner.login,
    name: node.name,
    description: node.description,
    isPrivate: node.isPrivate,
    isArchived: node.isArchived,
    isFork: node.isFork,
    defaultBranch: node.defaultBranchRef?.name ?? null,
    pushedAt: node.pushedAt,
    stargazerCount: node.stargazerCount,
    openIssues: node.issues.totalCount,
    openPullRequests: node.pullRequests.totalCount,
  };
}

// ---- Mode 1: by org -------------------------------------------------------

interface OrgReposResponse {
  organization: {
    repositories: Connection<RepoNode>;
  } | null;
}

const ORG_REPOS_QUERY = /* GraphQL */ `
  query OrgRepos($org: String!, $after: String) {
    organization(login: $org) {
      repositories(
        first: 50
        after: $after
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes { ${REPO_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

export async function listOrgRepos(org: string): Promise<RepoListResult> {
  const key = `repos:org:${org.toLowerCase()}`;
  return cached(key, async () => {
    const nodes: RepoNode[] = [];
    let after: string | null = null;

    // Manual cursor loop: the first response also tells us whether the org
    // exists (organization === null), so we can't reuse the generic paginate().
    for (let page = 0; page < 20; page += 1) {
      const data: OrgReposResponse = await graphqlRequest<OrgReposResponse>(
        ORG_REPOS_QUERY,
        { org, after },
      );
      if (data.organization === null) {
        throw new GitHubApiError(
          "NOT_FOUND",
          `Organization "${org}" was not found, or your token can't see it. ` +
            `Private orgs need the read:org scope.`,
        );
      }
      const conn = data.organization.repositories;
      nodes.push(...conn.nodes);
      if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
      after = conn.pageInfo.endCursor;
    }

    return {
      org,
      repos: nodes.map(toRepo).sort(sortByActivity),
    };
  });
}

// ---- Mode 2: explicit list ---------------------------------------------------

/**
 * Resolve up to ~50 "owner/name" strings in a single request using aliased
 * `repository(...)` fields. Unknown repos come back as null and are skipped.
 */
export async function listSpecificRepos(
  specs: string[],
): Promise<RepoListResult> {
  const clean = Array.from(
    new Set(
      specs
        .map((s) => s.trim())
        .filter((s) => /^[^/\s]+\/[^/\s]+$/.test(s)),
    ),
  );
  if (clean.length === 0) {
    throw new GitHubApiError(
      "NOT_FOUND",
      'No valid "owner/name" repositories were provided.',
    );
  }

  const key = `repos:list:${clean.sort().join(",").toLowerCase()}`;
  return cached(key, async () => {
    const aliases = clean.map((spec, i) => {
      const [owner, name] = spec.split("/");
      // GraphQL variables can't be used in aliases, so inline as string literals.
      return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
        name,
      )}) { ${REPO_FIELDS} }`;
    });
    const query = `query SpecificRepos {\n${aliases.join("\n")}\n}`;

    const data = await graphqlRequest<Record<string, RepoNode | null>>(query);
    const repos = clean
      .map((_, i) => data[`r${i}`])
      .filter((n): n is RepoNode => n != null)
      .map(toRepo)
      .sort(sortByActivity);

    if (repos.length === 0) {
      throw new GitHubApiError(
        "NOT_FOUND",
        "None of the requested repositories were found.",
      );
    }
    return { org: null, repos };
  });
}

/** Most-recently-pushed first; nulls last. */
function sortByActivity(a: Repo, b: Repo): number {
  const at = a.pushedAt ? Date.parse(a.pushedAt) : 0;
  const bt = b.pushedAt ? Date.parse(b.pushedAt) : 0;
  return bt - at;
}
