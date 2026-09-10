import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";
import { daysSince } from "@/lib/format";

/**
 * Stale branch detection across a set of repos.
 *
 * One batched GraphQL request, aliased `repository(...)` per repo. For each we
 * pull the 100 branches with the OLDEST last-commit date
 * (refs ordered by TAG_COMMIT_DATE ASC) plus the total branch count — the stale
 * ones are exactly the oldest ones, so the stalest-100 is the useful slice even
 * for a repo with thousands of branches.
 *
 * "Stale" = the branch tip commit is older than `thresholdDays`. The default
 * branch is always included but flagged (`isDefault`) so the UI can grey it out
 * — a quiet `main` isn't the same kind of problem as a forgotten feature branch.
 */

const PER_REPO_LIMIT = 100;

interface RefNode {
  name: string;
  target:
    | {
        __typename: "Commit";
        committedDate: string;
        author: {
          name: string | null;
          user: { login: string } | null;
        } | null;
      }
    | { __typename: string }
    | null;
}

interface RepoRefs {
  defaultBranchRef: { name: string } | null;
  refs: {
    totalCount: number;
    nodes: RefNode[];
  } | null;
}
type AliasedResponse = Record<string, RepoRefs | null>;

export interface BranchInfo {
  repo: string;
  name: string;
  isDefault: boolean;
  lastCommitDate: string | null;
  lastCommitAuthor: string | null;
  lastCommitLogin: string | null;
  /** Whole days since the tip commit. */
  ageDays: number;
  isStale: boolean;
}

export interface StaleBranchesResult {
  thresholdDays: number;
  /** All fetched branches, stalest-first. Filter client-side. */
  branches: BranchInfo[];
  totalBranches: number;
  staleCount: number;
  /** True where a repo has more branches than we fetched (stale count is a floor). */
  truncatedRepos: string[];
  byRepo: Array<{
    repo: string;
    total: number;
    stale: number;
    staleIsLowerBound: boolean;
  }>;
}

const REFS_FRAGMENT = /* GraphQL */ `
  defaultBranchRef { name }
  refs(
    refPrefix: "refs/heads/"
    first: ${PER_REPO_LIMIT}
    orderBy: { field: TAG_COMMIT_DATE, direction: ASC }
  ) {
    totalCount
    nodes {
      name
      target {
        __typename
        ... on Commit {
          committedDate
          author { name user { login } }
        }
      }
    }
  }
`;

function toBranch(
  repo: string,
  defaultBranch: string | null,
  node: RefNode,
): BranchInfo {
  const commit =
    node.target && node.target.__typename === "Commit"
      ? (node.target as Extract<RefNode["target"], { __typename: "Commit" }>)
      : null;
  const lastCommitDate = commit?.committedDate ?? null;
  const ageDays = lastCommitDate ? daysSince(lastCommitDate) : Infinity;
  return {
    repo,
    name: node.name,
    isDefault: node.name === defaultBranch,
    lastCommitDate,
    lastCommitAuthor: commit?.author?.name ?? null,
    lastCommitLogin: commit?.author?.user?.login ?? null,
    ageDays,
    isStale: false, // set by caller against the threshold
  };
}

export async function getStaleBranches(
  repos: string[],
  thresholdDays: number,
): Promise<StaleBranchesResult> {
  const clean = Array.from(new Set(repos)).filter((r) =>
    /^[^/\s]+\/[^/\s]+$/.test(r),
  );
  const threshold = Math.max(1, Math.floor(thresholdDays) || 30);

  // Cache key is independent of the threshold — we fetch the raw branch list
  // once and apply the threshold in memory, so flipping 30/60/90 is free.
  const key = `branches:${clean.slice().sort().join(",").toLowerCase()}`;

  const raw = await cached(
    key,
    async (): Promise<
      Array<{ repo: string; defaultBranch: string | null; refs: RepoRefs["refs"] }>
    > => {
      if (clean.length === 0) return [];
      const aliases = clean.map((spec, i) => {
        const [owner, name] = spec.split("/");
        return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
          name,
        )}) { ${REFS_FRAGMENT} }`;
      });
      const data = await graphqlRequest<AliasedResponse>(
        `query BatchBranches {\n${aliases.join("\n")}\n}`,
      );
      return clean.map((repo, i) => {
        const entry = data[`r${i}`];
        return {
          repo,
          defaultBranch: entry?.defaultBranchRef?.name ?? null,
          refs: entry?.refs ?? null,
        };
      });
    },
    10 * 60 * 1000,
  );

  const branches: BranchInfo[] = [];
  const truncatedRepos: string[] = [];
  const byRepo: StaleBranchesResult["byRepo"] = [];

  for (const { repo, defaultBranch, refs } of raw) {
    if (!refs) continue; // repo not found / no access
    const fetched = refs.nodes.map((n) => toBranch(repo, defaultBranch, n));
    for (const b of fetched) b.isStale = b.ageDays > threshold;
    branches.push(...fetched);

    const truncated = refs.totalCount > fetched.length;
    if (truncated) truncatedRepos.push(repo);

    const staleInFetched = fetched.filter((b) => b.isStale).length;
    // Branches are oldest-first, so stale ones are a prefix: if we didn't see a
    // non-stale branch and the list is truncated, the true count is higher.
    const allFetchedStale =
      fetched.length > 0 && staleInFetched === fetched.length;
    byRepo.push({
      repo,
      total: refs.totalCount,
      stale: staleInFetched,
      staleIsLowerBound: truncated && allFetchedStale,
    });
  }

  branches.sort((a, b) => b.ageDays - a.ageDays);

  return {
    thresholdDays: threshold,
    branches,
    totalBranches: byRepo.reduce((s, r) => s + r.total, 0),
    staleCount: byRepo.reduce((s, r) => s + r.stale, 0),
    truncatedRepos,
    byRepo: byRepo.sort((a, b) => b.stale - a.stale),
  };
}
