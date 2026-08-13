/** @type {import('jest').Config} */
export default {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  // Bilesen testleri gercek bir DOM ister (T-006: kamera girisi + onizleme davranisi).
  testEnvironment: 'jsdom',
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    // Vite tarafi ESM/bundler cozumlemesi kullanir; jest icin CommonJS'e cevrilir.
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'Node',
          jsx: 'react-jsx',
          types: ['jest', 'node'],
        },
      },
    ],
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    // CLAUDE.md §8.7: uygulama giris noktasi, uretilmis tipler ve test altyapisi kapsam disidir.
    '!src/main.tsx',
    '!src/test-setup.ts',
    '!src/api/schema.d.ts',
  ],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
