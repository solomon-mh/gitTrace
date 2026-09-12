import { NextResponse } from "next/server";
import { GitHubApiError } from "@/lib/github/errors";

/**
 * Wrap a route handler body so any `GitHubApiError` (or unexpected throw) becomes
 * a consistent `{ error: { kind, message } }` JSON response with a sane status.
 * Every card in the UI reads that shape, so error handling is uniform.
 */
export async function handleRoute<T>(
  fn: () => Promise<T>,
): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return NextResponse.json({ error: err.toJSON() }, { status: err.httpStatus });
    }
    console.error("[gittrace] unhandled route error:", err);
    return NextResponse.json(
      {
        error: {
          kind: "UNKNOWN",
          message:
            err instanceof Error ? err.message : "Unexpected server error.",
        },
      },
      { status: 500 },
    );
  }
}
