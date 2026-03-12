'use strict';

const { resolveFrontendAppUrl } = require('../../src');

describe('resolveFrontendAppUrl', () => {
  it('upgrades loopback frontend urls to https in development', () => {
    expect(resolveFrontendAppUrl({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:5173/',
    })).toBe('https://localhost:5173');
  });

  it('prefers app-local frontend urls over public urls in development', () => {
    expect(resolveFrontendAppUrl({
      NODE_ENV: 'development',
      FRONTEND_APP_URL: 'http://127.0.0.1:5173',
      PUBLIC_FRONTEND_URL: 'https://app.example.com',
    })).toBe('https://127.0.0.1:5173');
  });

  it('prefers explicit public frontend urls outside development', () => {
    expect(resolveFrontendAppUrl({
      NODE_ENV: 'production',
      PUBLIC_FRONTEND_URL: 'https://app.example.com/',
      FRONTEND_URL: 'https://internal.example.com',
    })).toBe('https://app.example.com');
  });

  it('upgrades local vite frontend urls even outside development', () => {
    expect(resolveFrontendAppUrl({
      NODE_ENV: 'production',
      FRONTEND_URL: 'http://localhost:5173',
    })).toBe('https://localhost:5173');
  });

  it('removes trailing slashes from non-local urls', () => {
    expect(resolveFrontendAppUrl({
      NODE_ENV: 'development',
      FRONTEND_URL: 'https://preview.example.com///',
    })).toBe('https://preview.example.com');
  });
});
