"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { useCardData, reposQuery } from "@/components/dashboard/useCardData";
import {
  axisProps,
  gridProps,
  MAX_SERIES,
  MUTED_SERIES,
  NO_ANIM,
  PRIMARY_HUE,
  SERIES_COLORS,
  shortRepo,
  tooltipStyle,
} from "@/lib/chart";
import { shortDate, formatNumber } from "@/lib/format";
import type { CommitActivityResult } from "@/lib/github/queries/commitActivity";

const WINDOW_OPTIONS = [4, 8, 12, 26, 52];

/**
 * Step 3 — commit activity.
 *
 * Weekly commit counts over the selected window. Two views:
 *   - Aggregate: total commits/week across all selected repos (bar chart)
 *   - Per repo:  one line per repo (top 7 by volume; the rest fold into "Other")
 */
export function CommitActivityCard() {
  const { selectedRepos, windowWeeks, setWindowWeeks } = useDashboard();
  const [view, setView] = useState<"aggregate" | "per-repo">("aggregate");

  const repoNames = selectedRepos.map((r) => r.nameWithOwner);
  const path = repoNames.length
    ? `/api/commit-activity?${reposQuery(repoNames, { weeks: windowWeeks })}`
    : null;

  const { status, data, error, reload } = useCardData<CommitActivityResult>(path);

  return (
    <Card
      title="Commit activity"
      subtitle={`Last ${windowWeeks} weeks`}
      className="md:col-span-2"
      actions={
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
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
          hint="Pick one or more repos in the Repositories panel."
        />
      )}
      {status === "loading" && <LoadingState label="Fetching commit stats…" />}
      {status === "error" && <ErrorState message={error!} onRetry={reload} />}
      {status === "ok" && data && (
        <CommitActivityBody data={data} view={view} />
      )}
    </Card>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: "aggregate" | "per-repo";
  onChange: (v: "aggregate" | "per-repo") => void;
}) {
  return (
    <div className="flex rounded-md bg-surface-2 p-0.5 text-xs font-medium">
      {(["aggregate", "per-repo"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded px-2 py-1 ${
            view === v ? "bg-surface shadow-sm" : "text-ink-muted"
          }`}
        >
          {v === "aggregate" ? "Aggregate" : "Per repo"}
        </button>
      ))}
    </div>
  );
}

function CommitActivityBody({
  data,
  view,
}: {
  data: CommitActivityResult;
  view: "aggregate" | "per-repo";
}) {
  // Which repos get their own line; the rest are summed into "Other".
  const namedRepos = useMemo(
    () => data.totals.slice(0, MAX_SERIES).map((t) => t.repo),
    [data.totals],
  );
  const hasOther = data.totals.length > namedRepos.length;

  // Build a { weekStart, <repo>: n, Other: n } row per week for the line chart.
  const perRepoRows = useMemo(() => {
    const weeks = data.aggregate.map((p) => p.weekStart);
    const byRepo = new Map(data.series.map((s) => [s.repo, s]));
    return weeks.map((week) => {
      const row: Record<string, number | string> = { weekStart: week };
      let other = 0;
      for (const s of data.series) {
        const commits =
          s.points.find((p) => p.weekStart === week)?.commits ?? 0;
        if (namedRepos.includes(s.repo)) {
          row[shortRepo(s.repo)] = commits;
        } else {
          other += commits;
        }
      }
      if (hasOther) row.Other = other;
      void byRepo;
      return row;
    });
  }, [data, namedRepos, hasOther]);

  const totalCommits = data.totals.reduce((s, t) => s + t.total, 0);

  if (totalCommits === 0 && data.pending.length === 0) {
    return (
      <EmptyState
        title="No commits in this window"
        hint="Try a longer time window, or check the selected repos have recent activity."
      />
    );
  }

  const lineKeys = [
    ...namedRepos.map(shortRepo),
    ...(hasOther ? ["Other"] : []),
  ];

  return (
    <div>
      {data.pending.length > 0 && (
        <p className="mb-2 rounded-md bg-warn/10 px-3 py-1.5 text-xs text-warn">
          GitHub is still computing stats for {data.pending.length} repo(s) —
          hit “Refresh all” in a moment: {data.pending.map(shortRepo).join(", ")}
        </p>
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {view === "aggregate" ? (
            <BarChart
              data={data.aggregate}
              margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="weekStart"
                {...axisProps}
                tickFormatter={(v) => shortDate(v)}
                minTickGap={24}
              />
              <YAxis {...axisProps} allowDecimals={false} width={44} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(v) => `Week of ${shortDate(v as string)}`}
                formatter={(v) => [formatNumber(Number(v)), "commits"]}
              />
              <Bar
                dataKey="commits"
                name="Commits"
                fill={PRIMARY_HUE}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                {...NO_ANIM}
              />
            </BarChart>
          ) : (
            <LineChart
              data={perRepoRows}
              margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
            >
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="weekStart"
                {...axisProps}
                tickFormatter={(v) => shortDate(v)}
                minTickGap={24}
              />
              <YAxis {...axisProps} allowDecimals={false} width={44} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={(v) => `Week of ${shortDate(v as string)}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="plainline"
              />
              {lineKeys.map((key, i) => (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={
                    key === "Other"
                      ? MUTED_SERIES
                      : SERIES_COLORS[i % SERIES_COLORS.length]
                  }
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  {...NO_ANIM}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Per-repo totals for the window */}
      <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {data.totals.map((t, i) => (
          <li
            key={t.repo}
            className="flex items-center justify-between border-b border-border py-1"
          >
            <span className="flex items-center gap-1.5 truncate">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{
                  background:
                    i < MAX_SERIES
                      ? SERIES_COLORS[i % SERIES_COLORS.length]
                      : MUTED_SERIES,
                }}
              />
              <span className="truncate text-ink-muted">{shortRepo(t.repo)}</span>
            </span>
            <span className="font-medium text-ink">
              {formatNumber(t.total)}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between py-1 text-ink-muted sm:col-span-2">
          <span>Total</span>
          <span className="font-semibold">{formatNumber(totalCommits)}</span>
        </li>
      </ul>
    </div>
  );
}
