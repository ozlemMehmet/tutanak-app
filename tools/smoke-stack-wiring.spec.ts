// T-024 iade turu 1: guvenlik denetimi duzeltmelerinin DAGITIM KABLOLAMASINI korur.
// Kod tarafi dogruydu ama iki uc silent-fail veriyordu:
//  1) `apps/web/Dockerfile` CSP'si obje depolama kokenini `{$R2_PUBLIC_ENDPOINT}` yer
//     tutucusundan alir; deger web container'ina VERILMEZSE yer tutucu bos genisler,
//     CSP gecerli kalir ve tutanak fotograflari tarayicida SESSIZCE engellenir
//     (sunucu tarafinda hic hata yok — bu yuzden ancak burada yakalanabilir).
//  2) Uretim imaji `NODE_ENV=production` tasir; duman testi yigini ise dis hesap
//     istemedigi icin `PAYMENT_PROVIDER=fake` kullanir. Ikisi ayni anda oldugunda
//     `validateEnv` acilisi reddeder ve dokumante edilmis duman testi komutu
//     (`docker compose -f docker-compose.e2e.yml up --build -d`) hic ayaga kalkmaz.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

/**
 * `docker-compose.e2e.yml` icindeki bir servisin `environment:` haritasini dondurur.
 * Tam bir YAML ayristiricisi degildir: bu dosyada yalnizca `ANAHTAR: deger` bicimi
 * kullanilir ve tasiyici bir bagimlilik eklemek icin yeterli sebep yoktur.
 */
function composeServiceEnvironment(service: string): Record<string, string> {
  const lines = readRepoFile('docker-compose.e2e.yml').split('\n');
  const entries: Record<string, string> = {};
  let inService = false;
  let inEnvironment = false;

  for (const line of lines) {
    const serviceMatch = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (serviceMatch) {
      inService = serviceMatch[1] === service;
      inEnvironment = false;
      continue;
    }
    if (!inService) continue;
    if (/^ {4}environment:\s*$/.test(line)) {
      inEnvironment = true;
      continue;
    }
    if (/^ {4}\S/.test(line)) {
      inEnvironment = false;
      continue;
    }
    if (!inEnvironment) continue;

    const entryMatch = /^ {6}([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    const key = entryMatch?.[1];
    if (key !== undefined) {
      entries[key] = (entryMatch?.[2] ?? '').trim();
    }
  }

  return entries;
}

function webCspHeader(): string {
  const dockerfile = readRepoFile('apps', 'web', 'Dockerfile');
  const match = /Content-Security-Policy "([^"]+)"/.exec(dockerfile);
  return match?.[1] ?? '';
}

/**
 * `apps/web/Dockerfile` icindeki Caddyfile'da statik SPA belgesine uygulanan
 * `header { ... }` blogunun govdesini dondurur. Caddyfile birden fazla header blogu
 * tasir (`header @public { ... }` yalnizca `/t/*` icindir), bu yuzden CSP'yi TASIYAN
 * blok secilir. Blok, satir bazli taranir: CSP degeri `{$R2_PUBLIC_ENDPOINT}` yer
 * tutucusu yuzunden suslu parantez icerir, tek regex ile kapanis parantezi bulunamaz.
 */
function webStaticSecurityHeaderBlock(): string {
  const lines = readRepoFile('apps', 'web', 'Dockerfile').split('\n');
  const blocks: string[] = [];
  let current: string[] | null = null;
  let closingLine = '';

  for (const line of lines) {
    if (current === null) {
      const opening = /^(\s*)header \{\s*$/.exec(line);
      if (opening) {
        current = [];
        closingLine = `${opening[1] ?? ''}}`;
      }
      continue;
    }
    if (line === closingLine) {
      blocks.push(current.join('\n'));
      current = null;
      continue;
    }
    current.push(line);
  }

  return blocks.find((block) => block.includes('Content-Security-Policy')) ?? '';
}

describe('CSP obje depolama kokeni (apps/web/Dockerfile <-> docker-compose.e2e.yml)', () => {
  it('CSP kokeni koda gommez, R2_PUBLIC_ENDPOINT yer tutucusundan turetir', () => {
    const csp = webCspHeader();

    expect(csp).toMatch(/img-src [^;]*\{\$R2_PUBLIC_ENDPOINT\}/);
    expect(csp).toMatch(/connect-src [^;]*\{\$R2_PUBLIC_ENDPOINT\}/);
  });

  it('duman testi yigini R2_PUBLIC_ENDPOINT degerini web container ina da gecirir', () => {
    const web = composeServiceEnvironment('web');

    expect(Object.keys(web)).toContain('R2_PUBLIC_ENDPOINT');
    expect(web.R2_PUBLIC_ENDPOINT).not.toBe('');
  });

  it('web ve api ayni obje depolama kokenini gorur (imzalayan adres = CSP kokeni)', () => {
    const web = composeServiceEnvironment('web');
    const api = composeServiceEnvironment('api');

    expect(web.R2_PUBLIC_ENDPOINT).toBe(api.R2_PUBLIC_ENDPOINT);
  });
});

// T-024 iade turu 2 / kabul kriteri 6: kriter 4'te sayilan baslik kumesinin otomatik
// karsiligi yoktu (CLAUDE.md §8.7). Basliklar Caddyfile'da tek bir blokta durur; biri
// silinirse ne birim ne e2e testi kirilir — S-02 sessizce geri gelirdi. Asagidaki
// testler o blogu kilitler.
describe('uretim imajinda statik SPA belgesinin guvenlik basliklari (apps/web/Dockerfile)', () => {
  const BASELINE_CSP_DIRECTIVES = [
    "default-src 'self'",
    "script-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ];

  it.each(BASELINE_CSP_DIRECTIVES)('CSP taban yonergesi "%s" silinmemistir', (directive) => {
    expect(webCspHeader()).toContain(directive);
  });

  it('CSP basligi statik belge blogunda tanimlidir (API yanitlarina dokunmaz)', () => {
    expect(webStaticSecurityHeaderBlock()).toMatch(/Content-Security-Policy "/);
  });

  it('statik belge blogu Strict-Transport-Security basligi doner', () => {
    expect(webStaticSecurityHeaderBlock()).toMatch(/Strict-Transport-Security "[^"]+"/);
  });

  it('statik belge blogu X-Content-Type-Options basligini nosniff olarak doner', () => {
    expect(webStaticSecurityHeaderBlock()).toMatch(/X-Content-Type-Options "nosniff"/);
  });

  it('statik belge blogu Referrer-Policy basligi doner', () => {
    expect(webStaticSecurityHeaderBlock()).toMatch(/Referrer-Policy "[^"]+"/);
  });
});

describe('duman testi yigini uretim imajiyla acilabilir (PAYMENT_PROVIDER=fake)', () => {
  it('api servisi NODE_ENV i acikca yerel ortama sabitler', () => {
    const api = composeServiceEnvironment('api');

    expect(Object.keys(api)).toContain('NODE_ENV');
  });

  it('api servisinin NODE_ENV degeri production DEGILDIR (fake saglayici reddedilirdi)', () => {
    const api = composeServiceEnvironment('api');

    expect(api.NODE_ENV).not.toBe('production');
  });

  it('bu koruma env semasindaki uretim reddiyle ayni ciftte durur', () => {
    const schema = readRepoFile('apps', 'api', 'src', 'config', 'env.schema.ts');

    // Sema uretimde `fake`'i reddetmeyi birakirsa yukaridaki iki test anlamsizlasir.
    expect(schema).toMatch(/NODE_ENV === PRODUCTION_NODE_ENV && env\.PAYMENT_PROVIDER === 'fake'/);
  });
});
