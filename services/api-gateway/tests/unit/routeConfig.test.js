'use strict';

const routeConfig = require('../../src/config/routeConfig');

describe('routeConfig', () => {
  it('allows invitation acceptance without gateway auth', () => {
    const organizationsRoute = routeConfig.find((route) => route.prefix === '/api/v1/organizations');
    const adminRoute = routeConfig.find((route) => route.prefix === '/api/v1/admin');

    expect(organizationsRoute).toBeDefined();
    expect(organizationsRoute.auth).toBe(true);
    expect(organizationsRoute.publicPaths).toEqual(
      expect.arrayContaining(['/api/v1/organizations/invitations/accept'])
    );

    expect(adminRoute).toBeDefined();
    expect(adminRoute.auth).toBe(true);
    expect(adminRoute.publicPaths).toEqual(
      expect.arrayContaining([
        '/api/v1/admin/invitations/validate',
        '/api/v1/admin/invitations/accept',
        '/api/v1/admin/users/invitations/validate',
        '/api/v1/admin/users/invitations/accept',
      ])
    );
  });

  it('allows the support socket handshake path without gateway auth', () => {
    const supportRoute = routeConfig.find((route) => route.prefix === '/api/v1/support');

    expect(supportRoute).toBeDefined();
    expect(supportRoute.auth).toBe(true);
    expect(supportRoute.publicPaths).toEqual(
      expect.arrayContaining(['/api/v1/support/socket.io'])
    );
  });
});
