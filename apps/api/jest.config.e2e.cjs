const {
  createDefaultEsmPreset,
} = require('ts-jest');

const esmPreset = createDefaultEsmPreset({
  tsconfig: './tsconfig.spec.json',
});

module.exports = {
  ...esmPreset,

  testEnvironment: 'node',

  roots: [
    '<rootDir>/test',
  ],

  testMatch: [
    '**/*.e2e-spec.ts',
  ],

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  clearMocks: true,
};