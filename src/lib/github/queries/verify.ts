import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Auth check: confirm the token works and report what it can see — the
 * authenticated user, their rate-limit budget, and every organization the token
 * has visibility into (so the UI can offer them as one-click picks).
 */

export interface VerifyResult {
  login: string;
  name: string | null;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
  /** Orgs the token can see. Empty usually means the token lacks `read:org`. */
  organizations: Array<{ login: string; name: string | null }>;
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
    organizations: {
      nodes: Array<{ login: string; name: string | null }>;
    };
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
      organizations(first: 100) {
        nodes {
          login
          name
        }
      }
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
        organizations: data.viewer.organizations.nodes,
        repos: data.viewer.repositories.nodes,
      };
    },
    60 * 1000, // short TTL — this is a health check, not dashboard data
  );
}
