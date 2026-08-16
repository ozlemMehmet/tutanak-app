// T-026 (perf raporu P-01/P-02): fotograf hattinin iki performans kararini KILITLER.
// Ikisi de birim/e2e testleriyle yakalanamaz, cunku ikisi de kod davranisi degil
// yapilandirma/kaynak duzeni:
//  1) `UV_THREADPOOL_SIZE` uretim imajinda ACIKCA ayarli olmali. Ayar silinirse Node
//     sessizce 4 is parcacigina duser; `sharp` (ve `bcrypt`) isi kuyruklanir ve p95
//     butcesi yalnizca YUK ALTINDA, yani hicbir testte gorunmeden kirilir.
//  2) Uzun kenar siniri TEK yerde tanimli olmali. Yukleme yolu ile PDF yolu ayri birer
//     "1600" tasisaydi biri degistiginde digeri sessizce sapardi (depolanan hal ile
//     belgeye gomulen hal birbirini tutmazdi).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const API_SOURCE_ROOT = join(REPO_ROOT, 'apps', 'api', 'src');

/** Node'un libuv is-parcacigi havuzu varsayilani; ayarin amaci bunun UZERINE cikmaktir. */
const NODE_DEFAULT_THREADPOOL_SIZE = 4;
const PHOTO_MAX_EDGE_PX = 1600;

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

/** Yorum satirlarindaki degerler bir "ikinci tanim" degildir; taramadan cikarilir. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function apiSourceFiles(directory = API_SOURCE_ROOT): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return apiSourceFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

/**
 * Imajin CALISAN katmanindaki ortam degiskenleri. Yalnizca SON `FROM`'dan sonraki `ENV`
 * satirlari sayilir: cok asamali bir Dockerfile'da derleme asamasina yazilan `ENV` nihai
 * imaja TASINMAZ, yani `docker exec ... printenv` bos doner. Bu ayrim bugun tek asamali
 * olan dosyada gorunmez ama devops'un cok asamali imaji devreye girdiginde ayarin sessizce
 * kaybolmasini engeller.
 */
function finalStageEnvironment(dockerfile: string): Record<string, string> {
  let entries: Record<string, string> = {};
  for (const line of dockerfile.split('\n')) {
    const trimmed = line.trim();
    if (/^FROM\s/i.test(trimmed)) {
      // Yeni asama basladi: onceki asamanin ortami nihai imaja gecmez.
      entries = {};
      continue;
    }
    const match = /^ENV\s+([A-Z_][A-Z0-9_]*)=(\S+)/.exec(trimmed);
    const key = match?.[1];
    if (key !== undefined) {
      entries[key] = match?.[2] ?? '';
    }
  }
  return entries;
}

function dockerfileEnvironment(...segments: string[]): Record<string, string> {
  return finalStageEnvironment(readRepoFile(...segments));
}

describe('uretim imajinda is-parcacigi havuzu (apps/api/Dockerfile)', () => {
  it('UV_THREADPOOL_SIZE imajda ENV olarak tanimlidir (printenv bos donmez)', () => {
    const environment = dockerfileEnvironment('apps', 'api', 'Dockerfile');

    expect(Object.keys(environment)).toContain('UV_THREADPOOL_SIZE');
    expect(environment.UV_THREADPOOL_SIZE).not.toBe('');
  });

  it('deger pozitif tam sayidir ve Node varsayilanindan buyuktur', () => {
    const value = Number(dockerfileEnvironment('apps', 'api', 'Dockerfile').UV_THREADPOOL_SIZE);

    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThan(NODE_DEFAULT_THREADPOOL_SIZE);
  });

  it('yalnizca derleme asamasina yazilan ENV kabul EDILMEZ (nihai imajda gorunmez)', () => {
    const cokAsamali = [
      'FROM node:22-alpine AS builder',
      'ENV UV_THREADPOOL_SIZE=8',
      'RUN npm ci',
      'FROM node:22-alpine AS runtime',
      'CMD ["node", "dist/main.js"]',
    ].join('\n');

    expect(Object.keys(finalStageEnvironment(cokAsamali))).not.toContain('UV_THREADPOOL_SIZE');
    expect(
      finalStageEnvironment(`${cokAsamali}\nENV UV_THREADPOOL_SIZE=8`).UV_THREADPOOL_SIZE,
    ).toBe('8');
  });

  it('deger koda degil imaja yazilir (uygulama kaynagi UV_THREADPOOL_SIZE atamaz)', () => {
    const atayanDosyalar = apiSourceFiles().filter((file) =>
      /UV_THREADPOOL_SIZE\s*(=|\])/.test(stripComments(readFileSync(file, 'utf8'))),
    );

    expect(atayanDosyalar).toEqual([]);
  });
});

describe('fotograf uzun kenar siniri tek kaynaktan gelir', () => {
  it('sinir degeri uygulama kaynaginda YALNIZCA bir kez tanimlanir', () => {
    const tanimlayanDosyalar = apiSourceFiles().filter((file) =>
      new RegExp(`=\\s*${String(PHOTO_MAX_EDGE_PX)}\\b`).test(readFileSync(file, 'utf8')),
    );

    expect(tanimlayanDosyalar).toHaveLength(1);
    expect(tanimlayanDosyalar[0]).toContain(join('modules', 'photos', 'photo-image.processor.ts'));
  });

  it('PDF yolu sinirin kendi kopyasini tutmaz, yukleme yolundan alir', () => {
    const pdfProcessor = readRepoFile(
      'apps',
      'api',
      'src',
      'modules',
      'pdf',
      'pdf-photo.processor.ts',
    );

    expect(pdfProcessor).toMatch(
      /import \{ PHOTO_MAX_EDGE_PX \} from '\.\.\/photos\/photo-image\.processor'/,
    );
    expect(stripComments(pdfProcessor)).not.toContain(String(PHOTO_MAX_EDGE_PX));
  });
});
