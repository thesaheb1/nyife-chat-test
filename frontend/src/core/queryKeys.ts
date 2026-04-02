import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

const SESSION_MARKER = 'session';
const ORGANIZATION_MARKER = 'org';
const ANONYMOUS_SESSION_ID = 'anonymous';
const NO_ORGANIZATION_ID = 'none';

export function sessionQueryKey<T extends QueryKey>(parts: T, userId?: string | null) {
  return [...parts, SESSION_MARKER, userId || ANONYMOUS_SESSION_ID] as const;
}

export function organizationQueryKey<T extends QueryKey>(
  parts: T,
  userId?: string | null,
  organizationId?: string | null
) {
  return [
    ...parts,
    SESSION_MARKER,
    userId || ANONYMOUS_SESSION_ID,
    ORGANIZATION_MARKER,
    organizationId || NO_ORGANIZATION_ID,
  ] as const;
}

export function isOrganizationScopedQuery(query: Query, roots?: Set<string>) {
  const [root] = query.queryKey;

  if (typeof root !== 'string') {
    return false;
  }

  if (roots && !roots.has(root)) {
    return false;
  }

  return query.queryKey.includes(ORGANIZATION_MARKER);
}

export function queryKeyStartsWith(queryKey: QueryKey, prefix: readonly unknown[]) {
  if (prefix.length > queryKey.length) {
    return false;
  }

  return prefix.every((segment, index) => queryKey[index] === segment);
}

export function invalidateOrganizationScopedQueryPrefixes(
  queryClient: QueryClient,
  prefixes: ReadonlyArray<readonly unknown[]>
) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      isOrganizationScopedQuery(query) &&
      prefixes.some((prefix) => queryKeyStartsWith(query.queryKey, prefix)),
  });
}
