// Build ciktisinin PWA kabul kriterlerini karsiladigini dogrular (T-001 kriter 3 ve 4).
// CI'da `npm run build` sonrasinda calisir; eksik cikti varsa surec kirmizi olur.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = join(REPO_ROOT, 'apps', 'web', 'dist');
const SERVICE_WORKER_URL = '/sw.js';

const failures = [];

function check(description, condition) {
  if (!condition) {
    failures.push(description);
  }
}

if (!existsSync(DIST_DIR)) {
  process.stderr.write(`Build ciktisi bulunamadi: ${DIST_DIR}. Once 'npm run build' calistirin.\n`);
  process.exit(1);
}

check('dist/index.html uretilmemis', existsSync(join(DIST_DIR, 'index.html')));
check('dist/sw.js uretilmemis (service worker)', existsSync(join(DIST_DIR, 'sw.js')));
check(
  'dist/manifest.webmanifest kopyalanmamis',
  existsSync(join(DIST_DIR, 'manifest.webmanifest')),
);

if (failures.length === 0) {
  const html = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  check(
    'index.html manifest dosyasini baglamiyor',
    /<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/.test(html),
  );

  const manifest = JSON.parse(readFileSync(join(DIST_DIR, 'manifest.webmanifest'), 'utf8'));
  check('manifest display alani standalone degil', manifest.display === 'standalone');
  check('manifest start_url alani bos', Boolean(manifest.start_url));
  check('manifest name alani bos', Boolean(manifest.name));
  check('manifest ikon tanimlamiyor', Array.isArray(manifest.icons) && manifest.icons.length > 0);

  for (const icon of manifest.icons ?? []) {
    check(
      `manifest ikonu dist icinde yok: ${icon.src}`,
      existsSync(join(DIST_DIR, icon.src.replace(/^\//, ''))),
    );
  }

  const serviceWorker = readFileSync(join(DIST_DIR, 'sw.js'), 'utf8');
  check('service worker precache manifesti bos', serviceWorker.includes('precacheAndRoute'));

  const assetsDir = join(DIST_DIR, 'assets');
  const bundles = existsSync(assetsDir)
    ? readdirSync(assetsDir).filter((file) => file.endsWith('.js'))
    : [];
  check(
    'uygulama paketi service worker kaydini icermiyor',
    bundles.some((file) =>
      readFileSync(join(assetsDir, file), 'utf8').includes(SERVICE_WORKER_URL),
    ),
  );
}

if (failures.length > 0) {
  process.stderr.write(`PWA build dogrulamasi basarisiz:\n- ${failures.join('\n- ')}\n`);
  process.exit(1);
}

process.stdout.write(
  'PWA build dogrulamasi gecti: manifest + service worker + kayit kodu mevcut.\n',
);
