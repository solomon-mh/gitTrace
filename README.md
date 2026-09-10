# GitStream

A single-page dashboard for GitHub organization health: commit activity, PR age,
stale branches, contributor concentration, and issue velocity — so you don't have
to click through a dozen GitHub tabs to know how your repos are doing.

> **Build status:** step 1 of 8 — project scaffold + GitHub API auth.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Recharts (added in later steps)
- GitHub GraphQL API v4, called from Next.js Route Handlers with a server-side PAT
- In-memory response cache to stay well inside GitHub's rate limits

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a GitHub Personal Access Token

**Classic token** (simplest):

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → *Generate new token (classic)*
2. Scopes:
   - `repo` — needed to read private repositories (skip if you only track public repos)
   - `read:org` — needed to list an organization's repositories
3. Generate, copy the `ghp_…` value.

**Fine-grained token** (more locked down): grant the target organization/repos
these read-only permissions: *Contents*, *Metadata*, *Pull requests*, *Issues*.

### 3. Configure the environment

```bash
cp .env.example .env.local
# edit .env.local and paste your token into GITHUB_TOKEN
```

`.env.local` is git-ignored. The token is only ever read server-side (in
`src/app/api/**`); it is never sent to the browser.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. Step 1's page calls `/api/verify`, which runs a
GraphQL `viewer { login }` query and lists your most recently pushed repos. If
you see your username and a repo list, auth works.

You can also hit the endpoint directly:

```bash
curl -s localhost:3000/api/verify | jq
```

## Project layout

```
src/
  app/
    api/verify/route.ts   Step-1 auth check endpoint
    layout.tsx
    page.tsx              Step-1 UI (replaced by the dashboard later)
  lib/
    api/
      client.ts           Browser fetch helper + error descriptions
      respond.ts          Route-handler wrapper -> uniform JSON errors
    github/
      client.ts           GraphQL/REST transport, typed errors, auth
      cache.ts            In-memory TTL cache with request de-duplication
      errors.ts           GitHubApiError + error-kind -> HTTP status
      queries/            One file per query (verify, repos, commits, …)
```

## Data flow

```
React card ──apiGet()──▶ /api/<card> route handler
                              │
                        cached(key, fn, ttl)   ◀── in-memory cache
                              │  (miss)
                        graphqlRequest()  ──▶  api.github.com/graphql
                              │
                        typed GitHubApiError on any failure
                              ▼
                    { error: { kind, message } }  ──▶  describeError() in the UI
```

## Error handling

Every failure mode surfaces as a visible message, never a blank card:

| Situation | `kind` | HTTP |
| --- | --- | --- |
| `GITHUB_TOKEN` unset | `MISSING_TOKEN` | 401 |
| Token expired / wrong scopes | `BAD_CREDENTIALS` | 401 |
| Rate limit / abuse limit | `RATE_LIMITED` | 429 |
| Org / repo doesn't exist | `NOT_FOUND` | 404 |
| GraphQL query error | `GRAPHQL` | 500 |
| Network failure | `NETWORK` | 502 |
