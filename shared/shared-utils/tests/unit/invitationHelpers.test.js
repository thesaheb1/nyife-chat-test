'use strict';

const {
  generateInvitationToken,
  calculateInvitationExpiry,
} = require('../../src');

describe('invitation helpers', () => {
  it('generates a hex token using the requested entropy size', () => {
    const token = generateInvitationToken(16);

    expect(token).toMatch(/^[a-f0-9]+$/);
    expect(token).toHaveLength(32);
  });

  it('calculates expiry relative to the provided time', () => {
    const now = new Date('2026-03-12T00:00:00.000Z');
    const expiry = calculateInvitationExpiry(7, now);

    expect(expiry.toISOString()).toBe('2026-03-19T00:00:00.000Z');
  });
});
