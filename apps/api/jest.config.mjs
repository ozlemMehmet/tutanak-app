/** @type {import('jest').Config} */
export default {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    // CLAUDE.md §8.7: main.ts, config ve DTO'lar kapsam disidir.
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/config/**',
    '!src/**/dto/**',
    // Tip bildirimleri calisan kod uretmez (iyzipay.d.ts).
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: { lines: 70 },
    './src/modules/': { lines: 80 },
  },
};
