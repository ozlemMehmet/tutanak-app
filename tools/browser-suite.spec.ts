// H-006: tarayici seviyesindeki suite'in KURULUMUNU kilitler (suite'in kendisi degil).
//
// Suite yalnizca calisan bir yigina karsi kosar (`docker compose up -d`); bu yuzden
// "bagimlilik duruyor mu, script duruyor mu, iki viewport tanimli mi, belge yerinde mi"
// sorulari Playwright'in KENDISI ile dogrulanamaz — kurulum bozulursa suite hic kosmaz ve
// hicbir test kirmizi olmaz (sessiz kayip). Kurulum sozlesmesi bu yuzden hizli kok
// jest paketinde yasar; olcum kriterleri (H-006 kriter 3/4/5) tarayicida yasar.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MASAUSTU_VIEWPORT, MOBIL_VIEWPORT } from '../apps/web/e2e/support/viewport';

const REPO_ROOT = join(__dirname, '..');
const E2E_DIR = join(REPO_ROOT, 'apps', 'web', 'e2e');

interface PackageManifest {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

function readManifest(...segments: string[]): PackageManifest {
  return JSON.parse(readRepoFile(...segments)) as PackageManifest;
}

/**
 * Yorumlari atar: yasak beklemeyi ANLATAN bir yorum ihlal degildir, yalnizca cagrilan kod
 * ihlaldir. `//` yalnizca protokol ayracindan (`http://`) sonra gelmiyorsa yorum sayilir.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Suite'in TUM kaynak dosyalari (spec + yardimcilar + yapilandirma), yorumsuz. */
function suiteSources(): { name: string; content: string }[] {
  const files = readdirSync(E2E_DIR, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => ({
      name: entry,
      content: stripComments(readFileSync(join(E2E_DIR, entry), 'utf8')),
    }));

  return [
    ...files,
    {
      name: 'playwright.config.ts',
      content: stripComments(readRepoFile('apps', 'web', 'playwright.config.ts')),
    },
  ];
}

describe('tarayici suite kurulumu (H-006 kriter 1)', () => {
  it('@playwright/test dev bagimliligi olarak eklidir', () => {
    const version = readManifest('package.json').devDependencies?.['@playwright/test'];

    expect(version).toBeDefined();
    // Surum minor'e sabitlenir (CLAUDE.md §6.1 "surumler sabitlenir"): `~`.
    expect(version).toMatch(/^~1\./);
  });

  it('surum, tarayici indirmesindeki HIGH advisory duzeltmesini icerir', () => {
    // GHSA-7mvr-c777-76hp: `playwright install` tarayiciyi SSL sertifikasini dogrulamadan
    // indiriyordu; duzeltme 1.62.1. CLAUDE.md §6.1'deki "1.4x" satiri bu advisory'den
    // ONCEDIR ve §9'un `npm audit --audit-level=high` kapisiyla ayni anda saglanamaz
    // (devlog: anayasa celiskisi, bcrypt 5.x -> 6.0 emsali).
    const version = readManifest('package.json').devDependencies?.['@playwright/test'] ?? '';
    const [major, minor] = version.replace(/^[~^]/, '').split('.');

    expect(Number(major)).toBe(1);
    expect(Number(minor)).toBeGreaterThanOrEqual(62);
  });

  it('suite apps/web altinda yasar ve en az bir senaryo dosyasi icerir', () => {
    expect(existsSync(join(REPO_ROOT, 'apps', 'web', 'playwright.config.ts'))).toBe(true);
    expect(
      readdirSync(E2E_DIR, { recursive: true, encoding: 'utf8' }).filter((entry) =>
        entry.endsWith('.spec.ts'),
      ).length,
    ).toBeGreaterThan(0);
  });

  it('web workspace icin test:browser script tanimlidir', () => {
    expect(readManifest('apps', 'web', 'package.json').scripts?.['test:browser']).toBe(
      'playwright test',
    );
  });

  it('kokten tek komutla kosulur', () => {
    expect(readManifest('package.json').scripts?.['test:browser']).toContain('test:browser');
  });

  it('jest paketleri suite dosyalarini TOPLAMAZ (iki kosucu ayni dosyayi kosmaz)', () => {
    // apps/web jest'i yalnizca `src` altini tarar; e2e klasoru disaridadir.
    expect(readRepoFile('apps', 'web', 'jest.config.mjs')).toContain("roots: ['<rootDir>/src']");
    expect(readRepoFile('jest.config.mjs')).toContain("roots: ['<rootDir>/tools']");
  });
});

describe('tarayici suite viewport sozlesmesi (H-006 kriter 2)', () => {
  it('masaustu viewport 1280x900 olarak tanimlidir', () => {
    expect(MASAUSTU_VIEWPORT).toEqual({ width: 1280, height: 900 });
  });

  it('mobil viewport 390x844 olarak tanimlidir', () => {
    expect(MOBIL_VIEWPORT).toEqual({ width: 390, height: 844 });
  });

  it('iki viewport da playwright projesi olarak kosar', () => {
    const config = readRepoFile('apps', 'web', 'playwright.config.ts');

    expect(config).toContain("name: 'masaustu'");
    expect(config).toContain("name: 'mobil'");
    // Degerler tek dogruluk kaynagindan gelir; config'e ham sayi yazilmaz.
    expect(config).toContain('MASAUSTU_VIEWPORT');
    expect(config).toContain('MOBIL_VIEWPORT');
  });
});

describe('tarayici suite kararliligi (H-006 kriter 7)', () => {
  it.each(['waitForTimeout', 'setTimeout', 'sleep'])(
    'suite kaynaklarinda sabit bekleme (%s) cagrilmaz',
    (forbidden) => {
      const call = new RegExp(`\\b${forbidden}\\s*\\(`);
      const offenders = suiteSources()
        .filter((file) => call.test(file.content))
        .map((file) => file.name);

      expect(offenders).toEqual([]);
    },
  );

  it('yeniden deneme kapalidir (flaky test gizlenmez — CLAUDE.md §8.8)', () => {
    expect(readRepoFile('apps', 'web', 'playwright.config.ts')).toContain('retries: 0');
  });
});

describe('tarayici suite belgesi (H-006 kriter 8)', () => {
  const readme = (): string => readRepoFile('README.md');

  it('kosum komutunu icerir', () => {
    expect(readme()).toContain('npm run test:browser');
  });

  it('calisan yigin gereksinimini yazar', () => {
    expect(readme()).toContain('docker compose up -d');
    expect(readme()).toContain('http://localhost:5173');
  });

  it('tarayici indirme adimini yazar', () => {
    expect(readme()).toContain('npx playwright install');
  });
});
