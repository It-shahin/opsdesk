const {
  createDefaultEsmPreset,
} = require('ts-jest');

const esmPreset = createDefaultEsmPreset({
  tsconfig: './tsconfig.spec.json',
});

module.exports = {
  ...esmPreset,

  testEnvironment: 'node',

  setupFilesAfterEnv: ['<rootDir>/test/setup-nest-esm.ts'],

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
