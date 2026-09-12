import { graphqlRequest, restRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Repo integrity signals: is the default branch actually protected, has anyone
 * force-pushed recently, and did anything merge in without a real review.
 *
 * This is explicitly NOT a security audit tool — GitHub's real audit log
 * (org-level, Enterprise-gated, needs an org owner + `read:audit_log`) is the
 * authoritative source for "who did what." What we *can* do with a normal
 * token is surface the same blind spots a human would otherwise only notice
 * after the fact:
 *   - branch protection: is force-push / unreviewed-merge even POSSIBLE right
 *     now on the default branch (a GraphQL config check — always available)
 *   - force-pushes: did one actually happen recently (the public Events API —
 *     see the caveat below)
 *   - unreviewed merges: did a PR land with zero approving reviews
 *
 * Events API caveat: `GET /repos/{o}/{r}/events` is GitHub's own activity feed
 * (what powers the repo's "Activity" tab) — it is NOT a durable audit log. It's
 * capped at roughly the most recent 300 events and ~90 days, whichever is
 * smaller, and very active repos can roll past a force-push within hours. Treat
 * a clean result as "no force-push visible in what GitHub still retains," not
 * "definitely never happened."
 */

// ---- Branch protection ----------------------------------------------------

export interface BranchProtectionSummary {
  repo: string;
  defaultBranch: string | null;
  /** A protection rule matches the default branch's name/pattern. */
  isProtected: boolean;
  /** Only meaningful when isProtected — an unprotected branch always allows both. */
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  requiresApprovingReviews: boolean;
  requiredApprovingReviewCount: number;
  isAdminEnforced: boolean;
}

interface ProtectionRuleNode {
  pattern: string;
  requiresApprovingReviews: boolean;
  requiredApprovingReviewCount: number;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  isAdminEnforced: boolean;
}

interface RepoProtectionNode {
  defaultBranchRef: { name: string } | null;
  branchProtectionRules: { nodes: ProtectionRuleNode[] };
}
type ProtectionResponse = Record<string, RepoProtectionNode | null>;

/** Minimal glob match for branch-protection patterns like "main" or "release/*". */
function patternMatches(pattern: string, branch: string): boolean {
  if (pattern === branch) return true;
  if (!pattern.includes("*")) return false;
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(branch);
}

async function getBranchProtection(
  repos: string[],
): Promise<BranchProtectionSummary[]> {
  if (repos.length === 0) return [];
  const aliases = repos.map((spec, i) => {
    const [owner, name] = spec.split("/");
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
      name,
    )}) {
      defaultBranchRef { name }
      branchProtectionRules(first: 25) {
        nodes {
          pattern
          requiresApprovingReviews
          requiredApprovingReviewCount
          allowsForcePushes
          allowsDeletions
          isAdminEnforced
        }
      }
    }`;
  });

  const data = await graphqlRequest<ProtectionResponse>(
    `query BranchProtection {\n${aliases.join("\n")}\n}`,
  );

  return repos.map((repo, i) => {
    const entry = data[`r${i}`];
    const defaultBranch = entry?.defaultBranchRef?.name ?? null;
    const rule =
      defaultBranch != null
        ? (entry?.branchProtectionRules.nodes.find((r) =>
            patternMatches(r.pattern, defaultBranch),
          ) ?? null)
        : null;

    return {
      repo,
      defaultBranch,
      isProtected: rule != null,
      allowsForcePushes: rule ? rule.allowsForcePushes : true,
      allowsDeletions: rule ? rule.allowsDeletions : true,
      requiresApprovingReviews: rule?.requiresApprovingReviews ?? false,
      requiredApprovingReviewCount: rule?.requiredApprovingReviewCount ?? 0,
      isAdminEnforced: rule?.isAdminEnforced ?? false,
    };
  });
}

// ---- Force pushes (best-effort, from the public Events API) ---------------

export interface ForcePushEvent {
  repo: string;
  branch: string;
  actor: string;
  at: string; // ISO
}

interface GitHubPushEvent {
  type: string | null;
  actor: { login: string } | null;
  created_at: string | null;
  payload: { ref?: string; forced?: boolean };
}

async function fetchForcePushes(
  repo: string,
  sinceMs: number,
): Promise<ForcePushEvent[]> {
  const [owner, name] = repo.split("/");
  let events: GitHubPushEvent[];
  try {
    events = await restRequest<GitHubPushEvent[]>(
      `/repos/${owner}/${name}/events?per_page=100`,
    );
  } catch {
    return []; // e.g. empty repo, or events not available — fail quiet, not loud
  }
  if (!Array.isArray(events)) return [];

  const cutoff = Date.now() - sinceMs;
  return events
    .filter((e) => e.type === "PushEvent" && e.payload?.forced === true)
    .filter((e) => e.created_at && Date.parse(e.created_at) >= cutoff)
    .map((e) => ({
      repo,
      branch: (e.payload.ref ?? "").replace(/^refs\/heads\//, ""),
      actor: e.actor?.login ?? "unknown",
      at: e.created_at as string,
    }));
}

// ---- Merges with zero approving reviews ------------------------------------

export interface UnreviewedMerge {
  repo: string;
  number: number;
  title: string;
  url: string;
  mergedAt: string;
  mergedBy: string | null;
  author: string | null;
  /** Merged by the same person who opened it. */
  selfMerged: boolean;
}

interface MergedPrNode {
  number: number;
  title: string;
  url: string;
  mergedAt: string | null;
  mergedBy: { login: string } | null;
  author: { login: string } | null;
  reviews: { totalCount: number };
}
interface RepoMergedPrs {
  pullRequests: { nodes: MergedPrNode[] };
}
type MergedPrsResponse = Record<string, RepoMergedPrs | null>;

async function getUnreviewedMerges(
  repos: string[],
  sinceMs: number,
): Promise<UnreviewedMerge[]> {
  if (repos.length === 0) return [];
  const aliases = repos.map((spec, i) => {
    const [owner, name] = spec.split("/");
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
      name,
    )}) {
      pullRequests(states: MERGED, first: 20, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          number
          title
          url
          mergedAt
          mergedBy { login }
          author { login }
          reviews(states: APPROVED) { totalCount }
        }
      }
    }`;
  });

  const data = await graphqlRequest<MergedPrsResponse>(
    `query UnreviewedMerges {\n${aliases.join("\n")}\n}`,
  );

  const cutoff = Date.now() - sinceMs;
  const out: UnreviewedMerge[] = [];
  repos.forEach((repo, i) => {
    const nodes = data[`r${i}`]?.pullRequests.nodes ?? [];
    for (const pr of nodes) {
      if (!pr.mergedAt || Date.parse(pr.mergedAt) < cutoff) continue;
      if (pr.reviews.totalCount > 0) continue; // had at least one approval
      out.push({
        repo,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        mergedAt: pr.mergedAt,
        mergedBy: pr.mergedBy?.login ?? null,
        author: pr.author?.login ?? null,
        selfMerged:
          !!pr.mergedBy?.login && pr.mergedBy.login === pr.author?.login,
      });
    }
  });
  return out.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
}

// ---- Orchestration ----------------------------------------------------------

export interface SecurityResult {
  weeks: number;
  branchProtection: BranchProtectionSummary[];
  forcePushes: ForcePushEvent[];
  unreviewedMerges: UnreviewedMerge[];
}

export async function getSecurity(
  repos: string[],
  weeks: number,
): Promise<SecurityResult> {
  const clean = Array.from(new Set(repos)).filter((r) =>
    /^[^/\s]+\/[^/\s]+$/.test(r),
  );
  const w = Math.min(52, Math.max(1, Math.floor(weeks) || 12));
  const sinceMs = w * 7 * 86_400_000;

  const key = `security:${w}:${clean.slice().sort().join(",").toLowerCase()}`;
  return cached(
    key,
    async () => {
      const [branchProtection, forcePushLists, unreviewedMerges] =
        await Promise.all([
          getBranchProtection(clean),
          Promise.all(clean.map((r) => fetchForcePushes(r, sinceMs))),
          getUnreviewedMerges(clean, sinceMs),
        ]);

      return {
        weeks: w,
        branchProtection,
        forcePushes: forcePushLists.flat().sort((a, b) => b.at.localeCompare(a.at)),
        unreviewedMerges,
      };
    },
    2 * 60 * 1000, // short TTL — this is the kind of thing you want fresh
  );
}
