import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";
import { daysSince } from "@/lib/format";

/**
 * Open pull requests across a set of repos.
 *
 * One batched GraphQL request with an aliased `repository(...)` field per repo.
 * We pull the **oldest 100** open PRs per repo (GraphQL's per-page max) plus the
 * exact `totalCount`. We deliberately do NOT deep-paginate: a repo can have
 * hundreds of stale PRs, and the actionable view is "the oldest ones" — which is
 * exactly what CREATED_AT-ascending gives us.
 *
 * Stale-count accuracy: because PRs come back oldest-first and "stale" means
 * "old", the stale ones are always a prefix of the list. So:
 *   - if we fetched every open PR              -> staleCount is exact
 *   - if we hit a non-stale PR before the cap  -> everything after it is newer
 *                                                 and non-stale -> exact
 *   - if all 100 fetched are stale and there are more -> staleCount is ">= 100"
 *     (reported via `staleCountIsLowerBound`)
 */

/** PRs open longer than this many days get flagged (from the spec). */
export const STALE_PR_DAYS = 14;

/**
 * Oldest-N open PRs fetched per repo. Kept modest: batched across several repos,
 * a larger page with computed fields makes GitHub's GraphQL resolver time out
 * (502). 50 oldest PRs per repo is plenty for a "what's rotting" view.
 */
const PER_REPO_LIMIT = 50;

interface PrNode {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  author: { login: string; avatarUrl: string } | null;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  comments: { totalCount: number };
}

export interface OpenPR {
  repo: string;
  number: number;
  title: string;
  url: string;
  author: string | null;
  authorAvatar: string | null;
  createdAt: string;
  updatedAt: string;
  ageDays: number;
  isStale: boolean;
  isDraft: boolean;
  reviewDecision: PrNode["reviewDecision"];
  commentCount: number;
}

export interface PullRequestsResult {
  thresholdDays: number;
  /** Sorted oldest-first. May be truncated per repo — see `truncatedRepos`. */
  pullRequests: OpenPR[];
  /** Exact total of open PRs across all repos. */
  totalOpen: number;
  staleCount: number;
  staleCountIsLowerBound: boolean;
  /** Repos where more open PRs exist than we fetched. */
  truncatedRepos: string[];
  byRepo: Array<{
    repo: string;
    open: number;
    stale: number;
    staleIsLowerBound: boolean;
  }>;
}

const PR_FIELDS = /* GraphQL */ `
  number
  title
  url
  createdAt
  updatedAt
  isDraft
  author { login avatarUrl }
  reviewDecision
  comments { totalCount }
`;

interface RepoPrs {
  pullRequests: {
    totalCount: number;
    nodes: PrNode[];
  };
}
type AliasedResponse = Record<string, RepoPrs | null>;

function toOpenPR(repo: string, n: PrNode): OpenPR {
  const ageDays = daysSince(n.createdAt);
  return {
    repo,
    number: n.number,
    title: n.title,
    url: n.url,
    author: n.author?.login ?? null,
    authorAvatar: n.author?.avatarUrl ?? null,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    ageDays,
    isStale: ageDays > STALE_PR_DAYS,
    isDraft: n.isDraft,
    reviewDecision: n.reviewDecision,
    commentCount: n.comments.totalCount,
  };
}

export async function getOpenPullRequests(
  repos: string[],
): Promise<PullRequestsResult> {
  const clean = Array.from(new Set(repos)).filter((r) =>
    /^[^/\s]+\/[^/\s]+$/.test(r),
  );

  const key = `prs:${clean.slice().sort().join(",").toLowerCase()}`;
  return cached(
    key,
    async () => {
      const all: OpenPR[] = [];
      const truncatedRepos: string[] = [];
      const byRepo: PullRequestsResult["byRepo"] = [];

      if (clean.length > 0) {
        const aliases = clean.map((spec, i) => {
          const [owner, name] = spec.split("/");
          return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
            name,
          )}) {
            pullRequests(states: OPEN, first: ${PER_REPO_LIMIT}, orderBy: { field: CREATED_AT, direction: ASC }) {
              totalCount
              nodes { ${PR_FIELDS} }
            }
          }`;
        });

        const data = await graphqlRequest<AliasedResponse>(
          `query BatchPRs {\n${aliases.join("\n")}\n}`,
        );

        clean.forEach((repo, i) => {
          const entry = data[`r${i}`];
          if (!entry) return; // not found / no access — skip
          const prs = entry.pullRequests.nodes.map((n) => toOpenPR(repo, n));
          all.push(...prs);

          const open = entry.pullRequests.totalCount;
          const truncated = open > prs.length;
          if (truncated) truncatedRepos.push(repo);

          const staleInFetched = prs.filter((p) => p.isStale).length;
          const allFetchedStale =
            prs.length > 0 && staleInFetched === prs.length;
          byRepo.push({
            repo,
            open,
            stale: staleInFetched,
            staleIsLowerBound: truncated && allFetchedStale,
          });
        });
      }

      all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      const staleCount = byRepo.reduce((s, r) => s + r.stale, 0);
      const staleCountIsLowerBound = byRepo.some((r) => r.staleIsLowerBound);

      return {
        thresholdDays: STALE_PR_DAYS,
        pullRequests: all,
        totalOpen: byRepo.reduce((s, r) => s + r.open, 0),
        staleCount,
        staleCountIsLowerBound,
        truncatedRepos,
        byRepo: byRepo.sort((a, b) => b.open - a.open),
      };
    },
    3 * 60 * 1000, // PRs move fast — short TTL
  );
}
