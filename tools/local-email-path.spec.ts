// T-023: yerel e-posta yolunun TEK anlatimi. Karar (b) uygulandi — `mailpit` compose'tan
// kaldirildi, cunku e-posta siniri Resend'in HTTPS API istemcisidir (SMTP degil) ve saglayici
// secimi icin §5.1 tablosunda anahtar yoktur (dev anahtar UYDURMAZ). Bu testler, servisin
// "yerelde e-posta yakalanir" yanilsamasiyla geri sizmasini ve README'nin dogru anlatimi
// kaybetmesini engeller.
// Compose metin olarak degil, YAML olarak COZULEREK dogrulanir (yorum satirlari yanlis
// pozitif uretmesin diye — T-001/T-002'de kurulan kalip).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const REPO_ROOT = join(__dirname, '..');

interface ComposeService {
  image?: string;
  ports?: (string | number)[];
}

interface ComposeFile {
  services?: Record<string, ComposeService>;
}

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

function readCompose(): ComposeFile {
  return parse(readRepoFile('docker-compose.yml')) as ComposeFile;
}

/** Tum servislerin yayinladigi host portlari (`'8025:8025'` -> `8025`). */
function publishedHostPorts(): string[] {
  return Object.values(readCompose().services ?? {}).flatMap((service) =>
    (service.ports ?? []).map((port) => String(port).split(':')[0] ?? ''),
  );
}

describe('docker-compose.yml yerel e-posta servisi', () => {
  it('mailpit servisi tanimlamaz', () => {
    const services = readCompose().services ?? {};

    expect(Object.keys(services)).not.toContain('mailpit');
  });

  it('hicbir servis mailpit imajini kullanmaz', () => {
    const images = Object.values(readCompose().services ?? {}).map(
      (service) => service.image ?? '',
    );

    expect(images.some((image) => image.includes('mailpit'))).toBe(false);
  });

  it('SMTP (1025) ve mailpit arayuz (8025) portlarini yayinlamaz', () => {
    const hostPorts = publishedHostPorts();

    expect(hostPorts).not.toContain('1025');
    expect(hostPorts).not.toContain('8025');
  });

  it('yerel akis icin gereken diger servisleri korur', () => {
    // Kaldirma islemi komsu servisleri de silmis olmasin diye (regresyon korkulugu).
    const services = readCompose().services ?? {};

    expect(Object.keys(services)).toEqual(
      expect.arrayContaining(['db', 'minio', 'minio-init', 'api', 'web']),
    );
  });
});

describe('README yerel e-posta anlatimi', () => {
  it('servis listesinde mailpit/8025 gecmez', () => {
    const readme = readRepoFile('README.md');

    expect(readme).not.toMatch(/mailpit/i);
    expect(readme).not.toContain('8025');
  });

  it('yerelde e-posta gonderilmedigini ve failed durumunun beklendigini belgeler', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toContain('RESEND_API_KEY');
    expect(readme).toMatch(/e-posta GONDERILMEZ/i);
    expect(readme).toContain('status: "failed"');
  });

  it('paylasim linkinin e-postadan bagimsiz uretildigini belirtir', () => {
    const readme = readRepoFile('README.md');

    expect(readme).toMatch(/paylasim linki/i);
  });
});

describe('.env.example dis hesapsiz kosum sozlesmesi (CLAUDE.md §10)', () => {
  it('RESEND_API_KEY bos deger ile gelir — uygulama anahtarsiz da acilir', () => {
    const lines = readRepoFile('.env.example')
      .split('\n')
      .map((line) => line.trim());

    expect(lines).toContain('RESEND_API_KEY=');
  });
});
