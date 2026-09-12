import { restRequestStatus } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Contributor activity per repo within the selected week window.
 *
 * Source: REST `GET /repos/{owner}/{repo}/stats/contributors`, which returns
 * every contributor with a 52-week breakdown of commits (`weeks[].c`). We sum
 * each contributor's commits over the last N weeks. Like the other stats
 * endpoints it can 202 ("still computing") on a cold cache — we retry, then
 * report the repo as `pending`. A **200** with an empty array is different and
 * permanent (nobody has committed, so there's nothing to compute) — treating it
 * as "pending" would retry forever and show "still computing" on every load.
 *
 * Bus-factor flag: a repo is flagged when its top contributor authored more than
 * `BUS_FACTOR_SHARE` of the window's commits AND there were enough commits for
 * that to be meaningful (`BUS_FACTOR_MIN_COMMITS`).
 */

export const BUS_FACTOR_SHARE = 0.8;
const BUS_FACTOR_MIN_COMMITS = 10;

/**
 * Heuristic bot detection. The stats endpoint's user object is too thin to carry
 * a real `type: "Bot"`, so we match on login shape plus a few well-known CI
 * accounts. Bot commits (release automation, dependabot) otherwise dominate the
 * bus-factor signal and make it useless.
 */
const KNOWN_BOTS = new Set([
  "actions-user",
  "web-flow",
  "github-actions",
  "dependabot",
  "renovate",
  "snyk-bot",
  "greenkeeper",
]);

export function isBot(login: string): boolean {
  const l = login.toLowerCase();
  return (
    l.endsWith("[bot]") ||
    l.endsWith("-bot") ||
    l.endsWith("_bot") ||
    KNOWN_BOTS.has(l)
  );
}

interface ContributorStats {
  author: { login: string; avatar_url: string } | null;
  total: number;
  weeks: Array<{ w: number; a: number; d: number; c: number }>;
}

export interface Contributor {
  login: string;
  avatarUrl: string | null;
  commits: number;
  /** Fraction of the repo's window commits, 0–1. */
  share: number;
  isBot: boolean;
}

export interface RepoContributors {
  repo: string;
  windowCommits: number;
  contributors: Contributor[]; // sorted desc by commits, zero-commit dropped
  /** Top contributor's share (0–1), or 0 if no commits. */
  topShare: number;
  busFactorRisk: boolean;
}

export interface ContributorsResult {
  weeks: number;
  excludeBots: boolean;
  repos: RepoContributors[];
  pending: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRepoContributors(
  repo: string,
): Promise<ContributorStats[] | "pending"> {
  const [owner, name] = repo.split("/");
  const path = `/repos/${owner}/${name}/stats/contributors`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { status, data } = await restRequestStatus<ContributorStats[]>(path);
    if (status === 200) return Array.isArray(data) ? data : [];
    await sleep(1500 * (attempt + 1));
  }
  return "pending";
}

export async function getContributors(
  repos: string[],
  weeks: number,
  excludeBots = true,
): Promise<ContributorsResult> {
  const clean = Array.from(new Set(repos)).filter((r) => /\S\/\S/.test(r));
  const w = Math.min(52, Math.max(1, Math.floor(weeks) || 12));

  const perRepo = await Promise.all(
    clean.map((repo) =>
      cached(
        `contributors:${repo.toLowerCase()}`,
        () => fetchRepoContributors(repo),
        10 * 60 * 1000,
      ).then((stats) => ({ repo, stats })),
    ),
  );

  const pending: string[] = [];
  const out: RepoContributors[] = [];

  for (const { repo, stats } of perRepo) {
    if (stats === "pending") {
      pending.push(repo);
      continue;
    }

    // Sum each contributor's commits across the last `w` weekly buckets.
    const tallied = stats
      .map((s) => {
        const commits = s.weeks
          .slice(-w)
          .reduce((sum, wk) => sum + (wk.c || 0), 0);
        const login = s.author?.login ?? "(unknown)";
        return {
          login,
          avatarUrl: s.author?.avatar_url ?? null,
          commits,
          isBot: isBot(login),
        };
      })
      .filter((c) => c.commits > 0)
      .filter((c) => !(excludeBots && c.isBot))
      .sort((a, b) => b.commits - a.commits);

    const windowCommits = tallied.reduce((s, c) => s + c.commits, 0);
    const contributors: Contributor[] = tallied.map((c) => ({
      ...c,
      share: windowCommits > 0 ? c.commits / windowCommits : 0,
    }));

    const topShare = contributors[0]?.share ?? 0;
    out.push({
      repo,
      windowCommits,
      contributors,
      topShare,
      // A solo-maintained repo (share == 1) is the extreme case and still counts.
      busFactorRisk:
        windowCommits >= BUS_FACTOR_MIN_COMMITS &&
        topShare > BUS_FACTOR_SHARE,
    });
  }

  // Repos with activity first, then by commit volume.
  out.sort((a, b) => b.windowCommits - a.windowCommits);

  return { weeks: w, excludeBots, repos: out, pending };
}
