const baseConfig = require('./jest.config.cjs');

module.exports = {
  ...baseConfig,
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
};
