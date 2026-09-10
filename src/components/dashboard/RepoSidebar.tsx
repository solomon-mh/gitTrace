"use client";

import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { useDashboard } from "./DashboardContext";
import { useVerify } from "./useVerify";
import { timeAgo } from "@/lib/format";
import type { Repo } from "@/lib/github/types";

type Mode = "viewer" | "org" | "repos";

/**
 * The left rail — logo, the repo source picker, and the checkable repo list.
 * This is the control surface: every card in the main column follows the
 * selection made here.
 */
export function RepoSidebar() {
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

  const verify = useVerify();
  const orgs =
    verify.state === "ok" ? verify.data.organizations : [];
  const viewerLogin =
    verify.state === "ok" ? verify.data.login : null;

  const [mode, setMode] = useState<Mode>(source?.type ?? "viewer");
  const [orgInput, setOrgInput] = useState(
    source?.type === "org" ? source.value : "",
  );
  const [reposInput, setReposInput] = useState(
    source?.type === "repos" ? source.value.join("\n") : "",
  );
  const [filter, setFilter] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);

  useEffect(() => {
    if (source?.type) setMode(source.type);
    if (source?.type === "org") setOrgInput(source.value);
    if (source?.type === "repos") setReposInput(source.value.join("\n"));
  }, [source]);

  const orgLogins = useMemo(
    () => new Set(orgs.map((o) => o.login.toLowerCase())),
    [orgs],
  );
  const isOwned = (r: Repo) =>
    r.owner.toLowerCase() === viewerLogin?.toLowerCase() ||
    orgLogins.has(r.owner.toLowerCase());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "viewer") loadViewerRepos();
    else if (mode === "org") {
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
      ? "All my repositories"
      : source?.type === "org"
        ? `Org · ${source.value}`
        : source?.type === "repos"
          ? `${source.value.length} listed repos`
          : null;

  return (
    <aside className="flex shrink-0 flex-col border-border bg-surface lg:sticky lg:top-0 lg:h-screen lg:w-[320px] lg:border-r">
      {/* logo */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <Logo />
      </div>

      {/* source picker */}
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[13px] font-semibold text-ink">
            Repositories
          </h2>
          {repos.length > 0 && (
            <span className="font-mono text-xs text-ink-subtle">
              {selected.length}/{repos.length}
            </span>
          )}
        </div>

        {activeLabel && (
          <div className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5 text-xs">
            <span className="truncate font-medium text-ink-muted">
              {activeLabel}
            </span>
            <button
              type="button"
              onClick={clearSource}
              className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-ink-subtle hover:bg-border hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1 text-xs font-medium">
            {(
              [
                ["viewer", "Mine"],
                ["org", "Org"],
                ["repos", "List"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1.5 ${
                  mode === m
                    ? "bg-accent/15 text-accent"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "viewer" && (
            <p className="text-xs text-ink-subtle">
              Everything your token can see — personal, collaborations, and every
              org you belong to.
            </p>
          )}
          {mode === "org" && (
            <div className="space-y-1.5">
              <input
                value={orgInput}
                onChange={(e) => setOrgInput(e.target.value)}
                placeholder="organization login"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
              />
              {orgs.length > 0 && (
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
              )}
            </div>
          )}
          {mode === "repos" && (
            <textarea
              value={reposInput}
              onChange={(e) => setReposInput(e.target.value)}
              placeholder={"owner/repo per line\nvercel/next.js"}
              rows={3}
              className="w-full rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            {reposStatus.state === "loading" ? "Loading…" : "Load"}
          </button>
        </form>
      </div>

      {/* repo list */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        {reposStatus.state === "loading" && <SkeletonRows rows={6} />}
        {reposStatus.state === "error" && (
          <ErrorState message={reposStatus.message} onRetry={clearSource} />
        )}
        {reposStatus.state === "idle" && (
          <EmptyState
            title="No repositories loaded"
            hint="“Mine” lists everything you're involved in."
          />
        )}
        {reposStatus.state === "ok" && repos.length === 0 && (
          <EmptyState title="No repositories found for this source." />
        )}

        {reposStatus.state === "ok" && repos.length > 0 && (
          <>
            <div className="mb-2 flex items-center gap-1.5">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                className="min-w-0 flex-1 rounded-md border border-border bg-canvas px-2 py-1 text-xs outline-none focus:border-accent"
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
                {filter ? "+shown" : "All"}
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
                Hide {collabCount} collaboration(s)
              </label>
            )}

            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
              {grouped.map(([owner, ownerRepos]) => (
                <div key={owner} className="mb-1">
                  {grouped.length > 1 && (
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                      <span className="truncate">{owner}</span>
                      <span className="font-mono">{ownerRepos.length}</span>
                    </div>
                  )}
                  {ownerRepos.map((r) => {
                    const isSelected = selected.includes(r.nameWithOwner);
                    return (
                      <label
                        key={r.nameWithOwner}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRepo(r.nameWithOwner)}
                          className="h-3.5 w-3.5 shrink-0 rounded border-border"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          <span
                            className={
                              isSelected ? "text-ink" : "text-ink-muted"
                            }
                          >
                            {r.name}
                          </span>
                          {!isOwned(r) && (
                            <span className="ml-1.5 rounded bg-warn/15 px-1 py-px text-[9px] uppercase text-warn">
                              collab
                            </span>
                          )}
                          {r.isPrivate && (
                            <span className="ml-1 rounded bg-surface-2 px-1 py-px text-[9px] uppercase text-ink-subtle">
                              priv
                            </span>
                          )}
                          {r.isArchived && (
                            <span className="ml-1 rounded bg-surface-2 px-1 py-px text-[9px] uppercase text-ink-subtle">
                              arch
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-ink-subtle">
                          {r.pushedAt ? timeAgo(r.pushedAt) : "—"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ))}
              {visible.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-ink-subtle">
                  No repos match “{filter}”.
                </p>
              )}
            </div>

            {selectedRepos.length === 0 && (
              <p className="mt-2 border-t border-border pt-2 text-xs text-warn">
                Select at least one repo.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
