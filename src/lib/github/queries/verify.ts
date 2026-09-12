import { graphqlRequest } from "@/lib/github/client";
import { cached } from "@/lib/github/cache";

/**
 * Auth check: confirm the token works and report what it can see — the
 * authenticated user, their rate-limit budget, the organizations the token can
 * see, and (for classic PATs) which OAuth scopes it carries. The UI uses the
 * scope list to explain *why* private repos or orgs might be missing.
 */

export interface VerifyResult {
  login: string;
  name: string | null;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
  /**
   * Classic-PAT scopes (e.g. ["repo", "read:org"]). `null` means a fine-grained
   * token (no OAuth scopes — its access is defined by resource permissions) or
   * that GitHub didn't return the header.
   */
  tokenScopes: string[] | null;
  /**
   * Derived from tokenScopes for classic PATs. `null` for fine-grained tokens,
   * where scope isn't the model — check the actual repo/org list instead.
   */
  canReadPrivate: boolean | null;
  canReadOrgs: boolean | null;
  /** Orgs the token can see. Empty usually means the token lacks `read:org`. */
  organizations: Array<{ login: string; name: string | null }>;
  repos: Array<{
    nameWithOwner: string;
    isPrivate: boolean;
    pushedAt: string | null;
  }>;
}

interface CoreQueryResponse {
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

// Identity + rate limit + a repo sample. Deliberately does NOT touch
// `organizations` — that field 403s the *entire* query when the token lacks
// `read:org`, which would take down the whole auth check over one missing
// scope. It's fetched separately and treated as best-effort below.
const CORE_QUERY = /* GraphQL */ `
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

interface OrgsQueryResponse {
  viewer: {
    organizations: {
      nodes: Array<{ login: string; name: string | null }>;
    };
  };
}

const ORGS_QUERY = /* GraphQL */ `
  query VerifyOrgs {
    viewer {
      organizations(first: 100) {
        nodes {
          login
          name
        }
      }
    }
  }
`;

/** Best-effort: a token without `read:org` gets `[]`, not a thrown error. */
async function fetchOrganizations(): Promise<
  VerifyResult["organizations"]
> {
  try {
    const data = await graphqlRequest<OrgsQueryResponse>(ORGS_QUERY);
    return data.viewer.organizations.nodes;
  } catch {
    return [];
  }
}

/**
 * GitHub returns a classic PAT's scopes in the `x-oauth-scopes` response header
 * on any REST call. GraphQL doesn't expose them, so we make one cheap REST hit.
 * Fine-grained tokens omit the header entirely — we return null for those.
 */
async function fetchTokenScopes(): Promise<string[] | null> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "gitStream-Dashboard",
      },
      cache: "no-store",
    });
    const header = res.headers.get("x-oauth-scopes");
    if (header == null) return null; // fine-grained token
    return header
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

export async function verifyToken(): Promise<VerifyResult> {
  return cached(
    "verify:viewer",
    async () => {
      const [core, organizations, scopes] = await Promise.all([
        graphqlRequest<CoreQueryResponse>(CORE_QUERY),
        fetchOrganizations(),
        fetchTokenScopes(),
      ]);

      // Classic token: check scopes directly. Fine-grained token: null (the UI
      // then leans on the actual repo/org list rather than a scope name).
      const canReadPrivate = scopes == null ? null : scopes.includes("repo");
      const canReadOrgs =
        scopes == null
          ? null
          : scopes.includes("read:org") || scopes.includes("admin:org");

      return {
        login: core.viewer.login,
        name: core.viewer.name,
        rateLimit: core.rateLimit,
        tokenScopes: scopes,
        canReadPrivate,
        canReadOrgs,
        organizations,
        repos: core.viewer.repositories.nodes,
      };
    },
    60 * 1000, // short TTL — this is a health check, not dashboard data
  );
}
