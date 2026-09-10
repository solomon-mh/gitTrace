"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { useCardData, reposQuery } from "@/components/dashboard/useCardData";
import { shortRepo } from "@/lib/chart";
import { shortDate } from "@/lib/format";
import type {
  BranchInfo,
  StaleBranchesResult,
} from "@/lib/github/queries/branches";

const THRESHOLDS = [30, 60, 90];

/**
 * Step 5 — stale branches.
 *
 * Branches whose tip commit is older than the threshold (30/60/90 days,
 * adjustable — the setting is shared dashboard state). Shows last-commit date
 * and author. The default branch is listed but greyed, since a quiet `main`
 * isn't the same problem as a forgotten feature branch.
 */
export function StaleBranchesCard() {
  const { selectedRepos, staleDays, setStaleDays } = useDashboard();
  const [showAll, setShowAll] = useState(false);

  const repoNames = selectedRepos.map((r) => r.nameWithOwner);
  // staleDays is sent so the server flags rows, but its result is threshold-
  // independent (raw branch list) — flipping 30/60/90 re-renders instantly.
  const path = repoNames.length
    ? `/api/branches?${reposQuery(repoNames, { staleDays })}`
    : null;

  const { status, data, error, reload } = useCardData<StaleBranchesResult>(path);

  // Re-flag client-side against the current threshold (data may be cached from
  // a different staleDays value).
  const flagged = useMemo(() => {
    if (!data) return [];
    return data.branches.map((b) => ({
      ...b,
      isStale: b.ageDays > staleDays,
    }));
  }, [data, staleDays]);

  const staleCount = flagged.filter((b) => b.isStale && !b.isDefault).length;
  const rows = showAll ? flagged : flagged.filter((b) => b.isStale);

  return (
    <Card
      title="Stale branches"
      subtitle={
        data
          ? `${staleCount} branch(es) idle > ${staleDays}d · ${data.totalBranches} total`
          : "Branches with no recent commits"
      }
      className="md:col-span-2"
      actions={
        <div className="flex items-center gap-2">
          {data && data.branches.length > 0 && (
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              show all
            </label>
          )}
          <div className="flex rounded-md bg-surface-2 p-0.5 text-xs font-medium">
            {THRESHOLDS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setStaleDays(d)}
                className={`rounded px-2 py-1 ${
                  staleDays === d ? "bg-surface shadow-sm" : "text-ink-muted"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      }
    >
      {status === "empty" && (
        <EmptyState
          title="No repositories selected"
          hint="Pick repos in the Repositories panel to scan their branches."
        />
      )}
      {status === "loading" && <LoadingState label="Scanning branches…" />}
      {status === "error" && <ErrorState message={error!} onRetry={reload} />}

      {status === "ok" && data && data.branches.length === 0 && (
        <EmptyState title="No branches found in the selected repos." />
      )}

      {status === "ok" && data && data.branches.length > 0 && (
        <>
          {rows.length === 0 ? (
            <EmptyState
              title={`No branches idle longer than ${staleDays} days 🎉`}
              hint="Tick “show all” to see every branch, or lower the threshold."
            />
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-ink-subtle">
                  <tr>
                    <th className="py-2 pr-2 font-medium">Idle</th>
                    <th className="py-2 pr-2 font-medium">Branch</th>
                    <th className="hidden py-2 pr-2 font-medium sm:table-cell">
                      Repo
                    </th>
                    <th className="hidden py-2 pr-2 font-medium md:table-cell">
                      Last commit
                    </th>
                    <th className="py-2 font-medium">Author</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((b) => (
                    <BranchRow key={`${b.repo}:${b.name}`} b={b} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-ink-subtle">
            Showing {rows.length} branch(es).
            {data.truncatedRepos.length > 0 && (
              <>
                {" "}
                Only the 100 stalest branches per repo are loaded for:{" "}
                {data.truncatedRepos.map(shortRepo).join(", ")}.
              </>
            )}
          </p>
        </>
      )}
    </Card>
  );
}

function BranchRow({ b }: { b: BranchInfo }) {
  return (
    <tr
      className={`align-top hover:bg-surface-2 ${
        b.isDefault ? "text-ink-subtle" : ""
      }`}
    >
      <td className="py-2 pr-2">
        <span
          className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
            b.isDefault
              ? "bg-surface-2 text-ink-subtle"
              : b.ageDays > 90
                ? "bg-danger/10 text-danger"
                : b.isStale
                  ? "bg-warn/10 text-warn"
                  : "bg-surface-2 text-ink-muted"
          }`}
        >
          {Number.isFinite(b.ageDays) ? `${b.ageDays}d` : "—"}
        </span>
      </td>
      <td className="py-2 pr-2">
        <span className="font-mono text-[13px]">{b.name}</span>
        {b.isDefault && (
          <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-ink-subtle">
            default
          </span>
        )}
      </td>
      <td className="hidden py-2 pr-2 text-ink-muted sm:table-cell">
        {shortRepo(b.repo)}
      </td>
      <td className="hidden py-2 pr-2 text-ink-muted md:table-cell">
        {b.lastCommitDate ? shortDate(b.lastCommitDate) : "—"}
      </td>
      <td className="py-2 text-ink-muted">
        {b.lastCommitLogin
          ? `@${b.lastCommitLogin}`
          : (b.lastCommitAuthor ?? "—")}
      </td>
    </tr>
  );
}
