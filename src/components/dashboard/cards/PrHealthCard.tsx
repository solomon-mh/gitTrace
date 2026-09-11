"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { BlockedState, EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
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
                  filter === key ? "bg-accent/15 text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )
      }
    >
      {status === "blocked" && <BlockedState />}
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
            <div className="-mx-2 max-h-[440px] overflow-y-auto">
              {rows.map((pr) => (
                <PrRow key={`${pr.repo}#${pr.number}`} pr={pr} />
              ))}
            </div>
          )}

          <p className="mt-3 border-t border-border pt-3 text-xs text-ink-subtle">
            {rows.length} of {data.totalOpen} open across{" "}
            {data.byRepo.filter((r) => r.open > 0).length} repo(s)
            {data.truncatedRepos.length > 0 && (
              <>
                {" · "}oldest 50/repo shown for{" "}
                {data.truncatedRepos.map(shortRepo).join(", ")}
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
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"
    >
      <AgeBadge days={pr.ageDays} stale={pr.isStale} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink group-hover:text-accent">
          <span className="font-mono text-xs text-ink-subtle">
            #{pr.number}
          </span>{" "}
          {pr.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-subtle">
          {pr.isDraft && (
            <span className="rounded bg-surface-2 px-1.5 py-px uppercase text-ink-muted">
              draft
            </span>
          )}
          {pr.reviewDecision === "APPROVED" && (
            <span className="rounded bg-ok/10 px-1.5 py-px text-ok">
              approved
            </span>
          )}
          {pr.reviewDecision === "CHANGES_REQUESTED" && (
            <span className="rounded bg-warn/10 px-1.5 py-px text-warn">
              changes requested
            </span>
          )}
          <span className="text-ink-muted">{shortRepo(pr.repo)}</span>
          <span>·</span>
          <span>{pr.author ? `@${pr.author}` : "unknown"}</span>
          <span>·</span>
          <span>{shortDate(pr.createdAt)}</span>
          {pr.commentCount > 0 && <span>· 💬 {pr.commentCount}</span>}
        </div>
      </div>
    </a>
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
      className={`mt-0.5 inline-block w-11 shrink-0 rounded-md py-0.5 text-center font-mono text-xs font-medium tabular-nums ${tone}`}
    >
      {days}d
    </span>
  );
}
