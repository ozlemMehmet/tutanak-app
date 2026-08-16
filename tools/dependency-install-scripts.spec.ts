// T-027 (SonarCloud, PR #27): imaj derlemesinde bagimlilik lifecycle script'leri
// (`preinstall`/`install`/`postinstall`/`prepare`) kapatilir. Ele gecirilmis bir bagimlilik
// aksi halde `docker build` sirasinda kod calistirir ve derleme makinesi/imaj tedarik
// zincirinin en zayif halkasi olur.
//
// Bu koruma birim/e2e testleriyle YAKALANAMAZ: kural Dockerfile'da yasar, uygulama
// davranisinda degil. `--ignore-scripts` sessizce dusurulurse hicbir test kirilmaz.
// Ayni sekilde onun ZORUNLU telafileri de burada kilitlenir:
//   * `bcrypt` kurulum script'i (node-gyp-build) kapatildiginda platforma uygun ikili
//     dogrulanmaz; adim acikca `npm rebuild` ile geri getirilir.
//   * `apps/api` postinstall'i (`prisma generate`) artik calismaz; uretilmemis Prisma
//     Client ile imaj derlenir ama uygulama ACILMAZ (`Cannot find module
//     '.prisma/client/default'`). Bu yuzden generate adimi acikca cagrilir.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

/**
 * Dockerfile'daki `RUN` yonergelerini, ters bolu ile devam eden satirlari TEK bir komut
 * dizesinde birlestirerek dondurur. Birlestirme sart: kurulum ve telafi adimlari tek bir
 * `RUN ... && ...` zincirinde yazilir, satir bazli tarama onlari birbirinden kopuk gorur.
 * Yorum satirlari (devam eden satirlarin arasindakiler dahil) atilir — yorumdaki bir
 * `--ignore-scripts` gecisi kanit degildir.
 */
function runInstructions(dockerfile: string): string[] {
  const instructions: string[] = [];
  let current: string[] | null = null;

  for (const rawLine of dockerfile.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('#')) continue;

    if (current === null) {
      if (!/^RUN\s/i.test(line)) continue;
      current = [line.replace(/^RUN\s+/i, '')];
    } else {
      current.push(line);
    }

    const isContinued = current[current.length - 1]?.endsWith('\\') ?? false;
    if (!isContinued) {
      instructions.push(current.join(' ').replace(/\\\s+/g, ' ').replace(/\s+/g, ' ').trim());
      current = null;
    }
  }

  if (current !== null) {
    instructions.push(current.join(' ').replace(/\\\s+/g, ' ').replace(/\s+/g, ' ').trim());
  }

  return instructions;
}

function installInstructions(...segments: string[]): string[] {
  return runInstructions(readRepoFile(...segments)).filter((instruction) =>
    /\bnpm ci\b/.test(instruction),
  );
}

const DOCKERFILES: readonly (readonly [string, string[]])[] = [
  ['apps/api/Dockerfile', ['apps', 'api', 'Dockerfile']],
  ['apps/web/Dockerfile', ['apps', 'web', 'Dockerfile']],
];

describe('imaj derlemesinde bagimlilik lifecycle script leri kapalidir', () => {
  it.each(DOCKERFILES)('%s en az bir bagimlilik kurulumu yapar', (_name, segments) => {
    expect(installInstructions(...segments).length).toBeGreaterThan(0);
  });

  it.each(DOCKERFILES)('%s icindeki her `npm ci` --ignore-scripts tasir', (_name, segments) => {
    for (const instruction of installInstructions(...segments)) {
      expect(instruction).toMatch(/npm ci[^&|]*--ignore-scripts/);
    }
  });

  it.each(DOCKERFILES)('%s karari yorumla gerekcelendirir', (_name, segments) => {
    const commentLines = readRepoFile(...segments)
      .split('\n')
      .filter((line) => line.trim().startsWith('#'));

    expect(commentLines.join('\n')).toContain('--ignore-scripts');
  });

  it('satir devami olan (\\) cok satirli RUN zinciri tek komut olarak okunur', () => {
    // Bu yardimcinin yanlis pozitif/negatif vermedigini kanitlar: yorum satirlari elenir,
    // devam eden satirlar birlestirilir.
    const fixture = [
      'FROM node:22-alpine',
      '# RUN npm ci --ignore-scripts   <- yorum kanit degildir',
      'RUN npm ci \\',
      '    && npm rebuild bcrypt',
    ].join('\n');

    expect(runInstructions(fixture)).toEqual(['npm ci && npm rebuild bcrypt']);
  });
});

describe('apps/api: kapatilan script lerin telafisi acikca ve denetlenebilir yapilir', () => {
  const apiInstall = (): string => {
    const [instruction] = installInstructions('apps', 'api', 'Dockerfile');
    return instruction ?? '';
  };

  it.each(['bcrypt', 'sharp'])(
    'native modul %s kurulum adiminda acikca yeniden derlenir',
    (moduleName) => {
      expect(apiInstall()).toMatch(new RegExp(`npm rebuild[^&|]*\\b${moduleName}\\b`));
    },
  );

  it('yeniden derleme kurulumdan SONRA gelir (ayni RUN zincirinde)', () => {
    const instruction = apiInstall();

    expect(instruction.indexOf('npm rebuild')).toBeGreaterThan(instruction.indexOf('npm ci'));
  });

  it('native modullerin yuklenebildigi imaj derlemesi sirasinda dogrulanir', () => {
    // Sessiz bozulmaya karsi tek gercek kalkan: modul yuklenemezse `docker build` patlar,
    // uygulama uretimde acilmayi denerken degil.
    const instruction = apiInstall();

    expect(instruction).toMatch(/node -e[^&|]*require\(['"]bcrypt['"]\)/);
    expect(instruction).toMatch(/node -e[^&|]*require\(['"]sharp['"]\)/);
  });

  it('artik calismayan postinstall (prisma generate) acikca cagrilir', () => {
    const instruction = apiInstall();

    expect(instruction).toMatch(/prisma:generate|prisma generate/);
    expect(instruction.search(/prisma:generate|prisma generate/)).toBeGreaterThan(
      instruction.indexOf('npm ci'),
    );
  });
});
