import { handleRoute } from "@/lib/api/respond";
import { verifyToken } from "@/lib/github/queries/verify";

// Always run on the server, never statically prerendered — it reads a secret.
export const dynamic = "force-dynamic";

/**
 * GET /api/verify
 * Step 1 endpoint: proves the PAT is valid and GraphQL access works.
 */
export function GET() {
  return handleRoute(() => verifyToken());
}
