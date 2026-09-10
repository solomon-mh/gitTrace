"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { useDashboard } from "./DashboardContext";
import { apiGet } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import type { Repo } from "@/lib/github/types";
import type { VerifyResult } from "@/lib/github/queries/verify";

type Mode = "viewer" | "org" | "repos";

/**
 * The control that drives the whole dashboard: pick where repos come from
 * (everything you're involved in / one org / an explicit list), then tick the
 * ones you care about. Every card reads `selectedRepos` from context.
 */
export function RepoSelector() {
  const {
    source,
    repos,
    reposStatus,
    selected,
    selectedRepos,
    loadViewerRepos,
    loadOrg,
    loadRepoList,
    clearSource,
    toggleRepo,
    setSelected,
    selectAll,
    clearSelection,
  } = useDashboard();

  const [mode, setMode] = useState<Mode>(source?.type ?? "viewer");
  const [orgInput, setOrgInput] = useState(
    source?.type === "org" ? source.value : "",
  );
  const [reposInput, setReposInput] = useState(
    source?.type === "repos" ? source.value.join("\n") : "",
  );
  const [filter, setFilter] = useState("");
  const [orgs, setOrgs] = useState<VerifyResult["organizations"]>([]);
  const [viewerLogin, setViewerLogin] = useState<string | null>(null);
  const [ownedOnly, setOwnedOnly] = useState(false);

  // Who are we, and which orgs can the token see? (Used for the "collaborator"
  // tags and the org quick-picks.)
  useEffect(() => {
    let cancelled = false;
    apiGet<VerifyResult>("/api/verify")
      .then((v) => {
        if (cancelled) return;
        setOrgs(v.organizations ?? []);
        setViewerLogin(v.login);
      })
      .catch(() => {
        /* status bar already surfaces auth problems */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** A repo is "mine" if I own it directly or it's in one of my orgs. */
  const orgLogins = useMemo(
    () => new Set(orgs.map((o) => o.login.toLowerCase())),
    [orgs],
  );
  const isOwned = (r: Repo) =>
    r.owner.toLowerCase() === viewerLogin?.toLowerCase() ||
    orgLogins.has(r.owner.toLowerCase());

  // Keep the local mode/inputs in sync if the source is set from elsewhere
  // (URL param, "clear", localStorage hydrate).
  useEffect(() => {
    if (source?.type) setMode(source.type);
    if (source?.type === "org") setOrgInput(source.value);
    if (source?.type === "repos") setReposInput(source.value.join("\n"));
  }, [source]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "viewer") {
      loadViewerRepos();
    } else if (mode === "org") {
      if (orgInput.trim()) loadOrg(orgInput.trim());
    } else {
      const specs = reposInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (specs.length) loadRepoList(specs);
    }
  }

  const collabCount = useMemo(
    () => repos.filter((r) => !isOwned(r)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repos, viewerLogin, orgLogins],
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return repos.filter((r) => {
      if (q && !r.nameWithOwner.toLowerCase().includes(q)) return false;
      if (ownedOnly && !isOwned(r)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, filter, ownedOnly, viewerLogin, orgLogins]);

  // Group the (filtered) repo list by owner so a "my repos" list with many orgs
  // is navigable rather than a 300-row wall.
  const grouped = useMemo(() => {
    const map = new Map<string, Repo[]>();
    for (const r of visible) {
      const arr = map.get(r.owner) ?? [];
      arr.push(r);
      map.set(r.owner, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  const activeLabel =
    source?.type === "viewer"
      ? "My repositories"
      : source?.type === "org"
        ? `Org: ${source.value}`
        : source?.type === "repos"
          ? `${source.value.length} listed repo(s)`
          : null;

  return (
    <Card
      title="Repositories"
      subtitle={activeLabel ?? "Choose where to pull repos from"}
      actions={
        repos.length > 0 && (
          <span className="text-xs text-ink-subtle">
            {selected.length}/{repos.length}
          </span>
        )
      }
    >
      {/* --- active source chip --- */}
      {activeLabel && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
          <span className="truncate font-medium text-ink-muted">
            {activeLabel}
          </span>
          <button
            type="button"
            onClick={clearSource}
            className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-ink-subtle hover:bg-border hover:text-ink"
          >
            ✕ clear
          </button>
        </div>
      )}

      {/* --- source picker --- */}
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1 text-xs font-medium">
          {(
            [
              ["viewer", "My repos"],
              ["org", "Organization"],
              ["repos", "Specific"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2 py-1.5 ${
                mode === m ? "bg-surface shadow-sm" : "text-ink-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "viewer" && (
          <p className="text-xs text-ink-muted">
            Every repo your token can see — personal, collaborations, and every
            org you belong to.
          </p>
        )}
        {mode === "org" && (
          <div className="space-y-2">
            <input
              value={orgInput}
              onChange={(e) => setOrgInput(e.target.value)}
              placeholder="e.g. vercel"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {orgs.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {orgs.map((o) => (
                  <button
                    key={o.login}
                    type="button"
                    onClick={() => {
                      setOrgInput(o.login);
                      loadOrg(o.login);
                    }}
                    className="rounded-md border border-border px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-2"
                  >
                    {o.login}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-subtle">
                Your token can&apos;t see any orgs — it may be missing the{" "}
                <code className="font-mono">read:org</code> scope.
              </p>
            )}
          </div>
        )}
        {mode === "repos" && (
          <textarea
            value={reposInput}
            onChange={(e) => setReposInput(e.target.value)}
            placeholder={"owner/repo, one per line\nvercel/next.js\nfacebook/react"}
            rows={3}
            className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          />
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          {reposStatus.state === "loading"
            ? "Loading…"
            : mode === "viewer"
              ? "Load my repositories"
              : "Load repositories"}
        </button>
      </form>

      {/* --- repo list --- */}
      <div className="mt-5">
        {reposStatus.state === "loading" && <SkeletonRows rows={5} />}

        {reposStatus.state === "error" && (
          <ErrorState message={reposStatus.message} onRetry={clearSource} />
        )}

        {reposStatus.state === "idle" && (
          <EmptyState
            title="No repositories loaded"
            hint="“My repos” lists everything you're involved in — start there."
          />
        )}

        {reposStatus.state === "ok" && repos.length === 0 && (
          <EmptyState title="No repositories found for this source." />
        )}

        {reposStatus.state === "ok" && repos.length > 0 && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                className="flex-1 rounded-md border border-border px-2 py-1 text-xs outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={
                  filter
                    ? () =>
                        setSelected(
                          Array.from(
                            new Set([
                              ...selected,
                              ...visible.map((r) => r.nameWithOwner),
                            ]),
                          ),
                        )
                    : selectAll
                }
                className="rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface-2"
              >
                {filter ? "+ shown" : "All"}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md border border-border px-2 py-1 text-xs text-ink-muted hover:bg-surface-2"
              >
                None
              </button>
            </div>

            {collabCount > 0 && (
              <label className="mb-2 flex items-center gap-1.5 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={ownedOnly}
                  onChange={(e) => setOwnedOnly(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Hide {collabCount} repo(s) you only collaborate on
              </label>
            )}

            <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
              {grouped.map(([owner, ownerRepos]) => (
                <div key={owner}>
                  {grouped.length > 1 && (
                    <div className="sticky top-0 flex items-center justify-between bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                      <span>{owner}</span>
                      <span>{ownerRepos.length}</span>
                    </div>
                  )}
                  <ul className="divide-y divide-border">
                    {ownerRepos.map((r) => {
                      const isSelected = selected.includes(r.nameWithOwner);
                      return (
                        <li key={r.nameWithOwner}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleRepo(r.nameWithOwner)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="flex-1 truncate">
                              <span className="font-medium">{r.name}</span>
                              {grouped.length === 1 && (
                                <span className="ml-1 text-xs text-ink-subtle">
                                  {r.owner}
                                </span>
                              )}
                              {!isOwned(r) && (
                                <span className="ml-2 rounded bg-warn/15 px-1.5 py-0.5 text-[10px] uppercase text-warn">
                                  {r.viewerPermission === "READ" ||
                                  r.viewerPermission === "TRIAGE" ||
                                  r.viewerPermission == null
                                    ? "collaborator"
                                    : "collab · write"}
                                </span>
                              )}
                              {r.isPrivate && (
                                <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">
                                  private
                                </span>
                              )}
                              {r.isArchived && (
                                <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase text-ink-muted">
                                  archived
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-ink-subtle">
                              {r.pushedAt ? timeAgo(r.pushedAt) : "—"}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {visible.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-ink-subtle">
                  No repos match “{filter}”.
                </p>
              )}
            </div>

            <p className="mt-2 text-xs text-ink-subtle">
              {selectedRepos.length === 0
                ? "Select at least one repo — the cards below follow this selection."
                : `Cards below show data for ${selectedRepos.length} repo(s).`}
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
