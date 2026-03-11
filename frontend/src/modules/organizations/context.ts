import type { Organization } from '@/core/types';

type StoredOrganizationRef = Pick<Organization, 'id' | 'slug' | 'name'>;

const ACTIVE_ORGANIZATION_ID_KEY = 'nyife.activeOrganizationId';
const ACTIVE_ORGANIZATION_SLUG_KEY = 'nyife.activeOrganizationSlug';
const ORGANIZATION_REGISTRY_KEY = 'nyife.organizationRegistry';

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

export function getStoredOrganizationRegistry(): StoredOrganizationRef[] {
  const raw = readLocalStorage(ORGANIZATION_REGISTRY_KEY);
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

export function syncStoredOrganizationRegistry(organizations: Organization[]) {
  const registry = organizations.map((organization) => ({
    id: organization.id,
    slug: organization.slug,
    name: organization.name,
  }));

  writeLocalStorage(ORGANIZATION_REGISTRY_KEY, JSON.stringify(registry));
}

export function getStoredActiveOrganizationId() {
  return readLocalStorage(ACTIVE_ORGANIZATION_ID_KEY);
}

export function getStoredActiveOrganizationSlug() {
  return readLocalStorage(ACTIVE_ORGANIZATION_SLUG_KEY);
}

export function setStoredActiveOrganization(organization: Pick<Organization, 'id' | 'slug'>) {
  writeLocalStorage(ACTIVE_ORGANIZATION_ID_KEY, organization.id);
  writeLocalStorage(ACTIVE_ORGANIZATION_SLUG_KEY, organization.slug);
}

export function clearStoredActiveOrganization() {
  removeLocalStorage(ACTIVE_ORGANIZATION_ID_KEY);
  removeLocalStorage(ACTIVE_ORGANIZATION_SLUG_KEY);
  removeLocalStorage(ORGANIZATION_REGISTRY_KEY);
}

export function getOrganizationSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/org\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getOrganizationIdForCurrentPath(pathname: string) {
  const slug = getOrganizationSlugFromPath(pathname);
  if (!slug) {
    return null;
  }

  const registry = getStoredOrganizationRegistry();
  return registry.find((organization) => organization.slug === slug)?.id || null;
}

export function resolvePreferredOrganization(organizations: Organization[], preferredSlug?: string | null) {
  if (!organizations.length) {
    return null;
  }

  const storedSlug = preferredSlug || getStoredActiveOrganizationSlug();
  const storedId = getStoredActiveOrganizationId();

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

  return organizations[0];
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
