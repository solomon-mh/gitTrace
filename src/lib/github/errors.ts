/**
 * Normalised error type for everything that can go wrong talking to GitHub.
 *
 * Route handlers catch `GitHubApiError`, map `.kind` to an HTTP status, and send
 * `{ error: { kind, message } }` to the browser so every card can show a real
 * message instead of failing silently.
 */
export type GitHubErrorKind =
  | "MISSING_TOKEN" // GITHUB_TOKEN env var not set
  | "BAD_CREDENTIALS" // token rejected (401) or lacks scopes
  | "RATE_LIMITED" // primary or secondary rate limit hit (403/429)
  | "NOT_FOUND" // org / repo / branch does not exist or token can't see it
  | "GRAPHQL" // query executed but GitHub returned an errors array
  | "NETWORK" // fetch threw (DNS, timeout, offline)
  | "UNKNOWN";

export class GitHubApiError extends Error {
  readonly kind: GitHubErrorKind;
  /** Unix seconds when the rate limit resets, when GitHub tells us. */
  readonly rateLimitResetAt?: number;

  constructor(
    kind: GitHubErrorKind,
    message: string,
    opts?: { rateLimitResetAt?: number; cause?: unknown },
  ) {
    super(message, opts?.cause ? { cause: opts.cause } : undefined);
    this.name = "GitHubApiError";
    this.kind = kind;
    this.rateLimitResetAt = opts?.rateLimitResetAt;
  }

  /** HTTP status a route handler should return for this error. */
  get httpStatus(): number {
    switch (this.kind) {
      case "MISSING_TOKEN":
      case "BAD_CREDENTIALS":
        return 401;
      case "RATE_LIMITED":
        return 429;
      case "NOT_FOUND":
        return 404;
      case "NETWORK":
        return 502;
      default:
        return 500;
    }
  }

  toJSON() {
    return {
      kind: this.kind,
      message: this.message,
      ...(this.rateLimitResetAt
        ? { rateLimitResetAt: this.rateLimitResetAt }
        : {}),
    };
  }
}

/** Shape sent to the client in a non-2xx JSON body. */
export interface ApiErrorBody {
  error: {
    kind: GitHubErrorKind;
    message: string;
    rateLimitResetAt?: number;
  };
}
