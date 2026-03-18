'use strict';

const { buildDefaultOrganizationSeed } = require('../../src');

describe('buildDefaultOrganizationSeed', () => {
  it('builds name, description, and a stable slug from the user first name', () => {
    expect(
      buildDefaultOrganizationSeed({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        firstName: 'Saheb',
      })
    ).toEqual({
      name: "Saheb's Org",
      description: "Saheb's first organization",
      slug: 'saheb-s-org-550e8400',
    });
  });

  it('falls back to User when the first name is missing', () => {
    expect(
      buildDefaultOrganizationSeed({
        userId: 'user-uuid-1',
        firstName: '',
      })
    ).toEqual({
      name: "User's Org",
      description: "User's first organization",
      slug: 'user-s-org-user-uui',
    });
  });
});
