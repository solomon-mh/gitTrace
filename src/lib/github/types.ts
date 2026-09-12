/**
 * Shared data shapes used by both the query layer and the UI.
 *
 * These are the *normalised* shapes gitTrace works with — not raw GraphQL
 * responses. Each query file maps GitHub's response into one of these.
 */

/** A repository as shown in the selector and used as the unit of all cards. */
export interface Repo {
  /** "owner/name" — the stable id we key everything on. */
  nameWithOwner: string;
  owner: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  isArchived: boolean;
  isFork: boolean;
  /** Default branch name, e.g. "main". Null for an empty repo. */
  defaultBranch: string | null;
  /** ISO timestamp of the last push, or null for an empty repo. */
  pushedAt: string | null;
  stargazerCount: number;
  openIssues: number;
  openPullRequests: number;
  /**
   * The token user's permission on this repo: ADMIN / MAINTAIN / WRITE / TRIAGE
   * / READ. Lets the UI show why a repo you don't own is in your list
   * (you're a collaborator) vs. one you fully control.
   */
  viewerPermission:
    | "ADMIN"
    | "MAINTAIN"
    | "WRITE"
    | "TRIAGE"
    | "READ"
    | null;
}

export interface RepoListResult {
  /** The org we resolved, when the request was by-org. */
  org: string | null;
  repos: Repo[];
}
