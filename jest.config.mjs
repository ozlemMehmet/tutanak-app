// Kok seviyesi testler: repo iskeletinin (README, CI workflow) kabul kriterlerini dogrular.
/** @type {import('jest').Config} */
export default {
  rootDir: '.',
  roots: ['<rootDir>/tools'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
};
