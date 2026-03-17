import type { Organization } from '@/core/types';

type StoredOrganizationRef = Pick<Organization, 'id' | 'slug' | 'name'>;

const LEGACY_ACTIVE_ORGANIZATION_ID_KEY = 'nyife.activeOrganizationId';
const LEGACY_ACTIVE_ORGANIZATION_SLUG_KEY = 'nyife.activeOrganizationSlug';
const LEGACY_ORGANIZATION_REGISTRY_KEY = 'nyife.organizationRegistry';

const ORG_SCOPED_PREFIXES = [
  '/dashboard',
  '/contacts',
  '/templates',
  '/flows',
  '/campaigns',
  '/chat',
  '/team',
  '/automations',
  '/support',
  '/wallet',
  '/subscription',
  '/whatsapp/connect',
  '/settings',
  '/developer',
];

function readLocalStorage(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage write failures in restrictive environments.
  }
}

function removeLocalStorage(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage removal failures.
  }
}

function getOrganizationStorageKey(userId: string | null | undefined, field: 'activeId' | 'activeSlug' | 'registry') {
  if (!userId) {
    return null;
  }

  return `nyife.org.${userId}.${field}`;
}

export function clearLegacyStoredOrganizationState() {
  removeLocalStorage(LEGACY_ACTIVE_ORGANIZATION_ID_KEY);
  removeLocalStorage(LEGACY_ACTIVE_ORGANIZATION_SLUG_KEY);
  removeLocalStorage(LEGACY_ORGANIZATION_REGISTRY_KEY);
}

export function getStoredOrganizationRegistry(userId?: string | null): StoredOrganizationRef[] {
  const key = getOrganizationStorageKey(userId, 'registry');
  const raw = key ? readLocalStorage(key) : null;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function syncStoredOrganizationRegistry(userId: string | null | undefined, organizations: Organization[]) {
  const key = getOrganizationStorageKey(userId, 'registry');
  if (!key) {
    return;
  }

  const registry = organizations.map((organization) => ({
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
  }));

  writeLocalStorage(key, JSON.stringify(registry));
}

export function getStoredActiveOrganizationId(userId?: string | null) {
  const key = getOrganizationStorageKey(userId, 'activeId');
  return key ? readLocalStorage(key) : null;
}

export function getStoredActiveOrganizationSlug(userId?: string | null) {
  const key = getOrganizationStorageKey(userId, 'activeSlug');
  return key ? readLocalStorage(key) : null;
}

export function setStoredActiveOrganization(
  userId: string | null | undefined,
  organization: Pick<Organization, 'id' | 'slug'>
) {
  const idKey = getOrganizationStorageKey(userId, 'activeId');
  const slugKey = getOrganizationStorageKey(userId, 'activeSlug');

  if (!idKey || !slugKey) {
    return;
  }

  writeLocalStorage(idKey, organization.id);
  writeLocalStorage(slugKey, organization.slug);
}

export function clearStoredActiveOrganization(userId?: string | null) {
  const idKey = getOrganizationStorageKey(userId, 'activeId');
  const slugKey = getOrganizationStorageKey(userId, 'activeSlug');

  if (idKey) {
    removeLocalStorage(idKey);
  }

  if (slugKey) {
    removeLocalStorage(slugKey);
  }
}

export function clearStoredOrganizationRegistry(userId?: string | null) {
  const key = getOrganizationStorageKey(userId, 'registry');
  if (key) {
    removeLocalStorage(key);
  }
}

export function getOrganizationSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/org\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getOrganizationIdForCurrentPath(pathname: string, userId?: string | null) {
  const slug = getOrganizationSlugFromPath(pathname);
  if (!slug) {
    return null;
  }

  const registry = getStoredOrganizationRegistry(userId);
  return registry.find((organization) => organization.slug === slug)?.id || null;
}

export function resolvePreferredOrganization(
  organizations: Organization[],
  userId?: string | null,
  preferredSlug?: string | null
) {
  if (!organizations.length) {
    return null;
  }

  const storedSlug = preferredSlug || getStoredActiveOrganizationSlug(userId);
  const storedId = getStoredActiveOrganizationId(userId);

  if (storedSlug) {
    const bySlug = organizations.find((organization) => organization.slug === storedSlug);
    if (bySlug) {
      return bySlug;
    }
  }

  if (storedId) {
    const byId = organizations.find((organization) => organization.id === storedId);
    if (byId) {
      return byId;
    }
  }

  const firstOwnedOrganization = organizations.find(
    (organization) => organization.organization_role === 'owner' && organization.status === 'active'
  );

  if (firstOwnedOrganization) {
    return firstOwnedOrganization;
  }

  const firstActiveOrganization = organizations.find((organization) => organization.status === 'active');
  return firstActiveOrganization || organizations[0];
}

function normalizeScopedSuffix(pathname: string) {
  if (pathname.startsWith('/org/')) {
    const [, , , ...segments] = pathname.split('/');
    return `/${segments.join('/') || 'dashboard'}`;
  }

  return pathname;
}

export function isOrganizationScopedPath(pathname: string) {
  if (pathname.startsWith('/org/')) {
    return true;
  }

  return ORG_SCOPED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function buildOrganizationPath(
  organizationSlug: string,
  pathname: string,
  search = '',
  hash = ''
) {
  const suffix = normalizeScopedSuffix(pathname);
  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`;
  return `/org/${organizationSlug}${normalizedSuffix}${search}${hash}`;
}

export function buildOrganizationNavigationTarget(
  organizationSlug: string,
  pathname: string,
  search = '',
  hash = ''
) {
  if (!isOrganizationScopedPath(pathname)) {
    return `/org/${organizationSlug}/dashboard`;
  }

  return buildOrganizationPath(organizationSlug, pathname, search, hash);
}
