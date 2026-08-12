/** @type {import('jest').Config} */
export default {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    // Vite tarafi ESM/bundler cozumlemesi kullanir; jest icin CommonJS'e cevrilir.
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    // CLAUDE.md §8.7: uygulama giris noktasi kapsam disidir.
    '!src/main.tsx',
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
