'use strict';

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/migrations/**', '!src/seeders/**'],
  coverageDirectory: 'coverage',
  verbose: true,
};
