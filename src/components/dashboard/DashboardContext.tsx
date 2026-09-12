"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, apiGet, describeError } from "@/lib/api/client";
import type { Repo, RepoListResult } from "@/lib/github/types";
import type { VerifyResult } from "@/lib/github/queries/verify";

export type VerifyState =
  | { state: "loading" }
  | { state: "error"; message: string; kind: string }
  | { state: "ok"; data: VerifyResult };

/**
 * Dashboard-wide state shared by every card:
 *   - which repos are loaded (the org / explicit list the user picked)
 *   - which of those repos are currently selected (the filter every card obeys)
 *   - the analysis time window and the stale-branch threshold
 *   - a refresh nonce that forces all cards to refetch
 *
 * Persisted to localStorage so a reload keeps your view.
 */

export type RepoSource =
  | { type: "viewer" } // every repo the token's user is involved in
  | { type: "org"; value: string }
  | { type: "repos"; value: string[] };

type ReposStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ok" };

interface DashboardState {
  source: RepoSource | null;
  repos: Repo[];
  reposStatus: ReposStatus;
  /** nameWithOwner of every currently-selected repo. */
  selected: string[];
  /** Analysis window in weeks (commit activity, contributors, issues). */
  windowWeeks: number;
  /** Stale-branch threshold in days (30 / 60 / 90 or custom). */
  staleDays: number;
  /** Bump to force every card to refetch. */
  refreshNonce: number;
  /**
   * The one shared `/api/verify` result — who we're authed as, rate limit,
   * token scopes. Fetched once here (not per-component) so every card can gate
   * on it without firing its own redundant, independently-racing request.
   */
  verify: VerifyState;
}

interface DashboardApi extends DashboardState {
  /** Repos filtered to the current selection — what cards should render. */
  selectedRepos: Repo[];
  loadViewerRepos: () => void;
  loadOrg: (org: string) => void;
  loadRepoList: (specs: string[]) => void;
  /** Forget the current source entirely and wipe persisted state. */
  clearSource: () => void;
  toggleRepo: (nameWithOwner: string) => void;
  setSelected: (nameWithOwner: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setWindowWeeks: (n: number) => void;
  setStaleDays: (n: number) => void;
  refreshAll: () => void | Promise<void>;
}

const DashboardContext = createContext<DashboardApi | null>(null);

const STORAGE_KEY = "gittrail:v1";

interface Persisted {
  source: RepoSource | null;
  selected: string[];
  windowWeeks: number;
  staleDays: number;
}

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

function savePersisted(p: Persisted) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

export function DashboardProvider({
  children,
  defaultOrg,
}: {
  children: React.ReactNode;
  defaultOrg?: string;
}) {
  const [source, setSource] = useState<RepoSource | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [reposStatus, setReposStatus] = useState<ReposStatus>({ state: "idle" });
  const [selected, setSelectedState] = useState<string[]>([]);
  const [windowWeeks, setWindowWeeksState] = useState(12);
  const [staleDays, setStaleDaysState] = useState(30);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [verify, setVerify] = useState<VerifyState>({ state: "loading" });

  // One shared auth check for the whole tree — every card gates on this
  // instead of each firing its own `/api/verify` (which used to race and, on a
  // broken token, hammer GitHub with N parallel doomed requests).
  useEffect(() => {
    let cancelled = false;
    setVerify({ state: "loading" });
    apiGet<VerifyResult>("/api/verify")
      .then((data) => !cancelled && setVerify({ state: "ok", data }))
      .catch((err) => {
        if (cancelled) return;
        setVerify({
          state: "error",
          message: describeError(err),
          kind: err instanceof ApiError ? err.kind : "UNKNOWN",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  // Track whether the current selection was set by the user, so that reloading
  // a repo list doesn't stomp an explicit choice.
  const selectionTouched = useRef(false);
  const hydrated = useRef(false);

  // --- hydrate: URL query params > localStorage > default-org env ---------
  // URL params win so a dashboard view can be shared as a link:
  //   /?org=vercel&weeks=26&staleDays=60
  //   /?repos=vercel/next.js,facebook/react
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const urlMine = url.get("mine") === "1" || url.get("scope") === "viewer";
    const urlOrg = url.get("org")?.trim();
    const urlRepos = url.get("repos")?.trim();
    const urlWeeks = Number(url.get("weeks"));
    const urlStale = Number(url.get("staleDays"));

    const p = loadPersisted();

    if (p?.selected?.length) {
      setSelectedState(p.selected);
      selectionTouched.current = true;
    }
    setWindowWeeksState(
      Number.isFinite(urlWeeks) && urlWeeks > 0
        ? urlWeeks
        : (p?.windowWeeks ?? 12),
    );
    setStaleDaysState(
      Number.isFinite(urlStale) && urlStale > 0
        ? urlStale
        : (p?.staleDays ?? 30),
    );

    if (urlMine) {
      setSource({ type: "viewer" });
      selectionTouched.current = false;
    } else if (urlOrg) {
      setSource({ type: "org", value: urlOrg });
      selectionTouched.current = false;
    } else if (urlRepos) {
      setSource({ type: "repos", value: urlRepos.split(",").map((s) => s.trim()) });
      selectionTouched.current = false;
    } else if (p?.source) {
      setSource(p.source);
    } else if (defaultOrg) {
      setSource({ type: "org", value: defaultOrg });
    }

    hydrated.current = true;
  }, [defaultOrg]);

  // --- fetch repos whenever `source` changes ------------------------------
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setReposStatus({ state: "loading" });

    const query =
      source.type === "viewer"
        ? `?scope=viewer`
        : source.type === "org"
          ? `?org=${encodeURIComponent(source.value)}`
          : `?repos=${encodeURIComponent(source.value.join(","))}`;

    apiGet<RepoListResult>(`/api/repos${query}`)
      .then((res) => {
        if (cancelled) return;
        setRepos(res.repos);
        setReposStatus({ state: "ok" });
        // Default selection, unless the user already chose. Cap it: the cards
        // batch one API call per selected repo, so auto-selecting 200 repos from
        // a "my repos" load would hammer the API. Take the most recently pushed.
        if (!selectionTouched.current) {
          const active = res.repos.filter((r) => !r.isArchived);
          const DEFAULT_MAX = 12;
          setSelectedState(
            active.slice(0, DEFAULT_MAX).map((r) => r.nameWithOwner),
          );
        } else {
          // Keep only still-present repos.
          setSelectedState((prev) =>
            prev.filter((n) =>
              res.repos.some((r) => r.nameWithOwner === n),
            ),
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRepos([]);
        setReposStatus({ state: "error", message: describeError(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [source, refreshNonce]);

  // --- persist on change --------------------------------------------------
  useEffect(() => {
    if (!hydrated.current) return;
    savePersisted({ source, selected, windowWeeks, staleDays });
  }, [source, selected, windowWeeks, staleDays]);

  // --- actions -----------------------------------------------------------
  const loadViewerRepos = useCallback(() => {
    selectionTouched.current = false;
    setSource({ type: "viewer" });
  }, []);

  const loadOrg = useCallback((org: string) => {
    selectionTouched.current = false;
    setSource({ type: "org", value: org.trim() });
  }, []);

  const loadRepoList = useCallback((specs: string[]) => {
    selectionTouched.current = false;
    setSource({
      type: "repos",
      value: specs.map((s) => s.trim()).filter(Boolean),
    });
  }, []);

  const clearSource = useCallback(() => {
    selectionTouched.current = false;
    setSource(null);
    setRepos([]);
    setReposStatus({ state: "idle" });
    setSelectedState([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setSelected = useCallback((next: string[]) => {
    selectionTouched.current = true;
    setSelectedState(next);
  }, []);

  const toggleRepo = useCallback((nameWithOwner: string) => {
    selectionTouched.current = true;
    setSelectedState((prev) =>
      prev.includes(nameWithOwner)
        ? prev.filter((n) => n !== nameWithOwner)
        : [...prev, nameWithOwner],
    );
  }, []);

  const selectAll = useCallback(() => {
    selectionTouched.current = true;
    setSelectedState(repos.map((r) => r.nameWithOwner));
  }, [repos]);

  const clearSelection = useCallback(() => {
    selectionTouched.current = true;
    setSelectedState([]);
  }, []);

  /**
   * Clear the server's in-memory cache, then bump the nonce so every card
   * refetches. Without the clear, a "refresh" within a card's TTL would just
   * replay cached data.
   */
  const refreshAll = useCallback(async () => {
    try {
      await fetch("/api/cache/clear", { method: "POST" });
    } catch {
      /* refetch anyway — worst case cards show cached data */
    }
    setRefreshNonce((n) => n + 1);
  }, []);

  const selectedRepos = useMemo(
    () => repos.filter((r) => selected.includes(r.nameWithOwner)),
    [repos, selected],
  );

  const value: DashboardApi = {
    source,
    repos,
    reposStatus,
    selected,
    windowWeeks,
    staleDays,
    refreshNonce,
    verify,
    selectedRepos,
    loadViewerRepos,
    loadOrg,
    loadRepoList,
    clearSource,
    toggleRepo,
    setSelected,
    selectAll,
    clearSelection,
    setWindowWeeks: setWindowWeeksState,
    setStaleDays: setStaleDaysState,
    refreshAll,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardApi {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within <DashboardProvider>");
  return ctx;
}
