import type { ApiErrorBody } from "@/lib/github/errors";

/**
 * Browser-side fetch helper. Every card uses this so error handling is uniform:
 * a non-2xx response is thrown as an `ApiError` carrying the `kind` + message
 * the route handler produced.
 */
export class ApiError extends Error {
  readonly kind: string;
  readonly rateLimitResetAt?: number;
  constructor(body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.kind = body.kind;
    this.rateLimitResetAt = body.rateLimitResetAt;
  }
}

export async function apiGet<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const body = (json as ApiErrorBody).error ?? {
      kind: "UNKNOWN",
      message: `Request failed with HTTP ${res.status}.`,
    };
    throw new ApiError(body);
  }
  return json as T;
}

/** Turn an error into a short, human sentence for a card's error state. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.kind) {
      case "MISSING_TOKEN":
        return "No GitHub token configured. See the README setup steps.";
      case "BAD_CREDENTIALS":
        return "GitHub rejected the token. Check it hasn't expired and has the right scopes.";
      case "RATE_LIMITED": {
        const when = err.rateLimitResetAt
          ? ` Resets ${new Date(err.rateLimitResetAt * 1000).toLocaleTimeString()}.`
          : "";
        return `GitHub API rate limit hit.${when}`;
      }
      case "NOT_FOUND":
        return "Not found — check the org or repo name.";
      default:
        return err.message || "Something went wrong talking to GitHub.";
    }
  }
  return err instanceof Error ? err.message : "Unexpected error.";
}
