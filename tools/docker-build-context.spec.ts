// T-003 tur 3 kriterleri: `.dockerignore` + `bcrypt` surum pini.
// Regresyon koruma amaci: `.dockerignore` yokken `apps/api/Dockerfile`'daki `COPY . .`,
// `npm ci`'nin container icinde kurdugu linux native binding'i host'un (macOS) bcrypt
// binary'siyle eziyor ve Nest sureci ERR_DLOPEN_FAILED ile cokuyordu. `.gitignore` build
// context'i etkilemedigi icin bu kusur ancak burada yakalanabilir.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

/** Yorum ve bos satirlari atarak `.dockerignore` desenlerini dondurur. */
function dockerignorePatterns(): string[] {
  return readRepoFile('.dockerignore')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageLock {
  packages?: Record<string, { version?: string }>;
}

describe('Docker build context (.dockerignore)', () => {
  it('repo kokunde .dockerignore dosyasi vardir', () => {
    expect(dockerignorePatterns().length).toBeGreaterThan(0);
  });

  it('host node_modules dizinlerini build context disinda birakir', () => {
    const patterns = dockerignorePatterns();

    expect(patterns).toContain('node_modules');
    expect(patterns).toContain('**/node_modules');
  });

  it('uretilmis ciktilari (dist, coverage) ve .git dizinini haric tutar', () => {
    const patterns = dockerignorePatterns();

    expect(patterns).toEqual(
      expect.arrayContaining(['dist', '**/dist', 'coverage', '**/coverage', '.git']),
    );
  });

  it('gercek .env dosyasini imaja sizdirmaz, .env.example haric tutulmaz', () => {
    const patterns = dockerignorePatterns();

    expect(patterns).toContain('.env');
    expect(patterns).toContain('!.env.example');
  });

  it('Dockerfile hala tum context i kopyaladigi icin bu koruma gereklidir', () => {
    // Kural anlamsizlasirsa (COPY . . kalkarsa) test degil, gerekce guncellensin diye burada.
    expect(readRepoFile('apps', 'api', 'Dockerfile')).toContain('COPY . .');
  });
});

describe('bcrypt surum pini (CLAUDE.md §6.1 + §9 npm audit kapisi)', () => {
  it('apps/api bagimliligi ^6.0.0 olarak pinlenmistir', () => {
    const manifest = JSON.parse(readRepoFile('apps', 'api', 'package.json')) as PackageManifest;

    expect(manifest.dependencies?.bcrypt).toBe('^6.0.0');
  });

  it('lockfile 6.x surumunu cozer (npm audit high/critical bulgusu ureten 5.x degil)', () => {
    const lock = JSON.parse(readRepoFile('package-lock.json')) as PackageLock;
    const resolved = lock.packages?.['node_modules/bcrypt']?.version ?? '';

    expect(resolved).toMatch(/^6\./);
  });
});
