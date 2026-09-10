import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";
import type { Connection } from "@/lib/github/paginate";
import { GitHubApiError } from "@/lib/github/errors";
import type { Repo, RepoListResult } from "@/lib/github/types";

/**
 * Repo discovery — three modes:
 *   1. viewer: every repo the authenticated user is involved in, across all orgs
 *      (owner / collaborator / org member), paginated
 *   2. by org: every repository in one organization, paginated
 *   3. by list: resolve an explicit set of "owner/name" strings in one batched query
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
  viewerPermission: Repo["viewerPermission"];
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
  viewerPermission
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
    viewerPermission: node.viewerPermission ?? null,
  };
}

// ---- Mode 1: viewer (everything I'm involved in) -------------------------

interface ViewerReposResponse {
  viewer: {
    repositories: Connection<RepoNode>;
  };
}

const VIEWER_REPOS_QUERY = /* GraphQL */ `
  query ViewerRepos($after: String) {
    viewer {
      repositories(
        first: 50
        after: $after
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes { ${REPO_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/**
 * Every repo the token's user can touch — personal repos, repos they collaborate
 * on, and repos in every org they belong to. Paginated; capped at 20 pages
 * (1000 repos) as a safety valve.
 */
export async function listViewerRepos(): Promise<RepoListResult> {
  return cached(
    "repos:viewer",
    async () => {
      const nodes: RepoNode[] = [];
      let after: string | null = null;

      for (let page = 0; page < 20; page += 1) {
        const data: ViewerReposResponse =
          await graphqlRequest<ViewerReposResponse>(VIEWER_REPOS_QUERY, {
            after,
          });
        const conn = data.viewer.repositories;
        nodes.push(...conn.nodes);
        if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
        after = conn.pageInfo.endCursor;
      }

      // De-dupe (a repo can match more than one affiliation) and sort.
      const seen = new Set<string>();
      const unique = nodes.filter((n) => {
        if (seen.has(n.nameWithOwner)) return false;
        seen.add(n.nameWithOwner);
        return true;
      });

      return { org: null, repos: unique.map(toRepo).sort(sortByActivity) };
    },
    5 * 60 * 1000,
  );
}

// ---- Mode 2: by org -------------------------------------------------------

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

// ---- Mode 3: explicit list ---------------------------------------------------

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
