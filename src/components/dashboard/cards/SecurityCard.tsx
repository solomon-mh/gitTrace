"use client";

import { Card } from "@/components/ui/Card";
import { BlockedState, EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useDashboard } from "@/components/dashboard/DashboardContext";
import { useCardData, reposQuery } from "@/components/dashboard/useCardData";
import { shortRepo } from "@/lib/chart";
import { shortDate, timeAgo } from "@/lib/format";
import type {
  BranchProtectionSummary,
  ForcePushEvent,
  SecurityResult,
  UnreviewedMerge,
} from "@/lib/github/queries/security";

/**
 * Step 9 — repo security & integrity.
 *
 * Not an audit log (GitHub gates the real one behind Enterprise + org-owner
 * access). This surfaces what a normal token *can* see: whether the default
 * branch is even protected, whether anyone force-pushed recently (from
 * GitHub's public Events feed — best-effort, ~90 days/300 events), and
 * whether anything merged in with zero approving reviews.
 */
export function SecurityCard() {
  const { selectedRepos, windowWeeks, setWindowWeeks } = useDashboard();
  const repoNames = selectedRepos.map((r) => r.nameWithOwner);
  const path = repoNames.length
    ? `/api/security?${reposQuery(repoNames, { weeks: windowWeeks })}`
    : null;

  const { status, data, error, reload } = useCardData<SecurityResult>(path);

  const unprotected =
    data?.branchProtection.filter((b) => !b.isProtected).length ?? 0;
  const forceable =
    data?.branchProtection.filter((b) => b.isProtected && b.allowsForcePushes)
      .length ?? 0;

  return (
    <Card
      title="Repo security"
      accent={
        (data?.forcePushes.length ?? 0) > 0 ||
        (data?.unreviewedMerges.length ?? 0) > 0 ||
        unprotected > 0
          ? "danger"
          : "ok"
      }
      subtitle={
        data
          ? `${unprotected} unprotected branch(es) · ${data.forcePushes.length} force-push(es) · ${data.unreviewedMerges.length} unreviewed merge(s)`
          : "Branch protection, force-pushes, unreviewed merges"
      }
      className="xl:col-span-2"
      actions={
        <select
          value={windowWeeks}
          onChange={(e) => setWindowWeeks(Number(e.target.value))}
          className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink-muted"
        >
          {[4, 8, 12, 26, 52].map((w) => (
            <option key={w} value={w}>
              {w} wks
            </option>
          ))}
        </select>
      }
    >
      {status === "blocked" && <BlockedState />}
      {status === "empty" && (
        <EmptyState
          title="No repositories selected"
          hint="Pick repos in the Repositories panel."
        />
      )}
      {status === "loading" && <LoadingState label="Checking branch protection, recent pushes, and merges…" />}
      {status === "error" && <ErrorState message={error!} onRetry={reload} />}
      {status === "ok" && data && <SecurityBody data={data} />}
    </Card>
  );
}

function SecurityBody({ data }: { data: SecurityResult }) {
  return (
    <div className="space-y-6">
      <Section
        title="Branch protection"
        hint="Is a force-push or an unreviewed merge even possible right now?"
      >
        <ul className="divide-y divide-border">
          {data.branchProtection.map((b) => (
            <ProtectionRow key={b.repo} b={b} />
          ))}
        </ul>
      </Section>

      <Section
        title="Recent force-pushes"
        hint={`Last ${data.weeks} weeks, from GitHub's public activity feed — capped at ~90 days / 300 events, so a clean result means "not visible anymore," not "never happened."`}
      >
        {data.forcePushes.length === 0 ? (
          <EmptyState title="No force-pushes visible in this window." />
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {data.forcePushes.map((f, i) => (
              <ForcePushRow key={`${f.repo}:${f.branch}:${f.at}:${i}`} f={f} />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Merged without an approval"
        hint={`Merged PRs in the last ${data.weeks} weeks with zero approving reviews. On a repo with one maintainer, self-merges are just how it works — this list is a starting point to check, not proof anything's wrong.`}
      >
        {data.unreviewedMerges.length === 0 ? (
          <EmptyState title="Everything merged recently had at least one approval." />
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {data.unreviewedMerges.map((m) => (
              <UnreviewedMergeRow key={`${m.repo}#${m.number}`} m={m} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-xs font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-[11px] text-ink-subtle">{hint}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ProtectionRow({ b }: { b: BranchProtectionSummary }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0">
        <span className="text-ink-muted">{shortRepo(b.repo)}</span>{" "}
        <span className="font-mono text-xs text-ink-subtle">
          {b.defaultBranch ?? "—"}
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {!b.isProtected ? (
          <Badge tone="danger">no protection rule</Badge>
        ) : (
          <>
            <Badge tone="ok">protected</Badge>
            {b.allowsForcePushes && <Badge tone="danger">force-push allowed</Badge>}
            {b.allowsDeletions && <Badge tone="warn">deletable</Badge>}
            {b.requiresApprovingReviews ? (
              <Badge tone="ok">{b.requiredApprovingReviewCount}+ review(s) required</Badge>
            ) : (
              <Badge tone="warn">no review required</Badge>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function ForcePushRow({ f }: { f: ForcePushEvent }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0 truncate">
        <span className="font-mono text-xs text-danger">force-push</span>{" "}
        <span className="font-mono text-xs">{f.branch}</span>{" "}
        <span className="text-ink-subtle">on</span>{" "}
        <span className="text-ink-muted">{shortRepo(f.repo)}</span>
      </div>
      <div className="shrink-0 text-xs text-ink-subtle">
        @{f.actor} · {timeAgo(f.at)}
      </div>
    </li>
  );
}

function UnreviewedMergeRow({ m }: { m: UnreviewedMerge }) {
  return (
    <li className="py-2 text-sm">
      <a
        href={m.url}
        target="_blank"
        rel="noreferrer"
        className="truncate text-ink hover:text-accent"
      >
        <span className="font-mono text-xs text-ink-subtle">#{m.number}</span>{" "}
        {m.title}
      </a>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-subtle">
        <span className="text-ink-muted">{shortRepo(m.repo)}</span>
        <span>·</span>
        <span>merged by {m.mergedBy ? `@${m.mergedBy}` : "unknown"}</span>
        {m.selfMerged && <Badge tone="warn">self-merged</Badge>}
        <span>·</span>
        <span>{shortDate(m.mergedAt)}</span>
      </div>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-ok/10 text-ok"
      : tone === "warn"
        ? "bg-warn/10 text-warn"
        : "bg-danger/10 text-danger";
  return (
    <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}
