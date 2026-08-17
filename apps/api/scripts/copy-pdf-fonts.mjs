// PDF'e gomulen font dosyalarini derleme ciktisina tasir (H-001). `tsc` yalnizca .ts
// dosyalarini uretir; uretim imaji ise SADECE `apps/api/dist`'i kopyalar (apps/api/
// Dockerfile, runtime asamasi). Bu adim olmadan font `dist` icinde bulunmaz ve PDF
// uretimi uretimde ENOENT ile duser — hata yalnizca calisma zamaninda gorunurdu.
// Yerel gelistirme yolu (`npm run start:dev` -> `nest start --watch`) bu betigi CALISTIRMAZ;
// oradaki karsiligi `apps/api/nest-cli.json` icindeki `compilerOptions.assets` kuralidir.
// Iki yol da ayni kaynak/hedef ciftini kullanir; biri degisirse digeri de guncellenmelidir
// (ikisi de `tools/pdf-font-asset.spec.ts` ile kilitlidir).
import { cpSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(API_ROOT, 'src', 'modules', 'pdf', 'fonts');
const TARGET_DIR = join(API_ROOT, 'dist', 'modules', 'pdf', 'fonts');
/** Kopyanin gercekten ise yaradigini kanitlayan dosyalar (yalnizca dizin varligi yetmez). */
const REQUIRED_FILES = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'LICENSE.txt'];

if (!existsSync(SOURCE_DIR)) {
  process.stderr.write(`PDF font kaynagi bulunamadi: ${SOURCE_DIR}\n`);
  process.exit(1);
}

cpSync(SOURCE_DIR, TARGET_DIR, { recursive: true });

const copied = new Set(readdirSync(TARGET_DIR));
const missing = REQUIRED_FILES.filter((name) => !copied.has(name));

if (missing.length > 0) {
  process.stderr.write(`Derleme ciktisina kopyalanmayan font dosyalari: ${missing.join(', ')}\n`);
  process.exit(1);
}
