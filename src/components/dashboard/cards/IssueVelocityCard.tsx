"use client";

import {
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
  NO_ANIM,
  SERIES_COLORS,
  shortRepo,
  tooltipStyle,
} from "@/lib/chart";
import { shortDate, humanizeDuration, formatNumber } from "@/lib/format";
import type { IssueVelocityResult } from "@/lib/github/queries/issues";

const WINDOW_OPTIONS = [4, 8, 12, 26, 52];
const OPENED_COLOR = SERIES_COLORS[0]; // blue
const CLOSED_COLOR = SERIES_COLORS[2]; // aqua

/**
 * Step 7 — issue velocity.
 *
 * Opened vs. closed issues per week over the window, plus the average
 * time-to-close for issues closed in that window and the current open backlog.
 */
export function IssueVelocityCard() {
  const { selectedRepos, windowWeeks, setWindowWeeks } = useDashboard();
  const repoNames = selectedRepos.map((r) => r.nameWithOwner);
  const path = repoNames.length
    ? `/api/issues?${reposQuery(repoNames, { weeks: windowWeeks })}`
    : null;

  const { status, data, error, reload } =
    useCardData<IssueVelocityResult>(path);

  return (
    <Card
      title="Issue velocity"
      subtitle={`Last ${windowWeeks} weeks`}
      className="md:col-span-2"
      actions={
        <select
          value={windowWeeks}
          onChange={(e) => setWindowWeeks(Number(e.target.value))}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
        >
          {WINDOW_OPTIONS.map((wk) => (
            <option key={wk} value={wk}>
              {wk} wks
            </option>
          ))}
        </select>
      }
    >
      {status === "empty" && (
        <EmptyState
          title="No repositories selected"
          hint="Pick repos in the Repositories panel."
        />
      )}
      {status === "loading" && <LoadingState label="Fetching issue history…" />}
      {status === "error" && <ErrorState message={error!} onRetry={reload} />}
      {status === "ok" && data && <IssueVelocityBody data={data} />}
    </Card>
  );
}

function IssueVelocityBody({ data }: { data: IssueVelocityResult }) {
  const net = data.totalOpened - data.totalClosed;

  if (
    data.totalOpened === 0 &&
    data.totalClosed === 0 &&
    data.currentOpen === 0
  ) {
    return (
      <EmptyState
        title="No issue activity in this window"
        hint="The selected repos have no issues opened or closed recently."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open now" value={formatNumber(data.currentOpen)} />
        <Stat
          label={`Opened (${data.weeks}w)`}
          value={formatNumber(data.totalOpened)}
        />
        <Stat
          label={`Closed (${data.weeks}w)`}
          value={formatNumber(data.totalClosed)}
        />
        <Stat
          label="Avg time to close"
          value={
            data.avgTimeToCloseMs != null
              ? humanizeDuration(data.avgTimeToCloseMs)
              : "—"
          }
          hint={
            data.avgTimeToCloseMs != null
              ? `n=${data.ttcSampleSize}`
              : "no issues closed"
          }
        />
      </div>

      <div
        className={`mb-3 text-xs ${
          net > 0 ? "text-warn" : "text-ok"
        }`}
      >
        {net > 0
          ? `Backlog grew by ${net} in this window (opened > closed).`
          : net < 0
            ? `Backlog shrank by ${Math.abs(net)} in this window (closed > opened).`
            : "Opened and closed balanced out this window."}
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data.series}
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
            <Line
              type="linear"
              dataKey="opened"
              name="Opened"
              stroke={OPENED_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              {...NO_ANIM}
            />
            <Line
              type="linear"
              dataKey="closed"
              name="Closed"
              stroke={CLOSED_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              {...NO_ANIM}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {data.truncatedRepos.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          High issue volume in {data.truncatedRepos.map(shortRepo).join(", ")} —
          the totals above are exact, but the chart and avg-time-to-close use the
          100 most recent issues per direction, so earlier weeks are undercounted.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
    </div>
  );
}
