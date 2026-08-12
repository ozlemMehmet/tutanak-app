import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..', '..');
const MANIFEST_PATH = join(WEB_ROOT, 'public', 'manifest.webmanifest');
const INDEX_HTML_PATH = join(WEB_ROOT, 'index.html');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface WebAppManifest {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  icons?: ManifestIcon[];
}

function readManifest(): WebAppManifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as WebAppManifest;
}

describe('PWA manifest', () => {
  it('gecerli JSON olarak ayristirilir', () => {
    expect(() => readManifest()).not.toThrow();
  });

  it('name ve short_name alanlari dolu gelir', () => {
    const manifest = readManifest();

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
  });

  it('start_url uygulama kokunu gosterir', () => {
    expect(readManifest().start_url).toBe('/');
  });

  it('display alani standalone olur', () => {
    expect(readManifest().display).toBe('standalone');
  });

  it('192 ve 512 piksel ikonlari tanimlar ve dosyalari diskte bulunur', () => {
    const icons = readManifest().icons ?? [];

    expect(icons.length).toBeGreaterThan(0);
    for (const size of ['192x192', '512x512']) {
      const icon = icons.find((candidate) => candidate.sizes === size);
      expect(icon).toBeDefined();
      expect(icon?.type).toBe('image/png');
      expect(existsSync(join(WEB_ROOT, 'public', icon?.src.replace(/^\//, '') ?? ''))).toBe(true);
    }
  });

  it('kurulabilirlik icin en az bir maskable ikon icerir', () => {
    const icons = readManifest().icons ?? [];

    expect(icons.some((icon) => icon.purpose?.includes('maskable'))).toBe(true);
  });
});

describe('index.html', () => {
  it('manifest dosyasini link etiketi ile baglar', () => {
    const html = readFileSync(INDEX_HTML_PATH, 'utf8');

    expect(html).toMatch(/<link[^>]+rel="manifest"[^>]+href="\/manifest\.webmanifest"/);
  });
});
