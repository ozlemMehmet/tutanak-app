// T-014 kriteri: hiz siniri degerleri env uzerinden yapilandirilabilir ve `.env.example` ile
// `env.schema.ts` birlikte guncellenir (CLAUDE.md §5: yapilandirma tek dogruluk kaynagi).
// Bu test ikisinin birbirinden sapmasini yakalar: sadece semaya eklenen bir anahtar
// `cp .env.example .env` ile calisan yerel kurulumda gorunmez kalirdi.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

/** `.env.example` icindeki `ANAHTAR=deger` satirlarini nesneye cevirir. */
function envExampleEntries(): Record<string, string> {
  const entries = readRepoFile('.env.example')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=');
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)] as const;
    });
  return Object.fromEntries(entries);
}

function envSchemaSource(): string {
  return readRepoFile('apps', 'api', 'src', 'config', 'env.schema.ts');
}

// architecture.md §7 hiz siniri tablosu: /auth/* 5 istek/dk, diger uclar 300 istek/dk.
const EXPECTED_DEFAULTS: Record<string, string> = {
  RATE_LIMIT_WINDOW_SECONDS: '60',
  RATE_LIMIT_MAX_REQUESTS: '300',
  AUTH_RATE_LIMIT_MAX_REQUESTS: '5',
};

describe('hiz siniri yapilandirmasi (.env.example <-> env.schema.ts)', () => {
  it('hiz siniri anahtarlari .env.example icinde tanimlidir', () => {
    const keys = Object.keys(envExampleEntries());

    expect(keys).toEqual(expect.arrayContaining(Object.keys(EXPECTED_DEFAULTS)));
  });

  it('.env.example degerleri architecture.md §7 tablosundaki limitlerle aynidir', () => {
    const entries = envExampleEntries();

    for (const [key, value] of Object.entries(EXPECTED_DEFAULTS)) {
      expect(entries[key]).toBe(value);
    }
  });

  it('ayni anahtarlar env semasinda da dogrulanir (yoksa uygulama okumaz)', () => {
    const schema = envSchemaSource();

    for (const key of Object.keys(EXPECTED_DEFAULTS)) {
      expect(schema).toContain(key);
    }
  });
});
