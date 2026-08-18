// H-007: kullaniciya donuk dizelerde ASCII'ye katlanmis Turkce'yi yakalayan kontrolun testi.
// Kontrol `npm test` zincirindeki kok jest kosumuyla otomatik calisir (package.json).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  formatFindings,
  isScannedFile,
  SCAN_TARGETS,
  scanRepository,
  scanSource,
} from './turkish-text/ascii-folded-turkish';

const REPO_ROOT = join(__dirname, '..');

function writeFixture(root: string, relativePath: string, content: string): void {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

describe('scanSource — kasten bozulmus ornekler', () => {
  it('dize sabitindeki katlanmis kelimeyi bulgu olarak dondurur', () => {
    const source = "const PENDING = 'Odeme sonucu bekleniyor';\n";

    const findings = scanSource('apps/web/src/pages/SubscriptionPage.tsx', source);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      filePath: 'apps/web/src/pages/SubscriptionPage.tsx',
      line: 1,
      match: 'Odeme',
      expected: 'ödeme',
    });
  });

  it('JSX metin dugumundeki katlanmis kelimeyi yakalar', () => {
    const source = 'export const T = () => <p>Tutanagi paylas</p>;\n';

    const matches = scanSource('apps/web/src/features/sharing/Share.tsx', source).map(
      (finding) => finding.match,
    );

    expect(matches).toEqual(expect.arrayContaining(['Tutanagi', 'paylas']));
  });

  it('JSX ozniteliklerinden yalnizca kullaniciya donuk olanlari tarar', () => {
    const source =
      'export const T = () => <img className="odeme-karti" src="/odeme.png" alt="Odeme karti" />;\n';

    const findings = scanSource('apps/web/src/components/Card.tsx', source);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.snippet).toBe('Odeme karti');
  });

  it('sablon dizesinin metin parcalarini tarar', () => {
    const source = 'const m = (n: string) => `${n} icin fotograf yuklenemedi`;\n';

    const matches = scanSource('apps/web/src/features/photos/messages.ts', source).map(
      (finding) => finding.match,
    );

    expect(matches).toEqual(expect.arrayContaining(['icin', 'fotograf']));
  });

  it('manifest dosyasindaki katlanmis adi yakalar', () => {
    const source = '{ "name": "Emlak Teslim Tutanagi", "start_url": "/" }\n';

    const findings = scanSource('apps/web/public/manifest.webmanifest', source);

    expect(findings.map((finding) => finding.match)).toEqual(['Tutanagi']);
  });

  it('index.html metin ve aciklama alanlarindaki katlanmayi yakalar', () => {
    const source = [
      '<!doctype html>',
      '<html lang="tr">',
      '  <head>',
      '    <meta name="description" content="Tutanagi paylasmak icin uygulama" />',
      '    <title>Emlak Teslim Tutanagi</title>',
      '  </head>',
      '  <body><p>Yukleniyor</p></body>',
      '</html>',
    ].join('\n');

    const matches = scanSource('apps/web/index.html', source).map((finding) => finding.match);

    expect(matches).toEqual(expect.arrayContaining(['Tutanagi', 'icin', 'Yukleniyor']));
  });
});

describe('scanSource — yanlis pozitif yonetimi', () => {
  it('dogru yazilmis Turkce dizede bulgu uretmez', () => {
    const source =
      "const PENDING = 'Ödeme sonucu bekleniyor, abonelik henüz aktif değil';\n" +
      "const TITLE = 'Emlak Teslim Tutanağı — fotoğrafı paylaş';\n";

    expect(scanSource('apps/web/src/pages/SubscriptionPage.tsx', source)).toEqual([]);
  });

  it('Turkce harf icermeyen dogru dizeyi bulgu saymaz', () => {
    const source = "const TITLE = 'Yeni Tutanak';\n";

    expect(scanSource('apps/web/src/pages/ReportCreatePage.tsx', source)).toEqual([]);
  });

  it('ASCII yazilmis kod yorumlarini taramaz', () => {
    const source = [
      '// Odeme sonucu bekleniyor durumunda yoklama yapilir; kullanici uyarilir.',
      '/* Tutanagi paylasan kullanici icin fotograf listesi. */',
      'export const ok = true;',
    ].join('\n');

    expect(scanSource('apps/web/src/features/billing/poll.ts', source)).toEqual([]);
  });

  it('kod anahtarlarini, URL ve e-posta degerlerini disarida birakir', () => {
    const source = [
      "const CODE = 'move_in_out';",
      "const URL = 'https://ornek.test/odeme/sonuc';",
      "const MAIL = 'odeme@ornek.test';",
      "const MIME = 'image/png';",
      "const PATH = '/reports/odeme-durumu';",
      "const CONST_KEY = 'ODEME_SONUCU';",
    ].join('\n');

    expect(scanSource('apps/api/src/modules/billing/keys.ts', source)).toEqual([]);
  });

  it('yumusama nedeniyle dogru olan ekli bicimleri bulgu saymaz', () => {
    // "sonuç" + unlu ek = "sonucu" (dogru); yalnizca eksiz "sonuc" katlanmadir.
    const source = "const A = 'Ödeme sonucu bekleniyor';\nconst B = 'Islem sonuc';\n";

    const findings = scanSource('apps/web/src/features/billing/messages.ts', source);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(2);
  });

  it('log cagrilarinin govdesini taramaz', () => {
    const source = [
      "this.logger.warn('Odeme bildirimi islenmedi: referans taninmiyor.');",
      'this.logger.error(`E-posta saglayicisina ulasilamadi (to=${to})`);',
      "process.stdout.write('3 sablon seed edildi.\\n');",
    ].join('\n');

    expect(scanSource('apps/api/src/modules/billing/billing.service.ts', source)).toEqual([]);
  });

  it('ciplak Error mesajlarini taramaz ama AppError mesajlarini tarar', () => {
    const source = [
      "throw new Error('SessionProvider bulunamadi: kancalar saglayici icinde kullanilir');",
      "throw new ConflictError('REPORT_ALREADY_APPROVED', 'Onaylanmis tutanaga fotograf eklenemez');",
    ].join('\n');

    const findings = scanSource('apps/api/src/modules/photos/photos.service.ts', source);

    expect(findings.every((finding) => finding.line === 2)).toBe(true);
    expect(findings.map((finding) => finding.match)).toEqual(
      expect.arrayContaining(['tutanaga', 'fotograf']),
    );
  });

  it('gerekceli susturma isaretini uygular, gerekcesizini yok sayar', () => {
    const withReason = [
      '// ascii-tr-ok: saglayici alan sozlesmesi, urun metni degil',
      "const BUYER = { surname: 'Kullanicisi' };",
    ].join('\n');
    const withoutReason = ['// ascii-tr-ok:', "const BUYER = { surname: 'Kullanicisi' };"].join(
      '\n',
    );

    expect(scanSource('apps/api/src/infra/payment/iyzico-payment.adapter.ts', withReason)).toEqual(
      [],
    );
    expect(
      scanSource('apps/api/src/infra/payment/iyzico-payment.adapter.ts', withoutReason),
    ).toHaveLength(1);
  });

  it('import yollarini ve nesne anahtarlarini taramaz', () => {
    const source = [
      "import { x } from './odeme-karti';",
      "const map = { 'odeme_durumu': 1 };",
      'export const y = { x, map };',
    ].join('\n');

    expect(scanSource('apps/web/src/features/billing/index.ts', source)).toEqual([]);
  });
});

describe('isScannedFile — kapsam ve dislama listesi', () => {
  it('ticketta sayilan yuzeylerin tamamini kapsar', () => {
    expect(SCAN_TARGETS).toEqual(
      expect.arrayContaining([
        'apps/web/src',
        'apps/api/src',
        'apps/api/prisma/seed.ts',
        'apps/web/public/manifest.webmanifest',
        'apps/web/index.html',
      ]),
    );
  });

  it('urun kaynaklarini tarama listesine alir', () => {
    expect(isScannedFile('apps/web/src/pages/ReportListPage.tsx')).toBe(true);
    expect(isScannedFile('apps/api/src/modules/reports/reports.service.ts')).toBe(true);
    expect(isScannedFile('apps/api/prisma/seed.ts')).toBe(true);
  });

  it('test fixture ve uretilmis dosyalari disarida birakir', () => {
    expect(isScannedFile('apps/web/src/App.spec.tsx')).toBe(false);
    expect(isScannedFile('apps/api/src/modules/reports/reports.service.spec.ts')).toBe(false);
    expect(isScannedFile('apps/api/test/report-pdf.e2e-spec.ts')).toBe(false);
    expect(isScannedFile('apps/web/src/api/schema.d.ts')).toBe(false);
    expect(isScannedFile('apps/web/coverage/index.html')).toBe(false);
    expect(isScannedFile('apps/api/dist/main.ts')).toBe(false);
  });
});

describe('npm betikleri — kontrol mevcut komuta baglidir (kriter 1)', () => {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };

  it('kok `test` betigi bu kontrolu kosan jest yapilandirmasini calistirir', () => {
    expect(packageJson.scripts?.test).toContain('jest --config jest.config.mjs');
  });

  it('ayrica tek basina kosulabilen `lint:tr` betigi vardir', () => {
    expect(packageJson.scripts?.['lint:tr']).toContain('tools/ascii-folded-turkish.spec.ts');
  });
});

describe('scanRepository', () => {
  it('kasten bozulmus bir depoda her yuzeyde hata bulur', () => {
    const root = mkdtempSync(join(tmpdir(), 'h007-bozuk-'));

    try {
      writeFixture(root, 'apps/web/src/pages/SubscriptionPage.tsx', "const m = 'Odeme sonucu';\n");
      writeFixture(root, 'apps/api/src/modules/billing/messages.ts', "const m = 'henuz aktif';\n");
      writeFixture(root, 'apps/api/prisma/seed.ts', "const t = 'Cikis tutanagi sablonu';\n");
      writeFixture(root, 'apps/web/public/manifest.webmanifest', '{ "name": "Tutanagi" }\n');
      writeFixture(root, 'apps/web/index.html', '<html><title>Tutanagi</title></html>\n');
      // Dislama listesi bozuk depoda da gecerlidir: fixture dosyasi bulgu uretmez.
      writeFixture(root, 'apps/web/src/App.spec.tsx', "const m = 'Odeme sonucu';\n");

      const findings = scanRepository(root);
      const files = new Set(findings.map((finding) => finding.filePath));

      expect(files).toEqual(
        new Set([
          'apps/web/src/pages/SubscriptionPage.tsx',
          'apps/api/src/modules/billing/messages.ts',
          'apps/api/prisma/seed.ts',
          'apps/web/public/manifest.webmanifest',
          'apps/web/index.html',
        ]),
      );
      expect(formatFindings(findings)).toContain('Odeme');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('gercek urun dosyalarinin katlanmis kopyasinda hata verir (B-002/B-005 yeniden uretimi)', () => {
    // B-002 ve B-005 tam olarak boyle dogmustu: dogru Turkce metin ASCII'ye katlanmisti.
    const foldToAscii = (text: string): string =>
      text.replace(
        /[şğıçöüâîûŞĞİÇÖÜ]/g,
        (character) =>
          ({
            ş: 's',
            ğ: 'g',
            ı: 'i',
            ç: 'c',
            ö: 'o',
            ü: 'u',
            â: 'a',
            î: 'i',
            û: 'u',
            Ş: 'S',
            Ğ: 'G',
            İ: 'I',
            Ç: 'C',
            Ö: 'O',
            Ü: 'U',
          })[character] ?? character,
      );

    for (const file of [
      'apps/web/src/pages/SubscriptionPage.tsx',
      'apps/api/prisma/seed.ts',
      'apps/web/public/manifest.webmanifest',
      'apps/web/index.html',
    ]) {
      const original = readFileSync(join(REPO_ROOT, file), 'utf8');
      const folded = foldToAscii(original);

      expect(folded).not.toBe(original);
      expect(scanSource(file, folded).length).toBeGreaterThan(0);
    }
  });

  it('mevcut depoda temiz gecer', () => {
    const findings = scanRepository(REPO_ROOT);

    expect(formatFindings(findings)).toBe('');
    expect(findings).toEqual([]);
  });
});
