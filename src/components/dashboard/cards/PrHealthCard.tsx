"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { useCardData, reposQuery } from "@/components/dashboard/useCardData";
import { shortRepo } from "@/lib/chart";
import { shortDate } from "@/lib/format";
import type {
  OpenPR,
  PullRequestsResult,
} from "@/lib/github/queries/pullRequests";

type Filter = "all" | "stale" | "ready";

/**
 * Step 4 — PR health.
 *
 * Every open PR across the selected repos, oldest-first. PRs older than the
 * threshold (14 days) get a red badge; 7–14 days amber. Drafts are marked and
 * can be filtered out ("Ready for review").
 */
export function PrHealthCard() {
  const { selectedRepos } = useDashboard();
  const [filter, setFilter] = useState<Filter>("all");

  const repoNames = selectedRepos.map((r) => r.nameWithOwner);
  const path = repoNames.length
    ? `/api/pull-requests?${reposQuery(repoNames)}`
    : null;

  const { status, data, error, reload } = useCardData<PullRequestsResult>(path);

  const rows = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "stale":
        return data.pullRequests.filter((p) => p.isStale);
      case "ready":
        return data.pullRequests.filter((p) => !p.isDraft);
      default:
        return data.pullRequests;
    }
  }, [data, filter]);

  return (
    <Card
      title="PR health"
      subtitle={
        data
          ? `${data.totalOpen} open · ${data.staleCountIsLowerBound ? "≥" : ""}${data.staleCount} older than ${data.thresholdDays}d`
          : "Open pull requests, oldest first"
      }
      className="md:col-span-2"
      actions={
        data &&
        data.totalOpen > 0 && (
          <div className="flex rounded-md bg-surface-2 p-0.5 text-xs font-medium">
            {(
              [
                ["all", "All"],
                ["stale", "Stale"],
                ["ready", "Ready"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded px-2 py-1 ${
                  filter === key ? "bg-surface shadow-sm" : "text-ink-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )
      }
    >
      {status === "empty" && (
        <EmptyState
          title="No repositories selected"
          hint="Pick repos in the Repositories panel to see their open PRs."
        />
      )}
      {status === "loading" && <LoadingState label="Loading open PRs…" />}
      {status === "error" && <ErrorState message={error!} onRetry={reload} />}

      {status === "ok" && data && data.totalOpen === 0 && (
        <EmptyState
          title="No open pull requests 🎉"
          hint="Every selected repo has a clear PR queue."
        />
      )}

      {status === "ok" && data && data.totalOpen > 0 && (
        <>
          {rows.length === 0 ? (
            <EmptyState title={`No PRs match the “${filter}” filter.`} />
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Age</th>
                    <th className="py-2 pr-2 font-medium">PR</th>
                    <th className="hidden py-2 pr-2 font-medium sm:table-cell">
                      Repo
                    </th>
                    <th className="hidden py-2 pr-2 font-medium md:table-cell">
                      Author
                    </th>
                    <th className="py-2 font-medium">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((pr) => (
                    <PrRow key={`${pr.repo}#${pr.number}`} pr={pr} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-subtle">
            Showing {rows.length} of {data.totalOpen} open PR(s) across{" "}
            {data.byRepo.filter((r) => r.open > 0).length} repo(s).
            {data.truncatedRepos.length > 0 && (
              <>
                {" "}
                Only the oldest 50 PRs per repo are loaded for:{" "}
                {data.truncatedRepos.map(shortRepo).join(", ")}.
              </>
            )}
          </p>
        </>
      )}
    </Card>
  );
}

function PrRow({ pr }: { pr: OpenPR }) {
  return (
    <tr className="align-top hover:bg-surface-2">
      <td className="py-2 pr-2">
        <AgeBadge days={pr.ageDays} stale={pr.isStale} />
      </td>
      <td className="py-2 pr-2">
        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink hover:text-accent hover:underline"
        >
          <span className="text-ink-subtle">#{pr.number}</span> {pr.title}
        </a>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-subtle">
          {pr.isDraft && (
            <span className="rounded bg-surface-2 px-1.5 py-0.5 uppercase text-ink-muted">
              draft
            </span>
          )}
          {pr.reviewDecision === "APPROVED" && (
            <span className="rounded bg-ok/10 px-1.5 py-0.5 text-ok">
              approved
            </span>
          )}
          {pr.reviewDecision === "CHANGES_REQUESTED" && (
            <span className="rounded bg-warn/10 px-1.5 py-0.5 text-warn">
              changes requested
            </span>
          )}
          {pr.commentCount > 0 && <span>💬 {pr.commentCount}</span>}
          <span className="sm:hidden">· {shortRepo(pr.repo)}</span>
        </div>
      </td>
      <td className="hidden py-2 pr-2 text-ink-muted sm:table-cell">
        {shortRepo(pr.repo)}
      </td>
      <td className="hidden py-2 pr-2 text-ink-muted md:table-cell">
        {pr.author ? `@${pr.author}` : "—"}
      </td>
      <td className="py-2 text-ink-muted">{shortDate(pr.createdAt)}</td>
    </tr>
  );
}

function AgeBadge({ days, stale }: { days: number; stale: boolean }) {
  const tone = stale
    ? "bg-danger/10 text-danger"
    : days >= 7
      ? "bg-warn/10 text-warn"
      : "bg-surface-2 text-ink-muted";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${tone}`}
    >
      {days}d
    </span>
  );
}
