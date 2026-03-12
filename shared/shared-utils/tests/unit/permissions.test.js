'use strict';

const AppError = require('../../src/AppError');
const {
  ADMIN_ASSIGNABLE_RESOURCE_KEYS,
  ADMIN_RESERVED_RESOURCE_KEYS,
  buildFullOrganizationPermissions,
  buildPermissionMap,
  hasAnyPermission,
  hasPermission,
  normalizeAdminPermissions,
  normalizeOrganizationPermissions,
  assertPermission,
} = require('../../src');

describe('permissions helpers', () => {
  it('builds permission maps with all CRUD flags defaulting to false', () => {
    const permissions = buildPermissionMap(['templates', 'flows']);

    expect(permissions).toEqual({
      resources: {
        templates: { create: false, read: false, update: false, delete: false },
        flows: { create: false, read: false, update: false, delete: false },
      },
    });
  });

  it('normalizes organization permissions and drops unknown resources', () => {
    const permissions = normalizeOrganizationPermissions({
      resources: {
        templates: { create: 1, read: true, update: 0, delete: null },
        unknown: { create: true, read: true, update: true, delete: true },
      },
    });

    expect(permissions.resources.templates).toEqual({
      create: true,
      read: true,
      update: false,
      delete: false,
    });
    expect(permissions.resources.unknown).toBeUndefined();
  });

  it('normalizes admin aliases and strips reserved resources by default', () => {
    const permissions = normalizeAdminPermissions({
      resources: {
        email: { create: true, read: false, update: false, delete: false },
        sub_admins: { create: true, read: true, update: true, delete: true },
      },
    });

    expect(permissions.resources.emails).toEqual({
      create: true,
      read: false,
      update: false,
      delete: false,
    });
    expect(permissions.resources.sub_admins).toBeUndefined();
    expect(Object.keys(permissions.resources)).toEqual(
      expect.arrayContaining(ADMIN_ASSIGNABLE_RESOURCE_KEYS)
    );
  });

  it('keeps reserved admin resources only when explicitly requested', () => {
    const permissions = normalizeAdminPermissions(
      {
        resources: {
          roles: { create: true, read: true, update: false, delete: false },
          sub_admins: { create: false, read: true, update: false, delete: false },
        },
      },
      { includeReserved: true }
    );

    expect(permissions.resources.roles.read).toBe(true);
    expect(permissions.resources.sub_admins.read).toBe(true);
    expect(Object.keys(permissions.resources)).toEqual(
      expect.arrayContaining(ADMIN_RESERVED_RESOURCE_KEYS)
    );
  });

  it('builds full organization permissions with every CRUD flag enabled', () => {
    const permissions = buildFullOrganizationPermissions();

    expect(permissions.resources.templates).toEqual({
      create: true,
      read: true,
      update: true,
      delete: true,
    });
    expect(permissions.resources.team_members).toEqual({
      create: true,
      read: true,
      update: true,
      delete: true,
    });
  });

  it('evaluates hasPermission and hasAnyPermission against normalized permissions', () => {
    const permissions = normalizeOrganizationPermissions({
      resources: {
        templates: { create: true, read: true, update: false, delete: false },
        flows: { create: false, read: true, update: false, delete: false },
      },
    });

    expect(hasPermission(permissions, 'templates', 'create')).toBe(true);
    expect(hasPermission(permissions, 'templates', 'update')).toBe(false);
    expect(
      hasAnyPermission(permissions, [
        { resource: 'templates', action: 'delete' },
        { resource: 'flows', action: 'read' },
      ])
    ).toBe(true);
  });

  it('throws a standardized forbidden error when assertPermission fails', () => {
    expect(() => assertPermission(buildPermissionMap(['templates']), 'templates', 'delete')).toThrow(
      AppError
    );

    try {
      assertPermission(buildPermissionMap(['templates']), 'templates', 'delete');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
    }
  });
});
