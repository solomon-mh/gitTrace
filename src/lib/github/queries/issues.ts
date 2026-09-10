import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Issue velocity within the selected window.
 *
 * Per repo we run three things, batched into one GraphQL request via aliases:
 *   - `search(... is:issue created:>=<start>)` — issues OPENED in the window
 *   - `search(... is:issue closed:>=<start>)`  — issues CLOSED in the window
 *     (nodes carry createdAt + closedAt, so we can measure time-to-close)
 *   - `repository.issues(states: OPEN).totalCount` — the current open backlog
 *
 * We fetch the first 100 of each search (GraphQL's page max) and DON'T
 * deep-paginate — `issueCount` still gives the exact totals, and a 100-issue
 * sample is enough for the weekly buckets + average time-to-close. Repos that
 * exceed 100 in either direction are reported in `truncatedRepos`.
 *
 * Note: GitHub's `search` connection has its own tighter rate limit, so the
 * cache TTL here is a bit longer.
 */

interface IssueSearchNode {
  __typename: string;
  number?: number;
  title?: string;
  url?: string;
  createdAt?: string;
  closedAt?: string | null;
}

interface RepoIssuesRaw {
  opened: { issueCount: number; nodes: IssueSearchNode[] };
  closed: { issueCount: number; nodes: IssueSearchNode[] };
  currentOpen: number;
}

export interface IssueWeeklyPoint {
  weekStart: string; // YYYY-MM-DD (Monday)
  opened: number;
  closed: number;
}

export interface IssueVelocityResult {
  weeks: number;
  windowStart: string; // ISO date
  /** Aggregate opened/closed per week across all selected repos. */
  series: IssueWeeklyPoint[];
  totalOpened: number;
  totalClosed: number;
  /** Sum of open issues right now across selected repos. */
  currentOpen: number;
  /** Mean time-to-close for issues closed in the window (ms), or null. */
  avgTimeToCloseMs: number | null;
  /** How many closed issues fed the average (may be < totalClosed if truncated). */
  ttcSampleSize: number;
  /** Repos where opened or closed exceeded the 100-issue fetch cap. */
  truncatedRepos: string[];
  byRepo: Array<{
    repo: string;
    opened: number;
    closed: number;
    currentOpen: number;
  }>;
}

const ISSUE_NODE_FIELDS = /* GraphQL */ `
  __typename
  ... on Issue {
    number
    title
    url
    createdAt
    closedAt
  }
`;

/** Start-of-ISO-week (Monday) as YYYY-MM-DD. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Every Monday key from `start` to now, inclusive. */
function weekAxis(start: Date): string[] {
  const keys: string[] = [];
  const d = new Date(start);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  const now = Date.now();
  while (d.getTime() <= now) {
    keys.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return keys;
}

export async function getIssueVelocity(
  repos: string[],
  weeks: number,
): Promise<IssueVelocityResult> {
  const clean = Array.from(new Set(repos)).filter((r) =>
    /^[^/\s]+\/[^/\s]+$/.test(r),
  );
  const w = Math.min(52, Math.max(1, Math.floor(weeks) || 12));

  const start = new Date(Date.now() - w * 7 * 86_400_000);
  const startDate = start.toISOString().slice(0, 10);

  const key = `issues:${startDate}:${clean.slice().sort().join(",").toLowerCase()}`;

  return cached(
    key,
    async () => {
      const raw: Array<{ repo: string; data: RepoIssuesRaw | null }> = [];

      if (clean.length > 0) {
        const aliases = clean.flatMap((spec, i) => {
          // `sort:` matters: search defaults to best-match, which would cluster
          // the 100 sampled nodes arbitrarily and wreck the weekly buckets.
          // Newest-first means the recent weeks are always accurate; older weeks
          // are only undercounted once a repo exceeds the 100 cap (-> truncated).
          const openedQ = `repo:${spec} is:issue created:>=${startDate} sort:created-desc`;
          const closedQ = `repo:${spec} is:issue closed:>=${startDate} sort:updated-desc`;
          const [owner, name] = spec.split("/");
          return [
            `opened${i}: search(query: ${JSON.stringify(openedQ)}, type: ISSUE, first: 100) {
               issueCount
               nodes { ${ISSUE_NODE_FIELDS} }
             }`,
            `closed${i}: search(query: ${JSON.stringify(closedQ)}, type: ISSUE, first: 100) {
               issueCount
               nodes { ${ISSUE_NODE_FIELDS} }
             }`,
            `repo${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(
              name,
            )}) { issues(states: OPEN) { totalCount } }`,
          ];
        });

        const data = await graphqlRequest<Record<string, unknown>>(
          `query IssueVelocity {\n${aliases.join("\n")}\n}`,
        );

        clean.forEach((repo, i) => {
          const opened = data[`opened${i}`] as RepoIssuesRaw["opened"] | null;
          const closed = data[`closed${i}`] as RepoIssuesRaw["closed"] | null;
          const repoObj = data[`repo${i}`] as {
            issues: { totalCount: number };
          } | null;
          if (!opened || !closed) {
            raw.push({ repo, data: null });
            return;
          }
          raw.push({
            repo,
            data: {
              opened,
              closed,
              currentOpen: repoObj?.issues.totalCount ?? 0,
            },
          });
        });
      }

      // ---- aggregate ----
      const axis = weekAxis(start);
      const openedByWeek = new Map<string, number>(axis.map((k) => [k, 0]));
      const closedByWeek = new Map<string, number>(axis.map((k) => [k, 0]));

      let totalOpened = 0;
      let totalClosed = 0;
      let currentOpen = 0;
      let ttcSum = 0;
      let ttcCount = 0;
      const truncatedRepos: string[] = [];
      const byRepo: IssueVelocityResult["byRepo"] = [];

      for (const { repo, data } of raw) {
        if (!data) continue;

        totalOpened += data.opened.issueCount;
        totalClosed += data.closed.issueCount;
        currentOpen += data.currentOpen;
        byRepo.push({
          repo,
          opened: data.opened.issueCount,
          closed: data.closed.issueCount,
          currentOpen: data.currentOpen,
        });

        if (
          data.opened.issueCount > data.opened.nodes.length ||
          data.closed.issueCount > data.closed.nodes.length
        ) {
          truncatedRepos.push(repo);
        }

        for (const n of data.opened.nodes) {
          if (!n.createdAt) continue;
          const k = weekKey(n.createdAt);
          if (openedByWeek.has(k))
            openedByWeek.set(k, openedByWeek.get(k)! + 1);
        }
        for (const n of data.closed.nodes) {
          if (!n.closedAt) continue;
          const k = weekKey(n.closedAt);
          if (closedByWeek.has(k))
            closedByWeek.set(k, closedByWeek.get(k)! + 1);
          if (n.createdAt) {
            ttcSum += Date.parse(n.closedAt) - Date.parse(n.createdAt);
            ttcCount += 1;
          }
        }
      }

      const series: IssueWeeklyPoint[] = axis.map((weekStart) => ({
        weekStart,
        opened: openedByWeek.get(weekStart) ?? 0,
        closed: closedByWeek.get(weekStart) ?? 0,
      }));

      return {
        weeks: w,
        windowStart: startDate,
        series,
        totalOpened,
        totalClosed,
        currentOpen,
        avgTimeToCloseMs: ttcCount > 0 ? ttcSum / ttcCount : null,
        ttcSampleSize: ttcCount,
        truncatedRepos,
        byRepo: byRepo.sort(
          (a, b) => b.opened + b.closed - (a.opened + a.closed),
        ),
      };
    },
    8 * 60 * 1000,
  );
}
