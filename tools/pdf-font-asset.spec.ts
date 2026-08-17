// H-001: PDF'in Turkce basmasi tek bir kod satirina degil, bir KAYNAK ZINCIRINE baglidir —
// font dosyasi depoda durmali, HER derleme yolunda (uretim `build` + yerel `start:dev` watch)
// cikti dizinine kopyalanmali ve builder standart (WinAnsi) fontlara geri dusmemelidir. Bu
// zincirin hicbir halkasi birim/e2e testiyle yakalanmaz: testler kaynak agacindan kosar,
// calisan uygulama ise `dist`'ten kosar; kopya adimi silinirse butun testler yesil kalir ve
// hata yalnizca calistirmada (ENOENT, acilis aninda) gorunur.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const REPO_ROOT = join(__dirname, '..');
const PDF_MODULE_DIR = join(REPO_ROOT, 'apps', 'api', 'src', 'modules', 'pdf');
const FONT_DIR = join(PDF_MODULE_DIR, 'fonts');

/** Gomulen font dosyalari; adlari builder ile kopyalama betiginde birebir ayni olmali. */
const FONT_FILES = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'];
const LICENSE_FILE = 'LICENSE.txt';
/** Kirpilmis/bos bir font dosyasi da "var" gorunur; en azindan gercek bir TTF olmali. */
const MIN_FONT_BYTES = 50_000;
/** TrueType dosyasinin sihirli baytlari (`0x00010000`). */
const TRUE_TYPE_MAGIC = Buffer.from([0x00, 0x01, 0x00, 0x00]);

/** `nest-cli.json`'un bu testin okudugu bolumu (Nest CLI semasinin tamami degil). */
interface NestCliConfig {
  sourceRoot?: string;
  compilerOptions?: {
    assets?: { include?: string; watchAssets?: boolean }[];
  };
}

function readRepoFile(...segments: string[]): string {
  return readFileSync(join(REPO_ROOT, ...segments), 'utf8');
}

function readApiScripts(): Record<string, string | undefined> {
  const packageJson = JSON.parse(readRepoFile('apps', 'api', 'package.json')) as {
    scripts: Record<string, string | undefined>;
  };

  return packageJson.scripts;
}

describe('H-001 PDF gomulu font varliklari', () => {
  it.each(FONT_FILES)('%s depoda, gercek bir TTF olarak bulunur', (fileName) => {
    const path = join(FONT_DIR, fileName);

    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(MIN_FONT_BYTES);
    expect(readFileSync(path).subarray(0, 4)).toEqual(TRUE_TYPE_MAGIC);
  });

  it('font lisansi font dosyalariyla birlikte depoda tasinir', () => {
    const license = readFileSync(join(FONT_DIR, LICENSE_FILE), 'utf8');

    expect(license).toContain('Bitstream Vera Fonts Copyright');
    expect(license).toContain('Permission is hereby granted, free of charge');
  });

  it('builder gomulu fontlari kullanir, standart WinAnsi fontuna DUSMEZ', () => {
    const builder = readRepoFile('apps', 'api', 'src', 'modules', 'pdf', 'report-pdf.builder.ts');
    const code = builder.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    for (const fileName of FONT_FILES) {
      expect(code).toContain(fileName);
    }
    expect(code).toContain('registerFont');
    // Helvetica/Times/Courier ailesi Turkce'ye ozgu harfleri tasimaz (H-001 kok neden).
    expect(code).not.toMatch(/'(Helvetica|Times-Roman|Courier)[^']*'/);
  });

  it('uretim derlemesi (`npm run build`) fontlari dist ciktisina kopyalar', () => {
    const copyScript = readRepoFile('apps', 'api', 'scripts', 'copy-pdf-fonts.mjs');

    expect(readApiScripts().build).toContain('scripts/copy-pdf-fonts.mjs');
    // Hedef, builder'in `__dirname/fonts` cozumlemesiyle ayni yer olmali.
    expect(copyScript).toContain("join(API_ROOT, 'dist', 'modules', 'pdf', 'fonts')");
    for (const fileName of FONT_FILES) {
      expect(copyScript).toContain(fileName);
    }
  });

  // Yerel gelistirme (docker-compose `api` servisi -> `npm run start:dev`) `npm run build`'i
  // HIC calistirmaz: Nest CLI kendi derleyicisiyle `dist`'i uretir. Bu yol varlik kopyalamayi
  // kapsamazsa font baytlari modul yuklenirken okundugu icin API ACILISTA ENOENT ile duser
  // (CLAUDE.md §10 "temiz makinede `docker compose up` calisir" kabulu kirilir).
  it('yerel watch yolu (`npm run start:dev`) fontlari dist ciktisina kopyalar', () => {
    const nestCli = JSON.parse(readRepoFile('apps', 'api', 'nest-cli.json')) as NestCliConfig;
    const sourceRoot = nestCli.sourceRoot ?? '';
    const assets = nestCli.compilerOptions?.assets ?? [];
    const fontAsset = assets.find((asset) => asset.include?.includes('modules/pdf/fonts'));

    // Watch yolu Nest CLI'den gecmezse `nest-cli.json` kurali hicbir sey yapmaz.
    expect(readApiScripts()['start:dev']).toContain('nest start');
    expect(fontAsset).toBeDefined();
    // Kaynak kok `src` olmadan varlik yolu `dist/modules/pdf/fonts` altina dusmez.
    expect(sourceRoot).toBe('src');
    // Watch sirasinda font dosyalari degisirse/`dist` tazelenirse kopya da tazelenmeli.
    expect(fontAsset?.watchAssets).toBe(true);
    // Kural gercek dizini gostermeli: yol yazim hatasi sessizce bos kopyaya donusur.
    const assetDir = join(REPO_ROOT, 'apps', 'api', sourceRoot, dirname(fontAsset?.include ?? ''));
    for (const fileName of FONT_FILES) {
      expect(existsSync(join(assetDir, fileName))).toBe(true);
    }
  });
});
