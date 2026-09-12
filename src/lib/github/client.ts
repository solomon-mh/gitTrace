import { GitHubApiError } from "./errors";

/**
 * Thin wrapper around GitHub's GraphQL v4 endpoint.
 *
 * Everything server-side goes through `graphqlRequest`. It:
 *   - injects the PAT from `GITHUB_TOKEN`
 *   - turns transport / auth / rate-limit failures into a typed `GitHubApiError`
 *   - inspects the GraphQL `errors[]` array (a 200 response can still be a failure)
 *
 * Nothing here is cached — callers wrap it with `cached()` from ./cache so the
 * cache key can be tailored to the query + variables.
 */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_REST_URL = "https://api.github.com";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    type?: string;
    message: string;
    path?: Array<string | number>;
  }>;
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token.trim() === "") {
    throw new GitHubApiError(
      "MISSING_TOKEN",
      "GITHUB_TOKEN is not set. Copy .env.example to .env.local and add a Personal Access Token.",
    );
  }
  return token.trim();
}

/** Parse the rate-limit reset header (unix seconds) if present. */
function readRateLimitReset(headers: Headers): number | undefined {
  const raw = headers.get("x-ratelimit-reset");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Run a GraphQL query/mutation and return typed `data`.
 * Throws `GitHubApiError` for anything that isn't a clean success.
 */
export async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Recommended by GitHub so they can contact us about abusive queries.
        "User-Agent": "gitStream-Dashboard",
      },
      body: JSON.stringify({ query, variables }),
      // We do our own caching; never let fetch serve a stale response here.
      cache: "no-store",
    });
  } catch (err) {
    throw new GitHubApiError(
      "NETWORK",
      "Could not reach api.github.com. Check your connection.",
      { cause: err },
    );
  }

  if (res.status === 401) {
    throw new GitHubApiError(
      "BAD_CREDENTIALS",
      "GitHub rejected the token (401). It may be expired, revoked, or missing the required scopes.",
    );
  }

  if (res.status === 403 || res.status === 429) {
    const reset = readRateLimitReset(res.headers);
    const remaining = res.headers.get("x-ratelimit-remaining");
    // 403 with remaining>0 is usually a secondary (abuse) rate limit.
    const isPrimary = remaining === "0";
    throw new GitHubApiError(
      "RATE_LIMITED",
      isPrimary
        ? "GitHub API rate limit exceeded. Try again after the reset time."
        : "GitHub secondary rate limit hit (too many requests too fast). Wait a minute and retry.",
      { rateLimitResetAt: reset },
    );
  }

  if (res.status === 502 || res.status === 503 || res.status === 504) {
    // Usually a GraphQL query that was too expensive to resolve in time.
    throw new GitHubApiError(
      "NETWORK",
      `GitHub couldn't resolve the query in time (HTTP ${res.status}). ` +
        `Try selecting fewer repos at once.`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GitHubApiError(
      "UNKNOWN",
      `GitHub returned HTTP ${res.status}. ${text.slice(0, 300)}`.trim(),
    );
  }

  let json: GraphQLResponse<T>;
  try {
    json = (await res.json()) as GraphQLResponse<T>;
  } catch (err) {
    throw new GitHubApiError(
      "UNKNOWN",
      "GitHub returned a response that was not valid JSON.",
      { cause: err },
    );
  }

  if (json.errors && json.errors.length > 0) {
    const notFound = json.errors.find(
      (e) => e.type === "NOT_FOUND" || /could not resolve/i.test(e.message),
    );
    if (notFound) {
      throw new GitHubApiError("NOT_FOUND", notFound.message);
    }
    const rateLimited = json.errors.find((e) => e.type === "RATE_LIMITED");
    if (rateLimited) {
      throw new GitHubApiError("RATE_LIMITED", rateLimited.message);
    }
    throw new GitHubApiError(
      "GRAPHQL",
      json.errors.map((e) => e.message).join("; "),
    );
  }

  if (json.data === undefined) {
    throw new GitHubApiError("UNKNOWN", "GitHub response contained no data.");
  }

  return json.data;
}

/**
 * Minimal REST helper. We only use REST where GraphQL has no equivalent — the
 * statistics endpoints for commit-activity histograms and contributor totals,
 * which GitHub never exposed in GraphQL.
 *
 * Returns the HTTP status alongside the body so callers can tell a genuine
 * "202 still computing" apart from a real "200 with nothing to report" (e.g. a
 * repo too small/quiet for GitHub to ever bother computing stats for) — both
 * decode to an empty array, but only the first one is worth retrying.
 */
export async function restRequestStatus<T>(
  path: string,
): Promise<{ status: number; data: T }> {
  const token = getToken();
  const url = path.startsWith("http") ? path : `${GITHUB_REST_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gitStream-Dashboard",
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new GitHubApiError(
      "NETWORK",
      "Could not reach api.github.com. Check your connection.",
      { cause: err },
    );
  }

  if (res.status === 401) {
    throw new GitHubApiError(
      "BAD_CREDENTIALS",
      "GitHub rejected the token (401). It may be expired or missing scopes.",
    );
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubApiError("RATE_LIMITED", "GitHub API rate limit exceeded.", {
      rateLimitResetAt: readRateLimitReset(res.headers),
    });
  }
  if (res.status === 404) {
    throw new GitHubApiError("NOT_FOUND", `GitHub resource not found: ${path}`);
  }
  // 202 = GitHub is still computing the stats. Caller decides whether/how to retry.
  if (res.status === 202) {
    return { status: 202, data: [] as unknown as T };
  }
  if (!res.ok) {
    throw new GitHubApiError("UNKNOWN", `GitHub returned HTTP ${res.status}.`);
  }

  const data = (await res.json()) as T;
  return { status: res.status, data };
}

/** Convenience wrapper for callers that don't care about 202 vs 200. */
export async function restRequest<T>(path: string): Promise<T> {
  return (await restRequestStatus<T>(path)).data;
}
