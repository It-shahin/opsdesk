const {
  createDefaultEsmPreset,
} = require('ts-jest');

const esmPreset = createDefaultEsmPreset({
  tsconfig: './tsconfig.json',
});

module.exports = {
  ...esmPreset,

  testEnvironment: 'node',

  roots: [
    '<rootDir>/src',
    '<rootDir>/test',
  ],

  testMatch: [
    '**/*.spec.ts',
  ],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  clearMocks: true,

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/generated/**',
  ],

  coverageDirectory: 'coverage',
};