"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { useCardData, reposQuery } from "@/components/dashboard/useCardData";
import { shortRepo } from "@/lib/chart";
import { formatNumber } from "@/lib/format";
import type {
  RepoContributors,
  ContributorsResult,
} from "@/lib/github/queries/contributors";
import { BUS_FACTOR_SHARE } from "@/lib/github/queries/contributors";

const WINDOW_OPTIONS = [4, 8, 12, 26, 52];
const TOP_N = 6;

/**
 * Step 6 — contributor activity.
 *
 * Per repo: who committed how much in the window, as a share of the repo's
 * commits. Repos where one person authored more than 80% are flagged as a
 * bus-factor risk.
 */
export function ContributorActivityCard() {
  const { selectedRepos, windowWeeks, setWindowWeeks } = useDashboard();
  const [excludeBots, setExcludeBots] = useState(true);
  const repoNames = selectedRepos.map((r) => r.nameWithOwner);
  const path = repoNames.length
    ? `/api/contributors?${reposQuery(repoNames, {
        weeks: windowWeeks,
        excludeBots: String(excludeBots),
      })}`
    : null;

  const { status, data, error, reload } =
    useCardData<ContributorsResult>(path);

  const riskCount = data?.repos.filter((r) => r.busFactorRisk).length ?? 0;

  return (
    <Card
      title="Contributor activity"
      subtitle={
        data
          ? `Last ${windowWeeks} weeks · ${riskCount} bus-factor risk(s)`
          : "Who's committing, and concentration risk"
      }
      className="xl:col-span-2"
      actions={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={excludeBots}
              onChange={(e) => setExcludeBots(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            hide bots
          </label>
          <select
            value={windowWeeks}
            onChange={(e) => setWindowWeeks(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted"
          >
            {WINDOW_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w} wks
              </option>
            ))}
          </select>
        </div>
      }
    >
      {status === "empty" && (
        <EmptyState
          title="No repositories selected"
          hint="Pick repos in the Repositories panel."
        />
      )}
      {status === "loading" && (
        <LoadingState label="Tallying contributors…" />
      )}
      {status === "error" && <ErrorState message={error!} onRetry={reload} />}

      {status === "ok" && data && (
        <ContributorBody data={data} />
      )}
    </Card>
  );
}

function ContributorBody({ data }: { data: ContributorsResult }) {
  const active = data.repos.filter((r) => r.windowCommits > 0);

  if (active.length === 0 && data.pending.length === 0) {
    return (
      <EmptyState
        title="No commits from anyone in this window"
        hint="Try a longer window, or check the selected repos have recent activity."
      />
    );
  }

  return (
    <div className="space-y-5">
      {data.pending.length > 0 && (
        <p className="rounded-md bg-warn/10 px-3 py-1.5 text-xs text-warn">
          GitHub is still computing contributor stats for{" "}
          {data.pending.map(shortRepo).join(", ")} — hit “Refresh all” shortly.
        </p>
      )}
      {active.map((repo) => (
        <RepoContributorBlock key={repo.repo} repo={repo} />
      ))}
    </div>
  );
}

function RepoContributorBlock({ repo }: { repo: RepoContributors }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? repo.contributors : repo.contributors.slice(0, TOP_N);
  const hidden = repo.contributors.length - shown.length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink">
            {shortRepo(repo.repo)}
          </span>
          <span className="text-xs text-ink-subtle">
            {formatNumber(repo.windowCommits)} commits ·{" "}
            {repo.contributors.length} contributor
            {repo.contributors.length === 1 ? "" : "s"}
          </span>
        </div>
        {repo.busFactorRisk && (
          <span className="flex items-center gap-1 rounded bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
            ⚠ bus-factor: {(repo.topShare * 100).toFixed(0)}% by one person
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {shown.map((c) => (
          <li key={c.login} className="flex items-center gap-3 text-sm">
            <span className="w-32 shrink-0 truncate text-ink-muted">
              @{c.login}
            </span>
            <span className="relative h-4 flex-1 overflow-hidden rounded bg-surface-2">
              <span
                className={`absolute inset-y-0 left-0 rounded ${
                  c.share > BUS_FACTOR_SHARE ? "bg-danger/70" : "bg-accent/70"
                }`}
                style={{ width: `${Math.max(2, c.share * 100)}%` }}
              />
            </span>
            <span className="w-24 shrink-0 text-right tabular-nums text-ink-muted">
              {formatNumber(c.commits)}{" "}
              <span className="text-xs text-ink-subtle">
                ({(c.share * 100).toFixed(0)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 text-xs text-ink-muted hover:text-ink"
        >
          + {hidden} more contributor{hidden === 1 ? "" : "s"}
        </button>
      )}
      {expanded && repo.contributors.length > TOP_N && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1.5 text-xs text-ink-muted hover:text-ink"
        >
          show less
        </button>
      )}
    </div>
  );
}
