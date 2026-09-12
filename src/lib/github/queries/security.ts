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
  /** A classic protection rule OR an active ruleset matches the default branch. */
  isProtected: boolean;
  /** Only meaningful when isProtected — an unprotected branch always allows both. */
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  requiresApprovingReviews: boolean;
  requiredApprovingReviewCount: number;
  isAdminEnforced: boolean;
  /** Which mechanism supplied the protection — for troubleshooting "why". */
  source: "classic" | "ruleset" | null;
}

interface ProtectionRuleNode {
  pattern: string;
  requiresApprovingReviews: boolean;
  requiredApprovingReviewCount: number;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  isAdminEnforced: boolean;
}

interface RulesetRuleNode {
  type: string;
  parameters: { requiredApprovingReviewCount?: number } | null;
}

interface RulesetNode {
  enforcement: "ACTIVE" | "EVALUATE" | "DISABLED";
  target: "BRANCH" | "TAG" | "PUSH" | "REPOSITORY" | null;
  conditions: {
    refName: { include: string[]; exclude: string[] } | null;
  };
  rules: { nodes: RulesetRuleNode[] };
}

interface RepoProtectionNode {
  defaultBranchRef: { name: string } | null;
  branchProtectionRules: { nodes: ProtectionRuleNode[] };
  rulesets: { nodes: RulesetNode[] };
}
type ProtectionResponse = Record<string, RepoProtectionNode | null>;

/**
 * Ruleset ref-name conditions use glob patterns, `refs/heads/...` paths, and
 * the special tokens `~ALL` / `~DEFAULT_BRANCH` — we're always checking
 * against the default branch, so both of those count as a match.
 */
function refConditionMatches(pattern: string, branch: string): boolean {
  if (pattern === "~ALL" || pattern === "~DEFAULT_BRANCH") return true;
  const stripped = pattern.replace(/^refs\/heads\//, "");
  return patternMatches(stripped, branch);
}

function findMatchingRuleset(
  rulesets: RulesetNode[],
  branch: string,
): RulesetNode | null {
  return (
    rulesets.find((rs) => {
      if (rs.enforcement !== "ACTIVE" || rs.target !== "BRANCH") return false;
      const cond = rs.conditions.refName;
      if (!cond) return false;
      if (cond.exclude.some((p) => refConditionMatches(p, branch)))
        return false;
      return cond.include.some((p) => refConditionMatches(p, branch));
    }) ?? null
  );
}

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
      rulesets(first: 25, targets: [BRANCH]) {
        nodes {
          enforcement
          target
          conditions { refName { include exclude } }
          rules(first: 25) {
            nodes {
              type
              parameters {
                ... on PullRequestParameters { requiredApprovingReviewCount }
              }
            }
          }
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
    const classicRule =
      defaultBranch != null
        ? (entry?.branchProtectionRules.nodes.find((r) =>
            patternMatches(r.pattern, defaultBranch),
          ) ?? null)
        : null;

    if (classicRule != null) {
      return {
        repo,
        defaultBranch,
        isProtected: true,
        allowsForcePushes: classicRule.allowsForcePushes,
        allowsDeletions: classicRule.allowsDeletions,
        requiresApprovingReviews: classicRule.requiresApprovingReviews,
        requiredApprovingReviewCount: classicRule.requiredApprovingReviewCount,
        isAdminEnforced: classicRule.isAdminEnforced,
        source: "classic" as const,
      };
    }

    const ruleset =
      defaultBranch != null
        ? findMatchingRuleset(entry?.rulesets.nodes ?? [], defaultBranch)
        : null;

    if (ruleset != null) {
      const types = new Set(ruleset.rules.nodes.map((r) => r.type));
      const prRule = ruleset.rules.nodes.find((r) => r.type === "PULL_REQUEST");
      const requiredApprovingReviewCount =
        prRule?.parameters?.requiredApprovingReviewCount ?? 0;
      return {
        repo,
        defaultBranch,
        isProtected: true,
        allowsForcePushes: !types.has("NON_FAST_FORWARD"),
        allowsDeletions: !types.has("DELETION"),
        requiresApprovingReviews: requiredApprovingReviewCount > 0,
        requiredApprovingReviewCount,
        isAdminEnforced: false,
        source: "ruleset" as const,
      };
    }

    return {
      repo,
      defaultBranch,
      isProtected: false,
      allowsForcePushes: true,
      allowsDeletions: true,
      requiresApprovingReviews: false,
      requiredApprovingReviewCount: 0,
      isAdminEnforced: false,
      source: null,
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
