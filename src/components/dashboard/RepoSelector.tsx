"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { useDashboard } from "./DashboardContext";
import { timeAgo } from "@/lib/format";

/**
 * Step 2: the control that drives the whole dashboard.
 *
 * Pick a source (an org, or an explicit list of owner/name repos), then tick the
 * repos you care about. Every other card reads `selectedRepos` from context.
 */
export function RepoSelector() {
  const {
    source,
    repos,
    reposStatus,
    selected,
    selectedRepos,
    loadOrg,
    loadRepoList,
    toggleRepo,
    selectAll,
    clearSelection,
  } = useDashboard();

  const [mode, setMode] = useState<"org" | "repos">("org");
  const [orgInput, setOrgInput] = useState(
    source?.type === "org" ? source.value : "",
  );
  const [reposInput, setReposInput] = useState(
    source?.type === "repos" ? source.value.join("\n") : "",
  );
  const [filter, setFilter] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "org") {
      if (orgInput.trim()) loadOrg(orgInput.trim());
    } else {
      const specs = reposInput
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (specs.length) loadRepoList(specs);
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.nameWithOwner.toLowerCase().includes(q));
  }, [repos, filter]);

  return (
    <Card
      title="Repositories"
      subtitle={
        source
          ? source.type === "org"
            ? `org: ${source.value}`
            : `${source.value.length} repo(s) requested`
          : "Choose an organization or a list of repos to begin"
      }
      actions={
        repos.length > 0 && (
          <span className="text-xs text-slate-400">
            {selected.length}/{repos.length} selected
          </span>
        )
      }
    >
      {/* --- source picker --- */}
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setMode("org")}
            className={`flex-1 rounded-md px-3 py-1.5 ${
              mode === "org" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            Organization
          </button>
          <button
            type="button"
            onClick={() => setMode("repos")}
            className={`flex-1 rounded-md px-3 py-1.5 ${
              mode === "repos" ? "bg-white shadow-sm" : "text-slate-500"
            }`}
          >
            Specific repos
          </button>
        </div>

        {mode === "org" ? (
          <input
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            placeholder="e.g. vercel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        ) : (
          <textarea
            value={reposInput}
            onChange={(e) => setReposInput(e.target.value)}
            placeholder={"owner/repo, one per line\nvercel/next.js\nfacebook/react"}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-slate-500"
          />
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {reposStatus.state === "loading" ? "Loading…" : "Load repositories"}
        </button>
      </form>

      {/* --- repo list --- */}
      <div className="mt-5">
        {reposStatus.state === "loading" && <SkeletonRows rows={5} />}

        {reposStatus.state === "error" && (
          <ErrorState message={reposStatus.message} />
        )}

        {reposStatus.state === "idle" && (
          <EmptyState
            title="No repositories loaded"
            hint="Enter an org name above (e.g. your company's GitHub org) and hit Load."
          />
        )}

        {reposStatus.state === "ok" && repos.length === 0 && (
          <EmptyState title="That source has no repositories we can see." />
        )}

        {reposStatus.state === "ok" && repos.length > 0 && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400"
              />
              <button
                type="button"
                onClick={selectAll}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                None
              </button>
            </div>

            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
              {visible.map((r) => {
                const isSelected = selected.includes(r.nameWithOwner);
                return (
                  <li key={r.nameWithOwner}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRepo(r.nameWithOwner)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{r.name}</span>
                        <span className="ml-1 text-xs text-slate-400">
                          {r.owner}
                        </span>
                        {r.isArchived && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                            archived
                          </span>
                        )}
                        {r.isFork && (
                          <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">
                            fork
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {r.pushedAt ? timeAgo(r.pushedAt) : "—"}
                      </span>
                    </label>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="px-3 py-4 text-center text-xs text-slate-400">
                  No repos match “{filter}”.
                </li>
              )}
            </ul>

            <p className="mt-2 text-xs text-slate-400">
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
