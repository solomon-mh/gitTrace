import { restRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Commit activity over the last N weeks, per repo + aggregated.
 *
 * Source: the REST "statistics" endpoint
 *   GET /repos/{owner}/{repo}/stats/commit_activity
 * which returns exactly 52 weekly buckets ({ week: unixSeconds, total, days }).
 * GraphQL has no weekly-histogram equivalent, and this endpoint is pre-computed
 * and cached by GitHub, so it's one cheap call per repo.
 *
 * Caveat: on a cold cache GitHub replies 202 (still computing) with an empty
 * body. We retry a few times, then report the repo as "pending" so the UI can
 * say "GitHub is still crunching this — refresh shortly" instead of showing a
 * misleading zero.
 */

interface WeekBucket {
  week: number; // unix seconds, start of week (Sunday, UTC)
  total: number;
  days: number[];
}

export interface WeeklyPoint {
  /** ISO date for the start of the week. */
  weekStart: string;
  commits: number;
}

export interface RepoWeeklySeries {
  repo: string;
  points: WeeklyPoint[];
  total: number;
}

export interface CommitActivityResult {
  weeks: number;
  /** One entry per repo we could resolve. */
  series: RepoWeeklySeries[];
  /** Sum across all repos, week by week. */
  aggregate: WeeklyPoint[];
  /** repo -> total commits in window, sorted desc — for the summary list. */
  totals: Array<{ repo: string; total: number }>;
  /** Repos GitHub is still computing stats for. */
  pending: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch one repo's 52-week activity, retrying past GitHub's 202 "computing". */
async function fetchRepoActivity(
  repo: string,
): Promise<WeekBucket[] | "pending"> {
  const [owner, name] = repo.split("/");
  const path = `/repos/${owner}/${name}/stats/commit_activity`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const data = await restRequest<WeekBucket[]>(path);
    if (Array.isArray(data) && data.length > 0) return data;
    // restRequest maps 202 -> []. Wait and retry.
    await sleep(1500 * (attempt + 1));
  }
  return "pending";
}

export async function getCommitActivity(
  repos: string[],
  weeks: number,
): Promise<CommitActivityResult> {
  const clean = Array.from(new Set(repos)).filter((r) => /\S\/\S/.test(r));
  const w = Math.min(52, Math.max(1, Math.floor(weeks) || 12));

  const perRepo = await Promise.all(
    clean.map((repo) =>
      cached(
        `commit-activity:${repo.toLowerCase()}`,
        () => fetchRepoActivity(repo),
        10 * 60 * 1000,
      ).then((buckets) => ({ repo, buckets })),
    ),
  );

  const pending: string[] = [];
  const series: RepoWeeklySeries[] = [];

  for (const { repo, buckets } of perRepo) {
    if (buckets === "pending") {
      pending.push(repo);
      continue;
    }
    // Keep only the last `w` weeks. GitHub returns oldest-first.
    const recent = buckets.slice(-w);
    const points: WeeklyPoint[] = recent.map((b) => ({
      weekStart: new Date(b.week * 1000).toISOString().slice(0, 10),
      commits: b.total,
    }));
    series.push({
      repo,
      points,
      total: points.reduce((s, p) => s + p.commits, 0),
    });
  }

  // Aggregate: align on weekStart across all repos.
  const byWeek = new Map<string, number>();
  for (const s of series) {
    for (const p of s.points) {
      byWeek.set(p.weekStart, (byWeek.get(p.weekStart) ?? 0) + p.commits);
    }
  }
  const aggregate: WeeklyPoint[] = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, commits]) => ({ weekStart, commits }));

  const totals = series
    .map((s) => ({ repo: s.repo, total: s.total }))
    .sort((a, b) => b.total - a.total);

  return { weeks: w, series, aggregate, totals, pending };
}
