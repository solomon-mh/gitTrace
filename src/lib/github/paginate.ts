import { graphqlRequest } from "./client";

/** Relay-style page info returned by every GitHub connection. */
export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

/**
 * Walk every page of a GraphQL cursor connection.
 *
 * `query` must accept an `$after: String` variable and return a connection at
 * the path `select(data)`. We stop at `maxPages` as a safety valve so a
 * pathological org can't spin us forever.
 */
export async function paginate<TNode, TData>(
  query: string,
  variables: Record<string, unknown>,
  select: (data: TData) => Connection<TNode>,
  opts: { maxPages?: number } = {},
): Promise<TNode[]> {
  const maxPages = opts.maxPages ?? 20;
  const out: TNode[] = [];
  let after: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const data: TData = await graphqlRequest<TData>(query, {
      ...variables,
      after,
    });
    const conn = select(data);
    out.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) break;
    after = conn.pageInfo.endCursor;
  }

  return out;
}
