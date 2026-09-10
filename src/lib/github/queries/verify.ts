import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Step 1 sanity check: confirm the token works and we can read data.
 * Returns the authenticated user plus a handful of their repos.
 */

export interface VerifyResult {
  login: string;
  name: string | null;
  /** GraphQL rate-limit budget snapshot, handy for the status bar. */
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
  repos: Array<{
    nameWithOwner: string;
    isPrivate: boolean;
    pushedAt: string | null;
  }>;
}

interface VerifyQueryResponse {
  viewer: {
    login: string;
    name: string | null;
    repositories: {
      nodes: Array<{
        nameWithOwner: string;
        isPrivate: boolean;
        pushedAt: string | null;
      }>;
    };
  };
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

const VERIFY_QUERY = /* GraphQL */ `
  query VerifyToken {
    viewer {
      login
      name
      repositories(
        first: 10
        orderBy: { field: PUSHED_AT, direction: DESC }
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      ) {
        nodes {
          nameWithOwner
          isPrivate
          pushedAt
        }
      }
    }
    rateLimit {
      limit
      remaining
      resetAt
    }
  }
`;

export async function verifyToken(): Promise<VerifyResult> {
  return cached(
    "verify:viewer",
    async () => {
      const data = await graphqlRequest<VerifyQueryResponse>(VERIFY_QUERY);
      return {
        login: data.viewer.login,
        name: data.viewer.name,
        rateLimit: data.rateLimit,
        repos: data.viewer.repositories.nodes,
      };
    },
    60 * 1000, // short TTL — this is a health check, not dashboard data
  );
}
