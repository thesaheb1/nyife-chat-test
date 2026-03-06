'use strict';

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // setup.js is loaded via require('../setup') in each test file
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/migrations/**', '!src/seeders/**'],
  coverageDirectory: 'coverage',
  verbose: true,
};
